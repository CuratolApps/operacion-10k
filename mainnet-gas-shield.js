/**
 * mainnet-gas-shield.js - Operación 10k
 * ---------------------------------------------------------------------------
 * Escudo de GAS REAL en Mainnet (BNB Smart Chain y Polygon PoS).
 *
 *  1) Cabeceras (#001, #101, #201, #301, #401) y Bóveda #501 quedan RESERVADAS
 *     como tanques nodriza: jamás participan en rutinas de gasto repetitivo.
 *  2) Umbral mínimo de ejecución por red (para operar con satélites de ~0.00014 BNB).
 *  3) Modo Ahorro: las rutinas de relleno con gas real (WBNB/WPOL, checkIn, bounty)
 *     corren como MÁXIMO 1 vez por día UTC, por rutina y por red, con un tope de
 *     5 satélites por ronda. Las lecturas (scan, snapshot) NO pasan por aquí: $0 gas.
 *  4) Testnets (Sepolia, Base/Arbitrum/OP Sepolia, Solana Devnet): sin restricción.
 *
 * Persistencia: el runner de GitHub Actions es efímero, por eso el estado vive en
 * telemetry/mainnet-cooldown.json y el workflow lo commitea junto a la telemetría.
 * Sin claves privadas ni valores de .env.
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { fetchEthBalancesBatch } = require("./networks");

const HEADER_INDEXES = [1, 101, 201, 301, 401];
const VAULT_INDEX = 501;
const PROTECTED_INDEXES = new Set([...HEADER_INDEXES, VAULT_INDEX]);

// Mínimo de saldo nativo para que un satélite ejecute en cada Mainnet (BNB / POL).
const MAINNET_MIN_EXEC = {
  bscMainnet: 0.00008,
  polygonMainnet: 0.005
};

const MAX_MAINNET_SATS_PER_ROUND = 5;
const COOLDOWN_FILE = path.join(__dirname, "telemetry", "mainnet-cooldown.json");

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

function utcDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
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

/** true si la rutina aún NO consumió su turno del día UTC en esa red. */
function isCooldownFree(routine, networkKey) {
  const entry = readState()?.[routine]?.[networkKey];
  return !(entry && entry.lastUtcDay === utcDay());
}

/**
 * Consume el turno diario ANTES de enviar transacciones (si el proceso muere a mitad,
 * no se repite el gasto). Devuelve false si el turno ya estaba consumido.
 */
function claimDailySlot(routine, networkKey, meta = {}) {
  const state = readState();
  const today = utcDay();
  if (state?.[routine]?.[networkKey]?.lastUtcDay === today) return false;
  if (!state[routine]) state[routine] = {};
  state[routine][networkKey] = { lastUtcDay: today, claimedAt: new Date().toISOString(), ...meta };
  return writeState(state);
}

/**
 * Selecciona hasta `max` satélites FONDEADOS (>= mínimo de la red), excluyendo cabeceras
 * y bóveda, rotando por día UTC para repartir el desgaste. Lectura en lote (0 gas).
 * @returns {Promise<{squad:Array, fundedCount:number, minExec:number}>}
 */
async function selectFundedSatellites({ provider, satellites, networkKey, max = MAX_MAINNET_SATS_PER_ROUND }) {
  const minExec = getMinExec(networkKey, 0.0005);
  const candidates = satellites.filter((s) => s.index >= 1 && s.index <= 500 && !isProtectedIndex(s.index));
  const balances = await fetchEthBalancesBatch(provider, candidates.map((s) => s.address));
  const minWei = ethers.parseEther(String(minExec));
  const funded = candidates
    .filter((s) => (balances[s.address.toLowerCase()] ?? 0n) >= minWei)
    .sort((a, b) => a.index - b.index);

  const size = Math.min(max, MAX_MAINNET_SATS_PER_ROUND, funded.length);
  const dayNumber = Math.floor(Date.now() / 86400000);
  const start = funded.length ? (dayNumber * size) % funded.length : 0;
  const squad = [];
  for (let i = 0; i < size; i++) squad.push(funded[(start + i) % funded.length]);
  return { squad, fundedCount: funded.length, minExec };
}

module.exports = {
  HEADER_INDEXES,
  VAULT_INDEX,
  PROTECTED_INDEXES,
  MAINNET_MIN_EXEC,
  MAX_MAINNET_SATS_PER_ROUND,
  COOLDOWN_FILE,
  isMainnetKey,
  isProtectedIndex,
  getMinExec,
  utcDay,
  isCooldownFree,
  claimDailySlot,
  selectFundedSatellites
};
