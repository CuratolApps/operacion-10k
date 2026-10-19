/**
 * scripts/detect-group.js
 * Detecta el chat.id del grupo (empieza con '-') desde getUpdates de TELEGRAM_BOT_TOKEN o VANGUARD_BOT_TOKEN.
 * Actualiza TELEGRAM_CHAT_ID en .env y reporta exclusivamente el GROUP_CHAT_ID detectado.
 * 
 * REGLA ESTRICTA DE SEGURIDAD: PROHIBIDO IMPRIMIR TOKENS O CLAVES PRIVADAS.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function fetchUpdates(token) {
  if (!token) return [];
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`, {
      signal: AbortSignal.timeout(8000)
    });
    const data = await res.json();
    return data.ok && Array.isArray(data.result) ? data.result : [];
  } catch (e) {
    return [];
  }
}

async function main() {
  const token1 = (process.env.TELEGRAM_BOT_TOKEN || '').trim().replace(/^["']|["']$/g, '');
  const token2 = (process.env.VANGUARD_BOT_TOKEN || '').trim().replace(/^["']|["']$/g, '');

  console.log("🔍 Consultando eventos recientes en Telegram...");

  const [updates1, updates2] = await Promise.all([
    fetchUpdates(token1),
    fetchUpdates(token2)
  ]);

  const allUpdates = [...updates1, ...updates2];

  let detectedGroup = null;

  // Buscar mensajes o eventos en grupo/supergroup
  for (let i = allUpdates.length - 1; i >= 0; i--) {
    const u = allUpdates[i];
    const msg = u.message || u.channel_post || u.edited_message || u.my_chat_member;
    if (msg && msg.chat) {
      const type = msg.chat.type;
      const cid = String(msg.chat.id);
      if (cid.startsWith('-') || type === 'group' || type === 'supergroup') {
        const text = (msg.text || '').toLowerCase();
        if (text.includes('/activar') || !detectedGroup) {
          detectedGroup = {
            id: cid,
            title: msg.chat.title || 'Grupo de Mando',
            type: type,
            text: msg.text || ''
          };
          if (text.includes('/activar')) {
            break; // Prioridad máxima al mensaje explícito /activar
          }
        }
      }
    }
  }

  if (!detectedGroup) {
    console.log("⚠️ No se encontró aún ningún mensaje en grupo en getUpdates.");
    console.log("👉 Por favor asegúrate de que el bot tenga permisos de lectura en el grupo o que los bots estén agregados como miembros/admins.");
    process.exit(1);
  }

  console.log(`\n=============================================================`);
  console.log(`🎯 SALA DE MANDO (GRUPO TELEGRAM) DETECTADA CON ÉXITO:`);
  console.log(`   GROUP_CHAT_ID: ${detectedGroup.id}`);
  console.log(`   Título del Grupo: ${detectedGroup.title}`);
  console.log(`   Tipo: ${detectedGroup.type}`);
  console.log(`=============================================================\n`);

  // Actualizar .env local
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.match(/^TELEGRAM_CHAT_ID=.*/m)) {
      envContent = envContent.replace(/^TELEGRAM_CHAT_ID=.*/m, `TELEGRAM_CHAT_ID="${detectedGroup.id}"`);
    } else {
      envContent += `\nTELEGRAM_CHAT_ID="${detectedGroup.id}"\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log(`✅ Archivo .env local actualizado con TELEGRAM_CHAT_ID="${detectedGroup.id}"`);
  } else {
    fs.writeFileSync(envPath, `TELEGRAM_CHAT_ID="${detectedGroup.id}"\n`, 'utf8');
    console.log(`✅ Archivo .env creado con TELEGRAM_CHAT_ID="${detectedGroup.id}"`);
  }
}

main().catch(err => {
  console.error("Error en detección:", err.message);
  process.exit(1);
});
