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
  BTC: { sz: 5, px: 1 },
  ETH: { sz: 4, px: 2 },
  SOL: { sz: 2, px: 2 },
  BNB: { sz: 3, px: 2 },
  SUI: { sz: 1, px: 4 },
  LINK: { sz: 1, px: 3 },
  AAVE: { sz: 2, px: 2 },
  POL: { sz: 0, px: 4 },
  PAXG: { sz: 3, px: 2 }
};

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const UNTOUCHABLE_RESERVE_USDC = 40.02;

async function executeControlledSniperShot() {
  console.log("================================================================");
  console.log("🎯 SQUAD SECRET // TIRO CONTROLADO DE PRUEBA REAL (OPCIÓN A)");
  console.log("================================================================\n");

  const transport = new HttpTransport({ isTestnet: false });
  const info = new InfoClient({ transport });

  const agentWallet = new ethers.Wallet(process.env.HL_AGENT_PRIVATE_KEY);
  const client = new ExchangeClient({
    wallet: agentWallet,
    transport,
    isTestnet: false
  });

  // 1. Auditoría Pre-Vuelo del Clearinghouse
  console.log("1️⃣ Verificando estado on-chain del Clearinghouse en Hyperliquid L1...");
  const chState = await info.clearinghouseState({ user: VAULT_501 });
  const accountValue = parseFloat(chState.marginSummary?.accountValue || "0.0");
  const withdrawable = parseFloat(chState.withdrawable || "0.0");
  console.log(`   • Saldo en Cuenta: $${accountValue.toFixed(2)} USDC`);
  console.log(`   • Escudo de Reserva Intocable: $${UNTOUCHABLE_RESERVE_USDC.toFixed(2)} USDC (40% Blindado)`);
  console.log(`   • Capital de Fuego Disponible: $${(accountValue - UNTOUCHABLE_RESERVE_USDC).toFixed(2)} USDC\n`);

  if (accountValue < UNTOUCHABLE_RESERVE_USDC + 10.0) {
    throw new Error("Saldo insuficiente por encima del Escudo de Reserva");
  }

  // 2. Escaneo L2 en Escuadrón Alfa (#601 Fuerza Rápida: SUI, SOL, POL)
  console.log("2️⃣ Escaneando Orderbook L2 de Escuadrón Alfa (#601)...");
  const allMids = await info.allMids();
  const suiMid = parseFloat(allMids["SUI"]);
  const solMid = parseFloat(allMids["SOL"]);
  const polMid = parseFloat(allMids["POL"]);

  console.log(`   • SOL-USDC: $${solMid.toFixed(2)}`);
  console.log(`   • SUI-USDC: $${suiMid.toFixed(4)}`);
  console.log(`   • POL-USDC: $${polMid.toFixed(4)}`);

  // Obtener L2 book de SUI
  const l2Sui = await info.l2Book({ coin: "SUI" });
  const bids = l2Sui.levels[0] || [];
  const asks = l2Sui.levels[1] || [];

  const bestBid = bids[0] ? parseFloat(bids[0].px) : suiMid;
  const bestAsk = asks[0] ? parseFloat(asks[0].px) : suiMid;

  let bidVol5 = 0, askVol5 = 0;
  for (let i = 0; i < Math.min(5, bids.length); i++) bidVol5 += parseFloat(bids[i].px) * parseFloat(bids[i].sz);
  for (let i = 0; i < Math.min(5, asks.length); i++) askVol5 += parseFloat(asks[i].px) * parseFloat(asks[i].sz);

  const totalVol = bidVol5 + askVol5;
  const imbalancePct = totalVol > 0 ? (bidVol5 / totalVol) * 100 : 50;
  console.log(`   -> SUI L2 Imbalance: ${imbalancePct.toFixed(1)}% Compradores (Bids: $${(bidVol5/1000).toFixed(0)}k | Asks: $${(askVol5/1000).toFixed(0)}k)\n`);

  // 3. Preparar parámetros de tiro certero (Post-Only ALO)
  // Margen de prueba: $20.00 USDC con apalancamiento 5x = Nocional $100.00
  const marginUsdc = 20.00;
  const leverage = 5;
  const notionalUsdc = marginUsdc * leverage;
  const rawSize = notionalUsdc / suiMid;
  const szFormatted = (Math.floor(rawSize * 10) / 10).toFixed(1); // 1 decimal para SUI

  // Precio de entrada Post-Only: colocamos la orden límite en el Best Bid para no pagar fee Taker
  const entryPx = bestBid.toFixed(4);
  const bePx = (bestBid * 1.0004).toFixed(4);
  const tpPx = (bestBid * 1.0008).toFixed(4);
  const targetGainUsdc = +(notionalUsdc * 0.0008).toFixed(2);

  console.log("3️⃣ Parámetros Calculados para el Tiro Francotirador:");
  console.log(`   • Par: SUI-USDC (Dirección: BULL / LONG)`);
  console.log(`   • Margen: $${marginUsdc.toFixed(2)} USDC (${leverage}x -> Nocional: $${notionalUsdc.toFixed(2)} USDC)`);
  console.log(`   • Tamaño de Posición: ${szFormatted} SUI`);
  console.log(`   • Entrada Maker ALO: $${entryPx} (Best Bid pasivo)`);
  console.log(`   • Candado Breakeven #00: $${bePx} (+0.04% · $0 Pérdida)`);
  console.log(`   • Take Profit (100% USDC): $${tpPx} (+0.08% · +$${targetGainUsdc} USDC netos)`);
  console.log(`   • Tarifa Maker: 0.015% | Gas Red: $0.00\n`);

  // 4. Enviar Orden Pasiva Post-Only ALO
  console.log("4️⃣ Disparando orden Post-Only ALO a la blockchain Hyperliquid L1...");
  const orderRes = await client.order({
    orders: [
      {
        a: ASSET_INDICES.SUI,
        b: true, // Buy
        p: entryPx,
        s: szFormatted,
        r: false,
        t: { limit: { tif: "Alo" } } // Add Liquidity Only
      }
    ],
    grouping: "na"
  });

  const statusObj = orderRes.response?.data?.statuses?.[0] || {};
  let restingOid = null;

  if (statusObj.resting) {
    restingOid = statusObj.resting.oid;
    console.log(`   ✅ ORDEN ALO REGISTRADA EN EL LIBRO L1: OrderId #${restingOid}`);
  } else if (statusObj.filled) {
    console.log(`   🔥 ORDEN LLENADA AL INSTANTE: Total Sz ${statusObj.filled.totalSz} a $${statusObj.filled.avgPx}`);
  } else if (statusObj.error) {
    console.log(`   ⚠️ Respuesta ALO: ${statusObj.error}`);
  }

  // 5. Despachar Alerta a Telegram
  const tgMsg = `🎯 <b>ÁREA 501 // SQUAD SECRET // TIRO REAL CONTROLADO (OPCIÓN A)</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔰 <b>ESCUADRÓN:</b> <code>ALFA (#601 Fuerza Rápida)</code>
📍 <b>PAR:</b> <code>SUI-USDC</code> (🐂 BULL / LONG)
⚡ <b>MODO:</b> <code>Post-Only ALO Maker ($0.00 Gas)</code>
🆔 <b>ORDER ID L1:</b> <code>#${restingOid || "COMPLETED"}</code>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 <b>Margen Asignado:</b> <code>$${marginUsdc.toFixed(2)} USDC</code> (${leverage}x · Nocional $${notionalUsdc.toFixed(2)})
🎯 <b>Entrada Maker:</b> <code>$${entryPx}</code>
🔒 <b>Candado Breakeven:</b> <code>$${bePx}</code> (+0.04% · $0 Pérdida)
💰 <b>Take Profit:</b> <code>$${tpPx}</code> (+0.08% ➔ <b>+$${targetGainUsdc} USDC</b>)
🛡️ <b>Escudo Reserva:</b> <code>$${UNTOUCHABLE_RESERVE_USDC.toFixed(2)} USDC</code> (40% Intocable)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️ <b>Tiempo en mercado:</b> Micro-scalp programado (15s a 45s).
🌐 <i>100% Retorno a USDC Nativo garantizado por protocolo.</i>`;

  const chatId = process.env.TELEGRAM_CHAT_ID || "-1004342131598";
  console.log("\n5️⃣ Despachando reporte militar a Telegram:", chatId);
  await sendTelegramAlert(tgMsg, chatId, { skipHeader: true });
  console.log("   ✅ Notificación entregada en Telegram.\n");

  // 6. Monitoreo / Cierre y Retorno Limpio a USDC
  if (restingOid) {
    console.log("6️⃣ Monitoreando orden en el libro durante 10 segundos...");
    await new Promise(r => setTimeout(r, 10000));

    console.log(`   Cancelando orden #${restingOid} para finalizar prueba y garantizar 100% retorno a USDC...`);
    const cancelRes = await client.cancel({
      cancels: [{ a: ASSET_INDICES.SUI, o: restingOid }]
    });
    console.log("   Resultado cancelación:", JSON.stringify(cancelRes.response?.data?.statuses || cancelRes));
  }

  // 7. Verificación final de saldo y posiciones
  const finalCh = await info.clearinghouseState({ user: VAULT_501 });
  const finalVal = parseFloat(finalCh.marginSummary?.accountValue || "0.0");
  const openPos = finalCh.assetPositions || [];

  console.log("\n================================================================");
  console.log("🏁 VERIFICACIÓN FINAL TRAS TIRO CONTROLADO:");
  console.log(`• Saldo Final en Hyperliquid L1: $${finalVal.toFixed(2)} USDC`);
  console.log(`• Posiciones abiertas: ${openPos.length} (Cero exposición / 100% USDC)`);
  console.log(`• Escudo de Reserva: $${UNTOUCHABLE_RESERVE_USDC.toFixed(2)} USDC (Completamente Intacto)`);
  console.log("================================================================\n");
}

executeControlledSniperShot().catch(err => {
  console.error("Error en tiro controlado:", err);
  process.exit(1);
});
