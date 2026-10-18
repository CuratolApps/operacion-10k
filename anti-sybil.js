/**
 * anti-sybil.js - Operación 10k
 * Módulo de camuflaje comportamental y escudo de aislamiento Anti-Sybil.
 * 
 * Regla de seguridad: Prohibido manipular o mostrar claves privadas ni .env
 */

const { ethers } = require("ethers");

/**
 * Pausa asíncrona aleatoria entre minMs y maxMs con aviso en consola.
 * @param {number} minMs Tiempo mínimo en milisegundos
 * @param {number} maxMs Tiempo máximo en milisegundos
 * @returns {Promise<number>} Tiempo esperado en ms
 */
async function sleepRandom(minMs, maxMs) {
  const actualMin = Math.min(minMs, maxMs);
  const actualMax = Math.max(minMs, maxMs);
  const delay = Math.floor(Math.random() * (actualMax - actualMin + 1)) + actualMin;
  const seconds = (delay / 1000).toFixed(2);

  console.log(`   ⏳ [ANTI-SYBIL] Pausa de camuflaje humano: esperando ${seconds}s...`);
  await new Promise((resolve) => setTimeout(resolve, delay));
  return delay;
}

/**
 * Desordena aleatoriamente una lista de billeteras usando el algoritmo Fisher-Yates.
 * No muta el array original.
 * @param {Array} wallets Lista de billeteras
 * @returns {Array} Nueva lista con orden aleatorio
 */
function shuffleSwarm(wallets) {
  if (!Array.isArray(wallets)) return [];
  const array = [...wallets];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Genera un monto aleatorio en formato string con 5 a 8 decimales irregulares.
 * Elimina ceros redondos al final para simular comportamiento humano orgánico.
 * @param {number|string} minEth Monto mínimo en ETH
 * @param {number|string} maxEth Monto máximo en ETH
 * @returns {string} Monto como string (ej. "0.00014729")
 */
function generateHumanAmount(minEth, maxEth) {
  const min = parseFloat(minEth);
  const max = parseFloat(maxEth);
  const raw = Math.random() * (max - min) + min;

  // Elegir aleatoriamente entre 5 y 8 decimales
  const decimals = Math.floor(Math.random() * 4) + 5; // 5, 6, 7 u 8
  let formatted = raw.toFixed(decimals);

  // Asegurar que no termine en ceros redondos
  while (formatted.endsWith("0")) {
    const nonZeroDigit = Math.floor(Math.random() * 9) + 1; // 1 - 9
    formatted = formatted.slice(0, -1) + nonZeroDigit;
  }

  return formatted;
}

/**
 * Escudo de Aislamiento: Valida que ninguna billetera del enjambre interactúe con otra
 * billetera del mismo enjambre, previniendo grafos de clusterización on-chain.
 * 
 * Reglas:
 * 1. Auto-transacción (sender === target): PERMITIDO (generación de historial / calldata).
 * 2. Transacción hacia contrato o dirección externa: PERMITIDO.
 * 3. Transacción satélite A -> satélite B (sender !== target && target in swarm): BLOQUEO CRÍTICO.
 * 
 * @param {string} senderAddress Dirección emisora
 * @param {string} targetAddress Dirección de destino
 * @param {Array<string>} allSwarmAddresses Conjunto de todas las direcciones del enjambre
 * @returns {boolean} true si la transacción está aislada y es segura
 * @throws {Error} SYBIL_PROTECTION_TRIGGERED si se detecta contaminación cruzada
 */
function validateIsolation(senderAddress, targetAddress, allSwarmAddresses) {
  const senderNorm = ethers.getAddress(senderAddress);
  const targetNorm = ethers.getAddress(targetAddress);
  const swarmSet = new Set((allSwarmAddresses || []).map((addr) => ethers.getAddress(addr)));

  // Si la dirección destino pertenece al enjambre pero no es la misma emisora
  if (swarmSet.has(targetNorm) && targetNorm !== senderNorm) {
    const errorMsg = `SYBIL_PROTECTION_TRIGGERED: Violación de aislamiento detectada. ` +
      `El satélite ${senderNorm} intentó transferir fondos hacia otro miembro del enjambre ${targetNorm}. ` +
      `Operación abortada para evitar clusterización on-chain.`;
    throw new Error(errorMsg);
  }

  return true;
}

module.exports = {
  sleepRandom,
  shuffleSwarm,
  generateHumanAmount,
  validateIsolation
};
