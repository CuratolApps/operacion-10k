const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const { getWalletSigner } = require("../swarm-engine");

function getGitToken() {
  return new Promise((resolve, reject) => {
    const p = spawn("git", ["credential", "fill"]);
    p.stdin.write("protocol=https\nhost=github.com\n\n");
    let out = "";
    p.stdout.on("data", (d) => { out += d; });
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error("git credential fill failed"));
      const lines = out.split("\n");
      const passLine = lines.find((l) => l.startsWith("password="));
      if (!passLine) return reject(new Error("No password found in git credentials"));
      resolve(passLine.replace("password=", "").trim());
    });
    p.on("error", reject);
  });
}

function setGitHubSecret(name, value, ghToken, repo = "CuratolApps/operacion-10k") {
  return new Promise((resolve, reject) => {
    if (!value) {
      console.warn(`⚠️ Secreto ${name} no definido. Saltando.`);
      return resolve(false);
    }
    const ghPath = fs.existsSync(path.resolve(__dirname, "bin", "bin", "gh.exe"))
      ? path.resolve(__dirname, "bin", "bin", "gh.exe")
      : "gh";
    const proc = spawn(ghPath, ["secret", "set", name, "--repo", repo], {
      env: { ...process.env, GH_TOKEN: ghToken },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    proc.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ GitHub Secret ${name} inyectado exitosamente en ${repo}`);
        resolve(true);
      } else {
        console.error(`❌ Error inyectando GitHub Secret ${name}:`, stderr);
        reject(new Error(`Exit code ${code}`));
      }
    });

    proc.stdin.write(value + "\n");
    proc.stdin.end();
  });
}

async function main() {
  console.log("🐙 Inyectando secretos en GitHub Secrets (CuratolApps/operacion-10k)...");
  const ghToken = await getGitToken();

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || "-1004342131598";
  const hlAgentKey = process.env.HL_AGENT_PRIVATE_KEY;
  const hlWalletAddr = process.env.HL_WALLET_ADDRESS || "0xD4D12077a61118372f7a367319fb11922Beb3743";
  const hlAgentAddr = process.env.HL_AGENT_ADDRESS || "0xccb384286cCE024A318Ff98197E6c89e0f02F7f8";
  const trustSeed = process.env.TRUST_WALLET_SEED;
  const polygonRpc = (process.env.POLYGON_RPC_URL && !process.env.POLYGON_RPC_URL.includes("alchemy.com"))
    ? process.env.POLYGON_RPC_URL
    : "https://polygon-bor-rpc.publicnode.com";

  let polygonExecutorKey = "";
  try {
    const signer501 = getWalletSigner(501);
    polygonExecutorKey = signer501.privateKey;
    console.log(`🔑 Clave de Ejecutor #501 derivada en memoria para GitHub (Dirección: ${signer501.address})`);
  } catch (err) {
    console.warn("⚠️ No se pudo derivar signer #501:", err.message);
  }

  const secrets = [
    { name: "HL_AGENT_PRIVATE_KEY", value: hlAgentKey },
    { name: "HL_WALLET_ADDRESS", value: hlWalletAddr },
    { name: "HL_AGENT_ADDRESS", value: hlAgentAddr },
    { name: "POLYGON_EXECUTOR_KEY", value: polygonExecutorKey },
    { name: "POLYGON_RPC_URL", value: polygonRpc },
    { name: "TELEGRAM_BOT_TOKEN", value: botToken },
    { name: "TELEGRAM_CHAT_ID", value: chatId },
    { name: "TRUST_WALLET_SEED", value: trustSeed }
  ];

  for (const s of secrets) {
    await setGitHubSecret(s.name, s.value, ghToken);
  }

  console.log("🎉 Todos los secretos del ecosistema han sido blindados en GitHub Secrets.");
}

main().catch((err) => {
  console.error("Error en upload-github-secrets:", err.message);
  process.exit(1);
});
