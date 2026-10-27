/**
 * scripts/telegram-public-firewall.js - ÁREA 501 / YOZAPATA LAB
 * ==============================================================================
 * MURALLA CORTAFUEGOS ESTRICTA PARA EL CANAL PÚBLICO @YozapataChannel
 * ==============================================================================
 * 
 * REGLA SAGRADA:
 * Jamás publicar saldos en dólares ($202.45, $511.39, etc.), ni direcciones 0x...,
 * ni menciones de la Flota X500 / 500 carteras al canal público @YozapataChannel.
 * 
 * En @YozapataChannel SOLO se admiten:
 * • Porcentajes (+0.35% TP, +1.75% ROE).
 * • Precios de mercado de activos (Entrada: $80,422 ➔ Salida: $80,141).
 * • Métricas técnicas (RSI, EMA, Orderbook Imbalance L2, Candado Breakeven).
 * • Radares DeFi públicos (DefiLlama TVL de Veda, Upshift, Polymarket).
 * ==============================================================================
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");

const PUBLIC_CHANNEL_ID = "@YozapataChannel";
const FIREWALL_LOG_FILE = path.join(__dirname, "..", "telemetry", "public-firewall-blocks.json");

// Lista de palabras y patrones estrictamente PROHIBIDOS en @YozapataChannel
const FORBIDDEN_PATTERNS = [
  // 1. Direcciones 0x de cualquier tipo (privadas o de carteras)
  /0x[a-fA-F0-9]{40}/i,

  // 2. Menciones a la Flota privada y carteras internas
  /Flota\s*X500/i,
  /500\s*carteras/i,
  /500\s*sat[eé]lites/i,
  /B[oó]veda\s*#?501/i,
  /Capit[aá]n\s*#?001/i,
  /Box\s*[1-5]/i,
  /Piedra\s*Picada/i,
  /squad-secret/i,

  // 3. Saldos personales en dólares o balances acumulados
  /Saldo/i,
  /Balance/i,
  /Capital\s*(?:total|asignado|real|operativo|en\s*riesgo)?\s*:\s*\$/i,
  /Tesor(?:er[ií]a|y)/i,
  /Fondo\s*Real/i,
  /Fondo\s*Flota/i,
  /C[aá]mara\s*[12]/i,
  /Ganancia\s*neta/i,
  /Ganancia\s*al\s*vender/i,
  /Margen\s*Asignado/i,
  /Nuevo\s*Saldo/i,
  /Liquidaci[oó]n/i,
  /\+\$[0-9]+/i,                    // Cualquier ganancia en dólares (Ej: +$0.50) -> En público solo se admite +0.35%
  /\$[0-9]+(?:\.[0-9]+)?\s*USDC/i, // Cualquier cifra de dólares USDC (Ej: $202.45 USDC)
  /\$[0-9]+(?:\.[0-9]+)?\s*POL/i,
  /\$[0-9]+(?:\.[0-9]+)?\s*BNB/i,
  /\b202\.[0-9]+\b/,
  /\b511\.[0-9]+\b/,
  /\b20\.11\b/,
  /\b198\.[0-9]+\b/,
  /\b199\.[0-9]+\b/
];

/**
 * Filtro Sanitizador Estricto: Valida que el texto cumpla al 100% las reglas públicas.
 * Lanza una excepción si detecta cualquier intento de fuga de datos privados.
 * @param {string} text Texto a publicar
 * @returns {string} Texto aprobado si está 100% limpio
 */
function sanitizePublicBroadcast(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Texto de transmisión público inválido o vacío.");
  }

  const violations = [];

  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      violations.push(`Coincidencia con patrón prohibido: "${match[0]}"`);
    }
  }

  if (violations.length > 0) {
    const errorMsg = `🚨 [FIREWALL BLOQUEO]: Intento de publicar información privada en @YozapataChannel abortado.\nViolaciones detectadas:\n• ${violations.join("\n• ")}`;
    
    // Registrar incidente en telemetría
    try {
      const dir = path.join(__dirname, "..", "telemetry");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let logs = [];
      if (fs.existsSync(FIREWALL_LOG_FILE)) {
        try { logs = JSON.parse(fs.readFileSync(FIREWALL_LOG_FILE, "utf8")); } catch (_) {}
      }
      logs.unshift({
        timestamp: new Date().toISOString(),
        violations,
        blockedSnippet: text.slice(0, 200)
      });
      if (logs.length > 20) logs = logs.slice(0, 20);
      fs.writeFileSync(FIREWALL_LOG_FILE, JSON.stringify(logs, null, 2), "utf8");
    } catch (_) {}

    throw new Error(errorMsg);
  }

  return text;
}

/**
 * Envía un mensaje seguro y sanitizado al canal público @YozapataChannel.
 * @param {string} messageText Mensaje a enviar
 * @param {Object} options Opciones adicionales (pin, disablePreview, etc.)
 */
async function sendPublicChannelBroadcast(messageText, options = {}) {
  // 1. Pasar por el cortafuegos estricto
  const sanitizedText = sanitizePublicBroadcast(messageText);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN no configurado en .env");
  }

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: PUBLIC_CHANNEL_ID,
    text: sanitizedText,
    parse_mode: options.parseMode || "HTML",
    disable_web_page_preview: options.disablePreview !== false
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Error de Telegram API al publicar en @YozapataChannel: ${data.description || "Error desconocido"}`);
  }

  const messageId = data.result.message_id;
  console.log(`📢 [CANAL PÚBLICO @YozapataChannel] Mensaje #${messageId} publicado exitosamente ✅`);

  // Fijar el mensaje si se solicitó
  if (options.pin) {
    await pinPublicChannelMessage(messageId);
  }

  return { ok: true, messageId, result: data.result };
}

/**
 * Fija un mensaje en el canal público @YozapataChannel.
 * @param {number} messageId ID del mensaje a fijar
 */
async function pinPublicChannelMessage(messageId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const endpoint = `https://api.telegram.org/bot${token}/pinChatMessage`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: PUBLIC_CHANNEL_ID,
      message_id: messageId,
      disable_notification: false
    })
  });

  const data = await response.json();
  if (data.ok) {
    console.log(`📌 [CANAL PÚBLICO @YozapataChannel] Mensaje #${messageId} fijado en la cabecera ✅`);
    return true;
  } else {
    console.warn(`⚠️ No se pudo fijar mensaje #${messageId}: ${data.description}`);
    return false;
  }
}

module.exports = {
  PUBLIC_CHANNEL_ID,
  sanitizePublicBroadcast,
  sendPublicChannelBroadcast,
  pinPublicChannelMessage
};
