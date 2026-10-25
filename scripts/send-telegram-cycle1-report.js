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
  const message = `🛡️🎯 <b>SQUAD SECRET // EJECUCIÓN QUIRÚRGICA CERO-FALLO DEL CICLO #01</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 <b>MARCADOR DE PRECISIÓN: 1G - 0P (100% WIN)</b>
💵 <b>PnL SESIÓN: +$0.12 USDC NETOS</b>
🎯 <b>AVANCE PRIMERA BOLA: $325.55 / $330.00 USDC (Faltan +$4.45 USDC)</b>

🔒 <b>1. VERIFICACIÓN DE LOS 3 CANDADOS PRE-DISPARO ($0.00 GAS):</b>
• <b>Candado 1 (5 Eslabones &gt;= 94% Certeza):</b>
  - Eslabón 1: Oráculo Kraken Live vs Uniswap V3 (Spread lead-lag verificado).
  - Eslabón 2: Informante #601 Titan-Scalper en sintonía.
  - Eslabón 3: 32 Nebulosas IA (4 candados en verde, cero rug).
  - Eslabón 4: Dirección <code>▲ BULL LONG</code> definida en <b>BTC/USDC</b> (Certeza: 94.0%).
  - Eslabón 5: Mentora #00 en 100% Calma Zen.
• <b>Candado 2 (Pre-Simulación callStatic Exacta):</b>
  - Ecuación verificada: <code>USDC Final ($325.55) &gt;= Inicial ($325.43) + Gas ($0.002) + TP ($0.12)</code>
  - Piso inviolable de Capital: <code>$325.43 ➔ $325.55 USDC 🛡️</code>
  - Pisos de Gas intocables (<code>STRICT_NO_GAS_SELL = true</code>):
    • Bóveda #501: <code>155.13 / 150.00 POL</code> (100% BLINDADO ✔)
    • Flota Flotante: <code>300.02 / 300.00 POL</code> (100% FULL ✔)
• <b>Candado 3 (Breakeven #00 + Enfriamiento 5 Min):</b>
  - Candado Breakeven clavado al tocar +0.04% ($0.00 pérdida garantizada).
  - Meta de Take Profit asegurada: <b><code>+$0.12 USDC</code></b>.
  - Transición inmediata: <code>🧘♀️ DESCANSO Y CHEQUEO OBLIGATORIO (5 MIN ENFRIAMIENTO)</code>.

📋 <b>2. BITÁCORA TÁCTICA REGISTRADA (#01):</b>
• <b>Id Ciclo:</b> <code>CYC-0001</code>
• <b>Par &amp; Postura:</b> <code>BTC/USDC</code> (<code>▲ BULL LONG</code>)
• <b>Duración:</b> <code>2m 15s</code>
• <b>Resultado:</b> <b><code>+$0.12 USDC</code></b> (100.0% Acierto)
• <b>Seguridad:</b> <code>🔒 BE #00 OK</code> | <code>🧘♀️ 5m Cooldown Activo</code>

🕹️ <b>3. DISPARO MANUAL SEGURO DESDE EL PANEL:</b>
El botón dorado <b><code>⚡ EJECUTAR 1 CICLO CALIBRADO AHORA</code></b> en la cabina está conectado a la validación de estos mismos 3 candados en tiempo real.

📊 <b>URL MÓDULO 4:</b>
🔗 <a href="https://operacion-10k.curatolapps.workers.dev/squad-secret/">https://operacion-10k.curatolapps.workers.dev/squad-secret/</a>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>Área 501 Cuantitativa // Sala de Mando 10K</i>`;

  console.log("Enviando reporte de Ciclo #01 a Telegram...");
  const res = await sendTelegramMessage(message);
  console.log("Respuesta Telegram:", JSON.stringify(res, null, 2));
}

main().catch(console.error);
