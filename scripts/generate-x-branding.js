/**
 * scripts/generate-x-branding.js - Operación 10k
 * Generador de Identidad Visual Oficial 10K para @yozapata en X (Twitter).
 * 
 * Genera:
 * 1. assets/x-branding/avatar-yozapata-10k.png (400x400 px)
 * 2. assets/x-branding/banner-yozapata-10k.png (1500x500 px)
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUTPUT_DIR = path.resolve(__dirname, "..", "assets", "x-branding");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// -------------------------------------------------------------------------------------
// 1. AVATAR 400x400 px
// -------------------------------------------------------------------------------------
function generateAvatarSvg() {
  // Anillo de nodos Web3 (12 nodos en círculo radio 145)
  const nodeCount = 12;
  const cx = 200;
  const cy = 200;
  const r = 145;
  let nodesSvg = "";
  let linesSvg = "";

  const coords = [];
  for (let i = 0; i < nodeCount; i++) {
    const angle = (i * 2 * Math.PI) / nodeCount - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    coords.push({ x, y, angle });
  }

  // Líneas entre nodos consecutivos y cruzados (red de malla)
  for (let i = 0; i < nodeCount; i++) {
    const next = (i + 1) % nodeCount;
    linesSvg += `<line x1="${coords[i].x.toFixed(1)}" y1="${coords[i].y.toFixed(1)}" x2="${coords[next].x.toFixed(1)}" y2="${coords[next].y.toFixed(1)}" stroke="#D4AF37" stroke-opacity="0.35" stroke-width="1.5" />`;
    const cross = (i + 3) % nodeCount;
    linesSvg += `<line x1="${coords[i].x.toFixed(1)}" y1="${coords[i].y.toFixed(1)}" x2="${coords[cross].x.toFixed(1)}" y2="${coords[cross].y.toFixed(1)}" stroke="#38bdf8" stroke-opacity="0.15" stroke-width="1" stroke-dasharray="3,3" />`;
  }

  // Puntos de nodos
  coords.forEach((c, idx) => {
    const isGold = idx % 2 === 0;
    const fill = isGold ? "#D4AF37" : "#38bdf8";
    const rad = isGold ? 4.5 : 3;
    nodesSvg += `
      <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${rad * 2}" fill="${fill}" opacity="0.18" />
      <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${rad}" fill="${fill}" />
    `;
  });

  return `
<svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Fondo Gradiente Radial Profundo -->
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#121D33" />
      <stop offset="60%" stop-color="#080D1A" />
      <stop offset="100%" stop-color="#04070D" />
    </radialGradient>

    <!-- Gradiente Oro Mate de Lujo -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F5E08F" />
      <stop offset="50%" stop-color="#D4AF37" />
      <stop offset="100%" stop-color="#AA820A" />
    </linearGradient>

    <!-- Resplandor Dorado Sutil -->
    <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Fondo Grafito / Azul Espacial -->
  <rect width="400" height="400" fill="url(#bgGrad)" />

  <!-- Anillos concéntricos sutiles -->
  <circle cx="200" cy="200" r="175" fill="none" stroke="#D4AF37" stroke-opacity="0.12" stroke-width="1" />
  <circle cx="200" cy="200" r="145" fill="none" stroke="#38bdf8" stroke-opacity="0.2" stroke-width="1.2" stroke-dasharray="6,4" />
  <circle cx="200" cy="200" r="115" fill="none" stroke="#D4AF37" stroke-opacity="0.18" stroke-width="1" />

  <!-- Malla de nodos Web3 -->
  <g>
    ${linesSvg}
    ${nodesSvg}
  </g>

  <!-- Escudo Central Hexagonal / Geométrico -->
  <polygon points="200,95 285,145 285,255 200,305 115,255 115,145" 
           fill="#0A1122" 
           stroke="url(#goldGrad)" 
           stroke-width="2.5" 
           filter="url(#goldGlow)" />

  <!-- Borde Interno Hexagonal -->
  <polygon points="200,105 275,151 275,249 200,295 125,249 125,151" 
           fill="#060A14" 
           fill-opacity="0.75"
           stroke="#D4AF37" 
           stroke-opacity="0.3" 
           stroke-width="1" />

  <!-- Emblema Geométrico Central: YZ // 10K -->
  <!-- Monograma YZ -->
  <text x="200" y="185" 
        text-anchor="middle" 
        font-family="'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" 
        font-size="44" 
        font-weight="900" 
        letter-spacing="6" 
        fill="url(#goldGrad)"
        filter="url(#goldGlow)">YZ</text>

  <!-- Separador Divisor de Lujo con Destello -->
  <line x1="145" y1="205" x2="255" y2="205" stroke="url(#goldGrad)" stroke-width="2" />
  <circle cx="200" cy="205" r="3.5" fill="#FFFFFF" />

  <!-- Lema / Identificador 10K -->
  <text x="200" y="242" 
        text-anchor="middle" 
        font-family="'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" 
        font-size="24" 
        font-weight="800" 
        letter-spacing="8" 
        fill="#FFFFFF">10K</text>

  <!-- Micro-tag On-Chain -->
  <text x="200" y="265" 
        text-anchor="middle" 
        font-family="'SF Mono', 'Consolas', monospace" 
        font-size="9" 
        font-weight="700" 
        letter-spacing="3" 
        fill="#38bdf8" 
        opacity="0.9">ON-CHAIN INTEL</text>
</svg>
`;
}

// -------------------------------------------------------------------------------------
// 2. BANNER 1500x500 px
// -------------------------------------------------------------------------------------
function generateBannerSvg() {
  // Red de líneas de radar y cuadrícula de alta tecnología
  let gridLines = "";
  for (let x = 0; x <= 1500; x += 100) {
    gridLines += `<line x1="${x}" y1="0" x2="${x}" y2="500" stroke="#38bdf8" stroke-opacity="0.04" stroke-width="1" />`;
  }
  for (let y = 0; y <= 500; y += 50) {
    gridLines += `<line x1="0" y1="${y}" x2="1500" y2="${y}" stroke="#38bdf8" stroke-opacity="0.04" stroke-width="1" />`;
  }

  // Constelación de nodos y enlaces en los costados
  const leftNodes = [
    { x: 120, y: 150 }, { x: 220, y: 100 }, { x: 180, y: 240 },
    { x: 90, y: 340 }, { x: 250, y: 380 }, { x: 320, y: 220 },
    { x: 140, y: 440 }
  ];
  const rightNodes = [
    { x: 1380, y: 150 }, { x: 1280, y: 100 }, { x: 1320, y: 240 },
    { x: 1410, y: 340 }, { x: 1250, y: 380 }, { x: 1180, y: 220 },
    { x: 1360, y: 440 }
  ];

  let constellationSvg = "";
  function renderConstellation(nodes, isRight) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (dist < 180) {
          const stroke = (i + j) % 2 === 0 ? "#D4AF37" : "#38bdf8";
          const op = ((180 - dist) / 180) * 0.25;
          constellationSvg += `<line x1="${nodes[i].x}" y1="${nodes[i].y}" x2="${nodes[j].x}" y2="${nodes[j].y}" stroke="${stroke}" stroke-opacity="${op.toFixed(2)}" stroke-width="1.2" />`;
        }
      }
      const col = i % 2 === 0 ? "#D4AF37" : "#38bdf8";
      constationSvg = constellationSvg += `
        <circle cx="${nodes[i].x}" cy="${nodes[i].y}" r="3" fill="${col}" />
        <circle cx="${nodes[i].x}" cy="${nodes[i].y}" r="6" fill="${col}" opacity="0.25" />
      `;
    }
  }
  renderConstellation(leftNodes, false);
  renderConstellation(rightNodes, true);

  return `
<svg width="1500" height="500" viewBox="0 0 1500 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Fondo Gradiente Lineal Profundo -->
    <linearGradient id="bannerBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050811" />
      <stop offset="35%" stop-color="#080D1A" />
      <stop offset="50%" stop-color="#0D1629" />
      <stop offset="65%" stop-color="#080D1A" />
      <stop offset="100%" stop-color="#050811" />
    </linearGradient>

    <!-- Gradiente Oro Mate de Lujo -->
    <linearGradient id="goldGradBanner" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#D4AF37" />
      <stop offset="30%" stop-color="#FFF0B3" />
      <stop offset="50%" stop-color="#D4AF37" />
      <stop offset="70%" stop-color="#FFF0B3" />
      <stop offset="100%" stop-color="#D4AF37" />
    </linearGradient>

    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#818cf8" />
    </linearGradient>

    <!-- Resplandor Dorado Sutil -->
    <filter id="goldGlowBanner" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    <!-- Resplandor Cyan -->
    <filter id="cyanGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Fondo -->
  <rect width="1500" height="500" fill="url(#bannerBg)" />

  <!-- Cuadrícula Tecnológica -->
  <g>${gridLines}</g>

  <!-- Constelación de Nodos Laterales -->
  <g>${constellationSvg}</g>

  <!-- Líneas de Acento Top y Bottom -->
  <line x1="0" y1="2" x2="1500" y2="2" stroke="url(#goldGradBanner)" stroke-width="3" />
  <line x1="0" y1="498" x2="1500" y2="498" stroke="url(#goldGradBanner)" stroke-width="2" />

  <!-- Centro: Radar Glow Circunferencial -->
  <circle cx="750" cy="250" r="230" fill="none" stroke="#D4AF37" stroke-opacity="0.08" stroke-width="1.5" />
  <circle cx="750" cy="250" r="180" fill="none" stroke="#38bdf8" stroke-opacity="0.12" stroke-width="1" stroke-dasharray="8,6" />
  <circle cx="750" cy="250" r="130" fill="none" stroke="#D4AF37" stroke-opacity="0.06" stroke-width="1" />

  <!-- Badge Superior: 🛰️ AUTONOMOUS WEB3 INFRASTRUCTURE -->
  <g transform="translate(750, 95)">
    <rect x="-180" y="-18" width="360" height="34" rx="17" fill="#0A1224" stroke="url(#goldGradBanner)" stroke-width="1" />
    <text x="0" y="4" 
          text-anchor="middle" 
          font-family="'SF Mono', 'Consolas', monospace" 
          font-size="12" 
          font-weight="700" 
          letter-spacing="4" 
          fill="#D4AF37">🛰️ AUTONOMOUS SWARM LAB</text>
  </g>

  <!-- Título Principal Institucional -->
  <text x="750" y="195" 
        text-anchor="middle" 
        font-family="'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" 
        font-size="44" 
        font-weight="900" 
        letter-spacing="5" 
        fill="#FFFFFF">
    YOZAPATA <tspan fill="url(#goldGradBanner)">//</tspan> 10K ON-CHAIN INTELLIGENCE
  </text>

  <!-- Barra Divisoria de Lujo -->
  <g transform="translate(750, 225)">
    <line x1="-380" y1="0" x2="-20" y2="0" stroke="url(#goldGradBanner)" stroke-width="2" />
    <polygon points="0,-6 6,0 0,6 -6,0" fill="#FFFFFF" filter="url(#goldGlowBanner)" />
    <line x1="20" y1="0" x2="380" y2="0" stroke="url(#goldGradBanner)" stroke-width="2" />
  </g>

  <!-- Subtítulo de Operaciones -->
  <text x="750" y="275" 
        text-anchor="middle" 
        font-family="'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" 
        font-size="15.5" 
        font-weight="700" 
        letter-spacing="3" 
        fill="#CBD5E1">
    AUTONOMOUS DEFI • L2 AIRDROPS • LIQUIDITY RADAR (BASE • ARBITRUM • POLYGON • BNB)
  </text>

  <!-- Pills de Redes Soportadas -->
  <g transform="translate(750, 325)">
    <!-- Base -->
    <rect x="-300" y="-14" width="130" height="28" rx="14" fill="#060B17" stroke="#38bdf8" stroke-width="1" stroke-opacity="0.6" />
    <circle cx="-285" cy="0" r="4" fill="#38bdf8" />
    <text x="-215" y="4" text-anchor="middle" font-family="'SF Mono', 'Consolas', monospace" font-size="11" font-weight="700" letter-spacing="1.5" fill="#E2E8F0">BASE L2</text>

    <!-- Arbitrum -->
    <rect x="-150" y="-14" width="130" height="28" rx="14" fill="#060B17" stroke="#38bdf8" stroke-width="1" stroke-opacity="0.6" />
    <circle cx="-135" cy="0" r="4" fill="#60a5fa" />
    <text x="-75" y="4" text-anchor="middle" font-family="'SF Mono', 'Consolas', monospace" font-size="11" font-weight="700" letter-spacing="1.5" fill="#E2E8F0">ARBITRUM</text>

    <!-- Polygon -->
    <rect x="20" y="-14" width="130" height="28" rx="14" fill="#060B17" stroke="#c084fc" stroke-width="1" stroke-opacity="0.6" />
    <circle cx="35" cy="0" r="4" fill="#c084fc" />
    <text x="95" y="4" text-anchor="middle" font-family="'SF Mono', 'Consolas', monospace" font-size="11" font-weight="700" letter-spacing="1.5" fill="#E2E8F0">POLYGON</text>

    <!-- BNB Chain -->
    <rect x="170" y="-14" width="130" height="28" rx="14" fill="#060B17" stroke="#D4AF37" stroke-width="1" stroke-opacity="0.6" />
    <circle cx="185" cy="0" r="4" fill="#FACC15" />
    <text x="245" y="4" text-anchor="middle" font-family="'SF Mono', 'Consolas', monospace" font-size="11" font-weight="700" letter-spacing="1.5" fill="#E2E8F0">BNB CHAIN</text>
  </g>

  <!-- Lema Legendario 10K: WE CAN DO IT -->
  <g transform="translate(750, 420)">
    <rect x="-150" y="-22" width="300" height="42" rx="21" fill="#0A1122" stroke="url(#goldGradBanner)" stroke-width="1.8" filter="url(#goldGlowBanner)" />
    <text x="0" y="6" 
          text-anchor="middle" 
          font-family="'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" 
          font-size="18" 
          font-weight="900" 
          letter-spacing="6" 
          fill="url(#goldGradBanner)">⚡ WE CAN DO IT ⚡</text>
  </g>

  <!-- Firma / Coordenadas en esquinas -->
  <text x="35" y="475" font-family="'SF Mono', 'Consolas', monospace" font-size="10" font-weight="600" letter-spacing="2" fill="#64748B">SYS // 501 SATELLITES ACTIVE</text>
  <text x="1465" y="475" text-anchor="end" font-family="'SF Mono', 'Consolas', monospace" font-size="10" font-weight="600" letter-spacing="2" fill="#64748B">OMNICHAIN ENGINE v2.0</text>
</svg>
`;
}

async function main() {
  console.log("🎨 Generando Identidad Visual 10K para @yozapata...");

  const avatarSvg = Buffer.from(generateAvatarSvg());
  const bannerSvg = Buffer.from(generateBannerSvg());

  const avatarPath = path.join(OUTPUT_DIR, "avatar-yozapata-10k.png");
  const bannerPath = path.join(OUTPUT_DIR, "banner-yozapata-10k.png");

  await sharp(avatarSvg)
    .resize(400, 400)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(avatarPath);
  console.log(`✅ Avatar generado: ${avatarPath} (400x400 px)`);

  await sharp(bannerSvg)
    .resize(1500, 500)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(bannerPath);
  console.log(`✅ Banner generado: ${bannerPath} (1500x500 px)`);

  console.log("💎 Assets de branding listos en assets/x-branding/");
}

if (require.main === module) {
  main().catch(err => {
    console.error("❌ Error generando branding:", err);
    process.exit(1);
  });
}

module.exports = { main };
