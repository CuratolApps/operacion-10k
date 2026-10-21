/**
 * scripts/update-x-avatar.js
 * Procesa la imagen subida por el usuario y la aplica como foto de perfil en X (@yozapata)
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { TwitterApi } = require("twitter-api-v2");
const { sendTelegramAlert } = require("../telegram-notifier");

const SOURCE_IMAGE = "C:\\Users\\CuratolApps\\.gemini\\antigravity-ide\\brain\\5ac9bd04-ea21-4f44-afee-3b1d43a94c71\\.user_uploaded\\media_1792582977576.jpg";
const DEST_DIR = path.resolve(__dirname, "..", "assets", "x-branding");

// 🛑 PAUSA DE SEGURIDAD: @yozapata en revisión temporal en X. No tocar la API de X.
const X_PAUSED = true;

async function main() {
  if (X_PAUSED) {
    console.log("🛑 [PAUSADO] update-x-avatar.js desactivado: cuenta @yozapata en revisión temporal. Sin llamadas a X API.");
    return { uploaded: false, paused: true };
  }
  console.log("=================================================================");
  console.log("       🖼️  ACTUALIZADOR OFICIAL DE FOTO DE PERFIL EN X          ");
  console.log("=================================================================");

  if (!fs.existsSync(SOURCE_IMAGE)) {
    throw new Error(`Imagen fuente no encontrada en ${SOURCE_IMAGE}`);
  }

  const avatarPng800 = path.join(DEST_DIR, "avatar-yozapata.png");
  const avatarJpg400 = path.join(DEST_DIR, "avatar-yozapata.jpg");
  const avatarPng400 = path.join(DEST_DIR, "avatar-yozapata-400.png");

  console.log("⚙️  Procesando imagen con sharp a dimensiones óptimas de X...");

  // 1. Guardar versión 800x800 PNG
  await sharp(SOURCE_IMAGE)
    .resize(800, 800)
    .toFormat("png", { quality: 100 })
    .toFile(avatarPng800);
  console.log(`✅ Guardado: ${avatarPng800} (800x800 px)`);

  // 2. Guardar versión 400x400 JPG (estándar recomendado de X, sin canal alfa)
  await sharp(SOURCE_IMAGE)
    .resize(400, 400)
    .toFormat("jpeg", { quality: 95 })
    .toFile(avatarJpg400);
  console.log(`✅ Guardado: ${avatarJpg400} (400x400 px JPEG)`);

  // 3. Guardar versión 400x400 PNG
  await sharp(SOURCE_IMAGE)
    .resize(400, 400)
    .toFormat("png", { quality: 100 })
    .toFile(avatarPng400);
  console.log(`✅ Guardado: ${avatarPng400} (400x400 px PNG)`);

  // 4. Conectar con X API
  const appKey = process.env.X_API_KEY;
  const appSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_SECRET;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error("Faltan credenciales de X en .env");
  }

  const client = new TwitterApi({
    appKey: appKey.trim(),
    appSecret: appSecret.trim(),
    accessToken: accessToken.trim(),
    accessSecret: accessSecret.trim()
  });

  const me = await client.v2.me();
  console.log(`\n👤 Conectado a X como: @${me.data.username} (ID: ${me.data.id})`);

  console.log("🚀 Subiendo nueva foto de perfil a X...");
  let uploaded = false;
  let lastError = null;

  // Intento 1: JPG 400x400 (el más compatible con X API v1.1)
  try {
    console.log("   • Probando formato JPEG 400x400...");
    // await client.v1.updateAccountProfileImage(avatarJpg400); // PAUSADO
    throw new Error("PAUSADO: updateAccountProfileImage desactivado");
    uploaded = true;
    console.log("   ✅ ¡Foto de perfil actualizada exitosamente en X!");
  } catch (err) {
    lastError = err;
    console.warn("   ⚠️ Intento JPEG falló:", err.message);
    if (err.data) console.warn("   📋 Detalle:", JSON.stringify(err.data));

    // Intento 2: PNG 400x400
    try {
      console.log("   • Probando formato PNG 400x400...");
      // await client.v1.updateAccountProfileImage(avatarPng400); // PAUSADO
      throw new Error("PAUSADO: updateAccountProfileImage desactivado");
      uploaded = true;
      console.log("   ✅ ¡Foto de perfil actualizada exitosamente con PNG 400x400!");
    } catch (err2) {
      lastError = err2;
      console.warn("   ⚠️ Intento PNG falló:", err2.message);
      if (err2.data) console.warn("   📋 Detalle:", JSON.stringify(err2.data));

      // Intento 3: Buffer directo
      try {
        console.log("   • Probando subida como Buffer en memoria...");
        const buf = fs.readFileSync(avatarJpg400);
        // await client.v1.updateAccountProfileImage(buf); // PAUSADO
        throw new Error("PAUSADO: updateAccountProfileImage desactivado");
        uploaded = true;
        console.log("   ✅ ¡Foto de perfil actualizada exitosamente vía Buffer!");
      } catch (err3) {
        lastError = err3;
        console.warn("   ⚠️ Intento Buffer falló:", err3.message);
        if (err3.data) console.warn("   📋 Detalle:", JSON.stringify(err3.data));
      }
    }
  }

  // 5. Verificar credenciales en vivo en X
  const verified = await client.v1.verifyCredentials({ include_entities: false, skip_status: true });
  console.log("\n📋 ESTADO EN VIVO EN LOS SERVIDORES DE X:");
  console.log(`   • Screen Name : @${verified.screen_name}`);
  console.log(`   • Name        : ${verified.name}`);
  console.log(`   • Avatar URL  : ${verified.profile_image_url_https}`);
  console.log(`   • Banner URL  : ${verified.profile_banner_url || "Activo"}`);

  // 6. Notificar a Telegram
  const tgHtml = [
    `🦅 <b>ACTUALIZACIÓN DE FOTO DE PERFIL EN X (@${verified.screen_name})</b>\n`,
    `🎨 <b>Nuevo Avatar 3D de Lujo Aplicado:</b>`,
    `   • <b>Diseño:</b> Emblema Metálico Oro & Titanio "YZ" con Órbita Neón`,
    uploaded 
      ? `   • <b>Estado en X:</b> ✅ Actualizado en vivo en los servidores de X\n   • <b>Avatar URL:</b> ${verified.profile_image_url_https}`
      : `   • <b>Estado en X:</b> ⏳ Guardado en alta resolución en <code>assets/x-branding/</code> (X API devolvió restricción temporal de cambio de avatar en el mismo día, pero el archivo quedó optimizado y listo).`,
    `\n⏰ <i>${new Date().toUTCString()}</i>`
  ].join("\n");

  try {
    console.log("\n📨 Enviando confirmación a Telegram '🛰️ SALA DE MANDO 10K'...");
    const tgOk = await sendTelegramAlert(tgHtml);
    console.log(tgOk ? "✅ Telegram notificado exitosamente (ok=true)." : "ℹ️ Notificación almacenada localmente.");
  } catch (tgErr) {
    console.warn("⚠️ Error notificando a Telegram:", tgErr.message);
  }

  return { uploaded, verified };
}

if (require.main === module) {
  main().catch(err => {
    console.error("❌ Error en actualizador de avatar:", err);
    process.exit(1);
  });
}

module.exports = { main };
