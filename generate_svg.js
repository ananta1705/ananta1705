const { Jimp } = require('jimp');
const fs = require('fs');

const INPUT = 'nanta_fix.jpg';

// Output SVG dimensions for the portrait panel
const SVG_W = 296;
const SVG_H = 416;

// Dot grid config — how many columns & rows of sample points
const COLS = 90;
const ROWS = 130;

const CELL_W = SVG_W / COLS;
const CELL_H = SVG_H / ROWS;

// Characters that look like the reference image dots
const CHARS = ['·', ':', '.', '·', '+', '·', ':', '·', '-', '·'];

async function run() {
  console.log('Reading image...');
  const buf = fs.readFileSync(INPUT);
  const img = await Jimp.fromBuffer(buf);

  // Crop to roughly portrait aspect ratio (center crop)
  const iw = img.width;
  const ih = img.height;
  const targetAspect = SVG_W / SVG_H;
  const imgAspect = iw / ih;

  let cropX = 0, cropY = 0, cropW = iw, cropH = ih;
  if (imgAspect > targetAspect) {
    cropW = Math.round(ih * targetAspect);
    cropX = Math.round((iw - cropW) / 2);
  } else {
    cropH = Math.round(iw / targetAspect);
    cropY = 0;
  }

  // Jimp v1 chained methods
  img.crop({ x: cropX, y: cropY, w: cropW, h: cropH });
  img.resize({ w: COLS, h: ROWS });
  img.greyscale();
  img.contrast(0.3);
  img.brightness(-0.1);

  // Read pixels from bitmap buffer (RGBA)
  const bmp = img.bitmap;
  const pixels = [];
  for (let row = 0; row < ROWS; row++) {
    const rowData = [];
    for (let col = 0; col < COLS; col++) {
      const idx = (row * COLS + col) * 4;
      const r = bmp.data[idx];
      const g = bmp.data[idx + 1];
      const b = bmp.data[idx + 2];
      const a = bmp.data[idx + 3];
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      rowData.push({ brightness, alpha: a / 255 });
    }
    pixels.push(rowData);
  }

  console.log('Generating SVG dot-matrix...');

  // Build SVG dot elements
  let dots = '';
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const { brightness, alpha } = pixels[row][col];
      if (alpha < 0.05) continue;

      // Skip very dark background pixels
      if (brightness < 0.08) continue;

      const cx = col * CELL_W + CELL_W / 2;
      const cy = row * CELL_H + CELL_H / 2;

      // Map brightness to dot radius and opacity
      // Brighter pixels = more visible dot
      const normalised = Math.min(1, brightness);
      const r = Math.max(0.3, normalised * 1.6);
      const opacity = Math.min(1, 0.35 + normalised * 0.75);

      // Slight glow on bright pixels
      const glowOpacity = normalised > 0.55 ? (normalised - 0.55) * 0.6 : 0;

      if (glowOpacity > 0) {
        dots += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r * 2.8).toFixed(1)}" fill="#4dd9e8" opacity="${(glowOpacity * 0.3).toFixed(3)}"/>`;
      }
      dots += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="#4dd9e8" opacity="${opacity.toFixed(3)}"/>`;
    }
  }

  // Build full SVG with all the terminal card sections

  const svg = `<svg width="940" height="560" viewBox="0 0 940 560" xmlns="http://www.w3.org/2000/svg">
<defs>
  <style>
    .mono { font-family: 'Courier New', Courier, ui-monospace, monospace; }
    .scanline { animation: scan 3.4s linear infinite; }
    @keyframes scan {
      0%   { transform: translateY(0px); }
      100% { transform: translateY(416px); }
    }
    .glow-pass { animation: glowpass 3.4s ease-in-out infinite; }
    @keyframes glowpass {
      0%   { transform: translateY(-40%); opacity: 0; }
      10%  { opacity: 1; }
      80%  { opacity: 1; }
      100% { transform: translateY(120%); opacity: 0; }
    }
    .pulse { animation: pulse 1.4s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.2;} }
  </style>
  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
    <path d="M20 0L0 0 0 20" fill="none" stroke="rgba(77,217,232,0.06)" stroke-width="0.8"/>
  </pattern>
  <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#4dd9e8" stop-opacity="0"/>
    <stop offset="50%"  stop-color="#4dd9e8" stop-opacity="0.45"/>
    <stop offset="100%" stop-color="#4dd9e8" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="glowGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#ff6fb0" stop-opacity="0"/>
    <stop offset="45%"  stop-color="#ff6fb0" stop-opacity="0.18"/>
    <stop offset="55%"  stop-color="#4dd9e8" stop-opacity="0.35"/>
    <stop offset="100%" stop-color="#4dd9e8" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="divider" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#1c2b3a"/>
    <stop offset="100%" stop-color="transparent"/>
  </linearGradient>
  <radialGradient id="panelGlow" cx="50%" cy="20%" r="70%">
    <stop offset="0%"   stop-color="#4dd9e8" stop-opacity="0.09"/>
    <stop offset="100%" stop-color="#4dd9e8" stop-opacity="0"/>
  </radialGradient>
  <clipPath id="outerClip"><rect width="940" height="560" rx="14"/></clipPath>
  <clipPath id="dotClip"><rect x="20" y="76" width="296" height="416" rx="6"/></clipPath>
  <clipPath id="scanClip"><rect x="20" y="76" width="296" height="416" rx="6"/></clipPath>
  <filter id="dotGlow" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="1.5" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="textGlow">
    <feGaussianBlur stdDeviation="2" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>

<g clip-path="url(#outerClip)">
  <!-- BG -->
  <rect width="940" height="560" fill="#0b1220"/>
  <rect x="0.75" y="0.75" width="938.5" height="558.5" rx="13.5" fill="none" stroke="#1c2b3a" stroke-width="1.5"/>
  <rect x="1" y="1" width="938" height="558" rx="13" fill="none" stroke="rgba(77,217,232,0.05)" stroke-width="1"/>

  <!-- TITLEBAR -->
  <rect width="940" height="44" fill="#0a0f19"/>
  <rect width="940" height="14" rx="14" fill="#0a0f19"/>
  <line x1="0" y1="44" x2="940" y2="44" stroke="#1c2b3a" stroke-width="1"/>
  <circle cx="22" cy="22" r="6" fill="#ff5f57"/>
  <circle cx="42" cy="22" r="6" fill="#febc2e"/>
  <circle cx="62" cy="22" r="6" fill="#28c840"/>
  <text x="470" y="26" class="mono" fill="#5b7686" font-size="12" text-anchor="middle" letter-spacing="0.3">ananta1705@github ~ % ./profile --live</text>
  <circle cx="878" cy="22" r="4" fill="#ff6fb0" class="pulse"/>
  <text x="888" y="27" class="mono" fill="#ff6fb0" font-size="11" font-weight="bold" letter-spacing="1">SCANNING</text>

  <!-- LEFT PANE BG -->
  <rect x="0" y="44" width="336" height="516" fill="#0d1420"/>
  <rect x="0" y="44" width="336" height="516" fill="url(#grid)"/>
  <line x1="336" y1="44" x2="336" y2="560" stroke="#1c2b3a" stroke-width="1"/>

  <!-- VISUAL.MAP label -->
  <text x="20" y="68" class="mono" fill="#4dd9e8" font-size="10" font-weight="bold" letter-spacing="2">VISUAL.MAP <tspan fill="#5b7686">/ PORTRAIT.SIGNAL</tspan></text>

  <!-- Portrait box -->
  <rect x="20" y="76" width="296" height="416" rx="6" fill="#060a10" stroke="#1c2b3a" stroke-width="1"/>
  <rect x="20" y="76" width="296" height="416" rx="6" fill="url(#panelGlow)"/>
  <rect x="20" y="76" width="296" height="416" rx="6" fill="url(#grid)"/>

  <!-- DOT-MATRIX PORTRAIT (generated from nanta.png) -->
  <g clip-path="url(#dotClip)" transform="translate(20,76)" filter="url(#dotGlow)">
    ${dots}
  </g>

  <!-- Scanline animation -->
  <g clip-path="url(#scanClip)">
    <g class="scanline">
      <rect x="20" y="76" width="296" height="30" fill="url(#scanGrad)" opacity="0.65"/>
    </g>
    <g class="glow-pass">
      <rect x="20" y="76" width="296" height="170" fill="url(#glowGrad)" opacity="0.45"/>
    </g>
  </g>

  <!-- Portrait border glow lines -->
  <rect x="20" y="76" width="296" height="2" fill="#4dd9e8" opacity="0.2"/>
  <rect x="20" y="490" width="296" height="1" fill="#4dd9e8" opacity="0.1"/>

  <!-- Corner accents -->
  <line x1="20" y1="76" x2="40" y2="76" stroke="#4dd9e8" stroke-width="1.5" opacity="0.6"/>
  <line x1="20" y1="76" x2="20" y2="96" stroke="#4dd9e8" stroke-width="1.5" opacity="0.6"/>
  <line x1="316" y1="76" x2="296" y2="76" stroke="#4dd9e8" stroke-width="1.5" opacity="0.6"/>
  <line x1="316" y1="76" x2="316" y2="96" stroke="#4dd9e8" stroke-width="1.5" opacity="0.6"/>
  <line x1="20" y1="492" x2="40" y2="492" stroke="#4dd9e8" stroke-width="1.5" opacity="0.6"/>
  <line x1="20" y1="492" x2="20" y2="472" stroke="#4dd9e8" stroke-width="1.5" opacity="0.6"/>
  <line x1="316" y1="492" x2="296" y2="492" stroke="#4dd9e8" stroke-width="1.5" opacity="0.6"/>
  <line x1="316" y1="492" x2="316" y2="472" stroke="#4dd9e8" stroke-width="1.5" opacity="0.6"/>

  <!-- Footer tag -->
  <text x="168" y="515" class="mono" fill="#5b7686" font-size="9.5" text-anchor="middle" letter-spacing="1.5">AI/UX  /  FRONT-END  /  DESIGN SYSTEMS</text>

  <!-- ── RIGHT PANE ── -->
  <text x="356" y="68" class="mono" fill="#4dd9e8" font-size="10" font-weight="bold" letter-spacing="2">SYSTEM.INFO <tspan fill="#5b7686">/ DESIGN.BUILDER</tspan></text>
  <text x="356" y="92" class="mono" fill="#ff6fb0" font-size="15" font-weight="bold">ananta1705@github</text>
  <text x="560" y="92" class="mono" fill="#ff6fb0" font-size="14" opacity="0.25">- - - - - - - - - - - -</text>

  <!-- Info rows -->
  <text x="356" y="115" class="mono" fill="#4dd9e8" font-size="12.5">. Subject:</text>
  <text x="472" y="115" class="mono" fill="#cfe8ee" font-size="12.5">Ananta Puti Maharani</text>
  <text x="356" y="133" class="mono" fill="#4dd9e8" font-size="12.5">. Role:</text>
  <text x="472" y="133" class="mono" fill="#cfe8ee" font-size="12.5">UI/UX Designer &amp; Front-End Developer</text>
  <text x="356" y="151" class="mono" fill="#4dd9e8" font-size="12.5">. Affiliation:</text>
  <text x="472" y="151" class="mono" fill="#cfe8ee" font-size="12.5">Telkom University</text>
  <text x="356" y="169" class="mono" fill="#4dd9e8" font-size="12.5">. Base:</text>
  <text x="472" y="169" class="mono" fill="#cfe8ee" font-size="12.5">Purwokerto, Jawa Tengah, Indonesia</text>
  <text x="356" y="187" class="mono" fill="#4dd9e8" font-size="12.5">. Status:</text>
  <text x="472" y="187" class="mono" fill="#cfe8ee" font-size="12.5">Studying / Designing / Shipping</text>

  <!-- DESIGN.NODE -->
  <text x="356" y="215" class="mono" fill="#5ee6a5" font-size="11" font-weight="bold" letter-spacing="1.5">DESIGN.NODE</text>
  <rect x="460" y="210" width="460" height="1" fill="url(#divider)"/>
  <text x="356" y="235" class="mono" fill="#4dd9e8" font-size="12.5">. Primary:</text>
  <text x="472" y="235" class="mono" fill="#cfe8ee" font-size="12.5">UI/UX Design</text>
  <text x="356" y="253" class="mono" fill="#4dd9e8" font-size="12.5">. Direction:</text>
  <text x="472" y="253" class="mono" fill="#cfe8ee" font-size="12.5">Front-End Development</text>
  <text x="356" y="271" class="mono" fill="#4dd9e8" font-size="12.5">. Themes:</text>
  <text x="472" y="271" class="mono" fill="#cfe8ee" font-size="12.5">Smooth, modern, intuitive interfaces</text>

  <!-- BUILD.LOG -->
  <text x="356" y="299" class="mono" fill="#5ee6a5" font-size="11" font-weight="bold" letter-spacing="1.5">BUILD.LOG</text>
  <rect x="428" y="294" width="492" height="1" fill="url(#divider)"/>
  <text x="356" y="319" class="mono" fill="#4dd9e8" font-size="12">. DPBO_Mahananta:</text>
  <text x="495" y="319" class="mono" fill="#cfe8ee" font-size="12">OOP coursework (Java)</text>
  <text x="356" y="336" class="mono" fill="#4dd9e8" font-size="12">. GPT-botmahananta:</text>
  <text x="495" y="336" class="mono" fill="#cfe8ee" font-size="12">Conversational bot (JS)</text>
  <text x="356" y="353" class="mono" fill="#4dd9e8" font-size="12">. BlupTrain:</text>
  <text x="495" y="353" class="mono" fill="#cfe8ee" font-size="12">Train ticketing platform</text>
  <text x="356" y="370" class="mono" fill="#4dd9e8" font-size="12">. WasteSmartKitchen:</text>
  <text x="495" y="370" class="mono" fill="#cfe8ee" font-size="12">Zero-waste kitchen GUI</text>

  <!-- STACK.GRID -->
  <text x="356" y="397" class="mono" fill="#5ee6a5" font-size="11" font-weight="bold" letter-spacing="1.5">STACK.GRID</text>
  <rect x="430" y="392" width="490" height="1" fill="url(#divider)"/>

  <!-- Row 1: Languages -->
  <rect x="356" y="406" width="39" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="375" y="420" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">Java</text>
  <rect x="401" y="406" width="71" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="436" y="420" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">C / C++ / C#</text>
  <rect x="478" y="406" width="77" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="516" y="420" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">JavaScript</text>
  <rect x="561" y="406" width="52" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="587" y="420" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">Python</text>
  <rect x="619" y="406" width="32" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="635" y="420" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">PHP</text>
  <rect x="657" y="406" width="40" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="677" y="420" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">Swift</text>

  <!-- Row 2: Front-End -->
  <rect x="356" y="432" width="40" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="376" y="446" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">HTML5</text>
  <rect x="402" y="432" width="86" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="445" y="446" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">React Native</text>
  <rect x="494" y="432" width="70" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="529" y="446" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">Bootstrap</text>
  <rect x="570" y="432" width="36" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="588" y="446" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">Vite</text>
  <rect x="612" y="432" width="55" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="639" y="446" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">Laravel</text>
  <rect x="673" y="432" width="50" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="698" y="446" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">JavaFX</text>

  <!-- Row 3: Tools -->
  <rect x="356" y="458" width="57" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="384" y="472" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">Firebase</text>
  <rect x="419" y="458" width="46" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="442" y="472" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">Figma</text>
  <rect x="471" y="458" width="77" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="509" y="472" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">Photoshop</text>
  <rect x="554" y="458" width="74" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="591" y="472" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">Illustrator</text>
  <rect x="634" y="458" width="64" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="666" y="472" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">Adobe XD</text>
  <rect x="704" y="458" width="60" height="20" rx="4" fill="rgba(77,217,232,0.04)" stroke="#1c2b3a" stroke-width="1"/>
  <text x="734" y="472" class="mono" fill="#cfe8ee" font-size="10.5" text-anchor="middle">Postman</text>

  <!-- GRID.LINKS -->
  <text x="356" y="500" class="mono" fill="#5ee6a5" font-size="11" font-weight="bold" letter-spacing="1.5">GRID.LINKS</text>
  <rect x="428" y="495" width="492" height="1" fill="url(#divider)"/>
  <text x="356" y="519" class="mono" fill="#4dd9e8" font-size="12">. GitHub:</text>
  <text x="440" y="519" class="mono" fill="#ff6fb0" font-size="12">@ananta1705</text>
  <text x="530" y="519" class="mono" fill="#4dd9e8" font-size="12">  . Portfolio:</text>
  <text x="638" y="519" class="mono" fill="#ff6fb0" font-size="12">mahanantadev.vercel.app</text>
  <text x="356" y="537" class="mono" fill="#4dd9e8" font-size="12">. LinkedIn:</text>
  <text x="440" y="537" class="mono" fill="#ff6fb0" font-size="12">ananta-puti-299788281</text>

  <!-- signal_locked -->
  <text x="356" y="554" class="mono" fill="#c94f8c" font-size="11" letter-spacing="1.5">signal_locked &gt; <tspan fill="#ff6fb0" font-weight="bold">UI/UX / FRONT-END / TELKOM UNIVERSITY</tspan></text>

  <!-- Footer bar -->
  <line x1="0" y1="557" x2="940" y2="557" stroke="#1c2b3a" stroke-width="1"/>
</g>
</svg>`;

  fs.writeFileSync('terminal-profile.svg', svg, 'utf8');
  const size = (fs.statSync('terminal-profile.svg').size / 1024).toFixed(1);
  console.log(`✅ Done! terminal-profile.svg written (${size} KB)`);
}

run().catch(console.error);
