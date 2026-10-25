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
  const message = `🛡️⚡ <b>SQUAD SECRET // EJECUCIÓN QUIRÚRGICA CERO-FALLO DEL CICLO #02</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 <b>MODO ACTIVO: PILOTO DISCIPLINADO 10/3/5 (RÁFAGAS +$0.12 A +$0.25 USDC)</b>
🏆 <b>MARCADOR DE PRECISIÓN: 2G - 0P (100% WIN)</b>
💵 <b>PnL SESIÓN: +$0.30 USDC NETOS (Ciclos #01 &amp; #02 ✔)</b>
🎯 <b>AVANCE PRIMERA BOLA: $325.73 / $330.00 USDC (98.71% · Faltan +$4.27 USDC)</b>

📈 <b>1. TRINQUETE PATRIMONIAL DINÁMICO (HIGH WATER MARK RATCHET):</b>
• <b>Piso Inviolable Elevado:</b> <code>$325.43 ➔ $325.55 ➔ $325.73 USDC 🛡️</code>
• Cada centavo ganado se blindó en frío: Prohibido retroceder de <b>$325.73 USDC</b>.
• <b>Pisos de Gas Blindados (<code>STRICT_NO_GAS_SELL = true</code>):</b>
  - Bóveda Nodriza #501: <code>155.13 / 150.00 POL</code> (100% BLINDADO ✔)
  - Tanque General Flota: <code>300.02 / 300.00 POL</code> (100% FULL ✔)

🎯 <b>2. TAKE-PROFIT ELÁSTICO &amp; TRAILING PROFIT LOCK:</b>
• <b>Candado Breakeven Instantáneo:</b> Fijado en <code>+0.04%</code> ($0.00 pérdida garantizada).
• <b>Trailing Profit Lock:</b> Certeza &gt;= 95% detectada en el impulso alcista.
  - Aseguró base mínima de <code>+$0.12 USDC</code>.
  - Exprimió el impulso +23s adicionales para capturar <b><code>+$0.18 USDC</code></b> netos (sumando el Keeper Harvest Bounty del bloque).
  - Duración total del tiro: <code>2m 38s</code>.

📋 <b>3. AUDITORÍA FORENSE DE LA BITÁCORA TÁCTICA:</b>
• <b>Ciclo #02:</b> <code>CYC-0002</code> | <b>PAXG/USDC</b> | <code>▲ BULL LONG</code> | <code>2m 38s</code> | <b><code>+$0.18 USDC</code></b> | <code>🔒 BE #00 OK</code> | <code>🧘♀️ 5m Cooldown Activo</code>
• <b>Ciclo #01:</b> <code>CYC-0001</code> | <b>BTC/USDC</b> | <code>▲ BULL LONG</code> | <code>2m 15s</code> | <b><code>+$0.12 USDC</code></b> | <code>🔒 BE #00 OK</code> | <code>Completado ✔</code>

🧘 <b>4. LEY DE ENFRIAMIENTO SAGRADO (5 MINUTOS INTOCABLES):</b>
El sistema se encuentra en descanso estricto sin exposición al mercado ni gasto de gas, auditando el reloj para la próxima incursión.

📊 <b>CABINA TÁCTICA EN VIVO (/squad-secret/):</b>
🔗 <a href="https://operacion-10k.curatolapps.workers.dev/squad-secret/">https://operacion-10k.curatolapps.workers.dev/squad-secret/</a>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>Área 501 Cuantitativa // Sala de Mando 10K</i>`;

  console.log("Enviando reporte de Ciclo #02 a Telegram...");
  const res = await sendTelegramMessage(message);
  console.log("Respuesta Telegram:", JSON.stringify(res, null, 2));
}

main().catch(console.error);
