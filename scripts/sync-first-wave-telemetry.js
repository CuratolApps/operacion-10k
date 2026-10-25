const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// 1. fleet-telemetry.json
const fleetPath = path.join(ROOT, "telemetry", "fleet-telemetry.json");
if (fs.existsSync(fleetPath)) {
  const fleet = JSON.parse(fs.readFileSync(fleetPath, "utf8"));
  fleet.dailyCapturedUsdc = 325.55;
  fleet.totalHistoricalUsdc = 325.55;
  fleet.totalOnChainFleetUsdc = 325.55;
  if (fleet.atomicSniperExecution) {
    fleet.atomicSniperExecution.caliberPolygonUsdc = 303.03;
    fleet.atomicSniperExecution.caliberConsolidatedUsdc = 325.55;
    if (fleet.atomicSniperExecution.reboundPosition) {
      fleet.atomicSniperExecution.reboundPosition.currentPositionUsd = 325.55;
      fleet.atomicSniperExecution.reboundPosition.baselineFixedUsdc = 325.55;
      fleet.atomicSniperExecution.reboundPosition.fixedLiquidityUsdc = 325.55;
      fleet.atomicSniperExecution.reboundPosition.targetFirstWaveUsdc = 330.00;
      fleet.atomicSniperExecution.reboundPosition.remainingFirstWaveUsdc = 4.45;
      fleet.atomicSniperExecution.reboundPosition.capitalFloorLockUsdc = 325.43;
      fleet.atomicSniperExecution.reboundPosition.protectedFloorLockUsdc = 325.55;
    }
  }
  if (fleet.snipingEcosystem && fleet.snipingEcosystem.masterVault) {
    fleet.snipingEcosystem.masterVault.gasPol = 155.13;
  }
  fs.writeFileSync(fleetPath, JSON.stringify(fleet, null, 2), "utf8");
  console.log("✅ fleet-telemetry.json sincronizado con $325.55 USDC y piso $325.43.");
}

// 2. sniping/telemetry.json
const snipingPath = path.join(ROOT, "sniping", "telemetry.json");
if (fs.existsSync(snipingPath)) {
  const sniping = JSON.parse(fs.readFileSync(snipingPath, "utf8"));
  sniping.dailyCapturedUsdc = 325.55;
  sniping.totalHistoricalUsdc = 325.55;
  sniping.totalOnChainFleetUsdc = 325.55;
  if (sniping.atomicSniperExecution) {
    sniping.atomicSniperExecution.caliberPolygonUsdc = 303.03;
    sniping.atomicSniperExecution.caliberConsolidatedUsdc = 325.55;
  }
  fs.writeFileSync(snipingPath, JSON.stringify(sniping, null, 2), "utf8");
  console.log("✅ sniping/telemetry.json sincronizado con $325.55 USDC.");
}

// 3. trading-telemetry.json
const tradingPath = path.join(ROOT, "telemetry", "trading-telemetry.json");
if (fs.existsSync(tradingPath)) {
  const trading = JSON.parse(fs.readFileSync(tradingPath, "utf8"));
  if (trading.patrimonialLock) {
    trading.patrimonialLock.sniperCapitalProtectedUsdc = 325.55;
    if (trading.patrimonialLock.breakdown) {
      trading.patrimonialLock.breakdown.polygon501MasterUsdc = 303.03;
      trading.patrimonialLock.breakdown.bscCaptainsUsdc = 21.52;
      trading.patrimonialLock.breakdown.binanceSpotHarvestUsdc = 1.00;
      trading.patrimonialLock.breakdown.nativePolReserve = 300.02;
    }
  }
  fs.writeFileSync(tradingPath, JSON.stringify(trading, null, 2), "utf8");
  console.log("✅ trading-telemetry.json sincronizado con $325.55 USDC.");
}
