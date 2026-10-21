/**
 * scripts/generate-x-branding.js - Operación 10k
 * Generador Hiperrealista de Identidad Visual para @yozapata en X (Twitter).
 * 
 * Genera:
 * 1. assets/x-branding/avatar-yozapata.png (800x800 px) - Medallón 3D titanio satinado, cristal ahumado, oro mate y esmeralda.
 * 2. assets/x-branding/banner-yozapata.png (1500x500 px) - Nebulosa espacial fotorrealista cian/azul profundo, tipografía alta costura.
 * 
 * OPSEC ESTRICTO: Cero "10K", cero "we can do it", cero referencias internas.
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUTPUT_DIR = path.resolve(__dirname, "..", "assets", "x-branding");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// -------------------------------------------------------------------------------------
// 1. AVATAR 800x800 px: Medallón 3D Fotorrealista Titanio & Oro Mate con Nodos Esmeralda
// -------------------------------------------------------------------------------------
function generateAvatarSvg() {
  // Constelación orbital de 16 nodos de luz esmeralda
  const nodeCount = 16;
  const cx = 400;
  const cy = 400;
  const rOrbit = 295;
  let nodesSvg = "";
  let linesSvg = "";

  const coords = [];
  for (let i = 0; i < nodeCount; i++) {
    const angle = (i * 2 * Math.PI) / nodeCount - Math.PI / 2;
    const x = cx + rOrbit * Math.cos(angle);
    const y = cy + rOrbit * Math.sin(angle);
    coords.push({ x, y });
  }

  // Interconexión geométrica sutil
  for (let i = 0; i < nodeCount; i++) {
    const next = (i + 1) % nodeCount;
    linesSvg += `<line x1="${coords[i].x.toFixed(1)}" y1="${coords[i].y.toFixed(1)}" x2="${coords[next].x.toFixed(1)}" y2="${coords[next].y.toFixed(1)}" stroke="#10B981" stroke-opacity="0.35" stroke-width="2" />`;
    if (i % 2 === 0) {
      const cross = (i + 4) % nodeCount;
      linesSvg += `<line x1="${coords[i].x.toFixed(1)}" y1="${coords[i].y.toFixed(1)}" x2="${coords[cross].x.toFixed(1)}" y2="${coords[cross].y.toFixed(1)}" stroke="#D4AF37" stroke-opacity="0.22" stroke-width="1.2" stroke-dasharray="4,4" />`;
    }
  }

  coords.forEach((c, idx) => {
    const isGold = idx % 4 === 0;
    const color = isGold ? "#D4AF37" : "#10B981";
    const r = isGold ? 7 : 5.5;
    nodesSvg += `
      <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r * 2.8}" fill="${color}" opacity="0.25" filter="url(#glowBlur)" />
      <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r}" fill="${color}" />
      <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r * 0.4}" fill="#FFFFFF" opacity="0.9" />
    `;
  });

  return `
<svg width="800" height="800" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Gradiente de Fondo: Espacio Profundo y Titanio Oscuro -->
    <radialGradient id="spaceDark" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="#141E33" />
      <stop offset="45%" stop-color="#0A101D" />
      <stop offset="85%" stop-color="#04070D" />
      <stop offset="100%" stop-color="#020306" />
    </radialGradient>

    <!-- Bisel Exterior Titanio Cepillado Satinado -->
    <linearGradient id="brushedTitanium" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4B5563" />
      <stop offset="25%" stop-color="#9CA3AF" />
      <stop offset="50%" stop-color="#374151" />
      <stop offset="75%" stop-color="#D1D5DB" />
      <stop offset="100%" stop-color="#1F2937" />
    </linearGradient>

    <!-- Oro Mate 3D de Lujo -->
    <linearGradient id="matteGold" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#FFF2B2" />
      <stop offset="30%" stop-color="#D4AF37" />
      <stop offset="70%" stop-color="#AA820A" />
      <stop offset="100%" stop-color="#5B4403" />
    </linearGradient>

    <!-- Cristal Ahumado Luminoso -->
    <radialGradient id="smokedGlass" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#1E293B" stop-opacity="0.92" />
      <stop offset="50%" stop-color="#0F172A" stop-opacity="0.96" />
      <stop offset="100%" stop-color="#020617" stop-opacity="0.99" />
    </radialGradient>

    <!-- Resplandor Esmeralda y Dorado -->
    <filter id="glowBlur" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    <!-- Sombra 3D Volumétrica Profunda -->
    <filter id="medallionShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#000000" flood-opacity="0.75" />
    </filter>

    <!-- Relieve Bisel 3D para Monograma YZ -->
    <filter id="textBevel3D" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.8" />
      <feDropShadow dx="0" dy="-2" stdDeviation="2" flood-color="#FFF4CC" flood-opacity="0.6" />
    </filter>
  </defs>

  <!-- Fondo Lienzo -->
  <rect width="800" height="800" fill="url(#spaceDark)" />

  <!-- Destello de Luz Superior Izquierda (Luz Volumétrica de Estudio) -->
  <circle cx="280" cy="220" r="380" fill="#38BDF8" opacity="0.08" filter="url(#glowBlur)" />
  <circle cx="520" cy="560" r="320" fill="#10B981" opacity="0.07" filter="url(#glowBlur)" />

  <!-- Constelación Orbital Externa -->
  <g>
    <circle cx="400" cy="400" r="295" fill="none" stroke="#334155" stroke-opacity="0.4" stroke-width="1.5" />
    ${linesSvg}
    ${nodesSvg}
  </g>

  <!-- MEDALLÓN PRINCIPAL 3D -->
  <!-- Capa 1: Aro de Titanio Satinado con Sombra Volumétrica -->
  <circle cx="400" cy="400" r="248" fill="url(#brushedTitanium)" filter="url(#medallionShadow)" />

  <!-- Capa 2: Ranura de Separación Oscura -->
  <circle cx="400" cy="400" r="236" fill="#090D16" />

  <!-- Capa 3: Anillo Maestro de Oro Mate con Reflejo Especular -->
  <circle cx="400" cy="400" r="230" fill="none" stroke="url(#matteGold)" stroke-width="10" />
  <circle cx="400" cy="400" r="218" fill="none" stroke="#D4AF37" stroke-opacity="0.4" stroke-width="1.5" stroke-dasharray="8,6" />

  <!-- Capa 4: Disco Central de Cristal Ahumado con Profundidad Óptica -->
  <circle cx="400" cy="400" r="212" fill="url(#smokedGlass)" />

  <!-- Reflejo Especular Curvo de Cristal Luminoso -->
  <ellipse cx="370" cy="285" rx="140" ry="75" fill="#FFFFFF" opacity="0.07" transform="rotate(-20 370 285)" />

  <!-- Corona Interna de Micro-Nodos Esmeralda -->
  <circle cx="400" cy="400" r="172" fill="none" stroke="#10B981" stroke-opacity="0.3" stroke-width="1.5" stroke-dasharray="3,7" />

  <!-- NÚCLEO CENTRAL: MONOGRAMA ESCULPIDO YZ -->
  <!-- Monograma YZ en Oro Mate y Titanio con Relieve 3D -->
  <text x="400" y="440" 
        text-anchor="middle" 
        font-family="'Cinzel', 'Times New Roman', 'Inter', serif" 
        font-size="142" 
        font-weight="900" 
        letter-spacing="12" 
        fill="url(#matteGold)"
        filter="url(#textBevel3D)">YZ</text>

  <!-- Línea Divisoria de Precisión con Prisma Esmeralda -->
  <line x1="290" y1="480" x2="385" y2="480" stroke="url(#matteGold)" stroke-width="2.5" />
  <polygon points="400,474 406,480 400,486 394,480" fill="#10B981" filter="url(#glowBlur)" />
  <polygon points="400,476 404,480 400,484 396,480" fill="#FFFFFF" />
  <line x1="415" y1="480" x2="510" y2="480" stroke="url(#matteGold)" stroke-width="2.5" />

  <!-- Micro-Inscripción de Alta Gama -->
  <text x="400" y="520" 
        text-anchor="middle" 
        font-family="'SF Pro Display', 'Inter', system-ui, sans-serif" 
        font-size="16" 
        font-weight="700" 
        letter-spacing="8" 
        fill="#94A3B8">ON-CHAIN INTELLIGENCE</text>
</svg>
`;
}

// -------------------------------------------------------------------------------------
// 2. BANNER 1500x500 px: Nebulosa Espacial Hiperrealista Cian/Azul & Tipografía de Estudio
// -------------------------------------------------------------------------------------
function generateBannerSvg() {
  // Grilla de radar isométrica ultra-fina
  let gridSvg = "";
  for (let x = 0; x <= 1500; x += 60) {
    gridSvg += `<line x1="${x}" y1="0" x2="${x}" y2="500" stroke="#38BDF8" stroke-opacity="0.025" stroke-width="0.8" />`;
  }
  for (let y = 0; y <= 500; y += 40) {
    gridSvg += `<line x1="0" y1="${y}" x2="1500" y2="${y}" stroke="#38BDF8" stroke-opacity="0.025" stroke-width="0.8" />`;
  }

  // Constelaciones orgánicas laterales de nodos
  const leftCluster = [
    { x: 140, y: 120, r: 4 }, { x: 240, y: 180, r: 3 }, { x: 190, y: 310, r: 5 },
    { x: 100, y: 390, r: 3.5 }, { x: 280, y: 360, r: 4 }, { x: 330, y: 220, r: 3 }
  ];
  const rightCluster = [
    { x: 1360, y: 120, r: 4 }, { x: 1260, y: 180, r: 3 }, { x: 1310, y: 310, r: 5 },
    { x: 1400, y: 390, r: 3.5 }, { x: 1220, y: 360, r: 4 }, { x: 1170, y: 220, r: 3 }
  ];

  let clustersSvg = "";
  function drawCluster(nodes, isRight) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (d < 190) {
          const color = (i + j) % 2 === 0 ? "#10B981" : "#38BDF8";
          const op = ((190 - d) / 190) * 0.28;
          clustersSvg += `<line x1="${nodes[i].x}" y1="${nodes[i].y}" x2="${nodes[j].x}" y2="${nodes[j].y}" stroke="${color}" stroke-opacity="${op.toFixed(2)}" stroke-width="1.2" />`;
        }
      }
      const c = i % 2 === 0 ? "#10B981" : "#38BDF8";
      clustersSvg += `
        <circle cx="${nodes[i].x}" cy="${nodes[i].y}" r="${nodes[i].r * 2.2}" fill="${c}" opacity="0.25" filter="url(#glowFilter)" />
        <circle cx="${nodes[i].x}" cy="${nodes[i].y}" r="${nodes[i].r}" fill="${c}" />
        <circle cx="${nodes[i].x}" cy="${nodes[i].y}" r="${nodes[i].r * 0.4}" fill="#FFFFFF" />
      `;
    }
  }
  drawCluster(leftCluster, false);
  drawCluster(rightCluster, true);

  return `
<svg width="1500" height="500" viewBox="0 0 1500 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Fondo Gradiente de Nebulosa Galáctica -->
    <linearGradient id="nebulaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#030712" />
      <stop offset="30%" stop-color="#0B132B" />
      <stop offset="50%" stop-color="#111C3D" />
      <stop offset="70%" stop-color="#0B132B" />
      <stop offset="100%" stop-color="#02040A" />
    </linearGradient>

    <!-- Nube de Nebulosa Cian / Esmeralda Central -->
    <radialGradient id="nebulaCloudCyan" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#0284C7" stop-opacity="0.28" />
      <stop offset="40%" stop-color="#0369A1" stop-opacity="0.14" />
      <stop offset="70%" stop-color="#0F172A" stop-opacity="0.05" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>

    <radialGradient id="nebulaCloudEmerald" cx="65%" cy="50%" r="40%">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0.22" />
      <stop offset="60%" stop-color="#059669" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>

    <!-- Oro Mate Elegante -->
    <linearGradient id="bannerGold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#D4AF37" />
      <stop offset="25%" stop-color="#FFF2B2" />
      <stop offset="50%" stop-color="#D4AF37" />
      <stop offset="75%" stop-color="#FFF2B2" />
      <stop offset="100%" stop-color="#D4AF37" />
    </linearGradient>

    <!-- Filtro de Resplandor Suave -->
    <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    <!-- Sombra Volumétrica de Texto Principal -->
    <filter id="titleShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.9" />
    </filter>
  </defs>

  <!-- Fondo Base -->
  <rect width="1500" height="500" fill="url(#nebulaGrad)" />

  <!-- Nubes de Nebulosa Espacial Luminosa -->
  <rect width="1500" height="500" fill="url(#nebulaCloudCyan)" />
  <rect width="1500" height="500" fill="url(#nebulaCloudEmerald)" />

  <!-- Cuadrícula Fina -->
  <g>${gridSvg}</g>

  <!-- Constelaciones Orgánicas de Nodos -->
  <g>${clustersSvg}</g>

  <!-- Líneas Horizontales de Lujo Superior e Inferior -->
  <line x1="0" y1="2" x2="1500" y2="2" stroke="url(#bannerGold)" stroke-width="2.5" />
  <line x1="0" y1="498" x2="1500" y2="498" stroke="url(#bannerGold)" stroke-width="2" />

  <!-- Centro Orbital de Enfoque Óptico -->
  <circle cx="750" cy="245" r="230" fill="none" stroke="#38BDF8" stroke-opacity="0.08" stroke-width="1.5" />
  <circle cx="750" cy="245" r="170" fill="none" stroke="#D4AF37" stroke-opacity="0.12" stroke-width="1" stroke-dasharray="6,6" />

  <!-- Insignia Superior Centrada -->
  <g transform="translate(750, 95)">
    <rect x="-140" y="-16" width="280" height="32" rx="16" fill="#0A1122" stroke="url(#bannerGold)" stroke-width="1" />
    <circle cx="-112" cy="0" r="4.5" fill="#10B981" filter="url(#glowFilter)" />
    <text x="8" y="5" 
          text-anchor="middle" 
          font-family="'SF Pro Display', 'Inter', system-ui, sans-serif" 
          font-size="12" 
          font-weight="800" 
          letter-spacing="4" 
          fill="#D4AF37">YOZAPATA // RESEARCH</text>
  </g>

  <!-- TÍTULO PRINCIPAL (Centrado, Legible, Fotorrealista) -->
  <text x="750" y="215" 
        text-anchor="middle" 
        font-family="'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif" 
        font-size="46" 
        font-weight="900" 
        letter-spacing="3" 
        fill="#FFFFFF"
        filter="url(#titleShadow)">
    On-Chain Intelligence &amp; Autonomous Systems
  </text>

  <!-- Divisor Central con Prisma Esmeralda -->
  <g transform="translate(750, 255)">
    <line x1="-360" y1="0" x2="-25" y2="0" stroke="url(#bannerGold)" stroke-width="2" />
    <polygon points="0,-7 7,0 0,7 -7,0" fill="#10B981" filter="url(#glowFilter)" />
    <polygon points="0,-4 4,0 0,4 -4,0" fill="#FFFFFF" />
    <line x1="25" y1="0" x2="360" y2="0" stroke="url(#bannerGold)" stroke-width="2" />
  </g>

  <!-- SUBTÍTULO BILINGÜE -->
  <text x="750" y="315" 
        text-anchor="middle" 
        font-family="'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif" 
        font-size="19" 
        font-weight="700" 
        letter-spacing="3" 
        fill="#E2E8F0">
    Ecosistemas L2 • Liquidez DeFi • Fronteras Web3
  </text>

  <!-- Pastillas de Redes L2 / L1 (Estética Satinada Minimalista) -->
  <g transform="translate(750, 385)">
    <!-- Base -->
    <rect x="-300" y="-14" width="130" height="28" rx="14" fill="#0B1329" stroke="#38BDF8" stroke-width="1" stroke-opacity="0.7" />
    <circle cx="-285" cy="0" r="4" fill="#38BDF8" />
    <text x="-220" y="4" text-anchor="middle" font-family="'SF Mono', 'Consolas', monospace" font-size="11" font-weight="700" letter-spacing="1" fill="#F1F5F9">BASE L2</text>

    <!-- Arbitrum -->
    <rect x="-150" y="-14" width="130" height="28" rx="14" fill="#0B1329" stroke="#60A5FA" stroke-width="1" stroke-opacity="0.7" />
    <circle cx="-135" cy="0" r="4" fill="#60A5FA" />
    <text x="-75" y="4" text-anchor="middle" font-family="'SF Mono', 'Consolas', monospace" font-size="11" font-weight="700" letter-spacing="1" fill="#F1F5F9">ARBITRUM</text>

    <!-- Polygon -->
    <rect x="20" y="-14" width="130" height="28" rx="14" fill="#0B1329" stroke="#A855F7" stroke-width="1" stroke-opacity="0.7" />
    <circle cx="35" cy="0" r="4" fill="#A855F7" />
    <text x="95" y="4" text-anchor="middle" font-family="'SF Mono', 'Consolas', monospace" font-size="11" font-weight="700" letter-spacing="1" fill="#F1F5F9">POLYGON</text>

    <!-- BNB Chain -->
    <rect x="170" y="-14" width="130" height="28" rx="14" fill="#0B1329" stroke="#F59E0B" stroke-width="1" stroke-opacity="0.7" />
    <circle cx="185" cy="0" r="4" fill="#F59E0B" />
    <text x="245" y="4" text-anchor="middle" font-family="'SF Mono', 'Consolas', monospace" font-size="11" font-weight="700" letter-spacing="1" fill="#F1F5F9">BNB CHAIN</text>
  </g>

  <!-- Coordenadas Estéticas en Esquinas -->
  <text x="40" y="475" font-family="'SF Mono', 'Consolas', monospace" font-size="10" font-weight="600" letter-spacing="2" fill="#64748B">OMNICHAIN RESEARCH</text>
  <text x="1460" y="475" text-anchor="end" font-family="'SF Mono', 'Consolas', monospace" font-size="10" font-weight="600" letter-spacing="2" fill="#64748B">VERIFIED INFRASTRUCTURE</text>
</svg>
`;
}

async function main() {
  console.log("🎨 Generando Identidad Visual Hiperrealista para @yozapata...");

  const avatarSvg = Buffer.from(generateAvatarSvg());
  const bannerSvg = Buffer.from(generateBannerSvg());

  // Archivos oficiales requeridos
  const avatarPath = path.join(OUTPUT_DIR, "avatar-yozapata.png");
  const bannerPath = path.join(OUTPUT_DIR, "banner-yozapata.png");

  // También generamos los compatibles anteriores por si algún script los referencia
  const legacyAvatarPath = path.join(OUTPUT_DIR, "avatar-yozapata-10k.png");
  const legacyBannerPath = path.join(OUTPUT_DIR, "banner-yozapata-10k.png");

  await sharp(avatarSvg)
    .resize(800, 800)
    .flatten({ background: "#080D1A" })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(avatarPath);
  console.log(`✅ Avatar hiperrealista generado: ${avatarPath} (800x800 px)`);

  const avatar400Path = path.join(OUTPUT_DIR, "avatar-yozapata-400.png");
  await sharp(avatarSvg)
    .resize(400, 400)
    .flatten({ background: "#080D1A" })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(avatar400Path);

  const avatarJpgPath = path.join(OUTPUT_DIR, "avatar-yozapata.jpg");
  await sharp(avatarSvg)
    .resize(400, 400)
    .flatten({ background: "#080D1A" })
    .jpeg({ quality: 95 })
    .toFile(avatarJpgPath);
  console.log(`✅ Avatar JPEG 400x400 generado: ${avatarJpgPath}`);

  await sharp(bannerSvg)
    .resize(1500, 500)
    .flatten({ background: "#050811" })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(bannerPath);
  console.log(`✅ Banner hiperrealista generado: ${bannerPath} (1500x500 px)`);

  // Duplicar a legacy filenames para total retrocompatibilidad
  fs.copyFileSync(avatarPath, legacyAvatarPath);
  fs.copyFileSync(bannerPath, legacyBannerPath);

  console.log("💎 Assets de branding fotorrealistas listos en assets/x-branding/");
}

if (require.main === module) {
  main().catch(err => {
    console.error("❌ Error generando branding:", err);
    process.exit(1);
  });
}

module.exports = { main };
