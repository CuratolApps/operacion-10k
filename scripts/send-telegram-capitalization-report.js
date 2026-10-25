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
  const message = `🚀 <b>OPERACIÓN 10K // CAPITALIZACIÓN EXITOSA SQUAD SECRET</b> 💱
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 <b>META DE CAPITAL: $300.00 USDC SUPERADA (108.8%)</b>
💰 <b>NUEVA POSICIÓN REAL: $326.64 USDC (+$26.64 SUPERÁVIT)</b>

💎 <b>1. DETALLE DEL SWAP ON-CHAIN (POLYGON POS MAINNET):</b>
• <b>Depósito Entrante:</b> <code>+656.143 POL</code>
  🔗 <a href="https://polygonscan.com/tx/0xecfe4bc3186b17700d9605be72a0b22f64fa67eefe816282e4b4c4f134f6b5c0">Tx Depósito PolygonScan</a>
• <b>Wrap WPOL:</b> <code>656.143 POL ➔ WPOL</code>
  🔗 <a href="https://polygonscan.com/tx/0x904f80494ea6b398bddb785b9a4dc3b16bfc1bc66308c8b8235f1633b4273497">Tx Wrap PolygonScan</a>
• <b>Swap Uniswap V3 (Fee 0.05%):</b>
  <code>656.143 POL ➔ +$58.918386 USDC Nativo</code>
  🔗 <a href="https://polygonscan.com/tx/0xe09335209c377b610f3f342ca97fdb225f5d2d6ddbcc02618b571655e7550c2d">Tx Swap Uniswap V3 PolygonScan</a>

🏦 <b>2. DESGLOSE DE CAPITAL CONSOLIDADO:</b>
• <b>Cañón #1 Polygon (#501):</b> <code>$302.91 USDC</code> ($297.912 en #501 + $5.00 buffer)
• <b>Cañón #2 BSC (#501 & #101):</b> <code>$21.52 USDC</code>
• <b>Binance Spot #1:</b> <code>$1.00 USDC</code>
• <b>Micro-reservas & Airdrops:</b> <code>$1.21 USDC</code>
• <b>TOTAL CONSOLIDADO:</b> <b><code>$326.64 USDC</code></b> 🟢

🛡️ <b>3. PISOS DE GAS INTOCABLES (STRICT_NO_GAS_SELL = TRUE):</b>
• <b>Bóveda #501 (Polygon):</b> <code>155.19 POL</code> (Piso sagrado 150.00 POL 100% Blindado)
• <b>Flota x500 (Polygon):</b> <code>300.06 POL</code> (Piso sagrado 300.00 POL 100% Blindado)

📊 <b>4. SQUAD SECRET (/squad-secret/):</b>
• <b>Estado:</b> 🔒 <code>PLANIFICACIÓN $0 RIESGO — CAPITAL LISTO</code>
• <b>Marcador de Sesión:</b> <code>0G - 0P</code> | <code>PnL: $0.00 USDC</code> (Cero Humo)
• <b>URL Módulo 4:</b> <a href="https://operacion-10k.curatolapps.workers.dev/squad-secret/">Sala de Operaciones Squad Secret</a>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>Área 501 Cuantitativa // Sala de Mando 10K</i>`;

  console.log("Enviando reporte de capitalización a Telegram...");
  const res = await sendTelegramMessage(message);
  console.log("Respuesta Telegram:", JSON.stringify(res, null, 2));
}

main().catch(console.error);
