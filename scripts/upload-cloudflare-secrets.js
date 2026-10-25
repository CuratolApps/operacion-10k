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

async function main() {
  console.log("☁️ Subiendo secretos a Cloudflare Workers (Cero exposición en logs)...");
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || "-1004342131598";

  await uploadSecret("TELEGRAM_BOT_TOKEN", botToken);
  await uploadSecret("TELEGRAM_CHAT_ID", chatId);
  console.log("🎉 Todos los secretos de Telegram han sido blindados en Cloudflare Workers.");
}

main().catch((err) => {
  console.error("Error en upload-cloudflare-secrets:", err.message);
  process.exit(1);
});
