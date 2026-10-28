require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { ExchangeClient, InfoClient, HttpTransport } = require("@nktkas/hyperliquid");
const { ethers } = require("ethers");
const { sendTelegramAlert } = require("../telegram-notifier");

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";

const ASSET_INDICES = {
  BTC: 0,
  ETH: 1,
  SOL: 5,
  AVAX: 6,
  BNB: 7,
  SUI: 14,
  LINK: 18,
  AAVE: 28,
  POL: 142,
  PAXG: 187
};

function formatHlPrice(px, coin) {
  if (coin === "BTC" || coin === "PAXG") return Math.round(px).toString();
  if (coin === "ETH") return (Math.round(px * 10) / 10).toFixed(1);
  if (coin === "BNB" || coin === "AAVE") return (Math.round(px * 10) / 10).toFixed(1);
  if (coin === "SOL") return (Math.round(px * 100) / 100).toFixed(2);
  if (coin === "AVAX") return (Math.round(px * 1000) / 1000).toFixed(3);
  return (Math.round(px * 10000) / 10000).toFixed(4);
}

function formatHlSize(sz, decimals) {
  const factor = Math.pow(10, decimals);
  return (Math.floor(sz * factor) / factor).toFixed(decimals);
}

async function runRescue() {
  console.log("================================================================================");
  console.log("🚁🛡️ EJECUTANDO OPERACIÓN RESCATE #00 EN AVAX-USDC Y BLINDAJE L1");
  console.log("================================================================================");

  const transport = new HttpTransport({ isTestnet: false });
  const info = new InfoClient({ transport });

  const agentWallet = new ethers.Wallet(process.env.HL_AGENT_PRIVATE_KEY);
  const client = new ExchangeClient({
    wallet: agentWallet,
    transport,
    isTestnet: false
  });

  // 1. Auditoría del clearinghouseState
  const ch = await info.clearinghouseState({ user: VAULT_501 });
  const openOrders = await info.openOrders({ user: VAULT_501 });
  const positions = ch.assetPositions || [];

  const avaxPos = positions.find(p => p.position.coin === "AVAX");
  if (!avaxPos || parseFloat(avaxPos.position.szi) === 0) {
    console.log("No hay posición activa en AVAX.");
    return;
  }

  const sziTotal = parseFloat(avaxPos.position.szi);
  const entryPx = parseFloat(avaxPos.position.entryPx);
  const markPx = parseFloat(avaxPos.position.positionValue) / sziTotal;
  const unrealizedPnl = parseFloat(avaxPos.position.unrealizedPnl);

  console.log(`\n📊 ESTADO ACTUAL AVAX:`);
  console.log(`• Dirección: LONG`);
  console.log(`• Tamaño Total: ${sziTotal} AVAX (~$${(sziTotal * markPx).toFixed(2)} USD)`);
  console.log(`• Precio Entrada Promedio: $${entryPx.toFixed(4)}`);
  console.log(`• Mark Price Estimado: $${markPx.toFixed(4)}`);
  console.log(`• Unrealized PnL: $${unrealizedPnl.toFixed(2)} USDC`);
  console.log(`• Liquidación: $${parseFloat(avaxPos.position.liquidationPx || "0").toFixed(4)}`);

  // 2. Cancelar órdenes de salida previas en AVAX
  const avaxOrders = openOrders.filter(o => o.coin === "AVAX");
  if (avaxOrders.length > 0) {
    console.log(`\n🗑️ Cancelando ${avaxOrders.length} orden(es) previa(s) de AVAX...`);
    await client.cancel({
      cancels: avaxOrders.map(o => ({ a: ASSET_INDICES["AVAX"], o: o.oid }))
    });
    console.log("✔ Órdenes previas de AVAX canceladas.");
  }

  // 3. Colocar Salida Escalonada en 2 Tramos
  // Tramo 1 (50% Descarga de Alivio): 174.89 AVAX @ $8.890
  // Tramo 2 (50% Salida Banda Media): 174.90 AVAX @ $8.942
  const szHalf1 = formatHlSize(sziTotal / 2, 2); // 174.89
  const szHalf2 = formatHlSize(sziTotal - parseFloat(szHalf1), 2); // 174.90
  const pxTramo1 = formatHlPrice(8.890, "AVAX");
  const pxTramo2 = formatHlPrice(8.942, "AVAX");

  console.log(`\n🎯 COLOCANDO SALIDA ESCALONADA:`);
  console.log(`• Tramo 1 (50% Alivio Inmediato): ${szHalf1} AVAX @ $${pxTramo1} (ReduceOnly ALO)`);
  console.log(`• Tramo 2 (50% Salida Banda Media): ${szHalf2} AVAX @ $${pxTramo2} (ReduceOnly ALO)`);

  const orderRes = await client.order({
    orders: [
      {
        a: ASSET_INDICES["AVAX"],
        b: false, // Sell to close Long
        p: pxTramo1,
        s: szHalf1,
        r: true,
        t: { limit: { tif: "Alo" } }
      },
      {
        a: ASSET_INDICES["AVAX"],
        b: false, // Sell to close Long
        p: pxTramo2,
        s: szHalf2,
        r: true,
        t: { limit: { tif: "Alo" } }
      }
    ],
    grouping: "na"
  });

  console.log("✔ Respuesta orden escalonada AVAX:", JSON.stringify(orderRes.response?.data?.statuses || orderRes));

  // 4. Asegurar ganancia en BNB si está abierta y no tiene TP
  const bnbPos = positions.find(p => p.position.coin === "BNB");
  if (bnbPos && parseFloat(bnbPos.position.szi) > 0) {
    const bnbSz = parseFloat(bnbPos.position.szi);
    const bnbEntry = parseFloat(bnbPos.position.entryPx);
    const bnbOrders = openOrders.filter(o => o.coin === "BNB" && o.reduceOnly);
    if (bnbOrders.length === 0) {
      const bnbTpPx = formatHlPrice(Math.max(bnbEntry * 1.006, 749.5), "BNB");
      const bnbSzStr = formatHlSize(bnbSz, 3);
      console.log(`\n🛡️ Protegiendo ganancia en BNB: ${bnbSzStr} BNB @ $${bnbTpPx} (TP ReduceOnly ALO)`);
      try {
        await client.order({
          orders: [{
            a: ASSET_INDICES["BNB"],
            b: false,
            p: bnbTpPx,
            s: bnbSzStr,
            r: true,
            t: { limit: { tif: "Alo" } }
          }],
          grouping: "na"
        });
        console.log("✔ TP para BNB colocado con éxito.");
      } catch (err) {
        console.error("Error colocando TP BNB:", err.message);
      }
    }
  }

  // 5. Notificar a Telegram
  const tgMsg = `🚁🛡️ <b>ÁREA 501 // OPERACIÓN RESCATE #00: AVAX-USDC</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📍 <b>Activo:</b> <code>AVAX-USDC (LONG)</code>\n` +
    `📦 <b>Volumen Total:</b> <code>${sziTotal} AVAX (~$${(sziTotal * markPx).toFixed(2)} USD)</code>\n` +
    `💰 <b>Precio de Entrada:</b> <code>$${entryPx.toFixed(4)}</code> (Mark: $${markPx.toFixed(4)})\n` +
    `🛡️ <b>Liquidación Segura:</b> <code>$${parseFloat(avaxPos.position.liquidationPx || "0").toFixed(4)}</code>\n\n` +
    `🎯 <b>SALIDA ESCALONADA ACTIVADA:</b>\n` +
    `1. 🪜 <b>Tramo 1 (50% Alivio):</b> <code>${szHalf1} AVAX @ $${pxTramo1}</code>\n` +
    `   ➔ Libera ~$1,550 USD de nocional sin pérdida en el primer impulso.\n` +
    `2. 🎯 <b>Tramo 2 (50% Banda Media):</b> <code>${szHalf2} AVAX @ $${pxTramo2}</code>\n` +
    `   ➔ Salida final en Banda Media de 1H con Candado BE #00.\n` +
    `🚫 <b>Nuevas Entradas:</b> CONGELADAS temporalmente hasta finalizar extracción.\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 <i>Departamento de Mitigación de Riesgo Squad Matrix.</i>`;

  await sendTelegramAlert(tgMsg, process.env.TELEGRAM_CHAT_ID || "-1004342131598", { skipHeader: true });
  console.log("\n📱 Notificación enviada a Telegram con éxito.");
}

runRescue().catch(console.error);
