// scripts/send-official-execution-telegram.js
require("dotenv").config();
const { sendTelegramAlert } = require("../telegram-notifier");

async function main() {
  const chatId = process.env.TELEGRAM_CHAT_ID || "-1004342131598";

  const message = `🚀 <b>ÁREA 501 // EJECUCIÓN ON-CHAIN Y CAPITALIZACIÓN CONFIRMADA</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏛️ <b>PROCESAMIENTO DE 1,492.988 POL EN BÓVEDA #501:</b>
• <b>Depósito Matriz:</b> <code>1,492.988 POL</code> acreditados
• <b>Tx Entrada:</b> <a href="https://polygonscan.com/tx/0x145884b6625fc474bb9dd29ff0a6f6cc6f20a7f5eecccc1f3c6b8a0a4984dc74">0x1458...dc74</a>
• <b>Gas Blindado Polygon:</b> <code>160.85 POL</code> (Piso 155.05 POL intocable ✔)

📦 <b>CÁMARA 1 (POLYGON #501 — PISO CORONADO):</b>
• <b>Swap On-Chain:</b> 455 POL ➔ +$40.91 USDC Nativo
• <b>TxHash Polygon:</b> <a href="https://polygonscan.com/tx/0xf80f58d64bae914e96b979a17ccd2cf02eb6b1b71df546e0500df7bedcb44996">0xf80f...4996</a>
• <b>Saldo Consolidado Cámara 1:</b> <b>$500.31 USDC</b> (Piso <b>$500.00 USDC 100% CORONADO ✅</b>)
• <b>Estrategia Activa:</b> Aave V3 + Flash Arbitrage Atómico (0% Riesgo)

⚡ <b>CÁMARA 2 (ARBITRUM ONE ➔ HYPERLIQUID L1):</b>
• <b>Gas Arbitrum:</b> 22 POL ➔ 0.00085 ETH (~$2.00 USD)
  ↳ <a href="https://polygonscan.com/tx/0xd9b3f3731afe6485e3b9711a7412d044ab9fc7cfe43738088244fad4e81d8b1b">Bridge ETH Tx</a>
• <b>Capital Puenteado:</b> 1,010 POL ➔ $90.49 USDC Nativo en Arbitrum
  ↳ <a href="https://polygonscan.com/tx/0x061115c5eb5d3e7c1b70bac66865a47564cc288e0ae01bdc5902d4f94ba487c1">Bridge USDC Tx</a>
• <b>Depósito Hyperliquid Bridge2:</b> $90.49 USDC transferidos
  ↳ <a href="https://arbiscan.io/tx/0x231c7ec10a0c8ad5eaa99633d6347b381a71229dec2101f05de654bc1ceffbae">Arbiscan Deposit Tx</a>
• <b>Saldo Acreditado L1:</b> <b>$90.49 USDC</b> en Hyperliquid Clearinghouse
• <b>Agent Key SquadSecret501:</b> <code>0xccb3...F7f8</code> <b>AUTORIZADA ON-CHAIN</b> (EIP-712 approveAgent OK · 0% Retiro)
• <b>Meta de Retiro / Cosecha:</b> <b>+$20.00 USDC</b> ($0.00 Gas · 0.015% Maker Fee)

🧹 <b>PURGA DE SPAM TELEGRAM COMPLETADA:</b>
✅ Loops simulados eliminados de GitHub Actions.
✅ 7 scripts obsoletos eliminados del repositorio.
✅ Cero simulaciones, cero Euros, cero fechas vencidas: 100% USDC On-Chain.

🌐 <b>SALA DE MANDO & TELEMETRÍA EN VIVO:</b>
• <a href="https://area-501.curatolapps.workers.dev/">Mando Central #501</a>
• <a href="https://area-501.curatolapps.workers.dev/squad-secret/">Squad Secret Hyperliquid L1</a>
• <a href="https://app.hyperliquid.xyz/explorer/address/0xD4D12077a61118372f7a367319fb11922Beb3743">Explorer Hyperliquid #501</a>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  console.log(`📡 Enviando reporte oficial a Telegram (Chat: ${chatId})...`);
  const success = await sendTelegramAlert(message, chatId);
  if (success) {
    console.log("✅ Reporte oficial enviado exitosamente a Telegram!");
  } else {
    console.error("❌ Falló el envío del reporte oficial a Telegram.");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
