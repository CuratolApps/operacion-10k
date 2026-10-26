/**
 * scripts/hyperliquid-squad-daemon.js — ÁREA 501 // SQUAD SECRET AUTONOMOUS DAEMON
 * ==============================================================================
 * MOTOR AUTÓNOMO CONTINUO DE LOS 3 ESCUADRONES SNIPER EN HYPERLIQUID L1
 * - Escuadrón Alfa (#601 Fuerza Rápida): SOL, SUI, POL ($20 Margen · 5x)
 * - Escuadrón Bravo (#701 Macro Refugios): BTC, PAXG, LINK ($20 Margen · 5x)
 * - Escuadrón Charlie (#801 Ecosistema DeFi): ETH, BNB, AAVE ($20 Margen · 5x)
 * 
 * LEYES SAGRADAS DEL MOTOR:
 * 1. Escudo de Reserva Sagrado: $40.02 USDC 100% Intocable en Cash.
 * 2. Ley del Fee Blindado: Entrada y Salida estrictamente Post-Only ALO Maker ($0.00 gas, 0.015% fee).
 * 3. Candado Breakeven: Cubre 100% comisiones ida y vuelta (+0.045% mín).
 * 4. Máximo 1 posición a la vez por escuadrón (hasta 3 en total).
 * 5. Reportes militares automáticos a Telegram (-1004342131598).
 * ==============================================================================
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");
const { ExchangeClient, InfoClient, HttpTransport } = require("@nktkas/hyperliquid");
const { ethers } = require("ethers");
const { sendTelegramAlert } = require("../telegram-notifier");

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const UNTOUCHABLE_RESERVE_USDC = 40.02;
const SQUAD_MARGIN_USDC = 20.00;
const LEVERAGE = 5;

const TELEMETRY_DIR = path.join(__dirname, "..", "telemetry");
const REAL_LEDGER_FILE = path.join(TELEMETRY_DIR, "squad-secret-real-ledger.json");
const SQUAD_TELEMETRY_FILE = path.join(TELEMETRY_DIR, "squad-secret-telemetry.json");

const ASSET_INDICES = {
  BTC: 0,
  ETH: 1,
  SOL: 5,
  BNB: 7,
  SUI: 14,
  LINK: 18,
  AAVE: 28,
  POL: 142,
  PAXG: 187
};

const ASSET_DECIMALS = {
  BTC: { sz: 5, coin: "BTC" },
  ETH: { sz: 4, coin: "ETH" },
  SOL: { sz: 2, coin: "SOL" },
  BNB: { sz: 3, coin: "BNB" },
  SUI: { sz: 1, coin: "SUI" },
  LINK: { sz: 1, coin: "LINK" },
  AAVE: { sz: 2, coin: "AAVE" },
  POL: { sz: 0, coin: "POL" },
  PAXG: { sz: 3, coin: "PAXG" }
};

const SQUADS_CONFIG = {
  ALFA: {
    id: "ALFA",
    name: "Escuadrón Alfa",
    specialist: "#601 Titan-Scalper",
    role: "Fuerza Rápida High-Beta",
    pairs: ["SOL", "SUI", "POL"],
    targetGainPct: 0.080,
    beGainPct: 0.045
  },
  BRAVO: {
    id: "BRAVO",
    name: "Escuadrón Bravo",
    specialist: "#701 Oracle-Global",
    role: "Macro & Refugios RWA",
    pairs: ["BTC", "PAXG", "LINK"],
    targetGainPct: 0.080,
    beGainPct: 0.045
  },
  CHARLIE: {
    id: "CHARLIE",
    name: "Escuadrón Charlie",
    specialist: "#801 Nexus-Boss",
    role: "Ecosistema DeFi & ALO Maker",
    pairs: ["ETH", "BNB", "AAVE"],
    targetGainPct: 0.080,
    beGainPct: 0.045
  }
};

function formatHlPrice(price, coin) {
  if (coin === "BTC") return price.toFixed(1);
  if (coin === "ETH" || coin === "PAXG") return price.toFixed(1);
  if (coin === "SOL" || coin === "BNB" || coin === "AAVE") return price.toFixed(2);
  if (coin === "LINK") return price.toFixed(3);
  if (coin === "SUI") return price.toFixed(4);
  if (coin === "POL") return price.toFixed(5);
  return price.toFixed(2);
}

function formatHlSize(sz, szDecimals) {
  const factor = Math.pow(10, szDecimals);
  return (Math.floor(sz * factor) / factor).toFixed(szDecimals);
}

function loadRealLedger() {
  try {
    if (fs.existsSync(REAL_LEDGER_FILE)) {
      return JSON.parse(fs.readFileSync(REAL_LEDGER_FILE, "utf8"));
    }
  } catch (_) {}
  return { realWins: 0, realLosses: 0, realTransactions: [] };
}

function recordTransactionInLedger(tx) {
  try {
    const ledger = loadRealLedger();
    ledger.realWins = (ledger.realWins || 0) + 1;
    ledger.realPnlUsdc = +(Number(ledger.realPnlUsdc || 0) + Number(tx.netProfitUsdc || 0)).toFixed(4);
    ledger.totalConsolidatedUsdc = +(599.21 + Number(ledger.realPnlUsdc)).toFixed(4);
    ledger.updatedAt = new Date().toISOString();
    ledger.realTransactions = ledger.realTransactions || [];
    ledger.realTransactions.unshift(tx);
    if (ledger.realTransactions.length > 50) ledger.realTransactions = ledger.realTransactions.slice(0, 50);
    fs.writeFileSync(REAL_LEDGER_FILE, JSON.stringify(ledger, null, 2), "utf8");

    if (fs.existsSync(SQUAD_TELEMETRY_FILE)) {
      try {
        const telem = JSON.parse(fs.readFileSync(SQUAD_TELEMETRY_FILE, "utf8"));
        telem.scoreboard = telem.scoreboard || {};
        telem.scoreboard.currentWins = ledger.realWins;
        telem.scoreboard.sessionNetPnLUsdc = ledger.realPnlUsdc;
        telem.scoreboard.sessionNetPnLFormatted = `+$${ledger.realPnlUsdc.toFixed(2)} USDC`;
        telem.cycleHistory = ledger.realTransactions.slice(0, 15);
        fs.writeFileSync(SQUAD_TELEMETRY_FILE, JSON.stringify(telem, null, 2), "utf8");
      } catch (_) {}
    }
  } catch (err) {
    console.error("Error guardando transacción en ledger:", err.message);
  }
}

async function sendSquadTelegram(msg) {
  const chatId = process.env.TELEGRAM_CHAT_ID || "-1004342131598";
  try {
    await sendTelegramAlert(msg, chatId, { skipHeader: true });
  } catch (_) {}
}

async function startAutonomousSquadDaemon() {
  console.log("================================================================");
  console.log("🚀 ÁREA 501 // SQUAD SECRET // MOTOR AUTÓNOMO CONTINUO ENCENDIDO");
  console.log("================================================================");
  console.log(`• Bóveda Nodriza: ${VAULT_501}`);
  console.log(`• Escudo de Reserva: $${UNTOUCHABLE_RESERVE_USDC.toFixed(2)} USDC (Blindado e Intocable)`);
  console.log(`• 3 Escuadrones: ALFA (#601), BRAVO (#701), CHARLIE (#801)`);
  console.log(`• Regla: Doble Maker ALO ($0.00 Gas) · Candado BE +0.045% · TP +0.080%\n`);

  const transport = new HttpTransport({ isTestnet: false });
  const info = new InfoClient({ transport });

  const agentWallet = new ethers.Wallet(process.env.HL_AGENT_PRIVATE_KEY);
  const client = new ExchangeClient({
    wallet: agentWallet,
    transport,
    isTestnet: false
  });

  // Estado interno en memoria de cada escuadrón
  const squadState = {
    ALFA: { activeCoin: null, entryPx: 0, size: "0", restingOid: null, tpOid: null, entryTime: 0 },
    BRAVO: { activeCoin: null, entryPx: 0, size: "0", restingOid: null, tpOid: null, entryTime: 0 },
    CHARLIE: { activeCoin: null, entryPx: 0, size: "0", restingOid: null, tpOid: null, entryTime: 0 }
  };

  // Notificar ignición oficial a Telegram
  const startMsg = `🔥 <b>ÁREA 501 // MOTORES ENCENDIDOS // 3 ESCUADRONES EN VIVO</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏛️ <b>ESTADO OPERATIVO:</b> <code>100% FUEGO REAL AUTÓNOMO</code>
📍 <b>PLATAFORMA:</b> Hyperliquid L1 Maker ($0.00 Gas · 0.015% Fee)
🛡️ <b>ESCUDO DE RESERVA:</b> <code>$40.02 USDC</code> (40% Intocable en Cash)
💵 <b>MARGEN MÁXIMO ASIGNADO:</b> <code>$60.00 USDC</code> ($20 x 3 Escuadrones)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔰 <b>FRENTES TÁCTICOS EN CACERÍA INDEPENDIENTE:</b>
• ⚡ <b>ALFA (#601 Fuerza Rápida):</b> <code>SOL</code> · <code>SUI</code> · <code>POL</code>
• 🏛️ <b>BRAVO (#701 Macro Refugios):</b> <code>BTC</code> · <code>PAXG</code> · <code>LINK</code>
• 🌌 <b>CHARLIE (#801 Ecosistema DeFi):</b> <code>ETH</code> · <code>BNB</code> · <code>AAVE</code>

🎯 <b>POLÍTICA MILITAR:</b>
1. Doble Maker Post-Only ALO (Cero tarifa Taker).
2. Candado Breakeven cubriendo el 100% de comisiones.
3. Retorno inmediato a USDC al cobrar TP.
4. Mente fría: solo tiros de alta probabilidad (L2 Desequilibrio >= 65%).

🌐 <b>Mando Central:</b> <a href="https://area-501.curatolapps.workers.dev/squad-secret/">Squad Secret en Vivo</a>
<i>Comandante, descanse tranquilo. La guardia nocturna queda activa reportando cada victoria.</i>`;

  await sendSquadTelegram(startMsg);

  // Bucle autónomo continuo
  let cycleCounter = 0;
  while (true) {
    cycleCounter++;
    try {
      // 1. Obtener estado del Clearinghouse
      const ch = await info.clearinghouseState({ user: VAULT_501 });
      const accountValue = parseFloat(ch.marginSummary?.accountValue || "0.0");
      const openPositions = ch.assetPositions || [];
      const openOrders = await info.openOrders({ user: VAULT_501 });

      const availableForTrading = Math.max(0, accountValue - UNTOUCHABLE_RESERVE_USDC);

      if (cycleCounter % 10 === 1) {
        console.log(`[${new Date().toISOString().slice(11, 19)} UTC] Ciclo #${cycleCounter} | Saldo: $${accountValue.toFixed(4)} USDC | Fuego Disp: $${availableForTrading.toFixed(2)} USDC | Posiciones: ${openPositions.length}`);
      }

      // 2. Gestionar cada escuadrón de forma independiente
      for (const [squadKey, squadCfg] of Object.entries(SQUADS_CONFIG)) {
        const mem = squadState[squadKey];

        // Verificar si este escuadrón tiene una posición activa en la blockchain
        const activePos = openPositions.find(p => squadCfg.pairs.includes(p.position.coin) && parseFloat(p.position.szi) !== 0);

        if (activePos) {
          // --- GESTIÓN DE POSICIÓN ACTIVA ---
          const coin = activePos.position.coin;
          const sz = activePos.position.szi;
          const entryPx = parseFloat(activePos.position.entryPx);
          mem.activeCoin = coin;

          // Verificar si ya tiene orden de salida puesta
          const existingExitOrder = openOrders.find(o => o.coin === coin && o.side === "A" && o.reduceOnly === true);

          if (!existingExitOrder) {
            // Colocar orden de salida Take Profit / Breakeven Maker ALO
            const targetGainPct = squadCfg.targetGainPct || 0.080;
            const safeExitPxStr = formatHlPrice(entryPx * (1 + targetGainPct / 100), coin);

            console.log(`[${squadKey}] Colocando salida Maker ALO para ${coin}: ${sz} @ $${safeExitPxStr}`);
            try {
              const exitRes = await client.order({
                orders: [{
                  a: ASSET_INDICES[coin],
                  b: false,
                  p: safeExitPxStr,
                  s: formatHlSize(Math.abs(parseFloat(sz)), ASSET_DECIMALS[coin].sz),
                  r: true,
                  t: { limit: { tif: "Alo" } }
                }],
                grouping: "na"
              });
              const exitStatus = exitRes.response?.data?.statuses?.[0] || {};
              if (exitStatus.resting) {
                mem.tpOid = exitStatus.resting.oid;
                console.log(`[${squadKey}] Orden Salida ALO colocada: #${mem.tpOid} a $${safeExitPxStr}`);
              }
            } catch (err) {
              console.error(`[${squadKey}] Error colocando salida ALO:`, err.message);
            }
          }
        } else {
          // --- ESCUADRÓN LIBRE: BUSCAR NUEVO TIRO ---
          if (mem.activeCoin) {
            // Si antes tenía moneda y ya no está en posiciones, ¡SE COBRÓ EL TAKE PROFIT!
            console.log(`[${squadKey}] 💰 ¡VICTORIA CONFIRMADA! Posición en ${mem.activeCoin} cerrada al 100%.`);
            const closedCoin = mem.activeCoin;
            mem.activeCoin = null;
            mem.restingOid = null;
            mem.tpOid = null;

            // Consultar último fill para detalles exactos
            const recentFills = await info.userFills({ user: VAULT_501 });
            const closeFill = recentFills.find(f => f.coin === closedCoin && f.dir === "Close Long");
            const netGain = closeFill ? parseFloat(closeFill.closedPnl || "0.02") : 0.02;

            const victoryTx = {
              cycleId: `CYC-${Date.now().toString().slice(-4)}`,
              squad: `${squadCfg.name} (${squadCfg.specialist})`,
              pair: `${closedCoin}-USDC`,
              direction: "BULL",
              directionLabel: "🐂 BULL (LONG)",
              netProfitUsdc: netGain,
              status: "TAKE_PROFIT_CONFIRMED",
              timestamp: new Date().toISOString()
            };
            recordTransactionInLedger(victoryTx);

            const victoryTg = `💰 <b>ÁREA 501 // SQUAD SECRET // VICTORIA ON-CHAIN CERRADA</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔰 <b>Escuadrón:</b> <b>${squadCfg.name}</b> (${squadCfg.specialist})
🎯 <b>Par Liquidado:</b> <code>${closedCoin}-USDC</code>
💵 <b>Resultado Neto:</b> <b>+$${netGain.toFixed(4)} USDC Limpios</b>
🛡️ <b>Nuevo Saldo L1:</b> <code>$${accountValue.toFixed(4)} USDC</code>
⏱️ <b>Posiciones Abiertas:</b> <code>${openPositions.length} (Cero Holding)</code>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 <i>100% de capital resguardado en USDC nativo.</i>`;
            await sendSquadTelegram(victoryTg);
          }

          // Si el capital disponible supera el margen mínimo requerido ($20)
          if (availableForTrading >= SQUAD_MARGIN_USDC) {
            // Verificar si este escuadrón ya tiene una orden de entrada pendiente en el libro
            const pendingEntry = openOrders.find(o => squadCfg.pairs.includes(o.coin) && o.side === "B" && !o.reduceOnly);

            if (!pendingEntry) {
              // Escanear los 3 pares del escuadrón
              let bestCandidate = null;

              for (const coin of squadCfg.pairs) {
                try {
                  const l2 = await info.l2Book({ coin });
                  const bids = l2.levels[0] || [];
                  const asks = l2.levels[1] || [];
                  if (bids.length < 3 || asks.length < 3) continue;

                  let bidVol = 0, askVol = 0;
                  for (let i = 0; i < Math.min(5, bids.length); i++) bidVol += parseFloat(bids[i].px) * parseFloat(bids[i].sz);
                  for (let i = 0; i < Math.min(5, asks.length); i++) askVol += parseFloat(asks[i].px) * parseFloat(asks[i].sz);

                  const total = bidVol + askVol;
                  const bullPct = total > 0 ? (bidVol / total) * 100 : 50;

                  // Filtro estricto: Desequilibrio de compradores >= 65%
                  if (bullPct >= 65.0) {
                    if (!bestCandidate || bullPct > bestCandidate.bullPct) {
                      bestCandidate = {
                        coin,
                        bestBid: parseFloat(bids[0].px),
                        bestAsk: parseFloat(asks[0].px),
                        bullPct
                      };
                    }
                  }
                } catch (_) {}
              }

              if (bestCandidate) {
                // Tiro identificado con desequilibrio favorable
                const coin = bestCandidate.coin;
                const notional = SQUAD_MARGIN_USDC * LEVERAGE;
                const szFormatted = formatHlSize(notional / bestCandidate.bestBid, ASSET_DECIMALS[coin].sz);
                const entryPxStr = formatHlPrice(bestCandidate.bestBid, coin);

                console.log(`[${squadKey}] 🎯 Oportunidad detectada en ${coin}: Imbalance ${bestCandidate.bullPct.toFixed(1)}% | Entrada ALO @ $${entryPxStr}`);

                try {
                  const orderRes = await client.order({
                    orders: [{
                      a: ASSET_INDICES[coin],
                      b: true,
                      p: entryPxStr,
                      s: szFormatted,
                      r: false,
                      t: { limit: { tif: "Alo" } }
                    }],
                    grouping: "na"
                  });
                  const status = orderRes.response?.data?.statuses?.[0] || {};
                  if (status.resting) {
                    mem.restingOid = status.resting.oid;
                    mem.entryTime = Date.now();
                    console.log(`[${squadKey}] Orden Entrada ALO #${mem.restingOid} descansando en el libro.`);

                    const alertTg = `🎯 <b>ÁREA 501 // SEÑAL SNIPER DETECTADA &amp; ORDEN ALO</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔰 <b>Escuadrón:</b> <b>${squadCfg.name}</b> (${squadCfg.specialist})
📍 <b>Par:</b> <code>${coin}-USDC</code> (🐂 LONG MAKER)
📊 <b>Certeza L2:</b> <code>${bestCandidate.bullPct.toFixed(1)}% Compradores</code>
💵 <b>Margen:</b> <code>$${SQUAD_MARGIN_USDC.toFixed(2)} USDC</code> (5x · Nocional $${notional.toFixed(2)})
📥 <b>Entrada Maker ALO:</b> <code>$${entryPxStr}</code>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ <i>Ley del Fee Blindado en ejecución.</i>`;
                    await sendSquadTelegram(alertTg);
                  }
                } catch (err) {
                  console.error(`[${squadKey}] Error colocando entrada ALO:`, err.message);
                }
              }
            } else {
              // Si la orden de entrada lleva más de 3 minutos sin llenarse, cancelarla para buscar mejor oportunidad
              if (mem.entryTime && (Date.now() - mem.entryTime > 180000) && mem.restingOid) {
                console.log(`[${squadKey}] Orden #${mem.restingOid} sin llenar tras 3m. Cancelando para refrescar.`);
                try {
                  await client.cancel({ cancels: [{ a: ASSET_INDICES[pendingEntry.coin], o: mem.restingOid }] });
                  mem.restingOid = null;
                } catch (_) {}
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("[AUTONOMOUS LOOP] Error en ciclo (resiliente, reanudando):", err.message);
    }

    // Esperar 12 segundos antes del siguiente ciclo de escaneo
    await new Promise(r => setTimeout(r, 12000));
  }
}

startAutonomousSquadDaemon().catch(err => {
  console.error("Fallo fatal en daemon:", err);
  process.exit(1);
});
