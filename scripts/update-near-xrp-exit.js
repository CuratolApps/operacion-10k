require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { ExchangeClient, InfoClient, HttpTransport } = require("@nktkas/hyperliquid");
const { ethers } = require("ethers");

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

(async () => {
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

  const openPositions = (ch.assetPositions || []).filter(p => parseFloat(p.position.szi) !== 0);
  console.log(`Posiciones abiertas actuales: ${openPositions.length}`);

  // Cancel any non-reduce-only (entry) orders first
  const entryOrders = openOrders.filter(o => !o.reduceOnly);
  if (entryOrders.length > 0) {
    console.log(`Cancelando ${entryOrders.length} ordenes de entrada pendientes...`);
    for (const o of entryOrders) {
      if (ASSET_INDICES[o.coin] !== undefined) {
        await client.cancel({ cancels: [{ a: ASSET_INDICES[o.coin], o: o.oid }] }).catch(() => {});
      }
    }
  }

  // Align Reduce-Only ALO Maker exit orders for all open positions
  const tier1 = new Set(["ETH", "PAXG", "SUI", "DOGE", "LTC"]);
  const tier2 = new Set(["SOL", "HYPE", "BTC", "XRP"]);

  for (const pObj of openPositions) {
    const p = pObj.position;
    const coin = p.coin;
    if (ASSET_INDICES[coin] === undefined) continue;
    const szi = parseFloat(p.szi);
    const isShort = szi < 0;
    const entryPx = parseFloat(p.entryPx);
    const midPx = parseFloat(mids[coin] || entryPx);
    const szStr = formatHlSize(Math.abs(szi), ASSET_DECIMALS[coin].sz);

    // Target % based on Escalón 1 (+0.06%), Escalón 2 (+0.055%), Escalón 3 NEAR (+0.035%)
    const targetPct = tier1.has(coin) ? 0.060 : (tier2.has(coin) ? 0.055 : 0.035);
    let rawTp = isShort ? entryPx * (1 - targetPct / 100) : entryPx * (1 + targetPct / 100);
    // Ensure ALO doesn't cross book
    if (isShort && rawTp >= midPx) rawTp = midPx * 0.9996;
    if (!isShort && rawTp <= midPx) rawTp = midPx * 1.0004;

    const tpPxStr = formatHlPrice(rawTp, coin);

    const existing = openOrders.filter(o => o.coin === coin);
    for (const eo of existing) {
      await client.cancel({ cancels: [{ a: ASSET_INDICES[coin], o: eo.oid }] }).catch(() => {});
    }

    const res = await client.order({
      orders: [{
        a: ASSET_INDICES[coin],
        b: isShort,
        p: tpPxStr,
        s: szStr,
        r: true,
        t: { limit: { tif: "Alo" } }
      }],
      grouping: "na"
    }).catch(e => ({ error: e.message }));

    console.log(`✅ ${coin} (${isShort ? "SHORT" : "LONG"} ${szStr} @ $${entryPx} | Mid: $${midPx}) -> TP ALO Reduce-Only @ $${tpPxStr} (+${targetPct}%): ${JSON.stringify(res?.response?.data?.statuses || res)}`);
  }
})();
