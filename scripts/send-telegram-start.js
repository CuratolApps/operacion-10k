const fs = require('fs');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const imagePath = 'C:\\Users\\CuratolApps\\.gemini\\antigravity-ide\\brain\\01852625-a4ae-4b85-87ff-d65cad60bb17\\squad_secret_start_1792940413014.jpg';

async function sendTelegramPhoto() {
  if (!token || !chatId) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env');
    return;
  }

  const blob = await fs.openAsBlob(imagePath);
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('photo', blob, 'squad_secret_start.jpg');
  formData.append('caption', 
`🛰️ ÁREA 501 // FOTO DE INICIO OFICIAL ON-CHAIN (0% SIMULACIÓN)
=============================================
📍 Bóveda Matriz #501: 0xD4D12077a61118372f7a367319fb11922Beb3743

💵 Capital Físico Real en Bóvedas:
• Bóveda #501 (Polygon): $459.40 USDC Nativo Oficial
• Cartera #001 (Polygon): $5.00 USDC
• Cañón #2 BSC (#501/#101): $21.52 USDC
• Binance Spot #1: $1.00 USDC
💎 TOTAL BASE CONSOLIDADA: $486.92 USDC

⛽ Tanques de Gas Blindados (STRICT_NO_GAS_SELL):
• Bóveda #501: 155.05 / 150.00 POL (Piso Mínimo Protegido)
• Flota x500: 300.02 / 300.00 POL

🎯 Marcador de Fuego Real:
• Récord: 0G - 0P Reales
• PnL Real On-Chain: +$0.00 USDC
• Bloque Asentado: $450.00 USDC
• Próximo Objetivo: SEGUNDA BOLA ($500.00 USDC)
• Faltante para Coronar: $13.08 USDC (73.8% Progreso)

🛡️ Regla Sagrada del Comandante:
Toda simulación o fórmula sintética ha sido erradicada. Solo cantaremos victoria cuando exista un txHash confirmado en PolygonScan con beneficio real neto.`
  );

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  if (data.ok) {
    console.log('FOTO DE INICIO ENVIADA EXITOSAMENTE A TELEGRAM!');
  } else {
    console.error('Error enviando a Telegram:', data);
  }
}

sendTelegramPhoto().catch(console.error);
