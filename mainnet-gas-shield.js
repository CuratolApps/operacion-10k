/**
 * mainnet-gas-shield.js - Operación 10k
 * ---------------------------------------------------------------------------
 * Escudo de GAS REAL en Mainnet (BNB Smart Chain y Polygon PoS).
 *
 *  1) Cabeceras (#001, #101, #201, #301, #401), Bóveda #501 y VIP #00 quedan RESERVADAS
 *     como tanques nodriza: jamás participan en rutinas de gasto repetitivo.
 *  2) Umbral mínimo de ejecución por red (para operar con satélites de ~0.00014 BNB).
 *  3) COOLDOWN POR SATÉLITE Y POR RED (ventana móvil), dos clases:
 *       - MANTENIMIENTO (task-runner, bot-miner, bounty-radar): 168 h (7 días) → máx. 1 tx
 *         con gas por satélite y semana, compartido por todas esas rutinas.
 *       - CAMPAÑA (gamefi, solo contratos habilitados a mano en gamefi-targets.json): 24 h,
 *         con reloj PROPIO para que el mantenimiento no consuma el gas reservado a campañas.
 *     Tope de 5 satélites por ronda y red.
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
const MAINTENANCE_COOLDOWN_HOURS = 168;
const CAMPAIGN_COOLDOWN_HOURS = 24;
const MAINTENANCE_COOLDOWN_MS = MAINTENANCE_COOLDOWN_HOURS * 60 * 60 * 1000;
const CAMPAIGN_COOLDOWN_MS = CAMPAIGN_COOLDOWN_HOURS * 60 * 60 * 1000;
// Alias histórico: el cooldown "por defecto" es el de mantenimiento.
const COOLDOWN_MS = MAINTENANCE_COOLDOWN_MS;
// Rutinas cuyo gasto cuenta contra el reloj de CAMPAÑA (además del de mantenimiento).
const CAMPAIGN_ROUTINES = new Set(["gamefi"]);
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

function cooldownMsOf(kind) {
  return kind === "campaign" ? CAMPAIGN_COOLDOWN_MS : MAINTENANCE_COOLDOWN_MS;
}

/**
 * Timestamp (ms) del último tx con gas de un satélite en una red, o 0 si nunca.
 * kind="maintenance" (defecto): cuenta CUALQUIER tx con gas (reloj de 168 h).
 * kind="campaign": solo cuenta tx de rutinas de campaña (reloj de 24 h).
 */
function lastTxMs(state, networkKey, index, kind = "maintenance") {
  const entry = state?.[networkKey]?.[String(index)];
  if (!entry) return 0;
  let iso = entry.lastTxAt;
  if (kind === "campaign") {
    // Compatibilidad con entradas antiguas: routine==="gamefi" sin lastCampaignAt.
    iso = entry.lastCampaignAt || (CAMPAIGN_ROUTINES.has(entry.routine) ? entry.lastTxAt : null);
  }
  const t = iso ? Date.parse(iso) : 0;
  return Number.isFinite(t) ? t : 0;
}

/** true si el satélite ya cumplió su cooldown (168 h mantenimiento / 24 h campaña) en esa red. */
function isSatelliteReady(networkKey, index, now = Date.now(), state = readState(), kind = "maintenance") {
  return now - lastTxMs(state, networkKey, index, kind) >= cooldownMsOf(kind);
}

/**
 * Registra el uso de gas de los satélites ANTES de enviar (si el proceso muere a mitad,
 * no se repite el gasto). Persiste inmediatamente. Toda tx con gas actualiza el reloj de
 * mantenimiento; las rutinas de campaña además actualizan el reloj de campaña.
 */
function claimSatellites(networkKey, indexes, routine, now = Date.now()) {
  const state = readState();
  if (!state[networkKey]) state[networkKey] = {};
  const iso = new Date(now).toISOString();
  for (const i of indexes) {
    const prev = state[networkKey][String(i)] || {};
    const entry = { lastTxAt: iso, routine };
    if (CAMPAIGN_ROUTINES.has(routine)) {
      entry.lastCampaignAt = iso;
    } else {
      const prevCampaign = prev.lastCampaignAt || (CAMPAIGN_ROUTINES.has(prev.routine) ? prev.lastTxAt : null);
      if (prevCampaign) entry.lastCampaignAt = prevCampaign;
    }
    state[networkKey][String(i)] = entry;
  }
  return writeState(state);
}

/**
 * Selecciona hasta `max` satélites FONDEADOS (>= mínimo de la red) que no estén en
 * cooldown, excluyendo cabeceras, VIP y bóveda. Prioriza a los que llevan más tiempo
 * sin gastar gas. Lectura en lote (0 gas).
 * `kind`: "maintenance" (168 h, defecto) o "campaign" (24 h, solo gamefi).
 * @returns {Promise<{squad:Array, fundedCount:number, eligibleCount:number, cooldownCount:number, minExec:number}>}
 */
async function selectFundedSatellites({ provider, satellites, networkKey, max = MAX_MAINNET_SATS_PER_ROUND, kind = "maintenance" }) {
  const minExec = getMinExec(networkKey, 0.0005);
  const candidates = satellites.filter((s) => s.index >= 1 && s.index <= 500 && !isProtectedIndex(s.index));
  const balances = await fetchEthBalancesBatch(provider, candidates.map((s) => s.address));
  const minWei = ethers.parseEther(String(minExec));
  const funded = candidates.filter((s) => (balances[s.address.toLowerCase()] ?? 0n) >= minWei);

  const state = readState();
  const now = Date.now();
  const cdMs = cooldownMsOf(kind);
  // Los relojes de mantenimiento y de campaña son independientes a propósito: el mantenimiento
  // semanal no bloquea el gas reservado a campañas con recompensa real.
  const eligible = funded
    .filter((s) => now - lastTxMs(state, networkKey, s.index, kind) >= cdMs)
    .sort((a, b) => lastTxMs(state, networkKey, a.index, kind) - lastTxMs(state, networkKey, b.index, kind) || a.index - b.index);

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
 * `inCooldown` = satélites con gas gastado dentro de la ventana de MANTENIMIENTO (168 h);
 * `campaignInCooldown` = satélites con tx de campaña dentro de la ventana de 24 h.
 */
function getCooldownSummary(now = Date.now()) {
  const state = readState();
  const out = {};
  for (const key of Object.keys(MAINNET_MIN_EXEC)) {
    const entries = Object.entries(state[key] || {});
    let inCooldown = 0;
    let nextReadyMs = null;
    let lastTxAt = null;
    let campaignInCooldown = 0;
    let campaignNextReadyMs = null;
    for (const [idx] of entries) {
      const t = lastTxMs(state, key, idx, "maintenance");
      if (t) {
        if (!lastTxAt || t > Date.parse(lastTxAt)) lastTxAt = new Date(t).toISOString();
        const ready = t + MAINTENANCE_COOLDOWN_MS;
        if (ready > now) {
          inCooldown++;
          if (nextReadyMs === null || ready < nextReadyMs) nextReadyMs = ready;
        }
      }
      const c = lastTxMs(state, key, idx, "campaign");
      if (c) {
        const readyC = c + CAMPAIGN_COOLDOWN_MS;
        if (readyC > now) {
          campaignInCooldown++;
          if (campaignNextReadyMs === null || readyC < campaignNextReadyMs) campaignNextReadyMs = readyC;
        }
      }
    }
    out[key] = {
      minExecNative: MAINNET_MIN_EXEC[key],
      trackedSatellites: entries.length,
      inCooldown,
      nextReadyAt: nextReadyMs ? new Date(nextReadyMs).toISOString() : null,
      lastTxAt,
      campaignInCooldown,
      campaignNextReadyAt: campaignNextReadyMs ? new Date(campaignNextReadyMs).toISOString() : null
    };
  }
  return {
    cooldownHours: MAINTENANCE_COOLDOWN_HOURS,
    campaignCooldownHours: CAMPAIGN_COOLDOWN_HOURS,
    maxSatsPerRound: MAX_MAINNET_SATS_PER_ROUND,
    networks: out
  };
}

module.exports = {
  HEADER_INDEXES,
  VAULT_INDEX,
  VIP_INDEX,
  PROTECTED_INDEXES,
  MAINNET_MIN_EXEC,
  MAX_MAINNET_SATS_PER_ROUND,
  MAINTENANCE_COOLDOWN_HOURS,
  CAMPAIGN_COOLDOWN_HOURS,
  MAINTENANCE_COOLDOWN_MS,
  CAMPAIGN_COOLDOWN_MS,
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
