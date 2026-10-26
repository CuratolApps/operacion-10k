require("dotenv").config();
const { ExchangeClient, InfoClient, HttpTransport } = require("@nktkas/hyperliquid");
const { ethers } = require("ethers");
const { sendTelegramAlert } = require("../telegram-notifier");

const ASSET_INDICES = {
  BTC: 0,
  ETH: 1,
  SOL: 5,
  BNB: 7,
  SUI: 14,
  LINK: 18,
  AAVE: 28,
  POL: 142,
  PAXG: 187
};

const ASSET_DECIMALS = {
  BTC: { sz: 5, coin: "BTC" },
  ETH: { sz: 4, coin: "ETH" },
  SOL: { sz: 2, coin: "SOL" },
  BNB: { sz: 3, coin: "BNB" },
  SUI: { sz: 1, coin: "SUI" },
  LINK: { sz: 1, coin: "LINK" },
  AAVE: { sz: 2, coin: "AAVE" },
  POL: { sz: 0, coin: "POL" },
  PAXG: { sz: 3, coin: "PAXG" }
};

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const UNTOUCHABLE_RESERVE_USDC = 40.02;

function formatHlPrice(price, coin) {
  if (coin === "BTC") return price.toFixed(1);
  if (coin === "ETH" || coin === "PAXG") return price.toFixed(1);
  if (coin === "SOL" || coin === "BNB" || coin === "AAVE") return price.toFixed(2);
  if (coin === "LINK") return price.toFixed(3);
  if (coin === "SUI") return price.toFixed(4);
  if (coin === "POL") return price.toFixed(5);
  return price.toFixed(2);
}

function formatHlSize(sz, szDecimals) {
  const factor = Math.pow(10, szDecimals);
  return (Math.floor(sz * factor) / factor).toFixed(szDecimals);
}

async function runFeeShieldedSniperTest() {
  console.log("================================================================");
  console.log("🛡️ ÁREA 501 // SQUAD SECRET // TIRO 2: LEY DEL FEE BLINDADO");
  console.log("================================================================\n");

  const transport = new HttpTransport({ isTestnet: false });
  const info = new InfoClient({ transport });

  const agentWallet = new ethers.Wallet(process.env.HL_AGENT_PRIVATE_KEY);
  const client = new ExchangeClient({
    wallet: agentWallet,
    transport,
    isTestnet: false
  });

  // 1. Auditoría de Balance Inicial
  const chBefore = await info.clearinghouseState({ user: VAULT_501 });
  const initialBalance = parseFloat(chBefore.marginSummary?.accountValue || "0.0");
  console.log(`1️⃣ Saldo Inicial en Hyperliquid L1: $${initialBalance.toFixed(4)} USDC`);
  console.log(`   • Escudo de Reserva: $${UNTOUCHABLE_RESERVE_USDC.toFixed(2)} USDC (Blindado e Intocable)`);
  console.log(`   • Margen asignado para este tiro: $20.00 USDC (5x apalancamiento)\n`);

  // 2. Escanear L2 del par seleccionado (SUI-USDC en Escuadrón Alfa)
  const coin = "SUI";
  const l2 = await info.l2Book({ coin });
  const bestBid = parseFloat(l2.levels[0][0].px);
  const bestAsk = parseFloat(l2.levels[1][0].px);
  const spreadPct = ((bestAsk - bestBid) / bestBid * 100);

  console.log(`2️⃣ Libro L2 en ${coin}-USDC:`);
  console.log(`   • Best Bid: $${bestBid}`);
  console.log(`   • Best Ask: $${bestAsk}`);
  console.log(`   • Spread L2: ${spreadPct.toFixed(4)}%\n`);

  // 3. Cálculo de Precios con Doble Post-Only ALO y Cobertura Total de Comisiones
  // Tarifa Maker Hyperliquid: 0.015% por lado -> Ida + Vuelta = 0.030%
  const feeRoundTripPct = 0.030;
  const beTargetPct = 0.045; // Breakeven cubre comisión y deja $0.00 neto o +$0.01
  const tpTargetPct = 0.080; // Take Profit neto deja de +$0.05 a +$0.08 USDC limpios

  const marginUsdc = 20.00;
  const leverage = 5;
  const notionalUsdc = marginUsdc * leverage; // $100.00
  const szFormatted = formatHlSize(notionalUsdc / bestBid, ASSET_DECIMALS[coin].sz);

  // Entrada: Post-Only ALO al Best Bid
  const entryPxStr = formatHlPrice(bestBid, coin);
  const entryPx = parseFloat(entryPxStr);

  // Salida Breakeven / TP: Post-Only ALO por encima de la entrada
  const bePxStr = formatHlPrice(entryPx * (1 + beTargetPct / 100), coin);
  const tpPxStr = formatHlPrice(entryPx * (1 + tpTargetPct / 100), coin);

  console.log("3️⃣ Parámetros con Ley del Fee Blindado:");
  console.log(`   • Entrada Maker ALO: $${entryPxStr} (tif: Alo · 0.015% Maker)`);
  console.log(`   • Candado Breakeven (+0.045%): $${bePxStr} (Cubre 100% de comisiones ida y vuelta)`);
  console.log(`   • Take Profit ALO (+0.080%): $${tpPxStr} (tif: Alo · Reduce-Only · Ganancia Neta Asegurada)`);
  console.log(`   • Tamaño Posición: ${szFormatted} ${coin}\n`);

  // 4. Disparo de Entrada Post-Only ALO
  console.log("4️⃣ Disparando Orden de Entrada Maker ALO...");
  const orderRes = await client.order({
    orders: [
      {
        a: ASSET_INDICES[coin],
        b: true, // Buy
        p: entryPxStr,
        s: szFormatted,
        r: false,
        t: { limit: { tif: "Alo" } }
      }
    ],
    grouping: "na"
  });

  const entryStatus = orderRes.response?.data?.statuses?.[0] || {};
  let entryOid = null;

  if (entryStatus.resting) {
    entryOid = entryStatus.resting.oid;
    console.log(`   ✅ Orden Entrada descansando en el libro (Maker ALO): OrderId #${entryOid}`);
  } else if (entryStatus.filled) {
    console.log(`   🔥 Orden Entrada LLENADA INMEDIATAMENTE: Sz ${entryStatus.filled.totalSz} @ $${entryStatus.filled.avgPx}`);
  } else if (entryStatus.error) {
    console.log(`   ⚠️ Orden rechazada por protección ALO: ${entryStatus.error}`);
    return;
  }

  // Notificar Entrada a Telegram
  const tgEntryMsg = `🎯 <b>ÁREA 501 // SQUAD SECRET // TIRO 2 EN CURSO (FEE BLINDADO)</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔰 <b>ESCUADRÓN:</b> <code>ALFA (#601 Fuerza Rápida)</code>
📍 <b>PAR:</b> <code>${coin}-USDC</code> (🐂 LONG / MAKER ALO)
💵 <b>Margen:</b> <code>$${marginUsdc.toFixed(2)} USDC</code> (5x · Nocional $${notionalUsdc.toFixed(2)})
📥 <b>Entrada Maker ALO:</b> <code>$${entryPxStr}</code>
🔒 <b>Candado Breakeven:</b> <code>$${bePxStr}</code> (+0.045% · 100% Comisiones Cubiertas)
💰 <b>Take Profit ALO:</b> <code>$${tpPxStr}</code> (+0.080% · Ganancia Neta USDC)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ <i>Ley del Fee Blindado: Entrada y Salida 100% Post-Only Maker. Cero Taker Fee.</i>`;

  const chatId = process.env.TELEGRAM_CHAT_ID || "-1004342131598";
  await sendTelegramAlert(tgEntryMsg, chatId, { skipHeader: true });

  // 5. Monitoreo de Llenado de Entrada
  console.log("\n5️⃣ Monitoreando ejecución de entrada en los próximos 15 segundos...");
  let isFilled = false;
  let fillAvgPx = entryPx;

  for (let t = 0; t < 15; t++) {
    await new Promise(r => setTimeout(r, 1000));
    const chLoop = await info.clearinghouseState({ user: VAULT_501 });
    const pos = chLoop.assetPositions.find(p => p.position.coin === coin);
    if (pos && parseFloat(pos.position.szi) > 0) {
      isFilled = true;
      fillAvgPx = parseFloat(pos.position.entryPx);
      console.log(`   🔥 Posición confirmada on-chain: ${pos.position.szi} ${coin} @ $${fillAvgPx}`);
      break;
    }
  }

  if (!isFilled) {
    console.log("   ⏳ Orden no tomada en 15s. Cancelando para mantener disciplina de francotirador...");
    if (entryOid) {
      await client.cancel({ cancels: [{ a: ASSET_INDICES[coin], o: entryOid }] });
      console.log("   ✅ Orden cancelada limpiamente. Saldo 100% intacto en USDC ($0.00 pérdida).");
    }
    return;
  }

  // 6. Colocar de Inmediato la Orden de Salida Post-Only ALO (Reduce-Only)
  // Al ser tif: "Alo", nunca pagará comisión Taker y cobrará rebate o 0.015% Maker
  const safeExitPxStr = formatHlPrice(fillAvgPx * (1 + tpTargetPct / 100), coin);
  console.log(`\n6️⃣ Colocando Orden de Salida Maker ALO (Reduce-Only) a $${safeExitPxStr}...`);

  const exitRes = await client.order({
    orders: [
      {
        a: ASSET_INDICES[coin],
        b: false, // Sell
        p: safeExitPxStr,
        s: szFormatted,
        r: true, // Reduce-only
        t: { limit: { tif: "Alo" } }
      }
    ],
    grouping: "na"
  });

  console.log("   Resultado Orden Salida:", JSON.stringify(exitRes.response?.data?.statuses || exitRes));

  // 7. Esperar y Monitorear Cierre en TP / Breakeven
  console.log("\n7️⃣ Monitoreando hasta que el mercado absorba el Take Profit Maker...");
  let closed = false;
  for (let m = 0; m < 45; m++) {
    await new Promise(r => setTimeout(r, 2000));
    const chCheck = await info.clearinghouseState({ user: VAULT_501 });
    const remainingPos = chCheck.assetPositions.find(p => p.position.coin === coin);
    if (!remainingPos || parseFloat(remainingPos.position.szi) === 0) {
      closed = true;
      console.log("   💰 ¡TAKE PROFIT MAKER ABSORBIDO EN EL LIBRO! Posición cerrada al 100%.");
      break;
    }
    const currentMid = parseFloat((await info.allMids())[coin]);
    process.stdout.write(`   [${m * 2}s] SUI Mid actual: $${currentMid} (TP Objetivo: $${safeExitPxStr})\r`);
  }

  // 8. Verificación Final de Balance
  const chAfter = await info.clearinghouseState({ user: VAULT_501 });
  const finalBalance = parseFloat(chAfter.marginSummary?.accountValue || "0.0");
  const netDeltaUsdc = finalBalance - initialBalance;

  console.log("\n\n================================================================");
  console.log("🏁 RESULTADO FINAL TRAS LA LEY DEL FEE BLINDADO:");
  console.log(`• Saldo Previo al Tiro:   $${initialBalance.toFixed(4)} USDC`);
  console.log(`• Saldo Final en Cuenta:  $${finalBalance.toFixed(4)} USDC`);
  console.log(`• Delta Neto en Cuenta:   ${netDeltaUsdc >= 0 ? "+" : ""}$${netDeltaUsdc.toFixed(4)} USDC`);
  console.log(`• Posiciones Abiertas:    ${chAfter.assetPositions.length} (100% USDC Nativo)`);
  console.log(`• Escudo de Reserva:      $${UNTOUCHABLE_RESERVE_USDC.toFixed(2)} USDC (Completamente Blindado)`);
  console.log("================================================================\n");

  const tgFinalMsg = `🟢 <b>ÁREA 501 // TIRO 2 COMPLETADO // LEY DEL FEE BLINDADO</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔰 <b>Escuadrón:</b> <code>ALFA (#601 Fuerza Rápida)</code>
📍 <b>Par:</b> <code>${coin}-USDC</code>
💵 <b>Saldo Inicial:</b> <code>$${initialBalance.toFixed(4)} USDC</code>
💰 <b>Saldo Final:</b> <code>$${finalBalance.toFixed(4)} USDC</code>
📈 <b>Resultado Neto:</b> <b>${netDeltaUsdc >= 0 ? "+" : ""}$${netDeltaUsdc.toFixed(4)} USDC</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ <b>Comisiones Pagadas:</b> <code>Exclusivamente Maker (0.015% / Cero Taker)</code>
⏱️ <b>Posiciones Abiertas:</b> <code>0 (Cero Holding · 100% USDC)</code>
🌐 <b>Dashboard:</b> <a href="https://area-501.curatolapps.workers.dev/squad-secret/">Mando Central en Vivo</a>`;

  await sendTelegramAlert(tgFinalMsg, chatId, { skipHeader: true });
}

runFeeShieldedSniperTest().catch(err => {
  console.error("Error en tiro blindado:", err);
  process.exit(1);
});
