/**
 * anti-sybil.js - Operación 10k
 * Módulo de camuflaje comportamental y escudo de aislamiento Anti-Sybil.
 * Aislamiento estricto por bloques (5 bloques de 100 satélites).
 * 
 * Regla de seguridad: Prohibido manipular o mostrar claves privadas ni .env
 */

const { ethers } = require("ethers");

/**
 * Obtiene el ID del bloque al que pertenece un satélite según su índice.
 * - Bloque 0 : Cuenta VIP #00 (Aislada / Solo Lectura)
 * - Bloque 1 : Satélites #001 al #100
 * - Bloque 2 : Satélites #101 al #200
 * - Bloque 3 : Satélites #201 al #300
 * - Bloque 4 : Satélites #301 al #400
 * - Bloque 5 : Satélites #401 al #500
 * @param {number|string} index Índice del satélite
 * @returns {number} ID del bloque (0 a 5)
 */
function getBlockId(index) {
  const idx = parseInt(index, 10);
  if (isNaN(idx) || idx < 0) return -1;
  if (idx === 0) return 0;
  if (idx >= 1 && idx <= 100) return 1;
  if (idx >= 101 && idx <= 200) return 2;
  if (idx >= 201 && idx <= 300) return 3;
  if (idx >= 301 && idx <= 400) return 4;
  if (idx >= 401 && idx <= 500) return 5;
  return Math.floor((idx - 1) / 100) + 1;
}

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
 * Escudo de Aislamiento Estricto Anti-Sybil:
 * Valida que:
 * 1. Auto-transacciones (sender === target) siempre estén permitidas.
 * 2. Transacciones hacia contratos oficiales o destinos externos estén permitidas.
 * 3. En caso de transacciones internas (ej. distribución de gas de emergencia),
 *    emisor y receptor pertenezcan ESTRICTAMENTE al mismo bloque (B1..B5).
 * 4. Jamás se permita transferencia entre satélites de diferentes bloques ni hacia/desde VIP #00.
 * 
 * @param {string|number} sender Dirección o índice del emisor
 * @param {string|number} target Dirección o índice del receptor
 * @param {Array<string>} allSwarmAddresses Lista de direcciones públicas del enjambre
 * @param {Array<Object>} allWallets Lista completa de objetos de satélite con { index, address }
 * @param {boolean} allowIntraBlock Si permite transferencias entre satélites del mismo bloque (ej. donantes de gas)
 * @returns {boolean} true si cumple con el aislamiento estricto
 * @throws {Error} SYBIL_PROTECTION_TRIGGERED o SYBIL_BLOCK_CROSSING_PREVENTED si se detecta riesgo
 */
function validateIsolation(sender, target, allSwarmAddresses = [], allWallets = [], allowIntraBlock = false) {
  // Normalizar direcciones o buscar en allWallets si se enviaron índices
  let senderAddr = "";
  let targetAddr = "";
  let senderIndex = -1;
  let targetIndex = -1;

  if (typeof sender === "number" || (!isNaN(parseInt(sender, 10)) && String(sender).length < 5)) {
    senderIndex = parseInt(sender, 10);
    const found = allWallets.find((w) => w.index === senderIndex);
    if (found) senderAddr = found.address;
  } else {
    senderAddr = sender;
    const found = allWallets.find((w) => w.address && w.address.toLowerCase() === String(sender).toLowerCase());
    if (found) senderIndex = found.index;
  }

  if (typeof target === "number" || (!isNaN(parseInt(target, 10)) && String(target).length < 5)) {
    targetIndex = parseInt(target, 10);
    const found = allWallets.find((w) => w.index === targetIndex);
    if (found) targetAddr = found.address;
  } else {
    targetAddr = target;
    const found = allWallets.find((w) => w.address && w.address.toLowerCase() === String(target).toLowerCase());
    if (found) targetIndex = found.index;
  }

  // 1. Si no hay conflicto de formato, normalizar con ethers
  let senderNorm = senderAddr ? ethers.getAddress(senderAddr) : String(sender);
  let targetNorm = targetAddr ? ethers.getAddress(targetAddr) : String(target);

  // 2. Auto-transacción siempre permitida
  if (senderNorm.toLowerCase() === targetNorm.toLowerCase()) {
    return true;
  }

  // 3. Verificar si el destino pertenece a la flota pública
  const swarmSet = new Set((allSwarmAddresses || []).map((addr) => addr.toLowerCase()));
  const isTargetInSwarm = swarmSet.has(targetNorm.toLowerCase()) || targetIndex >= 0;

  // Si el destino es un contrato o dirección externa no perteneciente a la flota
  if (!isTargetInSwarm) {
    return true;
  }

  // 4. Protección Bóveda VIP #00
  if (senderIndex === 0 || targetIndex === 0) {
    throw new Error(
      `SYBIL_PROTECTION_TRIGGERED: Intento de interacción con Bóveda VIP #00 detectado (${senderNorm} -> ${targetNorm}). Operación abortada.`
    );
  }

  // 4.5. Bóveda Matriz #501 (Tesorería General & Hub de Fondeo Oficial de la Flota)
  if (senderIndex === 501 || targetIndex === 501) {
    return true;
  }

  // 5. Verificación de bloques
  const senderBlock = getBlockId(senderIndex);
  const targetBlock = getBlockId(targetIndex);

  if (senderBlock !== targetBlock && senderBlock !== -1 && targetBlock !== -1) {
    const errorMsg = `SYBIL_BLOCK_CROSSING_PREVENTED: Violación de aislamiento inter-bloques. ` +
      `Satélite #${senderIndex} (Bloque ${senderBlock}) intentó transferir fondos hacia Satélite #${targetIndex} (Bloque ${targetBlock}). ` +
      `Operación abortada para evitar clusterización on-chain de la flota.`;
    throw new Error(errorMsg);
  }

  // 6. Si es dentro del mismo bloque pero no está habilitado allowIntraBlock
  if (!allowIntraBlock) {
    const errorMsg = `SYBIL_PROTECTION_TRIGGERED: Violación de aislamiento intra-satélite. ` +
      `El satélite ${senderNorm} intentó transferir fondos hacia otro satélite ${targetNorm} sin bandera intra-bloque activa.`;
    throw new Error(errorMsg);
  }

  return true;
}

module.exports = {
  getBlockId,
  sleepRandom,
  shuffleSwarm,
  generateHumanAmount,
  validateIsolation
};
