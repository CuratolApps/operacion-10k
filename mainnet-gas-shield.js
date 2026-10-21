/**
 * mainnet-gas-shield.js - Operación 10k
 * ---------------------------------------------------------------------------
 * Escudo de GAS REAL en Mainnet (BNB Smart Chain y Polygon PoS).
 *
 *  1) Cabeceras (#001, #101, #201, #301, #401), Bóveda #501 y VIP #00 quedan RESERVADAS
 *     como tanques nodriza: jamás participan en rutinas de gasto repetitivo.
 *  2) Umbral mínimo de ejecución por red (para operar con satélites de ~0.00014 BNB).
 *  3) COOLDOWN POR SATÉLITE Y POR RED: cada satélite ejecuta como MÁXIMO 1 transacción
 *     con costo de gas cada 24 h (ventana móvil), compartido por TODAS las rutinas
 *     (task-runner, bot-miner, bounty-radar, gamefi). Tope de 5 satélites por ronda y red.
 *  4) Las lecturas (harvest --scan, onchain-snapshot) NO pasan por aquí: $0 gas.
 *  5) Testnets (Sepolia, Base/Arbitrum/OP Sepolia, Solana Devnet): sin restricción.
 *
 * Persistencia: el runner de GitHub Actions es efímero, por eso el estado vive en
 * telemetry/mainnet-cooldowns.json (último timestamp por satélite y red) y el workflow
 * lo commitea junto a la telemetría. Sin claves privadas ni valores de .env.
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { fetchEthBalancesBatch } = require("./networks");

const HEADER_INDEXES = [1, 101, 201, 301, 401];
const VAULT_INDEX = 501;
const VIP_INDEX = 0;
const PROTECTED_INDEXES = new Set([VIP_INDEX, ...HEADER_INDEXES, VAULT_INDEX]);

// Mínimo de saldo nativo para que un satélite ejecute en cada Mainnet (BNB / POL).
const MAINNET_MIN_EXEC = {
  bscMainnet: 0.00008,
  polygonMainnet: 0.005
};

const MAX_MAINNET_SATS_PER_ROUND = 5;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_FILE = path.join(__dirname, "telemetry", "mainnet-cooldowns.json");

function isMainnetKey(networkKey) {
  return Object.prototype.hasOwnProperty.call(MAINNET_MIN_EXEC, networkKey);
}

function isProtectedIndex(index) {
  return PROTECTED_INDEXES.has(Number(index));
}

/** Mínimo por red; si la red no es Mainnet protegida devuelve el fallback. */
function getMinExec(networkKey, fallback) {
  return isMainnetKey(networkKey) ? MAINNET_MIN_EXEC[networkKey] : fallback;
}

function readState() {
  try {
    if (fs.existsSync(COOLDOWN_FILE)) {
      const data = JSON.parse(fs.readFileSync(COOLDOWN_FILE, "utf8"));
      if (data && typeof data === "object") return data;
    }
  } catch (_) {}
  return {};
}

function writeState(state) {
  try {
    fs.mkdirSync(path.dirname(COOLDOWN_FILE), { recursive: true });
    fs.writeFileSync(COOLDOWN_FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
    return true;
  } catch (err) {
    console.warn(`⚠️ [GAS-SHIELD] No se pudo persistir el cooldown: ${err.message}`);
    return false;
  }
}

/** Timestamp (ms) del último tx con gas de un satélite en una red, o 0 si nunca. */
function lastTxMs(state, networkKey, index) {
  const entry = state?.[networkKey]?.[String(index)];
  const t = entry && entry.lastTxAt ? Date.parse(entry.lastTxAt) : 0;
  return Number.isFinite(t) ? t : 0;
}

/** true si el satélite ya cumplió sus 24 h desde el último tx con gas en esa red. */
function isSatelliteReady(networkKey, index, now = Date.now(), state = readState()) {
  return now - lastTxMs(state, networkKey, index) >= COOLDOWN_MS;
}

/**
 * Registra el uso de gas de los satélites ANTES de enviar (si el proceso muere a mitad,
 * no se repite el gasto). Persiste inmediatamente.
 */
function claimSatellites(networkKey, indexes, routine, now = Date.now()) {
  const state = readState();
  if (!state[networkKey]) state[networkKey] = {};
  for (const i of indexes) {
    state[networkKey][String(i)] = { lastTxAt: new Date(now).toISOString(), routine };
  }
  return writeState(state);
}

/**
 * Selecciona hasta `max` satélites FONDEADOS (>= mínimo de la red) que no estén en
 * cooldown, excluyendo cabeceras, VIP y bóveda. Prioriza a los que llevan más tiempo
 * sin gastar gas. Lectura en lote (0 gas).
 * @returns {Promise<{squad:Array, fundedCount:number, eligibleCount:number, cooldownCount:number, minExec:number}>}
 */
async function selectFundedSatellites({ provider, satellites, networkKey, max = MAX_MAINNET_SATS_PER_ROUND }) {
  const minExec = getMinExec(networkKey, 0.0005);
  const candidates = satellites.filter((s) => s.index >= 1 && s.index <= 500 && !isProtectedIndex(s.index));
  const balances = await fetchEthBalancesBatch(provider, candidates.map((s) => s.address));
  const minWei = ethers.parseEther(String(minExec));
  const funded = candidates.filter((s) => (balances[s.address.toLowerCase()] ?? 0n) >= minWei);

  const state = readState();
  const now = Date.now();
  const eligible = funded
    .filter((s) => now - lastTxMs(state, networkKey, s.index) >= COOLDOWN_MS)
    .sort((a, b) => lastTxMs(state, networkKey, a.index) - lastTxMs(state, networkKey, b.index) || a.index - b.index);

  const size = Math.min(max, MAX_MAINNET_SATS_PER_ROUND, eligible.length);
  return {
    squad: eligible.slice(0, size),
    fundedCount: funded.length,
    eligibleCount: eligible.length,
    cooldownCount: funded.length - eligible.length,
    minExec
  };
}

/**
 * Resumen del cooldown por red para Telegram / Dashboard (solo lectura del archivo).
 * `trackedInCooldown` = satélites con gas gastado en las últimas 24 h.
 */
function getCooldownSummary(now = Date.now()) {
  const state = readState();
  const out = {};
  for (const key of Object.keys(MAINNET_MIN_EXEC)) {
    const entries = Object.entries(state[key] || {});
    let inCooldown = 0;
    let nextReadyMs = null;
    let lastTxAt = null;
    for (const [, e] of entries) {
      const t = e && e.lastTxAt ? Date.parse(e.lastTxAt) : 0;
      if (!t) continue;
      if (!lastTxAt || t > Date.parse(lastTxAt)) lastTxAt = new Date(t).toISOString();
      const ready = t + COOLDOWN_MS;
      if (ready > now) {
        inCooldown++;
        if (nextReadyMs === null || ready < nextReadyMs) nextReadyMs = ready;
      }
    }
    out[key] = {
      minExecNative: MAINNET_MIN_EXEC[key],
      trackedSatellites: entries.length,
      inCooldown,
      nextReadyAt: nextReadyMs ? new Date(nextReadyMs).toISOString() : null,
      lastTxAt
    };
  }
  return { cooldownHours: 24, maxSatsPerRound: MAX_MAINNET_SATS_PER_ROUND, networks: out };
}

module.exports = {
  HEADER_INDEXES,
  VAULT_INDEX,
  VIP_INDEX,
  PROTECTED_INDEXES,
  MAINNET_MIN_EXEC,
  MAX_MAINNET_SATS_PER_ROUND,
  COOLDOWN_MS,
  COOLDOWN_FILE,
  isMainnetKey,
  isProtectedIndex,
  getMinExec,
  isSatelliteReady,
  claimSatellites,
  selectFundedSatellites,
  getCooldownSummary
};
