const { sendTelegramAlert } = require("../telegram-notifier");

async function notify() {
  const msg = `🚀💵 <b>EJECUCIÓN ON-CHAIN CONFIRMADA: SWAP 1,826.764 POL ➔ USDC NATIVO EN BÓVEDA #501</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 <b>BÓVEDA MATRIZ #501:</b> <code>0xD4D12077a61118372f7a367319fb11922Beb3743</code>
📥 <b>Depósito Detectado:</b> <a href="https://polygonscan.com/tx/0x4dcc07f0cf531571e48eb2c8ff9ff54da69ef47760bacf7c5d193f509b1dd721">1,826.764 POL en Polygon PoS</a>

🔄 <b>SWAP UNISWAP V3 POOL 500 (0.05% FEE):</b>
• <b>Tx Hash Swap:</b> <a href="https://polygonscan.com/tx/0xf65066517ceec7d32bde69153703eb5bac53327851ee2abbbb8fab5216162e8d">0xf65066517ceec7d32bde69153703eb5bac53327851ee2abbbb8fab5216162e8d</a>
• <b>Tx Wrap WPOL:</b> <a href="https://polygonscan.com/tx/0x39b4b29cd829c25e2555486c73e2e6668834a8f2187d8ceaeb57ce32fac5e881">0x39b4b29cd829c25e2555486c73e2e6668834a8f2187d8ceaeb57ce32fac5e881</a>
• <b>USDC Nativo Recibido:</b> <code>+$161.488091 USDC</code>
• <b>Nuevo Saldo USDC en #501:</b> <code>$459.400093 USDC</code>
• <b>Tanque Gas Intacto:</b> <code>155.05 / 150.00 POL</code> (100% BLINDADO ✔)

🏛️ <b>NUEVA BASE LÍQUIDA ON-CHAIN CONSOLIDADA:</b>
• <b>Polygon (#501 + #001):</b> <code>$464.40 USDC</code>
• <b>BSC (#501 / #101):</b> <code>$21.52 USDC</code>
• <b>Binance Spot #1:</b> <code>$1.00 USDC</code>
• <b>TOTAL BASE ON-CHAIN:</b> <b>$486.92 USDC</b>

🏆 <b>CORONACIÓN HISTÓRICA:</b>
• <b>Primera Bola ($330.00 USDC):</b> <b>CORONADA ✅</b>
• <b>Segunda Bola ($500.00 USDC):</b> <b>CORONADA ✅</b>
• <b>PnL Preservado Acumulado:</b> <code>+$67.82+ USDC</code> (205G - 0P al 100% Win)
• <b>Nuevo Capital Consolidado:</b> <b>$554.74+ USDC</b>
• <b>Bloque $550.00:</b> <b>ASENTADO EN FIRME EN #501 ✅</b>

🎯 <b>ACTIVACIÓN OFICIAL: TERCERA BOLA ($1,000.00 USDC)</b>
• <b>Próximo Bloque Inmediato:</b> <code>$600.00 USDC</code>
• <b>Nuevo Cobro Compuesto (+0.15%):</b> <b>+$0.83 a +$0.85 USDC netos por tiro</b>
• <b>Cadencia Sagrada:</b> <code>1m Tiro + 2m Descanso (Ciclo 180s)</code>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>Capitalización y asentamiento por bloques cerrados en estricta disciplina de gas $0.00.</i>`;

  const ok = await sendTelegramAlert(msg);
  console.log("Telegram Alert Sent:", ok);
}

notify().catch(e => console.error("Error enviando alerta:", e));
