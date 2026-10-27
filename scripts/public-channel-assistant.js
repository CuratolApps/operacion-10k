/**
 * scripts/public-channel-assistant.js - ÁREA 501 / YOZAPATA LAB
 * ==============================================================================
 * PORTERO CAPTCHA ANTI-BOTS Y ASISTENTE OFICIAL // @YozapataChannel
 * ==============================================================================
 * 
 * Funcionalidad:
 * 1. Escucha eventos chat_join_request del canal @YozapataChannel y comandos /start.
 * 2. Emite desafío Captcha interactivo con botón inline:
 *    [ 🛡️ Soy Humano — Entrar al Lab ]
 * 3. Al resolver el desafío, ejecuta approveChatJoinRequest y concede acceso inmediato.
 * 4. Funciona tanto en modo daemon (Long Polling) como serverless (Webhooks).
 * ==============================================================================
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");

const PUBLIC_CHANNEL_ID = "@YozapataChannel";
const VERIFICATION_LOG_FILE = path.join(__dirname, "..", "telemetry", "captcha-verifications.json");

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN no configurado en .env");
  return token.trim();
}

function logVerification(entry) {
  try {
    const dir = path.join(__dirname, "..", "telemetry");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let logs = [];
    if (fs.existsSync(VERIFICATION_LOG_FILE)) {
      try { logs = JSON.parse(fs.readFileSync(VERIFICATION_LOG_FILE, "utf8")); } catch (_) {}
    }
    logs.unshift({
      timestamp: new Date().toISOString(),
      ...entry
    });
    if (logs.length > 50) logs = logs.slice(0, 50);
    fs.writeFileSync(VERIFICATION_LOG_FILE, JSON.stringify(logs, null, 2), "utf8");
  } catch (_) {}
}

async function tgCall(method, body = {}) {
  const token = getBotToken();
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return await res.json();
}

/**
 * 1. Manejo de Solicitud de Entrada al Canal (chat_join_request)
 */
async function handleChatJoinRequest(joinReq) {
  const user = joinReq.from;
  const chatId = joinReq.user_chat_id || user.id;
  const firstName = user.first_name || "Usuario";
  const username = user.username ? `@${user.username}` : `ID: ${user.id}`;

  console.log(`🛡️ [CAPTCHA PORTERO] Solicitud de unión recibida de ${firstName} (${username}). Enviando desafío...`);

  const challengeText = `👋 ¡Hola, <b>${firstName}</b>! Soy <b>YoZapata Assistant ⚡</b>.

Para mantener <b>Yozapata | Smart Tools &amp; On-Chain Lab</b> 100% libre de bots automatizados y cuentas de spam, por favor confirma que eres una persona real tocando el botón abajo:`;

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "🛡️ Soy Humano — Entrar al Lab",
          callback_data: `verify_join:${user.id}`
        }
      ]
    ]
  };

  const sendRes = await tgCall("sendMessage", {
    chat_id: chatId,
    text: challengeText,
    parse_mode: "HTML",
    reply_markup: keyboard
  });

  logVerification({
    event: "CHALLENGE_ISSUED",
    userId: user.id,
    username,
    firstName,
    ok: sendRes.ok
  });

  return sendRes;
}

/**
 * 2. Manejo de Callback Query (Clic en botón "Soy Humano")
 */
async function handleCallbackQuery(cbQuery) {
  const data = cbQuery.data || "";
  const from = cbQuery.from;
  const firstName = from.first_name || "Usuario";
  const username = from.username ? `@${from.username}` : `ID: ${from.id}`;

  if (data.startsWith("verify_join")) {
    console.log(`✅ [CAPTCHA RESUELTO] Usuario ${firstName} (${username}) verificó ser humano. Aprobando acceso...`);

    // A) Responder callback para quitar reloj de carga
    await tgCall("answerCallbackQuery", {
      callback_query_id: cbQuery.id,
      text: "✅ ¡Verificación exitosa! Bienvenido al Lab.",
      show_alert: false
    });

    // B) Aprobar solicitud de acceso al canal
    const approveRes = await tgCall("approveChatJoinRequest", {
      chat_id: PUBLIC_CHANNEL_ID,
      user_id: from.id
    });

    // C) Actualizar mensaje del usuario
    const successMsg = `🎉 <b>¡VERIFICACIÓN EXITOSA! ACCESO CONCEDIDO</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👋 Bienvenido a <b>Yozapata | Smart Tools &amp; On-Chain Lab ⚡</b>.

Tu solicitud fue aprobada de forma limpia e inmediata. Aquí compartimos bitácoras en tiempo real, radares técnicos y avances de automatización Web3.

👉 <a href="https://t.me/YozapataChannel"><b>ENTRAR AL CANAL OFICIAL (@YozapataChannel)</b></a>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️ <i>Desarrollado con disciplina por @yozapata</i>`;

    if (cbQuery.message && cbQuery.message.chat) {
      await tgCall("editMessageText", {
        chat_id: cbQuery.message.chat.id,
        message_id: cbQuery.message.message_id,
        text: successMsg,
        parse_mode: "HTML",
        disable_web_page_preview: true
      });
    }

    logVerification({
      event: "ACCESS_APPROVED",
      userId: from.id,
      username,
      firstName,
      approveOk: approveRes.ok
    });

    return approveRes;
  }
}

/**
 * 3. Manejo de Mensajes Directos (/start)
 */
async function handleDirectMessage(message) {
  const text = (message.text || "").trim();
  const from = message.from;
  const firstName = from.first_name || "Usuario";
  const username = from.username ? `@${from.username}` : `ID: ${from.id}`;

  if (text.startsWith("/start") || text.startsWith("/verify")) {
    console.log(`👋 [BOT /start] Mensaje recibido de ${firstName} (${username})`);

    const welcomeText = `👋 ¡Hola, <b>${firstName}</b>! Soy <b>YoZapata Assistant ⚡</b>.

Soy el asistente automatizado de @yozapata y el portero de seguridad de <b>Yozapata | Smart Tools &amp; On-Chain Lab</b>.

Para unirte a nuestro canal público o verificar tu cuenta de forma anticipada, pulsa el botón abajo:`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🛡️ Soy Humano — Entrar al Lab",
            callback_data: `verify_join:${from.id}`
          }
        ],
        [
          {
            text: "📢 Ver Canal Oficial",
            url: "https://t.me/YozapataChannel"
          },
          {
            text: "🐦 X / Twitter",
            url: "https://x.com/yozapata"
          }
        ]
      ]
    };

    return await tgCall("sendMessage", {
      chat_id: message.chat.id,
      text: welcomeText,
      parse_mode: "HTML",
      reply_markup: keyboard
    });
  }
}

/**
 * Procesador central de cualquier Update entrante (Webhook o Polling)
 */
async function processTelegramUpdate(update) {
  if (update.chat_join_request) {
    return await handleChatJoinRequest(update.chat_join_request);
  }
  if (update.callback_query) {
    return await handleCallbackQuery(update.callback_query);
  }
  if (update.message) {
    return await handleDirectMessage(update.message);
  }
}

/**
 * Bucle Long Polling para el Asistente Portero
 */
async function startAssistantPolling(options = {}) {
  const singleRun = options.once || false;
  let offset = 0;
  console.log("🤖 [PORTERO CAPTCHA] Iniciando escucha de eventos en @YozapataChannel y bot...");

  while (true) {
    try {
      const res = await tgCall("getUpdates", {
        offset,
        timeout: 10,
        allowed_updates: ["chat_join_request", "callback_query", "message"]
      });

      if (res.ok && Array.isArray(res.result) && res.result.length > 0) {
        for (const update of res.result) {
          offset = update.update_id + 1;
          await processTelegramUpdate(update);
        }
      }
    } catch (err) {
      console.warn("⚠️ Aviso en bucle de polling:", err.message);
    }

    if (singleRun) break;
    await new Promise(r => setTimeout(r, 1000));
  }
}

if (require.main === module) {
  const isOnce = process.argv.includes("--once");
  startAssistantPolling({ once: isOnce })
    .then(() => {
      if (isOnce) {
        console.log("✓ Verificación de cola completada.");
        process.exitCode = 0;
      }
    })
    .catch(err => {
      console.error("❌ Error en asistente:", err);
      process.exitCode = 1;
    });
}

module.exports = {
  processTelegramUpdate,
  handleChatJoinRequest,
  handleCallbackQuery,
  handleDirectMessage,
  startAssistantPolling
};
