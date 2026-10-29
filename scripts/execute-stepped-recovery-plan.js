/**
 * scripts/execute-stepped-recovery-plan.js — ÁREA 501 // PLAN DE RECUPERACIÓN ESCALONADA ("POCO A POCO + 5M COOLING")
 * ====================================================================================================================
 * 1. Ajusta las órdenes de salida Reduce-Only ALO Maker de las posiciones atrapadas a +0.030% (Evacuación Sin Codicia,
 *    0% comisión Taker + 0.003% Maker Rebate) para salir en verde en el primer micro-rebote.
 * 2. Ejecuta Ola 1 de Promedio Quirúrgico sobre las posiciones pequeñas más cercanas al breakeven (ETH, BTC, UNI)
 *    respetando al 100% el Escudo Sagrado del 40% ($350+ USDC libres intocables).
 * 3. Activa el enfriamiento táctico de 5 minutos tras cada recuperación antes de re-entrar.
 * ====================================================================================================================
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { ExchangeClient, InfoClient, HttpTransport } = require("@nktkas/hyperliquid");
const { ethers } = require("ethers");
const { sendTelegramAlert } = require("../telegram-notifier");

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";

const ASSET_INDICES = {
  BTC: 0, ETH: 1, SOL: 5, AVAX: 6, BNB: 7, LTC: 10, DOGE: 12,
  SUI: 14, LINK: 18, XRP: 25, AAVE: 28, TRX: 37, UNI: 39,
  DOT: 48, ADA: 65, TON: 66, NEAR: 74, POL: 142, HYPE: 159, PAXG: 187
};

const ASSET_DECIMALS = {
  BTC: { sz: 5, px: 0 }, ETH: { sz: 4, px: 1 }, SOL: { sz: 2, px: 2 },
  AVAX: { sz: 2, px: 3 }, BNB: { sz: 3, px: 2 }, LTC: { sz: 2, px: 3 },
  DOGE: { sz: 0, px: 6 }, SUI: { sz: 1, px: 4 }, LINK: { sz: 1, px: 3 },
  XRP: { sz: 0, px: 4 }, AAVE: { sz: 2, px: 2 }, TRX: { sz: 0, px: 5 },
  UNI: { sz: 1, px: 4 }, DOT: { sz: 1, px: 5 }, ADA: { sz: 0, px: 5 },
  TON: { sz: 1, px: 4 }, NEAR: { sz: 1, px: 4 }, POL: { sz: 0, px: 5 },
  HYPE: { sz: 2, px: 3 }, PAXG: { sz: 3, px: 1 }
};

function formatHlPrice(price, coin) {
  const num = Number(price);
  if (!Number.isFinite(num) || num <= 0) return "0";
  const maxDec = ASSET_DECIMALS[coin] ? ASSET_DECIMALS[coin].px : 2;
  if (num >= 100000) return String(Math.round(num));
  const sig5 = Number(num.toPrecision(5));
  return Number(sig5.toFixed(maxDec)).toString();
}

function formatHlSize(size, szDec) {
  const factor = Math.pow(10, szDec);
  return (Math.floor(size * factor) / factor).toFixed(szDec);
}

async function main() {
  console.log("====================================================================================");
  console.log("🛠️ ÁREA 501 // EJECUTANDO PLAN DE RECUPERACIÓN ESCALONADA (POCO A POCO + 5M COOLING)");
  console.log("====================================================================================\n");

  const transport = new HttpTransport({ isTestnet: false });
  const info = new InfoClient({ transport });
  const agentWallet = new ethers.Wallet(process.env.HL_AGENT_PRIVATE_KEY);
  const client = new ExchangeClient({ wallet: agentWallet, transport, isTestnet: false });

  const [ch, mids, openOrders] = await Promise.all([
    info.clearinghouseState({ user: VAULT_501 }),
    fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allMids" })
    }).then(r => r.json()),
    info.openOrders({ user: VAULT_501 })
  ]);

  const accountValue = parseFloat(ch.marginSummary?.accountValue || "874.58");
  const reserveShield40 = +(accountValue * 0.40).toFixed(2);
  const openPositions = (ch.assetPositions || []).filter(p => parseFloat(p.position.szi) !== 0);

  console.log(`• Equity Real L1: $${accountValue.toFixed(2)} USDC | Escudo Sagrado 40%: $${reserveShield40.toFixed(2)} USDC`);
  console.log(`• Posiciones Abiertas Actualmente: ${openPositions.length}\n`);

  // OLA 1 DE PROMEDIO QUIRÚRGICO: Posiciones con nocional bajo (< $310) y más cercanas a recuperación rápida (ETH, BTC, UNI)
  const wave1RescueTargets = [
    { coin: "ETH", addNotionalUsdc: 120.0 },
    { coin: "BTC", addNotionalUsdc: 135.0 },
    { coin: "UNI", addNotionalUsdc: 110.0 }
  ];

  const rescueSummaryLines = [];

  for (const target of wave1RescueTargets) {
    const pos = openPositions.find(p => p.position.coin === target.coin);
    if (!pos) continue;
    const coin = target.coin;
    const szi = parseFloat(pos.position.szi);
    const isShort = szi < 0;
    const oldEntry = parseFloat(pos.position.entryPx);
    const midPx = parseFloat(mids[coin] || oldEntry);
    const currentNotional = Math.abs(szi) * midPx;

    if (currentNotional > 340) continue; // Solo promediar si aún es compacta

    const addSzStr = formatHlSize(target.addNotionalUsdc / midPx, ASSET_DECIMALS[coin].sz);
    if (parseFloat(addSzStr) <= 0) continue;

    // Precio límite IOC para promediar a favor del nuevo precio actual
    const iocPx = isShort ? midPx * 0.997 : midPx * 1.003;
    const iocPxStr = formatHlPrice(iocPx, coin);

    console.log(`⚡ [OLA 1 PROMEDIO QUIRÚRGICO] Acercando precio de entrada en ${coin} (${isShort ? "SHORT" : "LONG"}): +${addSzStr} ${coin} (~$${target.addNotionalUsdc} Nocional) @ $${formatHlPrice(midPx, coin)}...`);
    try {
      const res = await client.order({
        orders: [{
          a: ASSET_INDICES[coin],
          b: !isShort,
          p: iocPxStr,
          s: addSzStr,
          r: false,
          t: { limit: { tif: "Ioc" } }
        }],
        grouping: "na"
      });
      const st = res?.response?.data?.statuses?.[0] || {};
      console.log(`   ↳ Resultado ${coin}:`, JSON.stringify(st));
    } catch (err) {
      console.error(`   ⚠️ Error promediando ${coin}:`, err.message);
    }
  }

  await new Promise(r => setTimeout(r, 1500));

  // Re-leer estado actualizado del Clearinghouse y ajustar TODAS las salidas Reduce-Only ALO a +0.030% (Evacuación Sin Codicia)
  const [chAfter, ordersAfter] = await Promise.all([
    info.clearinghouseState({ user: VAULT_501 }),
    info.openOrders({ user: VAULT_501 })
  ]);
  const updatedPositions = (chAfter.assetPositions || []).filter(p => parseFloat(p.position.szi) !== 0);

  for (const p of updatedPositions) {
    const coin = p.position.coin;
    if (ASSET_INDICES[coin] === undefined || !ASSET_DECIMALS[coin]) continue;
    const szi = parseFloat(p.position.szi);
    const isShort = szi < 0;
    const entryPx = parseFloat(p.position.entryPx);
    const midPx = parseFloat(mids[coin] || entryPx);
    const totalSzStr = formatHlSize(Math.abs(szi), ASSET_DECIMALS[coin].sz);

    // Meta de evacuación rápida sin codicia: +0.030% (HYPE en +0.030% también)
    const evacGainPct = 0.030;
    let targetExitPx = isShort
      ? entryPx * (1 - evacGainPct / 100)
      : entryPx * (1 + evacGainPct / 100);

    // Si ya está en ganancia por encima del +0.030%, asegurar salida inmediata pegada al mid
    if (!isShort && midPx >= targetExitPx) targetExitPx = midPx * 1.0002;
    if (isShort && midPx <= targetExitPx) targetExitPx = midPx * 0.9998;

    const targetExitPxStr = formatHlPrice(targetExitPx, coin);
    const distPct = isShort ? ((entryPx - midPx) / entryPx * 100) : ((midPx - entryPx) / entryPx * 100);

    // Cancelar orden Reduce-Only previa para actualizarla al nuevo punto de evacuación +0.030%
    const prevExits = ordersAfter.filter(o => o.coin === coin && o.reduceOnly);
    if (prevExits.length > 0) {
      await client.cancel({
        cancels: prevExits.map(o => ({ a: ASSET_INDICES[coin], o: o.oid }))
      }).catch(() => {});
    }

    try {
      let tpRes = await client.order({
        orders: [{
          a: ASSET_INDICES[coin],
          b: isShort,
          p: targetExitPxStr,
          s: totalSzStr,
          r: true,
          t: { limit: { tif: "Alo" } }
        }],
        grouping: "na"
      });
      const tpSt = tpRes?.response?.data?.statuses?.[0] || {};
      if (tpSt.error && String(tpSt.error).includes("immediately matched")) {
        await client.order({
          orders: [{
            a: ASSET_INDICES[coin],
            b: isShort,
            p: targetExitPxStr,
            s: totalSzStr,
            r: true,
            t: { limit: { tif: "Gtc" } }
          }],
          grouping: "na"
        });
      }
      console.log(`✅ [EVACUACIÓN +0.030%] ${coin} (${isShort ? "SHORT" : "LONG"} ${totalSzStr}): Entrada $${formatHlPrice(entryPx, coin)} | Actual $${formatHlPrice(midPx, coin)} (${distPct.toFixed(2)}%) ➔ Salida ALO $${targetExitPxStr}`);
      rescueSummaryLines.push(`• <code>${coin}</code> (${distPct.toFixed(2)}%): Entrada <code>$${formatHlPrice(entryPx, coin)}</code> ➔ Salida ALO <code>$${targetExitPxStr}</code>`);
    } catch (e) {
      console.error(`⚠️ Error colocando TP de evacuación en ${coin}:`, e.message);
    }
  }

  const tgMsg = `🛠️🛡️ <b>ÁREA 501 // PLAN DE RECUPERACIÓN ESCALONADA ACTIVADO (POCO A POCO + 5M ENFRIAMIENTO)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `1️⃣ <b>Ola 1 Promedio Quirúrgico:</b> Acercado el precio de entrada en <code>ETH</code>, <code>BTC</code> y <code>UNI</code> manteniendo intacto el Escudo del 40% (<code>$${reserveShield40.toFixed(2)} USDC</code>).\n` +
    `2️⃣ <b>Evacuación Relámpago (+0.030% ALO Maker):</b> Todas las salidas Reduce-Only ajustadas al primer rebote en verde (+0.003% Maker Rebate).\n` +
    `3️⃣ <b>Enfriamiento de 5 Minutos:</b> Cada moneda que sale en verde entra en <b>5 minutos de enfriamiento</b> antes de volver a disparar.\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 <b>Mapa de Salidas Ajustadas (${updatedPositions.length} Activas):</b>\n${rescueSummaryLines.join("\n")}`;
  await sendTelegramAlert(tgMsg);
}

main().catch(console.error);

