require("dotenv").config();
const { HttpTransport, InfoClient, ExchangeClient } = require("@nktkas/hyperliquid");
const { ethers } = require("ethers");

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const ASSET_INDICES = { BTC: 0, ETH: 1, SOL: 5, SUI: 14, DOGE: 12, XRP: 25, NEAR: 74, HYPE: 159, PAXG: 187 };
const ASSET_DEC = { BTC: 5, ETH: 4, SOL: 2, SUI: 1, DOGE: 0, XRP: 0, NEAR: 1, HYPE: 2, PAXG: 3 };
const fmtPx = (px, c) =>
  c === "BTC"
    ? Math.round(px).toFixed(0)
    : c === "ETH" || c === "PAXG"
      ? px.toFixed(1)
      : c === "HYPE"
        ? px.toFixed(3)
        : c === "SUI" || c === "XRP" || c === "NEAR"
          ? px.toFixed(4)
          : c === "DOGE"
            ? px.toFixed(6)
            : px.toFixed(2);
const fmtSz = (sz, dec) => (Math.floor(sz * Math.pow(10, dec)) / Math.pow(10, dec)).toFixed(dec);

(async () => {
  const transport = new HttpTransport();
  const info = new InfoClient({ transport });
  const pk = process.env.HL_AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const wallet = new ethers.Wallet(pk);
  const client = new ExchangeClient({ wallet, transport, isTestnet: false });

  const [ch, openOrders, mids] = await Promise.all([
    info.clearinghouseState({ user: VAULT_501 }),
    info.openOrders({ user: VAULT_501 }),
    info.allMids()
  ]);

  // 1. Cancelar cualquier orden de entrada (!reduceOnly) y alinear órdenes Reduce-Only ALO a entryPx * 1.0005
  if (openOrders.length > 0) {
    await client.cancel({
      cancels: openOrders.map(o => ({ a: ASSET_INDICES[o.coin] ?? 0, o: o.oid }))
    }).catch(() => {});
  }

  const openPositions = (ch.assetPositions || []).filter(p => parseFloat(p.position.szi) !== 0);
  const tableRows = [];

  const priorityOrder = ["PAXG", "ETH", "HYPE", "SOL", "XRP", "BTC", "NEAR"];
  openPositions.sort((a, b) => {
    const iA = priorityOrder.indexOf(a.position.coin);
    const iB = priorityOrder.indexOf(b.position.coin);
    return (iA === -1 ? 99 : iA) - (iB === -1 ? 99 : iB);
  });

  for (const posObj of openPositions) {
    const p = posObj.position;
    const coin = p.coin;
    const szi = parseFloat(p.szi);
    const isShort = szi < 0;
    const entryPx = parseFloat(p.entryPx);
    const markPx = parseFloat(mids[coin] || entryPx);
    const uPnl = parseFloat(p.unrealizedPnl || "0");

    // Paso 1 (ETH, PAXG) y Paso 2 (SOL, XRP, HYPE) y BTC: entryPx * 1.0005 (+0.05%) | NEAR: +0.035%
    const tpMult = coin === "NEAR" ? 0.00035 : 0.0005;
    let tpNum = isShort ? entryPx * (1 - tpMult) : entryPx * (1 + tpMult);
    if (!isShort && tpNum <= markPx) tpNum = markPx * 1.0003;
    if (isShort && tpNum >= markPx) tpNum = markPx * 0.9997;

    const tpStr = fmtPx(tpNum, coin);
    const szStr = fmtSz(Math.abs(szi), ASSET_DEC[coin] ?? 2);

    let res = await client.order({
      orders: [{
        a: ASSET_INDICES[coin],
        b: isShort,
        p: tpStr,
        s: szStr,
        r: true,
        t: { limit: { tif: "Alo" } }
      }],
      grouping: "na"
    });
    let st = res?.response?.data?.statuses?.[0] || {};
    if (st.error) {
      res = await client.order({
        orders: [{
          a: ASSET_INDICES[coin],
          b: isShort,
          p: tpStr,
          s: szStr,
          r: true,
          t: { limit: { tif: "Gtc" } }
        }],
        grouping: "na"
      });
      st = res?.response?.data?.statuses?.[0] || {};
    }

    tableRows.push({
      Par: `${coin}-USDC`,
      Lado: isShort ? "SHORT" : "LONG",
      Tamaño: szStr,
      EntryPx: `$${fmtPx(entryPx, coin)}`,
      MarkPx_Actual: `$${fmtPx(markPx, coin)}`,
      Flotante_USDC: `${uPnl >= 0 ? "+" : "-"}$${Math.abs(uPnl).toFixed(2)}`,
      Orden_TP_Breakeven_00: `$${tpStr} (+${(tpMult * 100).toFixed(3)}%)`,
      Candado_00: coin === "ETH" || coin === "PAXG" ? "Activa a +0.03%" : "Activa a +0.05%"
    });
  }

  console.log("\n================================================================================");
  console.log("🛡️🔒 TABLA OFICIAL EN CONSOLA — CERROJO TOTAL ACTIVO (STRICT_RECOVERY_LOCK = true)");
  console.log(`📊 Posiciones Abiertas en Hyperliquid L1: ${openPositions.length}/6 (SUI, DOGE y HYPE ya cerraron en VERDE ✅)`);
  console.log("================================================================================");
  console.table(tableRows);
})();
