const { Jimp } = require('jimp');
const fs = require('fs');

// ── Config ──────────────────────────────────────────────────
const SVG_W = 296;  // portrait box width
const SVG_H = 416;  // portrait box height

// Scanline style: fewer ROWS = visible gap between lines (like the reference)
const COLS = 135;   // horizontal dots per row (increased for more detail)
const ROWS = 95;    // vertical rows

const CELL_W = SVG_W / COLS;  // ~2.8px per dot
const CELL_H = SVG_H / ROWS;  // ~5.5px per row (creates the horizontal line gaps)

// ── Load image, strip trailing garbage from PNG if needed ──
function loadImageBuf(path) {
  let buf = fs.readFileSync(path);
  // PNG: strip any trailing data after IEND chunk
  // IEND data: length(00 00 00 00) + "IEND" + CRC(AE 42 60 82) = 12 bytes total
  const iendMark = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  const iendPos = buf.indexOf(iendMark);
  if (iendPos !== -1) {
    buf = buf.slice(0, iendPos + iendMark.length);
    console.log(`PNG: stripped ${fs.statSync(path).size - buf.length} trailing bytes`);
  }
  return buf;
}

async function run() {
  console.log('Reading nanta.png...');
  const buf = loadImageBuf('nanta.png');
  const img = await Jimp.fromBuffer(buf);
  console.log(`Image: ${img.width}x${img.height}`);

  // ── Crop to portrait aspect ratio (zoom in on face/shoulders) ──
  const targetAspect = SVG_W / SVG_H;
  
  // Zoom factor: smaller value = more zoomed in
  const zoomFactor = 0.65; 
  let cropW = Math.round(img.width * zoomFactor);
  let cropH = Math.round(cropW / targetAspect);

  // Center horizontally
  let cropX = Math.round((img.width - cropW) / 2);
  
  // Move down slightly from the top to frame the head properly
  let cropY = Math.round(img.height * 0.08);

  // Failsafe in case crop exceeds image bounds
  if (cropY + cropH > img.height) {
    cropH = img.height - cropY;
  }

  img.crop({ x: cropX, y: cropY, w: cropW, h: cropH });
  img.resize({ w: COLS, h: ROWS });
  img.greyscale();
  img.contrast(0.35);   // moderate contrast to preserve facial features
  img.brightness(0.02); // very slight boost

  // ── Sample pixels ──
  const bmp = img.bitmap;
  const pixels = [];
  for (let row = 0; row < ROWS; row++) {
    const rowData = [];
    for (let col = 0; col < COLS; col++) {
      const idx = (row * COLS + col) * 4;
      const r = bmp.data[idx];
      const g = bmp.data[idx + 1];
      const b = bmp.data[idx + 2];
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      rowData.push(brightness);
    }
    pixels.push(rowData);
  }

  console.log('Building dot-matrix...');

  // ── Generate SVG ASCII Art ──────────────────────────────────────
  let dots = '';
  // ASCII chars from dark to bright
  const CHAR_MAP = ['.', '-', '+', '=', '#', '@'];

  for (let row = 0; row < ROWS; row++) {
    let rowHtml = '';
    // Y is baseline for text
    const cy = (row * CELL_H + CELL_H - 1).toFixed(2);

    for (let col = 0; col < COLS; col++) {
      const brightness = pixels[row][col];

      // Skip very bright pixels (white background) and very dark (pure black shadow)
      if (brightness > 0.96) continue;
      if (brightness < 0.01) continue;

      const cx = (col * CELL_W).toFixed(2);

      // Map brightness to character
      const t = Math.max(0, Math.min(1, (brightness - 0.01) / (0.96 - 0.01)));
      const charIdx = Math.floor(t * (CHAR_MAP.length - 1));
      const char = CHAR_MAP[charIdx];

      // Opacity: brighter areas slightly more opaque
      const opacity = (0.4 + t * 0.6).toFixed(2);

      rowHtml += `<tspan x="${cx}" opacity="${opacity}">${char}</tspan>`;
    }
    
    if (rowHtml) {
      // Use monospace font so characters align. Smaller font size for higher resolution.
      dots += `<text y="${cy}" font-family="'Courier New', Courier, monospace" font-size="5.5" fill="#4dd9e8" font-weight="bold">${rowHtml}</text>\n`;
    }
  }

  // ── Radar/grid background circles ─────────────────────────
  const radarCx = 148, radarCy = 200;
  const radarCircles = '';

  // Cross-hairs
  const crosshairs = '';

  // ── Fetch dynamic visitor badges ──
  console.log('Fetching visitor badges...');
  let visitorBadge1 = '';
  let visitorBadge2 = '';
  try {
    const res1 = await fetch('https://komarev.com/ghpvc/?username=ananta1705&label=Visitors&color=ff69b4&style=for-the-badge');
    let svg1 = await res1.text();
    visitorBadge1 = svg1.replace('<svg ', '<svg x="160" y="1" ');

    const res2 = await fetch('https://visitor-badge.laobi.icu/badge?page_id=ananta1705.ananta1705&style=for-the-badge');
    let svg2 = await res2.text();
    visitorBadge2 = svg2.replace('<svg ', '<svg x="295" y="5" ');
  } catch(e) {
    console.error('Failed to fetch visitor badges:', e);
  }

  // ── Build full SVG ─────────────────────────────────────────
  const svg = `<svg width="1020" height="770" viewBox="0 0 1020 770" xmlns="http://www.w3.org/2000/svg">
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
    <path d="M20 0L0 0 0 20" fill="none" stroke="rgba(77,217,232,0.05)" stroke-width="0.8"/>
  </pattern>
  <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#4dd9e8" stop-opacity="0"/>
    <stop offset="50%"  stop-color="#4dd9e8" stop-opacity="0.5"/>
    <stop offset="100%" stop-color="#4dd9e8" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="glowGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#ff6fb0" stop-opacity="0"/>
    <stop offset="45%"  stop-color="#ff6fb0" stop-opacity="0.2"/>
    <stop offset="55%"  stop-color="#4dd9e8" stop-opacity="0.38"/>
    <stop offset="100%" stop-color="#4dd9e8" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="divider" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#1c2b3a"/>
    <stop offset="100%" stop-color="transparent"/>
  </linearGradient>
  <radialGradient id="panelGlow" cx="50%" cy="30%" r="70%">
    <stop offset="0%"   stop-color="#4dd9e8" stop-opacity="0.07"/>
    <stop offset="100%" stop-color="#4dd9e8" stop-opacity="0"/>
  </radialGradient>

  <clipPath id="outerClip"><rect width="970" height="690" rx="14"/></clipPath>
  <clipPath id="dotClip"><rect x="0" y="0" width="${SVG_W}" height="${SVG_H}" rx="6"/></clipPath>
  <clipPath id="scanClip"><rect x="50" y="100" width="${SVG_W}" height="${SVG_H}" rx="6"/></clipPath>
</defs>

<!-- Outer background -->
<rect width="1020" height="770" fill="#090a0f"/>

<g transform="translate(25, 25)">
  <g clip-path="url(#outerClip)">
    <!-- ── CARD BACKGROUND ── -->
    <rect width="970" height="690" fill="#0c1017"/>
    <rect x="0.75" y="0.75" width="968.5" height="688.5" rx="13.5" fill="none" stroke="#252a3a" stroke-width="1.5"/>

    <!-- ── TITLE BAR ── -->
    <circle cx="26" cy="22" r="5.5" fill="#ff5f57"/>
    <circle cx="46" cy="22" r="5.5" fill="#febc2e"/>
    <circle cx="66" cy="22" r="5.5" fill="#28c840"/>
    <text x="485" y="27" class="mono" fill="#5b7686" font-size="12" text-anchor="middle" letter-spacing="0.3">ananta1705@github ~ % ./profile --live</text>
    <circle cx="894" cy="22" r="4" fill="#ff6fb0" class="pulse"/>
    <text x="906" y="27" class="mono" fill="#ff6fb0" font-size="11" font-weight="bold" letter-spacing="1">SCANNING</text>
    <line x1="0" y1="44" x2="970" y2="44" stroke="#1c2b3a" stroke-width="1" opacity="0.5"/>

    <!-- ── LEFT PANE ── -->
    <!-- Vertical divider -->
    <line x1="380" y1="44" x2="380" y2="645" stroke="#1c2b3a" stroke-width="1" opacity="0.5"/>

    <text x="50" y="70" class="mono" fill="#4dd9e8" font-size="10" font-weight="bold" letter-spacing="2">VISUAL.MAP <tspan fill="#5b7686">/ PORTRAIT.SIGNAL</tspan></text>

    <!-- Portrait box bg -->
    <rect x="50" y="100" width="${SVG_W}" height="${SVG_H}" rx="6" fill="#06090e" stroke="#252a3a" stroke-width="1.5"/>
    <rect x="50" y="100" width="${SVG_W}" height="${SVG_H}" rx="6" fill="url(#panelGlow)"/>

    <!-- Radar circles behind portrait -->
    <g transform="translate(50,100)">${radarCircles}${crosshairs}</g>

    <!-- DOT-MATRIX PORTRAIT -->
    <g clip-path="url(#dotClip)" transform="translate(50,100)">
      ${dots}
    </g>

    <!-- Scanline animation over portrait -->
    <g clip-path="url(#scanClip)">
      <g class="scanline">
        <rect x="50" y="100" width="${SVG_W}" height="28" fill="url(#scanGrad)" opacity="0.7"/>
      </g>
      <g class="glow-pass">
        <rect x="50" y="100" width="${SVG_W}" height="150" fill="url(#glowGrad)" opacity="0.4"/>
      </g>
    </g>

    <!-- Portrait border + corner accents -->
    <rect x="50" y="100" width="${SVG_W}" height="${SVG_H}" rx="6" fill="none" stroke="#252a3a" stroke-width="1"/>
    
    <!-- Left pane footer -->
    <text x="198" y="625" class="mono" fill="#5b7686" font-size="9.5" text-anchor="middle" letter-spacing="1.5" font-weight="bold">AI/UX  /  FRONT-END  /  DESIGN SYSTEMS</text>

    <!-- ── RIGHT PANE ── -->
    <text x="410" y="70" class="mono" fill="#4dd9e8" font-size="10" font-weight="bold" letter-spacing="2">SYSTEM.INFO <tspan fill="#5b7686">/ DESIGN.BUILDER</tspan></text>
    
    <text x="410" y="96" class="mono" fill="#ff6fb0" font-size="16" font-weight="bold" letter-spacing="0.5">ananta1705@github</text>
    <text x="580" y="96" class="mono" fill="#ff6fb0" font-size="15" opacity="0.4">- - - - - - - - - - - - - - - - - - - -</text>

    <!-- Info rows -->
    <text x="410" y="125" class="mono" fill="#4dd9e8" font-size="12">. Subject:</text>
    <text x="530" y="125" class="mono" fill="#e2e8f0" font-size="12" font-weight="bold">Ananta Puti Maharani</text>
    <text x="410" y="145" class="mono" fill="#4dd9e8" font-size="12">. Role:</text>
    <text x="530" y="145" class="mono" fill="#e2e8f0" font-size="12" font-weight="bold">UI/UX Designer &amp; Front-End Developer</text>
    <text x="410" y="165" class="mono" fill="#4dd9e8" font-size="12">. Affiliation:</text>
    <text x="530" y="165" class="mono" fill="#e2e8f0" font-size="12" font-weight="bold">Telkom University</text>
    <text x="410" y="185" class="mono" fill="#4dd9e8" font-size="12">. Base:</text>
    <text x="530" y="185" class="mono" fill="#e2e8f0" font-size="12" font-weight="bold">Purwokerto, Jawa Tengah, Indonesia</text>
    <text x="410" y="205" class="mono" fill="#4dd9e8" font-size="12">. Status:</text>
    <text x="530" y="205" class="mono" fill="#e2e8f0" font-size="12" font-weight="bold">Studying / Designing / Shipping</text>

    <!-- DESIGN.NODE -->
    <text x="410" y="240" class="mono" fill="#5ee6a5" font-size="11" font-weight="bold" letter-spacing="1.5">DESIGN.NODE</text>
    <text x="410" y="260" class="mono" fill="#4dd9e8" font-size="12">. Primary:</text>
    <text x="530" y="260" class="mono" fill="#e2e8f0" font-size="12" font-weight="bold">UI/UX Design</text>
    <text x="410" y="280" class="mono" fill="#4dd9e8" font-size="12">. Direction:</text>
    <text x="530" y="280" class="mono" fill="#e2e8f0" font-size="12" font-weight="bold">Front-End Development</text>
    <text x="410" y="300" class="mono" fill="#4dd9e8" font-size="12">. Themes:</text>
    <text x="530" y="300" class="mono" fill="#e2e8f0" font-size="12" font-weight="bold">Smooth, modern, intuitive interfaces</text>

    <!-- BUILD.LOG -->
    <text x="410" y="335" class="mono" fill="#5ee6a5" font-size="11" font-weight="bold" letter-spacing="1.5">BUILD.LOG</text>
    <rect x="495" y="330" width="445" height="1" fill="#1c2b3a" opacity="0.6"/>
    
    <text x="410" y="355" class="mono" fill="#4dd9e8" font-size="11">. DPBO_Mahananta:</text>
    <text x="570" y="355" class="mono" fill="#e2e8f0" font-size="11" font-weight="bold">OOP coursework (Java)</text>
    
    <text x="410" y="375" class="mono" fill="#4dd9e8" font-size="11">. EcoScope:</text>
    <text x="570" y="375" class="mono" fill="#e2e8f0" font-size="11" font-weight="bold">UI/UX Design Project</text>
    
    <text x="410" y="395" class="mono" fill="#4dd9e8" font-size="11">. BlupTrain:</text>
    <text x="570" y="395" class="mono" fill="#e2e8f0" font-size="11" font-weight="bold">Train ticketing platform</text>
    
    <text x="410" y="415" class="mono" fill="#4dd9e8" font-size="11">. Tel-U Competition:</text>
    <text x="570" y="415" class="mono" fill="#e2e8f0" font-size="11" font-weight="bold">Front-End Development</text>

    <!-- STACK.GRID separated perfectly matching reference colors -->
    <text x="410" y="450" class="mono" fill="#5ee6a5" font-size="11" font-weight="bold" letter-spacing="1.5">STACK.GRID</text>

    <!-- Row 1: Languages & Frameworks -->
    <text x="410" y="475" class="mono" fill="#4dd9e8" font-size="11">. Languages &amp; Frameworks:</text>
    <g transform="translate(410, 485)">
      <rect x="0" y="0" width="24" height="20" rx="4" fill="#00599C"/>
      <text x="12" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">C</text>
      
      <rect x="30" y="0" width="36" height="20" rx="4" fill="#00599C"/>
      <text x="48" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">C++</text>
      
      <rect x="72" y="0" width="30" height="20" rx="4" fill="#239120"/>
      <text x="87" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">C#</text>
      
      <rect x="108" y="0" width="42" height="20" rx="4" fill="#ED8B00"/>
      <text x="129" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">Java</text>
      
      <rect x="156" y="0" width="80" height="20" rx="4" fill="#F7DF1E"/>
      <text x="196" y="14" class="mono" fill="#000000" font-size="10.5" font-weight="bold" text-anchor="middle">JavaScript</text>
      
      <rect x="242" y="0" width="80" height="20" rx="4" fill="#3178C6"/>
      <text x="282" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">TypeScript</text>
      
      <rect x="328" y="0" width="54" height="20" rx="4" fill="#3776AB"/>
      <text x="355" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">Python</text>
      
      <rect x="388" y="0" width="36" height="20" rx="4" fill="#777BB4"/>
      <text x="406" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">PHP</text>
      
      <rect x="430" y="0" width="48" height="20" rx="4" fill="#F54A2A"/>
      <text x="454" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">Swift</text>
    </g>

    <!-- Row 2: Front-End & UI Tools -->
    <text x="410" y="530" class="mono" fill="#4dd9e8" font-size="11">. Front-End &amp; UI Tools:</text>
    <g transform="translate(410, 540)">
      <rect x="0" y="0" width="48" height="20" rx="4" fill="#E34F26"/>
      <text x="24" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">HTML5</text>
      
      <rect x="54" y="0" width="76" height="20" rx="4" fill="#7952B3"/>
      <text x="92" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">Bootstrap</text>
      
      <rect x="136" y="0" width="92" height="20" rx="4" fill="#20232A"/>
      <text x="182" y="14" class="mono" fill="#61DAFB" font-size="10.5" font-weight="bold" text-anchor="middle">React Native</text>
      
      <rect x="234" y="0" width="42" height="20" rx="4" fill="#646CFF"/>
      <text x="255" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">Vite</text>
      
      <rect x="282" y="0" width="62" height="20" rx="4" fill="#FF2D20"/>
      <text x="313" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">Laravel</text>
      
      <rect x="350" y="0" width="56" height="20" rx="4" fill="#FF0000"/>
      <text x="378" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">JavaFX</text>
    </g>

    <!-- Row 3: Tools & Platforms -->
    <text x="410" y="585" class="mono" fill="#4dd9e8" font-size="11">. Tools &amp; Platforms:</text>
    <g transform="translate(410, 595)">
      <rect x="0" y="0" width="66" height="20" rx="4" fill="#FFCA28"/>
      <text x="33" y="14" class="mono" fill="#000000" font-size="10.5" font-weight="bold" text-anchor="middle">Firebase</text>
      
      <rect x="72" y="0" width="48" height="20" rx="4" fill="#F24E1E"/>
      <text x="96" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">Figma</text>
      
      <rect x="126" y="0" width="76" height="20" rx="4" fill="#31A8FF"/>
      <text x="164" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">Photoshop</text>
      
      <rect x="208" y="0" width="90" height="20" rx="4" fill="#FF9A00"/>
      <text x="253" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">Illustrator</text>
      
      <rect x="304" y="0" width="68" height="20" rx="4" fill="#FF61F6"/>
      <text x="338" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">Adobe XD</text>
      
      <rect x="378" y="0" width="42" height="20" rx="4" fill="#0052CC"/>
      <text x="399" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">Jira</text>

      <rect x="426" y="0" width="60" height="20" rx="4" fill="#FF6C37"/>
      <text x="456" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">Postman</text>

      <rect x="492" y="0" width="48" height="20" rx="4" fill="#00C4CC"/>
      <text x="516" y="14" class="mono" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">Canva</text>
    </g>

    <!-- signal_locked -->
    <text x="410" y="635" class="mono" fill="#c94f8c" font-size="11.5" letter-spacing="1">signal_locked &gt; <tspan fill="#ff6fb0" font-weight="bold">UI/UX / FRONT-END / TELKOM UNIVERSITY</tspan></text>

    <!-- Footer Bar Text Centered in Card -->
    <line x1="0" y1="645" x2="970" y2="645" stroke="#1c2b3a" stroke-width="1" opacity="0.5"/>
    <text x="485" y="670" class="mono" fill="#5b7686" font-size="10" text-anchor="middle" letter-spacing="2" font-weight="bold">UI/UX DESIGN   /   FRONT-END DEV   /   TELKOM UNIVERSITY</text>
  </g>

  <!-- External Badges Row (Github + Visitors) underneath the card -->
  <g transform="translate(305, 715)">
    <!-- Github Button -->
    <g transform="translate(0, 0)">
      <rect x="0" y="0" width="140" height="30" rx="4" fill="#0c1017" stroke="#252a3a" stroke-width="1.5"/>
      <circle cx="15" cy="15" r="3" fill="#e2e8f0"/>
      <text x="25" y="19" class="mono" fill="#e2e8f0" font-size="11" font-weight="bold" letter-spacing="1">GITHUB</text>
      <text x="90" y="19" class="mono" fill="#ff6fb0" font-size="11" font-weight="bold" letter-spacing="1">ANANTA1705</text>
      <line x1="80" y1="0" x2="80" y2="30" stroke="#252a3a" stroke-width="1.5"/>
    </g>
    
    <!-- Visitor Badges -->
    ${visitorBadge1}
    ${visitorBadge2}
  </g>
</g>
</svg>`;

  fs.writeFileSync('terminal-profile.svg', svg, 'utf8');
  const kb = (fs.statSync('terminal-profile.svg').size / 1024).toFixed(1);
  console.log(`\n✅ terminal-profile.svg written (${kb} KB)`);
  console.log('   → Open preview.html in browser to check!');
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
