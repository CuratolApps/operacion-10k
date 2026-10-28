const { spawn } = require("child_process");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

function uploadSecret(name, value) {
  return new Promise((resolve, reject) => {
    if (!value) {
      console.warn(`⚠️ Secreto ${name} no encontrado en .env`);
      return resolve(false);
    }

    const isWindows = process.platform === "win32";
    const proc = spawn(isWindows ? "cmd.exe" : "npx", isWindows ? ["/c", "npx", "wrangler", "secret", "put", name] : ["wrangler", "secret", "put", name], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: path.resolve(__dirname, "..")
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });

    proc.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ Secreto ${name} configurado exitosamente en Cloudflare Workers.`);
        resolve(true);
      } else {
        console.error(`❌ Error configurando secreto ${name}:`, stderr || stdout);
        reject(new Error(`Failed with exit code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });

    proc.stdin.write(value + "\n");
    proc.stdin.end();
  });
}

const { getWalletSigner } = require("../swarm-engine");

async function main() {
  console.log("☁️ Subiendo secretos a Cloudflare Workers (Cero exposición en logs)...");
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || "-1004342131598";
  const hlAgentKey = process.env.HL_AGENT_PRIVATE_KEY;
  const hlWalletAddr = process.env.HL_WALLET_ADDRESS || "0xD4D12077a61118372f7a367319fb11922Beb3743";
  const hlAgentAddr = process.env.HL_AGENT_ADDRESS || "0xccb384286cCE024A318Ff98197E6c89e0f02F7f8";
  const trustSeed = process.env.TRUST_WALLET_SEED;
  const polygonRpc = (process.env.POLYGON_RPC_URL && !process.env.POLYGON_RPC_URL.includes("alchemy.com"))
    ? process.env.POLYGON_RPC_URL
    : "https://polygon-bor-rpc.publicnode.com";

  // Derivar clave de ejecución #501 para Polygon en memoria de forma segura
  let polygonExecutorKey = "";
  try {
    const signer501 = getWalletSigner(501);
    polygonExecutorKey = signer501.privateKey;
    console.log(`🔑 Clave de Ejecutor #501 derivada en memoria (Dirección: ${signer501.address})`);
  } catch (err) {
    console.warn("⚠️ No se pudo derivar signer #501:", err.message);
  }

  // Lista de secretos a blindar
  const secrets = [
    { name: "TELEGRAM_BOT_TOKEN", value: botToken },
    { name: "TELEGRAM_CHAT_ID", value: chatId },
    { name: "HL_AGENT_PRIVATE_KEY", value: hlAgentKey },
    { name: "HL_WALLET_ADDRESS", value: hlWalletAddr },
    { name: "HL_AGENT_ADDRESS", value: hlAgentAddr },
    { name: "POLYGON_EXECUTOR_KEY", value: polygonExecutorKey },
    { name: "TRUST_WALLET_SEED", value: trustSeed },
    { name: "POLYGON_RPC_URL", value: polygonRpc }
  ];

  for (const s of secrets) {
    if (s.value) {
      await uploadSecret(s.name, s.value);
    } else {
      console.warn(`⚠️ Secreto omitido por falta de valor: ${s.name}`);
    }
  }

  console.log("🎉 Todos los secretos del ecosistema (Hyperliquid L1 + Polygon V2 + Telegram) han sido blindados en Cloudflare Workers.");
}

main().catch((err) => {
  console.error("Error en upload-cloudflare-secrets:", err.message);
  process.exit(1);
});
