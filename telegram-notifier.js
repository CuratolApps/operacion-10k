/**
 * telegram-notifier.js - Operación 10k
 * Sistema de alertas móviles a Telegram sin dependencias externas.
 * 
 * Regla de seguridad: PROHIBIDO registrar o mostrar tokens o claves privadas.
 */

require("dotenv").config();

function getCleanToken() {
  const raw = process.env.TELEGRAM_BOT_TOKEN || "";
  return raw.trim().replace(/^["']|["']$/g, "").trim();
}

let cachedChatId = null;

/**
 * Obtiene el Chat ID de las variables de entorno o consultando getUpdates si no está definido.
 * @param {string} token Telegram Bot Token
 * @returns {Promise<string|null>} Chat ID o null si no se encuentra
 */
async function resolveChatId(token = null, timeoutSeconds = 0) {
  if (cachedChatId) return cachedChatId;

  if (process.env.TELEGRAM_CHAT_ID && process.env.TELEGRAM_CHAT_ID.trim() !== "") {
    cachedChatId = process.env.TELEGRAM_CHAT_ID.trim().replace(/^["']|["']$/g, "").trim();
    return cachedChatId;
  }

  const activeToken = token || getCleanToken();
  if (!activeToken) return null;

  const endpoint = `https://api.telegram.org/bot${activeToken}/getUpdates?timeout=${timeoutSeconds}&limit=100`;
  try {
    const controller = new AbortController();
    const abortTimeout = (timeoutSeconds + 5) * 1000;
    const timeoutId = setTimeout(() => controller.abort(), abortTimeout);

    const res = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeoutId);

    const data = await res.json();
    if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
      for (let i = data.result.length - 1; i >= 0; i--) {
        const update = data.result[i];
        const msg = update.message || update.channel_post || update.edited_message;
        if (msg && msg.chat && msg.chat.id) {
          cachedChatId = String(msg.chat.id);
          console.log(`📱 [TELEGRAM] Chat ID detectado automáticamente: ${cachedChatId}`);
          return cachedChatId;
        }
      }
    }
  } catch (err) {
    console.log(`⚠️ [TELEGRAM] Error al consultar getUpdates: ${err.message}`);
  }

  return null;
}

/**
 * Envía un mensaje a Telegram.
 * @param {string} messageText Mensaje a enviar
 * @param {string|null} customChatId Chat ID opcional
 * @returns {Promise<boolean>} true si se envió con éxito
 */
async function sendTelegramAlert(messageText, customChatId = null) {
  const token = getCleanToken();

  if (!token) {
    console.log("ℹ️ [Telegram no configurado aún - Saltando alerta móvil]");
    return false;
  }

  const chatId = customChatId || (await resolveChatId(token));
  if (!chatId) {
    console.log("ℹ️ [No se pudo detectar el Chat ID. Envía un mensaje al bot en Telegram primero]");
    return false;
  }

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: "HTML",
        disable_web_page_preview: true
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const result = await response.json();
    if (result.ok) {
      console.log("📱 [TELEGRAM] Alerta móvil enviada exitosamente.");
      return true;
    } else {
      console.log(`⚠️ [TELEGRAM] Respuesta de API: ${result.description || "Error desconocido"}`);
      return false;
    }
  } catch (error) {
    console.log(`⚠️ [TELEGRAM] No se pudo enviar notificación: ${error.message}`);
    return false;
  }
}

/**
 * Construye el mensaje de resumen de la ronda y lo envía.
 * @param {Object} summaryData Datos de la ronda
 */
async function notifyRoundSummary(summaryData) {
  const modeBadge = summaryData.executionMode === "DRY-RUN" ? "🧪 <b>[DRY-RUN SIMULACIÓN]</b>" : "⚡ <b>[PRODUCCIÓN EN VIVO]</b>";

  let breakdownText = "";
  if (Array.isArray(summaryData.networksBreakdown) && summaryData.networksBreakdown.length > 0) {
    breakdownText = summaryData.networksBreakdown.map((nb) => {
      if (nb.success > 0) {
        return `   • <b>${nb.name}:</b> ${nb.success}/${nb.total} txs ✅`;
      } else if (nb.isPendingGas) {
        return `   • <b>${nb.name}:</b> ${nb.statusLabel || "0 Gas ⏳"}`;
      } else {
        return `   • <b>${nb.name}:</b> ${nb.success}/${nb.total} txs`;
      }
    }).join("\n");
  } else {
    const sepSuccess = summaryData.sepoliaSuccessCount ?? summaryData.successCount ?? 0;
    const sepTotal = summaryData.sepoliaTotal ?? summaryData.totalSatellites ?? 20;
    const baseSuccess = summaryData.baseSuccessCount ?? 0;
    const baseTotal = summaryData.baseTotal ?? summaryData.totalSatellites ?? 20;
    breakdownText = `   • <b>Ethereum Sepolia:</b> ${sepSuccess}/${sepTotal} txs exitosas\n   • <b>Base Sepolia:</b> ${baseSuccess}/${baseTotal} txs exitosas`;
  }

  const squadText = summaryData.squadSize
    ? `${summaryData.squadSize}/${summaryData.totalSatellites || 500} Satélites (Carrusel Horario)`
    : `${summaryData.totalSatellites || 500} Satélites Activos`;

  const totalOnChain = summaryData.totalOnChainTx ?? 0;

  const text = `
🚀 <b>OPERACIÓN 10K - REPORTE DE RONDA OMNICHAIN</b>
${modeBadge}

👑 <b>VIP #00:</b> Monitoreada (100% Segura / 0 Tx en Mainnet)
🤖 <b>Escuadrón Activo:</b> ${squadText}

🌐 <b>Desglose Omnichain por Red:</b>
${breakdownText}

⚡ <b>Total Transacciones Confirmadas:</b> ${totalOnChain} on-chain
🛡️ <b>Escudo Anti-Sybil:</b> ACTIVO (DeFi Rotator + Aislamiento 100%)

⏰ <i>${new Date().toLocaleString("es-ES", { timeZone: "UTC" })} UTC</i>
`.trim();

  return await sendTelegramAlert(text);
}

// Ejecución directa de prueba
if (require.main === module) {
  (async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || token.trim() === "") {
      console.error("❌ ERROR: TELEGRAM_BOT_TOKEN no está definido en el archivo .env");
      process.exit(1);
    }

    try {
      const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const meData = await meRes.json();
      if (meData.ok) {
        console.log(`🤖 Bot detectado: @${meData.result.username} ("${meData.result.first_name}")`);
      }
    } catch (_) {}

    console.log("📡 Buscando último mensaje en Telegram...");
    let chatId = await resolveChatId(token, 0);

    if (!chatId) {
      console.log("👉 Por favor asegúrate de abrir tu bot y pulsar 'INICIAR' o escribirle 'Hola':");
      console.log("   🔗 https://t.me/operacion10k_yozapata_bot\n");
      console.log("⏳ Esperando tu mensaje durante 30 segundos (Long Polling)...");
      chatId = await resolveChatId(token, 30);
    }

    if (!chatId) {
      console.log("\n⚠️ Tiempo de espera agotado sin mensajes nuevos.");
      console.log("   Abre Telegram, dale a INICIAR o envía cualquier mensaje al bot, y ejecuta de nuevo:");
      console.log("   node telegram-notifier.js\n");
      process.exit(1);
    }

    console.log(`\n🎯 Chat ID confirmado: ${chatId}`);
    console.log("📨 Enviando mensaje de prueba al teléfono...");

    const testMsg = "🐝 <b>OPERACIÓN 10K:</b> Conexión establecida con éxito. El enjambre está en línea.";
    const ok = await sendTelegramAlert(testMsg, chatId);
    if (ok) {
      console.log("🎉 ¡Listo! Notificación de prueba enviada con éxito.");
      console.log(`💡 TIP: Puedes añadir TELEGRAM_CHAT_ID="${chatId}" en tu .env para fijarlo.`);
    }
  })();
}

module.exports = {
  resolveChatId,
  sendTelegramAlert,
  notifyRoundSummary
};
