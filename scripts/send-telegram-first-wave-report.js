require("dotenv").config();
const https = require("https");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "-1004342131598";

async function sendTelegramMessage(htmlText) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: htmlText,
      parse_mode: "HTML",
      disable_web_page_preview: false
    });

    const options = {
      hostname: "api.telegram.org",
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve({ ok: false, raw: data });
        }
      });
    });

    req.on("error", err => reject(err));
    req.write(payload);
    req.end();
  });
}

async function main() {
  const message = `🛡️🎯 <b>SQUAD SECRET // ACTIVACIÓN PRIMERA BOLA ($330.00 USDC)</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 <b>TRINQUETE DE CAPITAL: PISO $325.43 USDC INVIOLABLE</b>
🎯 <b>OBJETIVO PRIMERA BOLA: $330.00 USDC (Faltan +$4.57 USDC)</b>

💰 <b>1. DESGLOSE DEL CAPITAL REAL VERIFICADO EN CADENA:</b>
• <b>Cañón #1 Polygon (#501):</b> <code>$302.91 USDC</code> ($297.912 en #501 + $5.00 buffer)
• <b>Cañón #2 BSC (#501 & #101):</b> <code>$21.52 USDC</code>
• <b>Binance Spot #1 (Auto-Harvest):</b> <code>$1.00 USDC</code>
• <b>BASE CONSOLIDADA REAL:</b> <b><code>$325.43 USDC</code></b> (Piso 100% Blindado)

⛽ <b>2. BLINDAJE & NIVELACIÓN DE GAS ON-CHAIN:</b>
• <b>Transferencia de Nivelación:</b> <code>0.05 POL</code> transferidos desde #501 hacia Flota #001
  🔗 <a href="https://polygonscan.com/tx/0x356c58174438f79e14741bee92e3093548b3d65b58350d7603e04d404722501b">Tx PolygonScan 0.05 POL (Bloque #96122357)</a>
• <b>Bóveda #501:</b> <code>155.13 POL</code> (Piso sagrado 150.00 POL 100% blindado)
• <b>Tanque General Flota:</b> <b><code>300.02 / 300.00 POL</code> (100% FULL)</b>
• <code>STRICT_NO_GAS_SELL = true</code> activado e intangible.

🧠 <b>3. REGLA INVIOLABLE DE LA MENTORA #00:</b>
• En cada disparo, el Take Profit cubre el <b>100% del costo de gas</b> de firma (~$0.002) + <b>ganancia neta</b> (+$0.10 a +$0.15 USDC).
• Cero degradación del gas: El piso de gas no disminuye jamás.

📊 <b>4. SALA TÁCTICA (/squad-secret/):</b>
• <b>Estado:</b> 🔒 <code>PRIMERA BOLA: RUMBO A $330.00 USDC // PISO $325.43 INVIOLABLE</code>
• <b>Marcador:</b> <code>0G - 0P</code> | <code>PnL: $0.00 USDC</code> (Cero Humo)
• <b>URL Módulo 4:</b> <a href="https://operacion-10k.curatolapps.workers.dev/squad-secret/">Sala de Operaciones Squad Secret</a>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>Área 501 Cuantitativa // Sala de Mando 10K</i>`;

  console.log("Enviando confirmación de Primera Bola a Telegram...");
  const res = await sendTelegramMessage(message);
  console.log("Respuesta Telegram:", JSON.stringify(res, null, 2));
}

main().catch(console.error);
