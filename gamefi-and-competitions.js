/**
 * gamefi-and-competitions.js - Operación 10k
 * ---------------------------------------------------------------------------
 * Motor GameFi + Radar de Competencias/Bounties (cero datos simulados).
 *
 *  A) INTERACCIÓN ON-CHAIN VERIFICADA (Polygon 137 y BSC 56)
 *     Antes de enviar nada, cada objetivo pasa por 4 verificaciones reales:
 *       1. provider.getCode(address) !== "0x"        (hay bytecode desplegado)
 *       2. el selector de la función aparece en el bytecode (no se llama a ciegas)
 *       3. provider.estimateGas(...) no revierte      (simulación gratuita)
 *       4. coste de gas estimado < GAS_CAP_USD ($0.002) con precio de mercado real
 *          (si no hay precio, tope nativo conservador; se reporta la fuente)
 *     Solo satélites fondeados, NO reservados (sin cabeceras/VIP/#501) y fuera de su
 *     cooldown de 24 h (mainnet-gas-shield) ejecutan; máx. 5 por red y ronda.
 *     Solo se registra como confirmado un hash con receipt.status === 1.
 *
 *  B) ESCÁNER EN VIVO DE COMPETENCIAS / QUESTS / BOUNTIES
 *     Fuentes públicas sin API key: Galxe (GraphQL público, BSC y Polygon),
 *     Superteam Earn (listings abiertos) e Immunefi (bounties públicos).
 *     Filtro: recompensas en USDC, POL/MATIC o BNB. Si una fuente da timeout o exige
 *     clave, se reporta su estado real; NUNCA se inventan campañas.
 *
 *  Salidas: telemetry/competitions-live.json y fleet-telemetry.json → gamefiAndCompetitions.
 *
 *  Uso: node gamefi-and-competitions.js [--dry-run] [--scan-only]
 *  Objetivos extra verificados: gamefi-targets.json (opcional, ver GAMEFI_EXTRA_FILE).
 *  Sin claves privadas ni valores de .env en logs.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { networks, createResilientProvider } = require("./networks");
const { getWalletSigner } = require("./swarm-engine");
const { sleepRandom } = require("./anti-sybil");
const shield = require("./mainnet-gas-shield");

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");
const FLEET_TELEMETRY_FILE = path.join(__dirname, "telemetry", "fleet-telemetry.json");
const COMPETITIONS_FILE = path.join(__dirname, "telemetry", "competitions-live.json");
const GAMEFI_EXTRA_FILE = path.join(__dirname, "gamefi-targets.json");

const GAS_CAP_USD = 0.002;
// Tope nativo conservador SOLO si no se puede obtener precio de mercado.
const GAS_CAP_NATIVE_FALLBACK = { bscMainnet: 0.0000035, polygonMainnet: 0.01 };
const HTTP_TIMEOUT_MS = 12000;
const CONFIRM_TIMEOUT_MS = 60000;
const REWARD_TOKENS = ["USDC", "POL", "MATIC", "BNB"];

// Objetivos base: contratos wrapped-native oficiales (WBNB / WPOL). Es actividad on-chain
// real de bajo gas (deposit); NO es un check-in de un juego. Los check-ins de GameFi se
// añaden en gamefi-targets.json y pasan por las mismas verificaciones.
function baseTargets() {
  return [
    {
      id: "wbnb-deposit-bsc",
      networkKey: "bscMainnet",
      name: "WBNB deposit (actividad wrapped-native)",
      address: networks.bscMainnet.defiToken.address,
      signature: "function deposit() payable",
      method: "deposit",
      args: [],
      value: "0.00001",
      kind: "WRAPPED_NATIVE_DEPOSIT"
    },
    {
      id: "wpol-deposit-polygon",
      networkKey: "polygonMainnet",
      name: "WPOL deposit (actividad wrapped-native)",
      address: networks.polygonMainnet.defiToken.address,
      signature: "function deposit() payable",
      method: "deposit",
      args: [],
      value: "0.001",
      kind: "WRAPPED_NATIVE_DEPOSIT"
    }
  ];
}

function loadExtraTargets() {
  try {
    if (!fs.existsSync(GAMEFI_EXTRA_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(GAMEFI_EXTRA_FILE, "utf8"));
    const list = Array.isArray(data) ? data : data.targets || [];
    return list.filter(
      (t) => t && shield.isMainnetKey(t.networkKey) && ethers.isAddress(t.address) && t.signature && t.method
    );
  } catch (_) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function readJsonSafe(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {}
  return fallback;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function httpJson(url, opts = {}, timeoutMs = HTTP_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (operacion-10k scanner)", Accept: "application/json", ...(opts.headers || {}) }
    });
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      const err = new Error(`HTTP ${res.status} (el endpoint exige API key o bloquea el acceso)`);
      err.code = "NEEDS_KEY";
      throw err;
    }
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { code: "HTTP_ERROR" });
    return { json: JSON.parse(text), durationMs: Date.now() - started };
  } catch (err) {
    if (err.name === "AbortError") throw Object.assign(new Error(`Timeout > ${timeoutMs / 1000}s`), { code: "TIMEOUT" });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function tokenOf(text) {
  const t = String(text || "").toUpperCase();
  const found = REWARD_TOKENS.filter((k) => new RegExp(`(^|[^A-Z0-9])${k}([^A-Z0-9]|$)`).test(t));
  return found.map((k) => (k === "MATIC" ? "POL" : k)).filter((k, i, a) => a.indexOf(k) === i);
}

// ---------------------------------------------------------------------------
// B) ESCÁNER DE COMPETENCIAS
// ---------------------------------------------------------------------------
async function scanGalxe() {
  const query = `query { campaigns(input:{first:50, listType: Trending, statuses:[Active], chains:[BSC,MATIC]}) {
    list { id numberID name description chain status endTime cap space { name alias } participants { participantsCount } } } }`;
  const { json, durationMs } = await httpJson("https://graphigo.prd.galaxy.eco/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  });
  if (json.errors && !json.data) throw Object.assign(new Error(`GraphQL: ${json.errors[0]?.message || "error"}`), { code: "GRAPHQL_ERROR" });
  const list = json?.data?.campaigns?.list || [];
  const now = Date.now() / 1000;
  const items = [];
  for (const c of list) {
    if (c.status !== "Active" || (c.endTime && c.endTime < now)) continue;
    const tokens = tokenOf(`${c.name} ${String(c.description || "").slice(0, 1200)}`);
    if (tokens.length === 0) continue;
    items.push({
      source: "galxe",
      id: c.id,
      title: c.name,
      rewardTokens: tokens,
      rewardDetection: "texto de la campaña (Galxe no expone token estructurado)",
      chains: [c.chain === "MATIC" ? "Polygon" : c.chain === "BSC" ? "BSC" : c.chain],
      deadline: c.endTime ? new Date(c.endTime * 1000).toISOString() : null,
      participants: c.participants?.participantsCount ?? null,
      url: `https://app.galxe.com/quest/${c.space?.alias || "x"}/${c.id}`
    });
  }
  return { scanned: list.length, items, durationMs };
}

async function scanSuperteam() {
  const { json, durationMs } = await httpJson("https://earn.superteam.fun/api/listings?take=100&type=bounty");
  const list = Array.isArray(json) ? json : json.listings || [];
  const now = Date.now();
  const items = [];
  for (const l of list) {
    if (l.status && l.status !== "OPEN") continue;
    if (l.deadline && Date.parse(l.deadline) < now) continue;
    const tokens = tokenOf(l.token);
    if (tokens.length === 0) continue;
    items.push({
      source: "superteam",
      id: l.id,
      title: l.title,
      reward: { amount: l.rewardAmount ?? null, token: String(l.token).toUpperCase() },
      rewardTokens: tokens,
      rewardDetection: "campo token estructurado de la API",
      chains: ["Solana (pago en USDC; no requiere gas EVM)"],
      deadline: l.deadline || null,
      participants: l._count?.Submission ?? null,
      url: `https://earn.superteam.fun/listing/${l.slug}`
    });
  }
  return { scanned: list.length, items, durationMs };
}

async function scanImmunefi() {
  const { json, durationMs } = await httpJson("https://immunefi.com/public-api/bounties.json");
  const list = Array.isArray(json) ? json : json.bounties || [];
  const items = [];
  for (const b of list) {
    const blob = JSON.stringify([b.rewardsToken, b.ecosystem, b.assets, b.projectType]).slice(0, 4000);
    const tokens = tokenOf(b.rewardsToken || "");
    const evm = /bsc|bnb|binance|polygon|matic/i.test(blob);
    if (tokens.length === 0 || !evm) continue;
    items.push({
      source: "immunefi",
      id: b.id || b.slug,
      title: b.project || b.slug,
      reward: { amount: b.maxBounty ?? null, token: String(b.rewardsToken || "").toUpperCase() },
      rewardTokens: tokens,
      rewardDetection: "campo rewardsToken de la API",
      chains: ["BSC/Polygon (según activos del programa)"],
      deadline: null,
      participants: null,
      url: b.slug ? `https://immunefi.com/bug-bounty/${b.slug}/` : "https://immunefi.com/explore/"
    });
  }
  return { scanned: list.length, items, durationMs };
}

async function scanCompetitions() {
  const sources = [
    { id: "galxe", name: "Galxe (GraphQL público · BSC y Polygon)", url: "https://graphigo.prd.galaxy.eco/query", fn: scanGalxe },
    { id: "superteam", name: "Superteam Earn (bounties abiertos)", url: "https://earn.superteam.fun/api/listings", fn: scanSuperteam },
    { id: "immunefi", name: "Immunefi (bug bounties públicos)", url: "https://immunefi.com/public-api/bounties.json", fn: scanImmunefi }
  ];
  const report = [];
  let items = [];
  for (const s of sources) {
    try {
      const r = await s.fn();
      items = items.concat(r.items);
      report.push({ id: s.id, name: s.name, url: s.url, ok: true, scanned: r.scanned, matched: r.items.length, durationMs: r.durationMs, error: null });
      console.log(`   ✅ [${s.id}] ${r.scanned} analizados · ${r.items.length} con recompensa USDC/POL/BNB`);
    } catch (err) {
      report.push({ id: s.id, name: s.name, url: s.url, ok: false, scanned: 0, matched: 0, durationMs: null, error: `${err.code || "ERROR"}: ${err.message}` });
      console.log(`   ⚠️ [${s.id}] ${err.code || "ERROR"}: ${err.message} (sin datos; no se inventa nada)`);
    }
  }
  const byToken = {};
  for (const it of items) for (const t of it.rewardTokens) byToken[t] = (byToken[t] || 0) + 1;
  const bySource = Object.fromEntries(report.map((r) => [r.id, r.matched]));
  const live = {
    schemaVersion: "1.0.0",
    fetchedAt: new Date().toISOString(),
    sources: report,
    totals: { activeCompetitions: items.length, byToken, bySource },
    items: items.slice(0, 60),
    note: "Datos reales de endpoints públicos. Una fuente con ok=false NO aporta campañas."
  };
  writeJson(COMPETITIONS_FILE, live);
  return live;
}

// ---------------------------------------------------------------------------
// A) GAMEFI / INTERACCIÓN ON-CHAIN VERIFICADA
// ---------------------------------------------------------------------------
async function getNativeUsdPrice(symbol) {
  const pair = symbol === "BNB" ? "BNBUSDT" : "POLUSDT";
  try {
    const { json } = await httpJson(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`, {}, 8000);
    const p = Number(json.price);
    if (p > 0) return { usd: p, source: "binance-spot" };
  } catch (_) {}
  try {
    const id = symbol === "BNB" ? "binancecoin" : "polygon-ecosystem-token";
    const { json } = await httpJson(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`, {}, 8000);
    const p = Number(json?.[id]?.usd);
    if (p > 0) return { usd: p, source: "coingecko" };
  } catch (_) {}
  return { usd: null, source: "unavailable" };
}

/** Verifica un objetivo: bytecode, selector en bytecode, estimateGas y tope de gas en USD. */
async function verifyTarget(target, provider, probeSatellite, networkCfg) {
  const result = { id: target.id, name: target.name, network: target.networkKey, address: target.address, verified: false, reason: null };
  const iface = new ethers.Interface([target.signature]);
  const fragment = iface.getFunction(target.method);
  const data = iface.encodeFunctionData(target.method, target.args || []);
  const value = ethers.parseEther(String(target.value || "0"));

  const code = await provider.getCode(target.address);
  result.hasBytecode = code !== "0x";
  result.bytecodeBytes = code === "0x" ? 0 : (code.length - 2) / 2;
  if (code === "0x") return { ...result, reason: "NO_BYTECODE (no hay contrato desplegado)" };

  result.selectorInBytecode = code.toLowerCase().includes(fragment.selector.slice(2).toLowerCase());
  if (!result.selectorInBytecode) return { ...result, reason: `SELECTOR_${fragment.selector}_NO_ESTA_EN_EL_BYTECODE (proxy o función inexistente)` };

  let gas;
  try {
    gas = await provider.estimateGas({ from: probeSatellite.address, to: target.address, data, value });
  } catch (err) {
    return { ...result, reason: `ESTIMATE_GAS_REVIERTE: ${String(err.shortMessage || err.message).slice(0, 80)}` };
  }
  const fee = await provider.getFeeData();
  const POLYGON_TIP = ethers.parseUnits("35", "gwei");
  let unitPrice; // precio EFECTIVO esperado (el que se paga), no el techo
  let maxFeePerGas = null;
  if (target.networkKey === "polygonMainnet") {
    const block = await provider.getBlock("latest");
    const base = block && block.baseFeePerGas ? block.baseFeePerGas : null;
    if (base) {
      unitPrice = base + POLYGON_TIP;
      maxFeePerGas = base * 2n + POLYGON_TIP;
    } else if (fee.maxFeePerGas) {
      unitPrice = fee.maxFeePerGas;
      maxFeePerGas = (fee.maxFeePerGas * 125n) / 100n;
    }
  } else {
    unitPrice = fee.gasPrice ?? fee.maxFeePerGas;
  }
  if (!unitPrice) return { ...result, reason: "SIN_PRECIO_DE_GAS_EN_LA_RED" };

  const costNative = Number(ethers.formatEther(gas * unitPrice));
  const price = await getNativeUsdPrice(networkCfg.symbol);
  result.estimatedGas = gas.toString();
  result.gasCostNative = costNative;
  result.nativePriceUsd = price.usd;
  result.priceSource = price.source;
  if (price.usd) {
    result.gasCostUsd = costNative * price.usd;
    if (result.gasCostUsd >= GAS_CAP_USD) {
      return { ...result, reason: `GAS_SOBRE_EL_TOPE ($${result.gasCostUsd.toFixed(5)} >= $${GAS_CAP_USD})` };
    }
  } else if (costNative >= GAS_CAP_NATIVE_FALLBACK[target.networkKey]) {
    return { ...result, reason: `GAS_SOBRE_EL_TOPE_NATIVO (${costNative} ${networkCfg.symbol}; sin precio de mercado)` };
  }
  return { ...result, verified: true, reason: null, _gas: gas, _data: data, _value: value, _unitPrice: unitPrice, _maxFee: maxFeePerGas };
}

async function runGamefiNetwork(networkKey, targets, wallets, options) {
  const cfg = networks[networkKey];
  const out = { network: networkKey, symbol: cfg.symbol, targets: [], satellitesSelected: [], txs: [], skipped: null };
  const provider = createResilientProvider(cfg);
  const satellites = wallets.filter((w) => w.index >= 1 && w.index <= 500);

  let sel;
  try {
    sel = await shield.selectFundedSatellites({ provider, satellites, networkKey, max: shield.MAX_MAINNET_SATS_PER_ROUND });
  } catch (err) {
    out.skipped = `LECTURA_DE_SALDOS_FALLIDA: ${err.message}`;
    console.log(`   ⚠️ [${cfg.name}] ${out.skipped}`);
    return out;
  }
  out.fundedCount = sel.fundedCount;
  out.eligibleCount = sel.eligibleCount;
  out.cooldownCount = sel.cooldownCount;
  console.log(`   🎯 [${cfg.name}] fondeados=${sel.fundedCount} · elegibles=${sel.eligibleCount} · en cooldown 24h=${sel.cooldownCount} · mínimo ${sel.minExec} ${cfg.symbol}`);

  // Sonda: si no hay satélite elegible se verifica igualmente con uno fondeado cualquiera (lectura/simulación).
  const probe = sel.squad[0] || satellites.find((s) => !shield.isProtectedIndex(s.index));
  const verified = [];
  for (const t of targets) {
    try {
      const v = await verifyTarget(t, provider, probe, cfg);
      const { _gas, _data, _value, _unitPrice, _maxFee, ...publicV } = v;
      out.targets.push(publicV);
      console.log(`   ${v.verified ? "✅" : "⛔"} [${t.id}] bytecode=${v.hasBytecode ? v.bytecodeBytes + "B" : "NO"} selector=${v.selectorInBytecode ? "OK" : "NO"} ${v.verified ? `gas≈${v.estimatedGas} ($${v.gasCostUsd != null ? v.gasCostUsd.toFixed(5) : "n/d"})` : v.reason}`);
      if (v.verified) verified.push({ t, v });
    } catch (err) {
      out.targets.push({ id: t.id, verified: false, reason: `ERROR_VERIFICACION: ${err.message}` });
      console.log(`   ⛔ [${t.id}] ERROR_VERIFICACION: ${err.message}`);
    }
  }

  if (verified.length === 0) { out.skipped = "SIN_OBJETIVOS_VERIFICADOS"; return out; }
  if (sel.squad.length === 0) {
    out.skipped = sel.fundedCount > 0 ? "TODOS_EN_COOLDOWN_24H" : "SIN_SATELITES_FONDEADOS";
    console.log(`   🛡️ [${cfg.name}] ${out.skipped} · 0 gas esta ronda`);
    return out;
  }

  out.satellitesSelected = sel.squad.map((s) => s.index);
  console.log(`   🛰️ [${cfg.name}] turno: [ ${out.satellitesSelected.map((i) => "#" + String(i).padStart(3, "0")).join(", ")} ]`);
  if (options.dryRun) { out.skipped = "DRY_RUN (sin transacciones ni registro de cooldown)"; return out; }

  // El uso se registra ANTES de enviar: si el proceso muere a mitad, no se repite el gasto.
  shield.claimSatellites(networkKey, out.satellitesSelected, "gamefi");

  for (let i = 0; i < sel.squad.length; i++) {
    const sat = sel.squad[i];
    const { t, v } = verified[i % verified.length];
    const rec = { satellite: sat.index, target: t.id, address: sat.address, status: "NO_ENVIADA", hash: null, at: new Date().toISOString() };
    try {
      const signer = getWalletSigner(sat.index, provider);
      const txReq = { to: t.address, data: v._data, value: v._value, gasLimit: (v._gas * 130n) / 100n };
      if (networkKey === "polygonMainnet") {
        txReq.maxPriorityFeePerGas = ethers.parseUnits("35", "gwei");
        txReq.maxFeePerGas = v._maxFee ?? (v._unitPrice * 125n) / 100n;
        if (txReq.maxFeePerGas < txReq.maxPriorityFeePerGas) txReq.maxFeePerGas = txReq.maxPriorityFeePerGas * 2n;
      } else {
        txReq.gasPrice = v._unitPrice;
      }
      const tx = await signer.sendTransaction(txReq);
      rec.hash = tx.hash;
      rec.status = "ENVIADA_SIN_CONFIRMAR";
      console.log(`   🚀 [${cfg.name}] #${sat.index} tx enviada: ${tx.hash}`);
      const receipt = await Promise.race([
        tx.wait(1),
        new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT_CONFIRMACION")), CONFIRM_TIMEOUT_MS))
      ]).catch((e) => ({ timeout: true, error: e.message }));
      if (receipt && !receipt.timeout && receipt.status === 1) {
        rec.status = "CONFIRMADA";
        rec.blockNumber = receipt.blockNumber;
        rec.gasUsed = receipt.gasUsed?.toString();
        console.log(`   ✅ [${cfg.name}] #${sat.index} CONFIRMADA en bloque ${receipt.blockNumber}`);
      } else if (receipt && !receipt.timeout) {
        rec.status = "REVERTIDA";
        console.log(`   ❌ [${cfg.name}] #${sat.index} REVERTIDA on-chain (${tx.hash.slice(0, 12)}...)`);
      } else {
        console.log(`   ⏳ [${cfg.name}] #${sat.index} sin confirmar tras ${CONFIRM_TIMEOUT_MS / 1000}s (hash real, estado pendiente)`);
      }
    } catch (err) {
      rec.status = "ERROR_ENVIO";
      rec.error = String(err.shortMessage || err.message).slice(0, 120);
      console.log(`   ⚠️ [${cfg.name}] #${sat.index} ${rec.error}`);
    }
    out.txs.push(rec);
    await sleepRandom(800, 1600);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Orquestación + sincronización de telemetría
// ---------------------------------------------------------------------------
function syncTelemetry({ competitions, gamefi, dryRun }) {
  const telemetry = readJsonSafe(FLEET_TELEMETRY_FILE, {}) || {};
  const prev = telemetry.gamefiAndCompetitions || {};
  const recentTxs = [...(gamefi ? gamefi.flatMap((n) => n.txs.map((t) => ({ ...t, network: n.network }))) : []), ...(prev.gamefi?.recentTxs || [])]
    .filter((t) => t.hash)
    .slice(0, 20);

  telemetry.gamefiAndCompetitions = {
    updatedAt: new Date().toISOString(),
    mode: dryRun ? "DRY_RUN" : "PRODUCCION",
    competitions: competitions
      ? {
          fetchedAt: competitions.fetchedAt,
          activeCount: competitions.totals.activeCompetitions,
          byToken: competitions.totals.byToken,
          bySource: competitions.totals.bySource,
          sources: competitions.sources.map((s) => ({ id: s.id, ok: s.ok, matched: s.matched, error: s.error })),
          top: competitions.items.slice(0, 8)
        }
      : prev.competitions || null,
    gamefi: gamefi
      ? {
          lastRunAt: new Date().toISOString(),
          networks: Object.fromEntries(
            gamefi.map((n) => [
              n.network,
              {
                fundedCount: n.fundedCount ?? null,
                eligibleCount: n.eligibleCount ?? null,
                cooldownCount: n.cooldownCount ?? null,
                targetsVerified: n.targets.filter((t) => t.verified).length,
                targetsChecked: n.targets.length,
                targets: n.targets.map((t) => ({ id: t.id, verified: t.verified, hasBytecode: t.hasBytecode ?? null, reason: t.reason })),
                satellitesSelected: n.satellitesSelected,
                txConfirmed: n.txs.filter((t) => t.status === "CONFIRMADA").length,
                txPending: n.txs.filter((t) => t.status === "ENVIADA_SIN_CONFIRMAR").length,
                txFailed: n.txs.filter((t) => ["REVERTIDA", "ERROR_ENVIO"].includes(t.status)).length,
                skipped: n.skipped
              }
            ])
          ),
          recentTxs
        }
      : prev.gamefi || null,
    mainnetCooldown: shield.getCooldownSummary(),
    protectedHeaders: { indexes: shield.HEADER_INDEXES, vault: shield.VAULT_INDEX, policy: "EXCLUIDAS_DEL_GASTO_REPETITIVO_EN_MAINNET" }
  };
  writeJson(FLEET_TELEMETRY_FILE, telemetry);
  return telemetry.gamefiAndCompetitions;
}

async function runGamefiAndCompetitions(options = {}) {
  const dryRun = !!options.dryRun;
  console.log("=========================================================================================");
  console.log("   🎮 OPERACIÓN 10K — GAMEFI VERIFICADO + RADAR DE COMPETENCIAS USDC (DATOS REALES)      ");
  console.log("=========================================================================================");
  console.log(`🛡️  Modo: ${dryRun ? "DRY-RUN (sin transacciones)" : "PRODUCCIÓN"} · tope gas $${GAS_CAP_USD} · cooldown 24h por satélite\n`);

  console.log("📡 [B] Escaneando competencias, quests y bounties públicos (USDC / POL / BNB)...");
  const competitions = await scanCompetitions();
  console.log(`   ➜ ${competitions.totals.activeCompetitions} oportunidades activas · fuentes OK: ${competitions.sources.filter((s) => s.ok).length}/${competitions.sources.length}\n`);

  let gamefi = null;
  if (!options.scanOnly) {
    console.log("🎮 [A] GameFi / actividad on-chain verificada (Polygon 137 y BSC 56)...");
    const wallets = readJsonSafe(WALLETS_FILE, []);
    const all = [...baseTargets(), ...loadExtraTargets()];
    gamefi = [];
    for (const key of ["bscMainnet", "polygonMainnet"]) {
      console.log(`\n🌐 ${networks[key].name}`);
      gamefi.push(await runGamefiNetwork(key, all.filter((t) => t.networkKey === key), wallets, { dryRun }));
    }
  }

  const summary = syncTelemetry({ competitions, gamefi, dryRun });
  const confirmed = gamefi ? gamefi.reduce((n, g) => n + g.txs.filter((t) => t.status === "CONFIRMADA").length, 0) : 0;
  console.log("\n=========================================================================================");
  console.log(`📊 RESUMEN: competencias activas=${competitions.totals.activeCompetitions} · tx GameFi confirmadas=${confirmed}`);
  console.log(`📝 ${path.relative(__dirname, COMPETITIONS_FILE)} y fleet-telemetry.json → gamefiAndCompetitions actualizados`);
  console.log("=========================================================================================\n");

  const allSourcesFailed = competitions.sources.every((s) => !s.ok);
  return { competitions, gamefi, summary, allSourcesFailed, confirmed };
}

if (require.main === module) {
  runGamefiAndCompetitions({
    dryRun: process.argv.includes("--dry-run"),
    scanOnly: process.argv.includes("--scan-only")
  })
    .then((r) => {
      // Error real visible en CI: si NINGUNA fuente respondió, el paso falla.
      if (r.allSourcesFailed) {
        console.error("❌ Ninguna fuente de competencias respondió (ver estados arriba).");
        process.exitCode = 1;
      }
    })
    .catch((err) => {
      console.error("❌ Error en gamefi-and-competitions:", err);
      process.exit(1);
    });
}

module.exports = { runGamefiAndCompetitions, scanCompetitions, verifyTarget, COMPETITIONS_FILE };
