/**
 * scripts/sync-all-telemetry-after-swap.js
 * Sincronización oficial post-swap de +891.889 POL:
 * - 155.26 POL retenidos en #501 (Piso Sagrado 150.00 POL -> 100% FULL)
 * - 300.06 POL en Flota (Piso Sagrado 300.00 POL -> 100% FULL)
 * - 886.70 POL capitalizados a USDC Nativo (+79.591644 USDC)
 * - Bóveda #501 USDC Nativo: $238.993616 USDC
 * - Cañón #1 Polygon: $243.99 USDC (#501 $238.99 + #001 $5.00)
 * - Cañón #2 BSC: $21.52 USDC
 * - Binance Spot #1: $1.00 USDC
 * - Posición Consolidada Total 1:1: $266.51 USDC
 * - Calibre AtomicSniperExecutor (0x03Ac6307eF8c2Ec6ba724072D823bbf0b5DC6b67) actualizado
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FLEET_TEL_FILE = path.join(ROOT, "telemetry", "fleet-telemetry.json");
const SNIPING_TEL_FILE = path.join(ROOT, "sniping", "telemetry.json");
const TRADING_TEL_FILE = path.join(ROOT, "telemetry", "trading-telemetry.json");

const EXECUTOR_POLYGON = "0x03Ac6307eF8c2Ec6ba724072D823bbf0b5DC6b67";
const EXECUTOR_BSC = "0xD935F7B80237aA14B6D8F9D45070800e9E23Db20";
const WRAP_TX = "0xe2c7848af880409d5e8162e122d02d5878bb877f4444a54c87d42cacf81cefd7";
const SWAP_TX = "0xf908698b0314a4cce3eaf963e376d20425a97119cfd965891f69accb3509757a";
const RECEPTION_TX = "0x21f997630526ab3618935f0cfdffcf906062038c99a3a6a1f003ca9a3f73e1f2b";

async function main() {
  console.log("🔄 Actualizando telemetría post-swap...");

  // 1. Leer fleet-telemetry.json
  const tel = JSON.parse(fs.readFileSync(FLEET_TEL_FILE, "utf8"));

  tel.timestamp = new Date().toISOString();
  tel.atomicExecutorAddressPolygon = EXECUTOR_POLYGON;
  tel.atomicExecutorDeployTxPolygon = EXECUTOR_POLYGON;
  tel.atomicExecutorAddressBsc = EXECUTOR_BSC;

  tel.atomicExecutorDeployInfo = {
    deployedAt: "2026-10-23T23:45:00.000Z",
    contractAddress: EXECUTOR_POLYGON,
    chain: "polygon",
    owner: "0xD4D12077a61118372f7a367319fb11922Beb3743",
    allowanceUsdc: 2500,
    caliberUsdc: 243.99,
    status: "ARMED_AND_READY"
  };

  // Totales
  tel.totalOnChainFleetUsdc = 265.51;
  tel.totalHistoricalUsdc = 266.51;
  tel.dailyCapturedUsdc = 266.51;

  // atomicSniperExecution
  if (tel.atomicSniperExecution) {
    tel.atomicSniperExecution.strictNoGasSell = true;
    tel.atomicSniperExecution.vaultAddress = "0xD4D12077a61118372f7a367319fb11922Beb3743";
    tel.atomicSniperExecution.executorAddress = EXECUTOR_POLYGON;
    tel.atomicSniperExecution.caliberPolygonUsdc = 243.99;
    tel.atomicSniperExecution.caliberConsolidatedUsdc = 266.51;
    if (tel.atomicSniperExecution.reboundPosition) {
      tel.atomicSniperExecution.reboundPosition.baselineFixedUsdc = 266.51;
      tel.atomicSniperExecution.reboundPosition.initialGapUsd = 19.69;
      tel.atomicSniperExecution.reboundPosition.initialGapEur = 18.15;
      tel.atomicSniperExecution.reboundPosition.targetBreakevenUsdc = 286.20;
      tel.atomicSniperExecution.reboundPosition.fixedLiquidityUsdc = 266.51;
      tel.atomicSniperExecution.reboundPosition.currentPositionUsd = 113.81;
      tel.atomicSniperExecution.reboundPosition.currentPositionEur = 104.85;
      tel.atomicSniperExecution.reboundPosition.gapUsd = -19.69;
      tel.atomicSniperExecution.reboundPosition.gapEur = -18.15;
    }
  }

  // snipingEcosystem
  if (tel.snipingEcosystem) {
    tel.snipingEcosystem.strictNoGasSell = true;
    tel.snipingEcosystem.atomicExecutorAddress = EXECUTOR_POLYGON;
    if (tel.snipingEcosystem.masterVault) {
      tel.snipingEcosystem.masterVault.gasPol = 155.26;
      tel.snipingEcosystem.masterVault.gasBnb = 0.0227;
      tel.snipingEcosystem.masterVault.sacredFloorPol = 150.00;
      tel.snipingEcosystem.masterVault.usdcNative = 238.99;
      tel.snipingEcosystem.masterVault.status = "BLINDADA_0_GAS_PERDIDO_100_FULL";
    }
    if (tel.snipingEcosystem.gasTankLive) {
      tel.snipingEcosystem.gasTankLive.motherPol = "155.26 POL";
      tel.snipingEcosystem.gasTankLive.motherBnb = "0.0227 BNB";
      tel.snipingEcosystem.gasTankLive.sacredFloor = "150.00 POL (Piso Inviolable — 100% FULL)";
      tel.snipingEcosystem.gasTankLive.fleetPol = "300.06 POL (Piso Sagrado 300.00 POL — 100% FULL)";
      tel.snipingEcosystem.gasTankLive.fleetBnb = "0.0609 BNB";
      tel.snipingEcosystem.gasTankLive.guaranteedAutonomy = "+38,000 Operaciones Atómicas Disponibles";
      tel.snipingEcosystem.gasTankLive.autonomyBarPct = 100;
    }
    if (tel.snipingEcosystem.munitionTankUsdc) {
      tel.snipingEcosystem.munitionTankUsdc.totalConsolidated = 266.51;
      if (tel.snipingEcosystem.munitionTankUsdc.cannon1_Polygon) {
        tel.snipingEcosystem.munitionTankUsdc.cannon1_Polygon.amountUsdc = 243.99;
        tel.snipingEcosystem.munitionTankUsdc.cannon1_Polygon.command = "#501 (Nodriza Matriz $238.99) & #001 (Capitán Box 1 $5.00)";
      }
      if (tel.snipingEcosystem.munitionTankUsdc.cannon2_BSC) {
        tel.snipingEcosystem.munitionTankUsdc.cannon2_BSC.amountUsdc = 21.52;
      }
      if (tel.snipingEcosystem.munitionTankUsdc.binanceSpotVault) {
        tel.snipingEcosystem.munitionTankUsdc.binanceSpotVault.amountUsdc = 1.00;
      }
    }

    if (!Array.isArray(tel.snipingEcosystem.confirmedOnChainOperations)) {
      tel.snipingEcosystem.confirmedOnChainOperations = [];
    }

    // Agregar la tx del Swap reciente si no existe
    const hasSwap = tel.snipingEcosystem.confirmedOnChainOperations.some(op => op.txHash === SWAP_TX);
    if (!hasSwap) {
      tel.snipingEcosystem.confirmedOnChainOperations.unshift({
        chainBadge: "#POL 96081966",
        chain: "Polygon PoS",
        blockNumber: 96081966,
        txHash: SWAP_TX,
        explorerUrl: `https://polygonscan.com/tx/${SWAP_TX}`,
        timestampUtc: new Date().toISOString(),
        timeFormatted: new Date().toLocaleTimeString("es-ES", { timeZone: "UTC", hour12: false }) + " UTC",
        nebulas: "Nebulosa #01 (Calculista) + Nebulosa #02 (Guardaespaldas)",
        mothership: "#501 (Nodriza Matriz)",
        route: "Polygon / Uniswap V3 0.05% (WPOL ➔ USDC Nativo Circle)",
        cycleInOut: "886.70 WPOL ➔ +$79.5916 USDC Nativo",
        gasUsed: "164,915 Gas (0.007 POL · $0 Pérdida)",
        netProfit: "+$79.5916 USDC",
        statusType: "CONFIRMED"
      });
    }

    // Agregar la tx de recepción
    const hasRec = tel.snipingEcosystem.confirmedOnChainOperations.some(op => op.txHash === RECEPTION_TX);
    if (!hasRec) {
      tel.snipingEcosystem.confirmedOnChainOperations.unshift({
        chainBadge: "#POL 96081500",
        chain: "Polygon PoS",
        blockNumber: 96081500,
        txHash: RECEPTION_TX,
        explorerUrl: `https://polygonscan.com/tx/${RECEPTION_TX}`,
        timestampUtc: new Date().toISOString(),
        timeFormatted: new Date().toLocaleTimeString("es-ES", { timeZone: "UTC", hour12: false }) + " UTC",
        nebulas: "Vigilancia Centinela Área 501",
        mothership: "#501 (Bóveda Matriz)",
        route: "Polygon PoS / Recepción Fondos Nuevos",
        cycleInOut: "Entrada +891.889 POL a Bóveda Matriz #501",
        gasUsed: "0.00 POL",
        netProfit: "+891.889 POL Recibidos",
        statusType: "CONFIRMED"
      });
    }
  }

  // globalGasTank
  tel.globalGasTank = {
    pol: "300.06",
    bnb: "0.0609",
    sepoliaEth: tel.globalGasTank?.sepoliaEth || "4.205",
    baseEth: tel.globalGasTank?.baseEth || "0.926",
    arbitrumEth: tel.globalGasTank?.arbitrumEth || "0.706",
    optimismEth: tel.globalGasTank?.optimismEth || "0.060",
    statusText: "Tanque Global Óptimo (~300.1 POL · ~0.0609 BNB · 4.205 ETH Sepolia · 0.926 ETH Base — Pisos 100% FULL)"
  };

  // Guardar fleet-telemetry.json
  fs.writeFileSync(FLEET_TEL_FILE, JSON.stringify(tel, null, 2), "utf8");
  console.log(`✅ ${FLEET_TEL_FILE} actualizado exitosamente.`);

  // Guardar sniping/telemetry.json
  fs.writeFileSync(SNIPING_TEL_FILE, JSON.stringify(tel, null, 2), "utf8");
  console.log(`✅ ${SNIPING_TEL_FILE} actualizado exitosamente.`);

  // 2. Actualizar trading-telemetry.json
  if (fs.existsSync(TRADING_TEL_FILE)) {
    const tradeTel = JSON.parse(fs.readFileSync(TRADING_TEL_FILE, "utf8"));
    if (tradeTel.patrimonialLock) {
      tradeTel.patrimonialLock.sniperCapitalProtectedUsdc = 266.51;
      tradeTel.patrimonialLock.breakdown = {
        masterVault501OnChainUsdc: 265.51,
        binanceSpotHarvestUsdc: 1.00,
        nativePolReserve: 300.06
      };
    }
    fs.writeFileSync(TRADING_TEL_FILE, JSON.stringify(tradeTel, null, 2), "utf8");
    console.log(`✅ ${TRADING_TEL_FILE} actualizado exitosamente.`);
  }

  console.log("\n💎 RESUMEN TELEMETRÍA:");
  console.log(`   • Posición Consolidada: $266.51 USDC ($243.99 Polygon + $21.52 BSC + $1.00 Binance)`);
  console.log(`   • Tanque Nodriza #501: 155.26 / 150.00 POL (100% FULL)`);
  console.log(`   • Tanque Flota Total: 300.06 / 300.00 POL (100% FULL)`);
  console.log(`   • Calibre Ejecutor Atómico: $243.99 USDC (${EXECUTOR_POLYGON})`);
}

main().catch(err => {
  console.error("❌ Error actualizando telemetría:", err);
  process.exit(1);
});
