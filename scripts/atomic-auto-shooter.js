/**
 * atomic-auto-shooter.js — Disparador automático del AtomicSniperExecutor (Polygon + BSC).
 *
 * Ciclo (por red y por pasada):
 *  1) Escaneo $0 gas: cotiza USDC ➔ TOKEN ➔ USDC cross-pool (compra en piscina A, venta en piscina B ≠ A)
 *     con el USDC real de #501, neto de fees de piscina y gas del bloque.
 *  2) Condición de fuego: neto >= MIN_NET_PROFIT_USDC (0.03), #501 por encima de su piso de gas, allowance suficiente,
 *     < TARGET_DAILY_ATOMIC_SHOTS disparos hoy y < MAX_FAILURES_PER_DAY fallos hoy. Si no: NO firma NADA ($0 gas).
 *  3) Si hay ruta: calcula minOutLeg1/minOutLeg2 (0.05% de slippage máx.) y minProfit, ejecuta callStatic
 *     (eth_call con from=#501) contra execute() y SOLO si no revierte firma y envía la tx atómica.
 *  4) Registra el disparo en telemetry/fleet-telemetry.json (cápsulas + libro mayor del dashboard) y avisa por Telegram.
 *
 * Seguridad: el contrato solo acepta a #501; el USDC nunca se queda en él. Nunca imprime claves.
 * Kill-switch: AUTO_SHOOTER_DISABLE=1. Simulación total (hace callStatic pero no firma): --dry-run / AUTO_SHOOTER_DRY=1.
 * Uso: node scripts/atomic-auto-shooter.js [--passes N] [--interval SEG] [--dry-run]
 */
const fs = require("fs");
const path = require("path");
const { NETS, ERC20_ABI, ethers, MOTHERSHIP, provider, readTel, writeTel, signer501, sendRawAndWait, telegram } = require("./atomic-common");
const guard = require("../atomic-profit-guard");

const MIN_NET_PROFIT_USDC = guard.MIN_NET_PROFIT_USDC;       // 0.03
const TARGET_DAILY_ATOMIC_SHOTS = 15;
const MAX_FAILURES_PER_DAY = 2;                              // tx revertidas on-chain (gas perdido) antes de frenar la red
const SLIPPAGE_BPS = 5n;                                     // 0.05 %
const GAS_LIMIT_CAP = { polygon: 700000n, bsc: 800000n };    // techo de gas por disparo
const ART = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "contracts", "AtomicSniperExecutor.artifact.json"), "utf8"));
const EXEC_IFACE = new ethers.Interface(ART.abi);

const todayUtc = () => new Date().toISOString().slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const money = n => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(4)}`;

function revertReason(e) {
  try {
    const data = e.data || e.info?.error?.data;
    if (data && data !== "0x") {
      const p = EXEC_IFACE.parseError(data);
      if (p) return `${p.name}(${p.args.join(",")})`;
      if (data.startsWith("0x08c379a0")) return ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10))[0];
    }
  } catch (_) { /* seguir */ }
  return e.reason || e.shortMessage || e.message || "revert";
}

function legOf(chainKey, venueName) {
  const v = guard.CHAINS[chainKey].venues.find(x => x.name === venueName);
  return v && v.exec ? { kind: v.exec.kind, router: v.exec.router, fee: v.exec.fee } : null;
}

function buildCall(chainKey, net, amountRaw, row, minProfitRaw, zeroMins) {
  const buyLeg = legOf(chainKey, row.buy), sellLeg = legOf(chainKey, row.sell);
  if (!buyLeg || !sellLeg) return null;
  const keep = 10000n - SLIPPAGE_BPS;
  const minOut1 = zeroMins ? 0n : BigInt(row.buyOutRaw) * keep / 10000n;
  const minOut2 = zeroMins ? 0n : BigInt(row.sellOutRaw) * keep / 10000n;
  const data = EXEC_IFACE.encodeFunctionData("execute", [net.usdc, row.tokenAddress, amountRaw, minProfitRaw, minOut1, minOut2, buyLeg, sellLeg, true]);
  return { data, minOut1, minOut2, buyLeg, sellLeg };
}

async function scanChain(key, state, opts) {
  const net = NETS[key];
  const tel0 = readTel();
  const exec = tel0[net.executorKey];
  const st = { chain: key, executor: exec || null, armed: false, state: "INIT", checkedAt: new Date().toISOString() };
  if (!exec) { st.state = "NO_EXECUTOR"; return { st }; }

  const prov = provider(key);
  const code = await prov.getCode(exec.toLowerCase());
  const owner = code.length > 2 ? await new ethers.Contract(exec, ART.abi, prov).OWNER() : null;
  st.ownerOk = !!owner && owner.toLowerCase() === MOTHERSHIP.toLowerCase();
  if (!st.ownerOk) { st.state = "EXECUTOR_INVALID"; return { st }; }

  const usdc = new ethers.Contract(net.usdc, ERC20_ABI, prov);
  const [balRaw, allowance, nativeBal] = await Promise.all([usdc.balanceOf(MOTHERSHIP), usdc.allowance(MOTHERSHIP, exec), prov.getBalance(MOTHERSHIP)]);
  const balNum = Number(ethers.formatUnits(balRaw, net.usdcDec));
  const shotAmount = Math.floor(balNum * 100) / 100;          // USDC real de #501, truncado a centavos
  const amountRaw = ethers.parseUnits(shotAmount.toFixed(2), net.usdcDec);
  st.balanceUsdc = shotAmount;
  st.allowanceUsdc = Number(ethers.formatUnits(allowance, net.usdcDec));
  st.nativeBalance = Number(ethers.formatEther(nativeBal));
  st.armed = allowance >= amountRaw && shotAmount >= 1;
  if (shotAmount < 1) { st.state = "NO_USDC"; return { st }; }

  // 1) Escaneo $0 gas
  const r = await guard.evaluateRoundTrip(key, shotAmount, prov, { skipOdos: true });
  const cross = r.rows.filter(x => x.buy !== x.sell && legOf(key, x.buy) && legOf(key, x.sell)).sort((a, b) => b.netUsdc - a.netUsdc);
  const cand = cross.filter(x => x.netUsdc >= MIN_NET_PROFIT_USDC)[0] || null;
  const bestCross = cross[0] || null;
  st.scan = { usdcIn: shotAmount, gasUsdc: Number(r.gasUsdc.toFixed(4)), gasLimit: r.gasLimit, bestCross: bestCross ? { token: bestCross.token, buy: bestCross.buy, sell: bestCross.sell, netUsdc: Number(bestCross.netUsdc.toFixed(4)), netPct: Number(bestCross.netPct.toFixed(4)) } : null, firing: !!cand };

  // Guardas previas a firmar
  const ds = state.shootersDay;
  if (!cand) {
    st.state = "ESPERA_SIN_RUTA_NETA";
    // Prueba de cañería $0: callStatic con minProfit=0 sobre la mejor ruta. Revertir con NO_PROFIT = el contrato llega hasta la guarda final.
    if (bestCross && st.armed && !opts.noPlumbing) {
      const call = buildCall(key, net, amountRaw, bestCross, 0n, true);
      try { await prov.call({ from: MOTHERSHIP, to: exec, data: call.data }); st.plumbing = "OK (pasaría con minProfit=0)"; }
      catch (e) { const why = revertReason(e); st.plumbing = /NO_PROFIT/.test(why) ? "GUARDA OK: NO_PROFIT_REVERT" : `ERROR: ${why}`; }
    }
    return { st };
  }
  if (!st.armed) { st.state = "NO_ARMADO_ALLOWANCE"; return { st }; }
  if (ds.shotsToday >= TARGET_DAILY_ATOMIC_SHOTS) { st.state = "TOPE_DIARIO_15"; return { st }; }
  if (ds.failuresToday >= MAX_FAILURES_PER_DAY) { st.state = "FRENADO_POR_FALLOS"; return { st }; }

  const fee = await prov.getFeeData();
  const polygon = key === "polygon";
  const unitGas = polygon ? fee.maxFeePerGas : (fee.gasPrice > ethers.parseUnits("0.1", "gwei") ? fee.gasPrice : ethers.parseUnits("0.1", "gwei"));
  const worstGasWei = GAS_LIMIT_CAP[key] * unitGas;
  const floorWei = ethers.parseEther(String(net.floorNative));
  if (nativeBal <= floorWei || nativeBal - worstGasWei < floorWei) { st.state = "PISO_GAS_PROTEGIDO"; return { st }; }

  // 3a) Parámetros anti-sandwich y minProfit (cubre gas + 0.03)
  const minProfitUsdc = MIN_NET_PROFIT_USDC + cand.gasUsdc;
  const minProfitRaw = ethers.parseUnits(minProfitUsdc.toFixed(6), net.usdcDec);
  const call = buildCall(key, net, amountRaw, cand, minProfitRaw, false);

  // 3b) callStatic en el bloque actual
  try { await prov.call({ from: MOTHERSHIP, to: exec, data: call.data }); }
  catch (e) { st.state = "CALLSTATIC_REVIERTE"; st.callStaticError = revertReason(e); return { st }; }
  const gasEst = await prov.estimateGas({ from: MOTHERSHIP, to: exec, data: call.data });
  const gasLimit = gasEst * 130n / 100n > GAS_LIMIT_CAP[key] ? GAS_LIMIT_CAP[key] : gasEst * 130n / 100n;
  const gasRealUsdc = Number(ethers.formatEther(gasLimit * unitGas)) * r.nativePriceUsdc;
  if (minProfitUsdc < MIN_NET_PROFIT_USDC + gasRealUsdc) { st.state = "GAS_REAL_ANULA_BENEFICIO"; st.gasRealUsdc = Number(gasRealUsdc.toFixed(4)); return { st }; }
  if (nativeBal - gasLimit * unitGas <= floorWei) { st.state = "PISO_GAS_PROTEGIDO"; return { st }; }
  st.callStatic = "OK"; st.state = opts.dry ? "DRY_RUN_LISTO_PARA_DISPARAR" : "DISPARANDO";
  if (opts.dry) return { st, candidate: cand };

  // 3c) Firma y envío atómico
  const signer = signer501(prov);
  if ((await signer.getAddress()).toLowerCase() !== MOTHERSHIP.toLowerCase()) throw new Error("Signer #501 no coincide");
  const txReq = polygon
    ? { to: exec, data: call.data, gasLimit, maxFeePerGas: fee.maxFeePerGas, maxPriorityFeePerGas: fee.maxPriorityFeePerGas, value: 0n }
    : { to: exec, data: call.data, gasLimit, gasPrice: unitGas, value: 0n };
  state.signing = true; // desde aquí el timeout de red NO corta: no se puede perder el registro de una tx enviada
  const rc = await sendRawAndWait(prov, signer, txReq, "disparo");
  state.signing = false;
  const gasPaidNative = Number(ethers.formatEther(rc.gasUsed * (rc.effectiveGasPrice || unitGas)));
  const gasPaidUsdc = gasPaidNative * r.nativePriceUsdc;

  if (rc.status !== 1) {
    st.state = "DISPARO_REVERTIDO_ONCHAIN";
    return { st, failure: { chain: key, txHash: rc.hash, gasPaidNative, gasPaidUsdc, cand } };
  }
  let gross = null;
  for (const lg of rc.logs) {
    if (lg.address.toLowerCase() !== exec.toLowerCase()) continue;
    try { const p = EXEC_IFACE.parseLog({ topics: lg.topics, data: lg.data }); if (p && p.name === "AtomicCycle") gross = Number(ethers.formatUnits(p.args.netProfit, net.usdcDec)); } catch (_) { /* otro log */ }
  }
  if (gross === null) gross = cand.grossUsdc;
  st.state = "DISPARO_EJECUTADO";
  return { st, shot: { chain: key, txHash: rc.hash, blockNumber: rc.blockNumber, usdcIn: shotAmount, grossProfitUsdc: gross, gasPaidNative, gasPaidUsdc, netUsdc: gross - gasPaidUsdc, cand, executor: exec } };
}

function persist(chainResults, state, shots, failures) {
  const tel = readTel();
  const prev = tel.atomicAutoShooter || {};
  const day = todayUtc();
  const A = tel.atomicAutoShooter = {
    updatedAt: new Date().toISOString(), minNetProfitUsdc: MIN_NET_PROFIT_USDC, targetDaily: TARGET_DAILY_ATOMIC_SHOTS, slippageBps: Number(SLIPPAGE_BPS),
    dayUtc: day, shotsToday: state.shootersDay.shotsToday, failuresToday: state.shootersDay.failuresToday,
    chains: { ...(prev.chains || {}), ...chainResults }, shots: [...(prev.shots || [])]
  };
  const eco = (tel.snipingEcosystem = tel.snipingEcosystem || {});
  if (!Array.isArray(eco.confirmedOnChainOperations)) eco.confirmedOnChainOperations = [];
  for (const s of shots) {
    const net = NETS[s.chain];
    const when = new Date();
    const row = {
      chain: s.chain === "polygon" ? "Polygon PoS" : "BSC", chainBadge: `#${s.chain === "polygon" ? "POL" : "BSC"} ${s.blockNumber}`, blockNumber: s.blockNumber,
      txHash: s.txHash, explorerUrl: `${net.explorer}/tx/${s.txHash}`, timestampUtc: when.toISOString().slice(11, 19) + " UTC",
      nebulas: "Nebulosa IA (>=95%)", mothership: "#501 (Matriz Dual)",
      route: `Disparo atómico #${s.n} · ${net.name} / ${s.cand.buy} ➔ ${s.cand.sell} (USDC ➔ ${s.cand.token} ➔ USDC)`,
      cycleInOut: `$${s.usdcIn.toFixed(2)} ➔ +$${s.netUsdc.toFixed(4)} USDC neto`,
      gasUsed: `${s.gasPaidNative.toFixed(6)} ${net.nativeSym}`, netProfit: Number(s.netUsdc.toFixed(4)), executor: s.executor
    };
    eco.confirmedOnChainOperations.unshift(row);
    A.shots.unshift({ n: s.n, at: when.toISOString(), chain: s.chain, txHash: s.txHash, blockNumber: s.blockNumber, token: s.cand.token, buy: s.cand.buy, sell: s.cand.sell, usdcIn: s.usdcIn, grossProfitUsdc: Number(s.grossProfitUsdc.toFixed(6)), gasPaidUsdc: Number(s.gasPaidUsdc.toFixed(6)), netUsdc: Number(s.netUsdc.toFixed(6)) });
  }
  for (const f of failures) A.shots.unshift({ at: new Date().toISOString(), chain: f.chain, txHash: f.txHash, failed: true, gasPaidUsdc: Number(f.gasPaidUsdc.toFixed(6)) });
  A.shots = A.shots.slice(0, 60);
  // Contadores que lee la cabina (cápsulas [#01]..[#15])
  const total = state.shootersDay.shotsToday;
  tel.atomicSniperExecution = Object.assign(tel.atomicSniperExecution || {}, { shotsExecutedToday: total, dailyTarget: TARGET_DAILY_ATOMIC_SHOTS, status: "ARMED_AND_SCANNING" });
  eco.dailyAtomicOperations = Object.assign(eco.dailyAtomicOperations || {}, { target: TARGET_DAILY_ATOMIC_SHOTS, completedToday: total, pendingToday: Math.max(0, TARGET_DAILY_ATOMIC_SHOTS - total) });
  writeTel(tel);
}

async function runAutoShooter(opts = {}) {
  opts = Object.assign({ passes: 1, intervalSec: 30, dry: process.env.AUTO_SHOOTER_DRY === "1" }, opts);
  if (process.env.AUTO_SHOOTER_DISABLE === "1") { console.log("🛑 [AUTO-SHOOTER] desactivado por AUTO_SHOOTER_DISABLE=1"); return null; }
  console.log(`\n🎯 [AUTO-SHOOTER · Polygon + BSC] umbral neto >= $${MIN_NET_PROFIT_USDC} · máx ${TARGET_DAILY_ATOMIC_SHOTS}/día · slippage ${Number(SLIPPAGE_BPS) / 100}% · ${opts.dry ? "SIMULACIÓN" : "EN VIVO"}`);
  let last = null;
  for (let pass = 1; pass <= opts.passes; pass++) {
    const tel = readTel();
    const prev = tel.atomicAutoShooter || {};
    const fresh = prev.dayUtc !== todayUtc();
    const state = { shootersDay: { shotsToday: fresh ? 0 : (prev.shotsToday || 0), failuresToday: fresh ? 0 : (prev.failuresToday || 0) } };
    const results = {}, shots = [], failures = [];
    for (const key of ["polygon", "bsc"]) {
      try {
        // Timeout por red: un RPC colgado no debe bloquear el ciclo ni el cron (si ya se envió una tx, scanChain la espera hasta 120 s)
        const out = await Promise.race([
          scanChain(key, state, { dry: opts.dry, noPlumbing: pass > 1 }),
          new Promise((_, rej) => setTimeout(() => { if (!state.signing) rej(new Error("TIMEOUT_RED_60s")); }, 60000).unref())
        ]);
        results[key] = out.st;
        if (out.shot) { state.shootersDay.shotsToday++; out.shot.n = state.shootersDay.shotsToday; shots.push(out.shot); }
        if (out.failure) { state.shootersDay.failuresToday++; failures.push(out.failure); }
        const s = out.st;
        const sc = s.scan && s.scan.bestCross;
        console.log(`  [${key.toUpperCase()}] ${s.state} | ejecutor ${s.executor ? s.executor.slice(0, 8) + "…" : "-"} | owner#501 ${s.ownerOk ? "✔" : "✘"} | armado ${s.armed ? "✔" : "✘"} | USDC ${s.balanceUsdc ?? "-"} | allowance ${s.allowanceUsdc ?? "-"}${sc ? ` | mejor cross-pool: ${sc.token} ${sc.buy} ➔ ${sc.sell} ${money(sc.netUsdc)}` : ""}${s.plumbing ? ` | cañería: ${s.plumbing}` : ""}${s.callStaticError ? ` | callStatic: ${s.callStaticError}` : ""}`);
      } catch (e) {
        results[key] = { chain: key, state: "ERROR_LECTURA", error: String(e.message).slice(0, 160), checkedAt: new Date().toISOString() };
        console.log(`  [${key.toUpperCase()}] ERROR: ${results[key].error}`);
      }
    }
    // Persistir ANTES de avisar: nunca perder un disparo real
    persist(results, state, shots, failures);
    for (const s of shots) {
      const net = NETS[s.chain];
      const ok = await telegram(`🎯 DISPARO ATÓMICO #${s.n}/${TARGET_DAILY_ATOMIC_SHOTS} · ${net.name}\nRuta: ${s.cand.buy} ➔ ${s.cand.sell} (USDC ➔ ${s.cand.token} ➔ USDC)\nEntrada: $${s.usdcIn.toFixed(2)} USDC\nGanancia neta: ${money(s.netUsdc)} USDC (bruta ${money(s.grossProfitUsdc)}, gas ${s.gasPaidNative.toFixed(6)} ${net.nativeSym})\nTx: ${net.explorer}/tx/${s.txHash}\nContrato: ${s.executor}`);
      console.log(`  🎯 DISPARO #${s.n} ${net.name}: ${s.txHash} neto ${money(s.netUsdc)} | Telegram ${ok ? "enviado" : "no enviado"}`);
    }
    for (const f of failures) {
      await telegram(`⚠️ DISPARO REVERTIDO on-chain · ${NETS[f.chain].name}\nTx: ${NETS[f.chain].explorer}/tx/${f.txHash}\nGas perdido: ~$${f.gasPaidUsdc.toFixed(4)}. Fallos hoy: ${state.shootersDay.failuresToday}/${MAX_FAILURES_PER_DAY} (al llegar al tope la red se frena).`);
    }
    last = { results, shots, failures, shotsToday: state.shootersDay.shotsToday };
    if (pass < opts.passes) await sleep(opts.intervalSec * 1000);
  }
  return last;
}

module.exports = { runAutoShooter, MIN_NET_PROFIT_USDC, TARGET_DAILY_ATOMIC_SHOTS };

if (require.main === module) {
  const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
  runAutoShooter({ passes: Number(arg("--passes") || 1), intervalSec: Number(arg("--interval") || 30), dry: process.argv.includes("--dry-run") || process.env.AUTO_SHOOTER_DRY === "1" })
    .then(() => process.exit(0)).catch(e => { console.error("ERROR:", e.message); process.exit(1); });
}
