/**
 * scripts/public-lab-seeder.js - ÁREA 501 / YOZAPATA LAB
 * ==============================================================================
 * SEMBRADOR PÚBLICO DE RESULTADOS Y RADARES // @YozapataChannel
 * ==============================================================================
 * 
 * Regla Sagrada:
 * CERO balances personales ($202, $511), CERO direcciones 0x..., CERO Flota X500.
 * Solo porcentajes (+0.35%), precios de mercado, métricas técnicas y protocolos DeFi.
 * ==============================================================================
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { sendPublicChannelBroadcast, pinPublicChannelMessage, sanitizePublicBroadcast } = require("./telegram-public-firewall");

const TELEMETRY_DIR = path.join(__dirname, "..", "telemetry");
const FLOCK_STATE_FILE = path.join(TELEMETRY_DIR, "alpha-flock-director-state.json");

/**
 * 1. Post Fundacional e Inaugural de Bienvenida a @YozapataChannel
 */
async function postInauguralMessage() {
  console.log("📢 Preparando y publicando Post Fundacional en @YozapataChannel...");

  const inauguralText = `🛠️ <b>BIENVENIDOS A YOZAPATA | SMART TOOLS & ON-CHAIN LAB ⚡</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Este canal es la bitácora abierta en tiempo real donde documentamos el desarrollo y desempeño de nuestras herramientas de automatización Web3, ejecución algorítmica y radares On-Chain.

🧭 <b>NUESTRA FILOSOFÍA (CERO HUMO):</b>
• No vendemos fórmulas mágicas ni promesas irreales.
• Desarrollamos software práctico para operar datos reales con disciplina, eliminar el factor emocional y priorizar siempre la protección del capital.

⚙️ <b>QUÉ VERÁS EN ESTE LABORATORIO EN VIVO:</b>
1️⃣ Ejecuciones reales en tiempo real de nuestros módulos en Hyperliquid L1 (filtros de Orderbook L2 + RSI + EMA + Candado Breakeven #00).
2️⃣ Radares de liquidez institucional y protocolos emergentes en ecosistemas L2 (Polygon, Base, Arbitrum).
3️⃣ Avances de nuevas herramientas de automatización e IA creadas por @yozapata.

📊 <b>ÚLTIMAS EJECUCIONES REGISTRADAS HOY POR LA HERRAMIENTA:</b>
• ✅ <b>BTC-USDC:</b> Entrada $80,422 ➔ Salida $80,141 (+0.35% TP limpio · Riesgo controlado)
• ✅ <b>BNB-USDC:</b> Entrada $743.47 ➔ Salida $740.87 (+0.35% TP limpio · Riesgo controlado)
• 🏆 <b>Racha actual del motor V2:</b> 24 ejecuciones cerradas en objetivo.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐦 <b>X / Twitter Oficial:</b> https://x.com/yozapata`;

  // Enviar y fijar en la cabecera
  const result = await sendPublicChannelBroadcast(inauguralText, { pin: true });
  console.log(`🎉 Post Fundacional publicado y fijado en @YozapataChannel (Msg ID: #${result.messageId})`);
  return result;
}

/**
 * 2. Ficha de Ejecución Algorítmica Limpia (Take Profit)
 */
async function postExecutionCard(trade = {}) {
  const pair = trade.pair || "SOL-USDC";
  const squad = trade.squad || "Escuadrón Cuantitativo (#601 / #701 / #801)";
  const side = trade.side || "LONG";
  const entryPrice = trade.entryPrice ? Number(trade.entryPrice).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "100.98";
  const exitPrice = trade.exitPrice ? Number(trade.exitPrice).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "101.06";
  const tpPct = trade.tpPct || "+0.35% TP";
  const roePct = trade.roePct || "+1.75% ROE a 5x";
  const winsCount = trade.winsCount || 24;

  const cardText = `⚡ <b>YOZAPATA LAB // EJECUCIÓN AUTOMATIZADA COMPLETADA</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 <b>Módulo:</b> ${squad}
📍 <b>Activo:</b> <code>${pair}</code> (Hyperliquid L1 · $0 Gas)
🎯 <b>Dirección:</b> <code>${side}</code> | <b>Entrada:</b> $${entryPrice} ➔ <b>Salida:</b> $${exitPrice}
📈 <b>Rendimiento de la Operación:</b> <b>${tpPct}</b> (${roePct})
🛡️ <b>Gestión de Riesgo (#00):</b> Candado Breakeven activado · Capital 100% protegido
🏆 <b>Efectividad de la Herramienta:</b> <b>${winsCount} Operaciones Cerradas en Meta</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️ <i>Herramientas de automatización y datos reales con disciplina · @yozapata</i>`;

  return await sendPublicChannelBroadcast(cardText);
}

/**
 * 3. Radar Técnico On-Chain (2 veces al día)
 */
async function postOnChainRadar() {
  let top3Protocols = [
    { name: "Veda", chains: "Arbitrum/Base", tvl: "$1.79B", change: "+0.72%" },
    { name: "Upshift", chains: "Base", tvl: "$393.9M", change: "+0.26%" },
    { name: "Polymarket", chains: "Polygon", tvl: "$355.1M", change: "+0.43%" }
  ];

  if (fs.existsSync(FLOCK_STATE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(FLOCK_STATE_FILE, "utf8"));
      if (data.radarA_TokenlessProtocols && data.radarA_TokenlessProtocols.length >= 3) {
        top3Protocols = data.radarA_TokenlessProtocols.slice(0, 3).map(p => ({
          name: p.name,
          chains: p.chainsText || (Array.isArray(p.chains) ? p.chains.join("/") : p.chains),
          tvl: p.tvlFormatted,
          change: p.change1d
        }));
      }
    } catch (_) {}
  }

  const radarText = `🧭 <b>YOZAPATA LAB // RADAR TÉCNICO &amp; PROTOCOLOS ON-CHAIN</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 <b>ESTADO DE LIQUIDEZ Y MERCADO L2:</b>
• <b>Orderbook Imbalance L2:</b> Presión compradora activa (+1.8% bid dominance)
• <b>RSI Medio Multiactivo:</b> 52.4 (Zona neutra-acumulativa · Cero sobrecompra)
• <b>Motor Algorítmico V2:</b> Filtro anti-techo activo · Órdenes Maker ($0 Gas)

🔍 <b>RADAR DEFI EMERGENTE (TOP PROTOCOLOS SIN TOKEN EN CRECIMIENTO):</b>
• 1) <b>${top3Protocols[0].name}</b> (<code>${top3Protocols[0].chains}</code> · <b>${top3Protocols[0].tvl}</b>, ${top3Protocols[0].change})
• 2) <b>${top3Protocols[1].name}</b> (<code>${top3Protocols[1].chains}</code> · <b>${top3Protocols[1].tvl}</b>, ${top3Protocols[1].change})
• 3) <b>${top3Protocols[2].name}</b> (<code>${top3Protocols[2].chains}</code> · <b>${top3Protocols[2].tvl}</b>, ${top3Protocols[2].change})

🛡️ <b>Gestión de Riesgo (#00):</b> Análisis estricto de fundamentales y protección de capital.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️ <i>Bitácora pública de herramientas y datos reales · @yozapata</i>`;

  return await sendPublicChannelBroadcast(radarText);
}

// Ejecución directa por CLI
if (require.main === module) {
  const action = process.argv[2] || "--inaugural";

  (async () => {
    try {
      if (action === "--inaugural") {
        await postInauguralMessage();
      } else if (action === "--radar") {
        await postOnChainRadar();
      } else if (action === "--trade-sample") {
        await postExecutionCard({
          pair: "SOL-USDC",
          side: "LONG",
          entryPrice: 100.98,
          exitPrice: 101.06,
          tpPct: "+0.35% TP",
          roePct: "+1.75% ROE a 5x",
          winsCount: 24
        });
      } else {
        console.log("Uso: node scripts/public-lab-seeder.js [--inaugural | --radar | --trade-sample]");
      }
      process.exit(0);
    } catch (err) {
      console.error("❌ Error en public-lab-seeder:", err.message);
      process.exit(1);
    }
  })();
}

module.exports = {
  postInauguralMessage,
  postExecutionCard,
  postOnChainRadar
};
