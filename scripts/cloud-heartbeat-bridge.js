/**
 * scripts/cloud-heartbeat-bridge.js — ÁREA 501
 * ==============================================================================
 * PUENTE DE LATIDO ANTI-COLISIÓN (PC LOCAL ⇄ CLOUDFLARE WORKERS)
 * Envía un latido cada 15 segundos al Cloudflare Worker.
 * Si la laptop está encendida: El Worker cede el turno al daemon local.
 * Si la laptop se apaga (>45s sin latido): El Worker toma el mando 24/7 en la nube.
 * ==============================================================================
 */

const WORKER_URL = "https://area-501.curatolapps.workers.dev/api/heartbeat";
const INTERVAL_MS = 15000;

async function sendHeartbeat() {
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "LAPTOP_LOCAL_DAEMON",
        timestamp: Date.now(),
        hostname: process.env.COMPUTERNAME || "COMMAND_CENTER"
      })
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      // Silencioso o log periódico cada 2 minutos
      if (Math.random() < 0.1) {
        console.log(`[HEARTBEAT BRIDGE] 💓 Latido emitido a Cloudflare Worker: OK (${new Date().toLocaleTimeString()})`);
      }
    } else {
      console.warn(`[HEARTBEAT BRIDGE] ⚠️ Respuesta no OK (${res.status})`);
    }
  } catch (err) {
    console.warn("[HEARTBEAT BRIDGE] Error de red en latido:", err.message);
  }
}

console.log("================================================================================");
console.log("💓 ÁREA 501 // PUENTE DE LATIDO LOCAL ACTIVO (INTERVALO: 15s)");
console.log(`🌐 Destino: ${WORKER_URL}`);
console.log("================================================================================");

// Envío inicial inmediato
sendHeartbeat();

// Bucle cada 15 segundos
setInterval(sendHeartbeat, INTERVAL_MS);
