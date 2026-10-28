const fs = require("fs");
const path = require("path");

// Load solc from npm cache or npx
let solc;
try {
  solc = require("solc");
} catch (_) {
  // Try to find solc in npm cache
  const cachePath = path.join(process.env.LOCALAPPDATA, "npm-cache", "_npx");
  const dirs = fs.readdirSync(cachePath);
  for (const d of dirs) {
    const p = path.join(cachePath, d, "node_modules", "solc");
    if (fs.existsSync(p)) {
      solc = require(p);
      break;
    }
  }
}

if (!solc) {
  console.error("Could not find solc");
  process.exit(1);
}

console.log("Using solc version:", solc.version());

const contractPath = path.join(__dirname, "..", "contracts", "AtomicSniperExecutor.sol");
const source = fs.readFileSync(contractPath, "utf8");

const input = {
  language: "Solidity",
  sources: {
    "AtomicSniperExecutor.sol": {
      content: source
    }
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    },
    viaIR: true,
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode"]
      }
    }
  }
};

console.log("Compiling with viaIR: true and optimizer: 200 runs...");
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  let hasError = false;
  for (const err of output.errors) {
    if (err.severity === "error") {
      hasError = true;
      console.error("ERROR:", err.formattedMessage);
    } else {
      console.warn("WARNING:", err.formattedMessage);
    }
  }
  if (hasError) process.exit(1);
}

const contract = output.contracts["AtomicSniperExecutor.sol"]["AtomicSniperExecutor"];
const abi = contract.abi;
const bytecode = "0x" + contract.evm.bytecode.object;

console.log("✅ Compilation SUCCESS!");
console.log("ABI functions:", abi.filter(x => x.type === "function").map(x => x.name));
console.log("Bytecode length:", bytecode.length);

const artifact = {
  contractName: "AtomicSniperExecutor",
  abi,
  bytecode
};

const artifactPath = path.join(__dirname, "..", "contracts", "AtomicSniperExecutor.artifact.json");
fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), "utf8");
console.log("Saved artifact to:", artifactPath);
