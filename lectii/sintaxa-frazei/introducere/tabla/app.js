/* ============================================================
   qwzkySyntax — logica aplicației
   ============================================================ */
(function () {
  'use strict';

  const LS_KEY = 'qwzkySyntax.v1';
  const NOTES_KEY = 'qwzkySyntax.notes.v1';
  const PAGE_PAD = 32;
  const TEXT_PAD = 28; // distanță pe orizontală între text și chenarul-guideline
  const EXPORT_SCALE = 2;
  const HCAP = 120;
  const ACCENT = '#8b9bff';

  const $ = (id) => document.getElementById(id);

  /* ---------- Iconuri (SVG line, currentColor) ---------- */
  const ICON = {
    select:'<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3"/>',
    pencil:'<path d="M4 20 L4 16.5 L15.5 5 L19 8.5 L7.5 20 Z"/><line x1="13.5" y1="7" x2="17" y2="10.5"/>',
    rect:'<rect x="4" y="6" width="16" height="12" rx="1.5"/>',
    circle:'<circle cx="12" cy="12" r="8"/>',
    line:'<line x1="5" y1="19" x2="19" y2="5"/>',
    arrow:'<line x1="4" y1="12" x2="19" y2="12"/><polyline points="13,6 20,12 13,18"/>',
    curvedArrow:'<path d="M4 16 A 8 8 0 0 1 20 16" fill="none"/><polyline points="16.5 14 20 17.5 23.5 14" fill="none"/>',
    // Aceeași săgeată, oglindită: burta în jos, vârful tot în dreapta.
    curvedArrowDown:'<path d="M4 8 A 8 8 0 0 0 20 8" fill="none"/><polyline points="16.5 10 20 6.5 23.5 10" fill="none"/>',
    zigzag:'<polyline points="3,15 7,9 11,15 15,9 19,15 21,11"/>',
    wavy:'<path d="M3 13 Q 6 7 9 13 T 15 13 T 21 13"/>',
    text:'<line x1="6" y1="6" x2="18" y2="6"/><line x1="12" y1="6" x2="12" y2="19"/>',
    eraser:'<path d="M4 16 L12 8 L17 13 L11 19 L6 19 Z"/><line x1="11" y1="19" x2="20" y2="19"/>',
    undo:'<polyline points="9,7 4,12 9,17"/><path d="M4 12 H14 a5 5 0 0 1 0 10 H10"/>',
    redo:'<polyline points="15,7 20,12 15,17"/><path d="M20 12 H10 a5 5 0 0 0 0 10 H14"/>',
    trash:'<polyline points="4,7 20,7"/><path d="M9 7 V5 a1 1 0 0 1 1-1 h4 a1 1 0 0 1 1 1 V7"/><path d="M6 7 l1 13 a1 1 0 0 0 1 1 h8 a1 1 0 0 0 1-1 l1-13"/>',
    note:'<path d="M5 4 h14 v10 l-5 5 H5 Z"/><polyline points="19,14 14,14 14,19"/>',
    paste:'<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M9 5 H6 a1 1 0 0 0 -1 1 V20 a1 1 0 0 0 1 1 H18 a1 1 0 0 0 1 -1 V6 a1 1 0 0 0 -1 -1 H15"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    focus:'<path d="M8 4 H4 v4 M16 4 H20 v4 M8 20 H4 v-4 M16 20 H20 v-4"/>',
    focusExit:'<path d="M4 8 H8 V4 M20 8 H16 V4 M4 16 H8 V20 M20 16 H16 V20"/>',
    clearAll:'<path d="M4 7 H20"/><path d="M9 7 V5 a1 1 0 0 1 1-1 h4 a1 1 0 0 1 1 1 V7"/><path d="M6 7 l1 13 a1 1 0 0 0 1 1 h8 a1 1 0 0 0 1-1 l1-13"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    download:'<path d="M12 3 v11"/><polyline points="7 10 12 15 17 10"/><path d="M5 20 h14"/>',
    copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15 a2 2 0 0 1 -2 -2 V5 a2 2 0 0 1 2 -2 h8 a2 2 0 0 1 2 2 v1"/>',
    hand:'<path d="M7 11V7a1.5 1.5 0 0 1 3 0v3M10 10V5.5a1.5 1.5 0 0 1 3 0V10m0-.5V6.5a1.5 1.5 0 0 1 3 0V13a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.5-2L4 13.6a1.5 1.5 0 0 1 2.3-1.9l1 1.1"/>',
    zoomIn:'<circle cx="11" cy="11" r="6"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="15.5" y1="15.5" x2="20" y2="20"/>',
    zoomOut:'<circle cx="11" cy="11" r="6"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="15.5" y1="15.5" x2="20" y2="20"/>',
    fit:'<path d="M4 9 V4 h5 M20 9 V4 h-5 M4 15 v5 h5 M20 15 v5 h-5"/>',
    pin:'<path d="M9 4 h6 l-1 6 3 3 H7 l3 -3 Z"/><line x1="12" y1="13" x2="12" y2="20"/>',
    alignLeft:'<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="10" x2="14" y2="10"/><line x1="4" y1="14" x2="19" y2="14"/><line x1="4" y1="18" x2="12" y2="18"/>',
    alignCenter:'<line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="10" x2="17" y2="10"/><line x1="5" y1="14" x2="19" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/>',
    alignRight:'<line x1="4" y1="6" x2="20" y2="6"/><line x1="10" y1="10" x2="20" y2="10"/><line x1="5" y1="14" x2="20" y2="14"/><line x1="12" y1="18" x2="20" y2="18"/>',
    alignJustify:'<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="4" y1="14" x2="20" y2="14"/><line x1="4" y1="18" x2="20" y2="18"/>',
    table:'<rect x="4" y="5" width="16" height="14" rx="1.5"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="12" y1="5" x2="12" y2="19"/>',
  };
  function svgIcon(name, size) {
    const s = size || 22;
    return '<svg class="ic" viewBox="0 0 24 24" width="' + s + '" height="' + s +
      '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      (ICON[name] || '') + '</svg>';
  }

  /* ---------- Definiția uneltelor ---------- */
  const TOOLS = [
    { id:'select',      name:'Selectează',       icon:'select',      cursor:'default',   shape:false },
    { id:'pan',         name:'Mână (mută pânza)', icon:'hand',       cursor:'grab',      shape:false },
    { id:'pencil',      name:'Creion (desen liber)', icon:'pencil',  cursor:'crosshair', shape:true  },
    { id:'rect',        name:'Pătrat',           icon:'rect',        cursor:'crosshair', shape:true  },
    { id:'circle',      name:'Cerc',             icon:'circle',      cursor:'crosshair', shape:true  },
    { id:'line',        name:'Linie dreaptă',    icon:'line',        cursor:'crosshair', shape:true  },
    { id:'zigzag',      name:'Linie în zigzag',  icon:'zigzag',      cursor:'crosshair', shape:true  },
    { id:'wavy',        name:'Linie ondulată',   icon:'wavy',        cursor:'crosshair', shape:true  },
    { id:'arrow',       name:'Săgeată dreaptă',  icon:'arrow',       cursor:'crosshair', shape:true  },
    { id:'curvedArrow', name:'Săgeată curbată (pe deasupra)', icon:'curvedArrow', cursor:'crosshair', shape:true  },
    { id:'curvedArrowDown', name:'Săgeată curbată (pe dedesubt)', icon:'curvedArrowDown', cursor:'crosshair', shape:true  },
    { id:'text',        name:'Text',             icon:'text',        cursor:'text',      shape:true  },
    { id:'eraser',      name:'Radieră',          icon:'eraser',      cursor:'cell',      shape:false },
  ];
  const toolById = (id) => TOOLS.find((t) => t.id === id);
  const UTIL_TOOLS = ['select', 'pan', 'text', 'eraser'];
  const SHAPE_TOOLS = ['pencil', 'rect', 'circle', 'line', 'zigzag', 'wavy', 'arrow', 'curvedArrow', 'curvedArrowDown'];

  const FONTS = {
    serif:'Georgia,"Times New Roman","Iowan Old Style",serif',
    sans :'"Segoe UI",system-ui,-apple-system,Roboto,"Helvetica Neue",Arial,sans-serif',
    mono :'"Cascadia Code","JetBrains Mono",Consolas,monospace',
  };

  const DEFAULTS = {
    text:'', fontKey:'serif', fontSize:30,
    wordSpacing:12, lineSpacing:22, markingOpacity:1,
    strokeColor:'#e5484d', strokeWidth:4, tool:'select',
    favorites:['#e5484d','#2f6fed','#2fa84f','#f08c00','#8e44ad'],
    bgColors:['#ffffff','#fbf3d6','#eaf2fb','#eef1f4','#202533'],
    bgIndex:0, wheelStep:3, wheelDir:1, strokeWheelStep:3, strokeWheelDir:1, strokeWheelAmount:1,
    carouselTools:['pencil','rect','circle','line','arrow','zigzag','wavy','curvedArrow','curvedArrowDown','text','eraser'],
    uiScale:1, zoom:1, panX:0, panY:0,
    shapes:[],
    // Lucrările NU mai stau aici: ele merg în contul elevului, prin punte.
    // Aici rămân doar notițele, care sunt ale calculatorului ăstuia.
    // `w`/`h` = mărimea aleasă pentru panou.
    postits:{ pages:[''], cur:0, zoom:1, w:0, h:0 },
  };

  /* ---------- State ---------- */
  let state;
  let nextId = 1;
  let ctx, canvas, canvasWrap;
  const layout = { words:[], lineStep:0, contentBottom:0 };

  let drag = null;
  let pointers = new Map();   // toate degetele active (pointerId -> {x,y} în css canvas)
  let gesture = null;         // gest cu două degete (pinch + pan)
  let preview = null;
  let selection = [];
  let marquee = null;
  let textEditPos = null;
  let spaceDown = false;
  let pointerOverCanvas = false;
  let wheelAccum = 0;
  let strokeWheelAccum = 0;
  let carouselTimer = null;
  let toastTimer = null;
  let persistTimer = null;
  let postitPinned = false;

  let history = [];
  let hindex = -1;

  /* ---------- Helpers ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fontCss = () => FONTS[state.fontKey] || FONTS.serif;
  const currentBg = () => state.bgColors[state.bgIndex] || '#ffffff';

  function textColorForBg(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substr(0,2),16), g = parseInt(c.substr(2,2),16), b = parseInt(c.substr(4,2),16);
    const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
    return lum > 0.6 ? '#1d1d22' : '#f3f4f8';
  }

  function reId() {
    state.shapes.forEach((s) => {
      if (s.id == null) s.id = nextId++;
      else nextId = Math.max(nextId, s.id + 1);
    });
  }

  function screenToWorld(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - state.panX) / state.zoom,
      y: (e.clientY - r.top  - state.panY) / state.zoom,
    };
  }
  function worldToScreen(p) {
    return { x: p.x * state.zoom + state.panX, y: p.y * state.zoom + state.panY };
  }
  function evCss(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /* ============================================================
     AȘEZAREA TEXTULUI (wrapping + spațiere uniformă)
     ============================================================ */
  /* ============================================================
     LĂȚIMEA DE RUPERE A RÂNDURILOR

     Cât timp fraza e curată, rândurile se rup după fereastră: o lărgești, textul
     se așază pe lățimea nouă. Firesc, fiindcă n-ai ce strica.

     DAR din clipa în care ai pus primul marcaj, lucrurile se schimbă. Marcajele
     stau la coordonate fixe, peste cuvinte. Dacă textul s-ar re-aranja sub ele,
     sublinierile ar ajunge sub alte cuvinte, iar săgețile ar arăta spre nimic:
     toată munca s-ar da peste cap dintr-o simplă redimensionare a ferestrei.

     De-aia, la primul marcaj, îngheață lățimea de atunci și rândurile rămân
     rupte exact așa. Fereastra poate fi apoi oricât de lată sau de îngustă.

     Ștergi toate marcajele și gheața se topește: te-ai întors la fraza curată,
     deci n-ai ce strica din nou.
     ============================================================ */
  let latimeInghetata = null;

  /* Cheamă asta după ORICE schimbare a marcajelor. Stă în `pushHistory` și în
     `restore`, prin care trec toate: adăugare, ștergere, undo, redo, curățare. */
  function potrivesteInghetul() {
    if (state.shapes.length) {
      if (latimeInghetata == null) latimeInghetata = pageRect().w;
    } else {
      latimeInghetata = null;
    }
  }

  function layoutText() {
    if (!ctx) return;
    const latime = latimeInghetata != null ? latimeInghetata : pageRect().w;
    const maxW = Math.max(60, latime - TEXT_PAD * 2);
    ctx.font = state.fontSize + 'px ' + fontCss();
    const spaceW = ctx.measureText(' ').width;
    const gap = spaceW + state.wordSpacing;
    const lineStep = Math.round(state.fontSize * 1.25) + state.lineSpacing;
    const startX = PAGE_PAD + TEXT_PAD;
    const topGap = Math.round(lineStep * 0.6); // spațiu by default deasupra primului rând
    const words = [];
    const paras = (state.text || '').split('\n');
    let y = PAGE_PAD + topGap + state.fontSize;

    for (let p = 0; p < paras.length; p++) {
      const toks = paras[p].length ? paras[p].split(/\s+/).filter((t) => t.length) : [];
      if (toks.length === 0) { y += lineStep; continue; }
      let x = startX, first = true;
      for (const tok of toks) {
        const w = ctx.measureText(tok).width;
        if (!first && x + w > startX + maxW) { x = startX; y += lineStep; }
        words.push({ text: tok, x: x, y: y, w: w });
        x += w + gap;
        first = false;
      }
      y += lineStep; // Enter / sfârșit de paragraf -> același pas de rând
    }
    /* Centrarea NU se mai face aici, mutând textul în adâncul paginii.
       Se face din vedere: `centreazaLucrarea` așază pe ecran tot ce e desenat.
       Așa lucrarea stă la mijloc și pe verticală, și pe orizontală, la orice
       mărire, iar chenarul rămâne lipit de text. Mutat în așezare, textul ar
       fi coborât în pagină, dar pe ecran ar fi rămas tot sus la zoom out. */
    layout.words = words;
    layout.lineStep = lineStep;
    layout.contentBottom = y + PAGE_PAD;
  }

  /* ============================================================
     DESENAREA FORMELOR
     ============================================================ */
  function drawArrowHead(c, x, y, ang, wd) {
    const h = 10 + wd * 1.8;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - h * Math.cos(ang - Math.PI/7), y - h * Math.sin(ang - Math.PI/7));
    c.moveTo(x, y);
    c.lineTo(x - h * Math.cos(ang + Math.PI/7), y - h * Math.sin(ang + Math.PI/7));
    c.stroke();
  }

  // Traseu liber netezit (curbă quadratică prin mijloacele punctelor) — fin, fără colțuri „în trepte”.
  function drawSmoothPath(c, pts) {
    if (!pts || pts.length === 0) return;
    if (pts.length === 1) {
      c.beginPath();
      c.arc(pts[0].x, pts[0].y, Math.max(0.6, c.lineWidth / 2), 0, Math.PI * 2);
      c.fillStyle = c.strokeStyle; c.fill();
      return;
    }
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      c.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const last = pts[pts.length - 1];
    c.lineTo(last.x, last.y);
    c.stroke();
  }

  function drawShape(c, s) {
    c.strokeStyle = s.color; c.fillStyle = s.color;
    c.lineWidth = s.width; c.lineCap = 'round'; c.lineJoin = 'round';

    if (s.type === 'pencil') { drawSmoothPath(c, s.pts); return; }

    if (s.type === 'rect') { c.strokeRect(s.x, s.y, s.w, s.h); return; }

    if (s.type === 'ellipse') {
      c.beginPath();
      c.ellipse(s.x + s.w/2, s.y + s.h/2, Math.abs(s.w/2), Math.abs(s.h/2), 0, 0, Math.PI*2);
      c.stroke(); return;
    }

    if (s.type === 'line') {
      c.beginPath(); c.moveTo(s.x1, s.y1); c.lineTo(s.x2, s.y2); c.stroke(); return;
    }

    if (s.type === 'arrow') {
      c.beginPath(); c.moveTo(s.x1, s.y1); c.lineTo(s.x2, s.y2); c.stroke();
      drawArrowHead(c, s.x2, s.y2, Math.atan2(s.y2 - s.y1, s.x2 - s.x1), s.width); return;
    }

    // Cele două săgeți curbate sunt una și aceeași, doar cu burta în părți
    // opuse. De-aia geometria stă într-un singur loc, cu un semn care spune
    // încotro se umflă: `-1` în sus (curcubeu), `+1` în jos (albie).
    if (s.type === 'curvedArrow' || s.type === 'curvedArrowDown') {
      const jos = s.type === 'curvedArrowDown';
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy) || 1;
      let nx = -dy/len, ny = dx/len;
      // Normala are două sensuri; îl alegem pe cel cerut, indiferent din ce
      // parte a fost trasă săgeata.
      if ((jos && ny < 0) || (!jos && ny > 0)) { nx = -nx; ny = -ny; }
      const bulge = Math.max(28, len * 0.4);
      const mx = (s.x1 + s.x2)/2, my = (s.y1 + s.y2)/2;
      const cx = mx + nx*bulge, cy = my + ny*bulge;
      c.beginPath(); c.moveTo(s.x1, s.y1); c.quadraticCurveTo(cx, cy, s.x2, s.y2); c.stroke();
      drawArrowHead(c, s.x2, s.y2, Math.atan2(s.y2 - cy, s.x2 - cx), s.width); return;
    }

    if (s.type === 'zigzag') {
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy) || 1;
      const nx = -dy/len, ny = dx/len;
      const amp = shapeAmp(s);
      const seg = Math.max(2, Math.round(len / (amp * 2.0)));
      c.beginPath(); c.moveTo(s.x1, s.y1);
      for (let i = 1; i < seg; i++) {
        const t = i/seg, px = s.x1 + dx*t, py = s.y1 + dy*t;
        const dir = (i % 2 === 0) ? 1 : -1;
        c.lineTo(px + nx*amp*dir, py + ny*amp*dir);
      }
      c.lineTo(s.x2, s.y2); c.stroke(); return;
    }

    if (s.type === 'wavy') {
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy) || 1;
      const nx = -dy/len, ny = dx/len;
      const amp = shapeAmp(s);
      const waves = Math.max(1, Math.round(len / (amp * 4)));
      const steps = Math.max(16, waves * 16);
      c.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i/steps, bx = s.x1 + dx*t, by = s.y1 + dy*t;
        const off = Math.sin(t * Math.PI * 2 * waves) * amp;
        const x = bx + nx*off, y = by + ny*off;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke(); return;
    }

    if (s.type === 'text') {
      c.font = (s.size || 20) + 'px ' + fontCss();
      c.textBaseline = 'alphabetic';
      const lines = String(s.text).split('\n');
      const lh = Math.round((s.size || 20) * 1.3);
      for (let i = 0; i < lines.length; i++) c.fillText(lines[i], s.x, s.y + i * lh);
      return;
    }
  }

  /* ---------- bounding box + hit-test ---------- */
  function shapeAmp(s) {
    if (s.type === 'zigzag') return 3.5 + (s.width || 2) * 0.55;
    if (s.type === 'wavy')   return 3 + (s.width || 2) * 0.45;
    return 0;
  }
  function pad4(x1, y1, x2, y2, m) {
    return { x1: Math.min(x1,x2)-m, y1: Math.min(y1,y2)-m, x2: Math.max(x1,x2)+m, y2: Math.max(y1,y2)+m };
  }
  function shapeBBox(s) {
    const m = (s.width || 2) + 6;
    if (s.type === 'rect' || s.type === 'ellipse') return pad4(s.x, s.y, s.x+s.w, s.y+s.h, m);
    if (s.type === 'text') {
      const size = s.size || 20;
      ctx.font = size + 'px ' + fontCss();
      const lines = String(s.text).split('\n');
      let w = 0;
      for (const ln of lines) w = Math.max(w, ctx.measureText(ln).width);
      const lh = Math.round(size * 1.3);
      return { x1: s.x - 3, y1: s.y - size, x2: s.x + w + 3, y2: s.y - size + (lines.length - 1) * lh + size * 1.35 };
    }
    if (s.type === 'pencil') {
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const pt of s.pts) { x1 = Math.min(x1, pt.x); y1 = Math.min(y1, pt.y); x2 = Math.max(x2, pt.x); y2 = Math.max(y2, pt.y); }
      if (!isFinite(x1)) return { x1: 0, y1: 0, x2: 0, y2: 0 };
      return pad4(x1, y1, x2, y2, m);
    }
    const extra = shapeAmp(s) + 12 + s.width*1.8;
    const b = pad4(s.x1, s.y1, s.x2, s.y2, m + extra);
    // Săgeata curbată iese din coarda dintre capete: vârful arcului stă la
    // jumătate din umflătură, pe normală. Fără corectura asta, chenarul
    // punctat ar tăia tocmai burta săgeții.
    if (s.type === 'curvedArrow' || s.type === 'curvedArrowDown') {
      const jos = s.type === 'curvedArrowDown';
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy) || 1;
      let nx = -dy/len, ny = dx/len;
      if ((jos && ny < 0) || (!jos && ny > 0)) { nx = -nx; ny = -ny; }
      const varf = Math.max(28, len * 0.4) / 2;
      const vx = (s.x1 + s.x2)/2 + nx*varf, vy = (s.y1 + s.y2)/2 + ny*varf;
      b.x1 = Math.min(b.x1, vx - m); b.y1 = Math.min(b.y1, vy - m);
      b.x2 = Math.max(b.x2, vx + m); b.y2 = Math.max(b.y2, vy + m);
    }
    return b;
  }
  function bboxHas(b, p) { return p.x >= b.x1 && p.x <= b.x2 && p.y >= b.y1 && p.y <= b.y2; }
  function rectsIntersect(a, b) { return !(b.x1 > a.x2 || b.x2 < a.x1 || b.y1 > a.y2 || b.y2 < a.y1); }
  function distToSeg(p, x1, y1, x2, y2) {
    const dx = x2-x1, dy = y2-y1, l2 = dx*dx + dy*dy;
    let t = l2 ? ((p.x-x1)*dx + (p.y-y1)*dy) / l2 : 0;
    t = clamp(t, 0, 1);
    const cx = x1 + t*dx, cy = y1 + t*dy;
    return Math.hypot(p.x-cx, p.y-cy);
  }
  function hitShape(s, p, tol) {
    if (s.type === 'rect' || s.type === 'ellipse' || s.type === 'text') return bboxHas(shapeBBox(s), p);
    if (s.type === 'pencil') {
      const t = tol + (s.width || 2);
      for (let i = 0; i < s.pts.length - 1; i++) {
        if (distToSeg(p, s.pts[i].x, s.pts[i].y, s.pts[i+1].x, s.pts[i+1].y) <= t) return true;
      }
      return s.pts.length === 1 ? Math.hypot(p.x - s.pts[0].x, p.y - s.pts[0].y) <= t : false;
    }
    return distToSeg(p, s.x1, s.y1, s.x2, s.y2) <= tol + shapeAmp(s);
  }
  function topShapeAt(p) {
    for (let i = state.shapes.length - 1; i >= 0; i--) {
      const s = state.shapes[i];
      if (hitShape(s, p, (s.width || 2) + 8)) return s;
    }
    return null;
  }

  /* ============================================================
     RENDER
     ============================================================ */
  function drawContent(c) {
    // text
    c.save();
    c.font = state.fontSize + 'px ' + fontCss();
    c.textBaseline = 'alphabetic';
    c.fillStyle = textColorForBg(currentBg());
    for (const w of layout.words) c.fillText(w.text, w.x, w.y);
    c.restore();
    // forme (cu opacitate globală)
    for (const s of state.shapes) {
      c.save();
      c.globalAlpha = state.markingOpacity;
      drawShape(c, s);
      c.restore();
    }
  }

  function render() {
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = currentBg();
    ctx.fillRect(0, 0, cw, ch);

    ctx.translate(state.panX, state.panY);
    ctx.scale(state.zoom, state.zoom);

    drawContent(ctx);

    // chenar punctat = exact ce intră în captură (JPEG / Copiază)
    const eb = computeExportBounds();
    ctx.save();
    ctx.setLineDash([8 / state.zoom, 6 / state.zoom]);
    ctx.lineWidth = 1 / state.zoom;
    ctx.strokeStyle = 'rgba(150,150,160,0.32)';
    ctx.strokeRect(eb.x1, eb.y1, eb.x2 - eb.x1, eb.y2 - eb.y1);
    ctx.restore();

    if (preview) {
      ctx.save(); ctx.globalAlpha = state.markingOpacity; drawShape(ctx, preview); ctx.restore();
    }

    // selecție
    if (selection.length || (marquee && marquee.rect)) {
      ctx.save();
      ctx.setLineDash([6 / state.zoom, 4 / state.zoom]);
      ctx.lineWidth = 1.5 / state.zoom;
      ctx.strokeStyle = ACCENT;
      for (const s of selection) {
        const b = shapeBBox(s);
        ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
      }
      if (marquee && marquee.rect) {
        const r = marquee.rect;
        ctx.strokeRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
      }
      ctx.restore();
    }
  }

  function fitCanvas() {
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvasWrap.clientWidth, ch = canvasWrap.clientHeight;
    if (cw === 0 || ch === 0) return;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    state.pageWidth = cw;
    layoutText();
    centreazaLucrarea();
    render();
  }

  /* ============================================================
     CREAREA / EDITAREA FORMELOR
     ============================================================ */
  function makeShape(tool, a, b) {
    const base = { id: nextId++, color: state.strokeColor, width: state.strokeWidth };
    switch (tool) {
      case 'pencil':      return Object.assign(base, { type:'pencil', pts:[{ x:a.x, y:a.y }] });
      case 'rect':        return Object.assign(base, { type:'rect',    x:a.x, y:a.y, w:b.x-a.x, h:b.y-a.y });
      case 'circle':      return Object.assign(base, { type:'ellipse', x:a.x, y:a.y, w:b.x-a.x, h:b.y-a.y });
      case 'line':        return Object.assign(base, { type:'line',    x1:a.x, y1:a.y, x2:b.x, y2:b.y });
      case 'arrow':       return Object.assign(base, { type:'arrow',   x1:a.x, y1:a.y, x2:b.x, y2:b.y });
      case 'curvedArrow': return Object.assign(base, { type:'curvedArrow', x1:a.x, y1:a.y, x2:b.x, y2:b.y });
      case 'curvedArrowDown': return Object.assign(base, { type:'curvedArrowDown', x1:a.x, y1:a.y, x2:b.x, y2:b.y });
      case 'zigzag':      return Object.assign(base, { type:'zigzag',  x1:a.x, y1:a.y, x2:b.x, y2:b.y });
      case 'wavy':        return Object.assign(base, { type:'wavy',    x1:a.x, y1:a.y, x2:b.x, y2:b.y });
    }
    return null;
  }
  function updateShape(s, a, b) {
    if (s.type === 'pencil') {
      const last = s.pts[s.pts.length - 1];
      // filtru de distanță minimă (în unități „lume”) — elimină tremurul, păstrează fidelitatea
      const minD = 1.1 / (state.zoom || 1);
      if (!last || Math.hypot(b.x - last.x, b.y - last.y) >= minD) s.pts.push({ x: b.x, y: b.y });
      return;
    }
    if (s.type === 'rect' || s.type === 'ellipse') { s.w = b.x - a.x; s.h = b.y - a.y; }
    else { s.x2 = b.x; s.y2 = b.y; }
  }
  function shapeHasSize(s) {
    if (s.type === 'pencil') {
      if (s.pts.length < 2) return false;
      let len = 0;
      for (let i = 1; i < s.pts.length; i++) len += Math.hypot(s.pts[i].x - s.pts[i-1].x, s.pts[i].y - s.pts[i-1].y);
      return len > 2;
    }
    if (s.type === 'rect' || s.type === 'ellipse') return Math.abs(s.w) > 3 || Math.abs(s.h) > 3;
    return Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 4;
  }
  function normalizeShape(s) {
    if (s.type === 'rect' || s.type === 'ellipse') {
      if (s.w < 0) { s.x += s.w; s.w = -s.w; }
      if (s.h < 0) { s.y += s.h; s.h = -s.h; }
    }
  }
  function translateShape(s, dx, dy) {
    if (s.type === 'pencil') { for (const pt of s.pts) { pt.x += dx; pt.y += dy; } return; }
    if (s.type === 'rect' || s.type === 'ellipse' || s.type === 'text') { s.x += dx; s.y += dy; }
    else { s.x1 += dx; s.y1 += dy; s.x2 += dx; s.y2 += dy; }
  }

  /* ---------- input text pe pânză (multi-rând, ca în Word) ---------- */
  let textEditSize = 20;
  function openTextInput(p) {
    textEditPos = p;
    textEditSize = Math.max(14, Math.round(state.fontSize * 0.7));
    const s = worldToScreen(p);
    const ti = $('textInput');
    ti.style.display = 'block';
    ti.style.left = s.x + 'px';
    ti.style.top = s.y + 'px';
    ti.style.fontFamily = fontCss();
    ti.style.fontSize = (textEditSize * state.zoom) + 'px';
    ti.style.lineHeight = Math.round(textEditSize * 1.3 * state.zoom) + 'px';
    ti.style.color = state.strokeColor;
    ti.value = '';
    sizeTextInput();
    setTimeout(() => ti.focus(), 0);
  }
  function sizeTextInput() {
    const ti = $('textInput');
    const fpx = textEditSize * state.zoom;
    ctx.font = fpx + 'px ' + fontCss();
    const lines = (ti.value || '').split('\n');
    let w = 0;
    for (const ln of lines) w = Math.max(w, ctx.measureText(ln).width);
    const minW = Math.round(fpx * 1.8); // ~2-3 caractere
    const maxW = Math.round(pageRect().w * state.zoom);
    ti.style.width = clamp(Math.ceil(w) + 10, minW, maxW) + 'px';
    ti.style.height = 'auto';
    ti.style.height = ti.scrollHeight + 'px';
  }
  function commitText() {
    const ti = $('textInput');
    const v = ti.value.replace(/\s+$/,''); // păstrăm rândurile interioare, tăiem doar spațiile finale
    ti.style.display = 'none';
    if (v && textEditPos) {
      state.shapes.push({ id: nextId++, type:'text', x: textEditPos.x, y: textEditPos.y + textEditSize,
        text: v, color: state.strokeColor, width: state.strokeWidth, size: textEditSize });
      pushHistory(); render();
    }
    textEditPos = null;
  }
  function textInputOpen() { return $('textInput').style.display === 'block'; }

  function eraseAt(p) {
    for (let i = state.shapes.length - 1; i >= 0; i--) {
      const s = state.shapes[i];
      if (hitShape(s, p, (s.width || 2) + 8)) {
        state.shapes.splice(i, 1);
        if (drag) drag.changed = true;
        break;
      }
    }
  }

  /* ============================================================
     POINTER
     ============================================================ */
  function startGesture() {
    const pts = [...pointers.values()];
    if (pts.length < 2) { gesture = null; return; }
    const a = pts[0], b = pts[1];
    gesture = {
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      zoom: state.zoom,
      midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2,
      panX: state.panX, panY: state.panY,
    };
  }

  function onPointerDown(e) {
    if (e.button === 2) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, evCss(e));

    // două degete => pinch-zoom + mutare; anulăm orice desen în curs
    if (pointers.size >= 2) {
      if (drag && drag.mode === 'draw') preview = null;
      if (drag && drag.mode === 'select') marquee = null;
      drag = null;
      startGesture();
      render();
      return;
    }

    const p = screenToWorld(e);
    const tool = state.tool;

    // unealta „Mână” sau Space / click-mijloc => mută pânza cu un deget
    if (tool === 'pan' || e.button === 1 || spaceDown) {
      drag = { mode:'pan', sx:e.clientX, sy:e.clientY, px:state.panX, py:state.panY };
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    if (tool === 'text') { if (textInputOpen()) commitText(); openTextInput(p); return; }
    if (tool === 'eraser') { drag = { mode:'erase', changed:false }; eraseAt(p); render(); return; }

    if (tool === 'select') {
      const hit = topShapeAt(p);
      if (hit) {
        if (!selection.includes(hit)) selection = [hit];
        drag = { mode:'move', last:p, changed:false };
      } else {
        selection = [];
        marquee = { start:p, rect:null };
        drag = { mode:'select' };
      }
      render(); return;
    }

    // forme
    preview = makeShape(tool, p, p);
    drag = { mode:'draw', start:p };
    render();
  }

  function onPointerMove(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, evCss(e));
    updateBadge(e);

    // gest cu două degete: zoom + mutare simultană
    if (pointers.size >= 2 && gesture) {
      const pts = [...pointers.values()];
      const a = pts[0], b = pts[1];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
      const nz = clamp(gesture.zoom * (dist / gesture.dist), 0.2, 6);
      // punctul-lume aflat sub mijlocul inițial rămâne sub mijlocul curent
      const wx = (gesture.midX - gesture.panX) / gesture.zoom;
      const wy = (gesture.midY - gesture.panY) / gesture.zoom;
      state.zoom = nz;
      state.panX = midX - wx * nz;
      state.panY = midY - wy * nz;
      $('czVal').textContent = Math.round(state.zoom * 100) + '%';
      render();
      return;
    }

    if (!drag) return;
    const p = screenToWorld(e);

    if (drag.mode === 'pan') {
      state.panX = drag.px + (e.clientX - drag.sx);
      state.panY = drag.py + (e.clientY - drag.sy);
      render(); return;
    }
    if (drag.mode === 'erase') { eraseAt(p); render(); return; }
    if (drag.mode === 'draw') { updateShape(preview, drag.start, p); render(); return; }
    if (drag.mode === 'select') {
      marquee.rect = pad4(marquee.start.x, marquee.start.y, p.x, p.y, 0);
      selection = state.shapes.filter((s) => rectsIntersect(marquee.rect, shapeBBox(s)));
      render(); return;
    }
    if (drag.mode === 'move') {
      const dx = p.x - drag.last.x, dy = p.y - drag.last.y;
      for (const s of selection) translateShape(s, dx, dy);
      drag.last = p; drag.changed = true; render(); return;
    }
  }

  function onPointerUp(e) {
    if (e && pointers.has(e.pointerId)) pointers.delete(e.pointerId);

    // ieșire din gestul de două degete
    if (gesture && pointers.size < 2) {
      gesture = null;
      drag = null;            // degetul rămas nu reia desenul
      updateCursor(); render(); persist();
      if (pointers.size === 0) return;
      return;
    }

    if (!drag) { updateCursor(); return; }
    if (drag.mode === 'draw') {
      if (preview && shapeHasSize(preview)) { normalizeShape(preview); state.shapes.push(preview); pushHistory(); }
      preview = null;
    } else if (drag.mode === 'erase') {
      if (drag.changed) pushHistory();
    } else if (drag.mode === 'select') {
      marquee = null;
    } else if (drag.mode === 'move') {
      if (drag.changed) pushHistory();
    }
    drag = null;
    updateCursor();
    render();
    persist();
  }

  function deleteSelected() {
    if (!selection.length) return;
    state.shapes = state.shapes.filter((s) => !selection.includes(s));
    selection = [];
    pushHistory(); render();
  }

  /* ============================================================
     ROTIȚĂ: carusel unelte + Ctrl-zoom
     ============================================================ */
  /* Așază lucrarea în mijlocul ecranului, pe amândouă direcțiile.
     Se cheamă DOAR când tot ce e desenat încape pe ecran. Când nu încape, a
     centra ar însemna să sari peste locul la care te uitai, deci lăsăm vederea
     unde e și te muți tu cu mâna. */
  function centreazaLucrarea() {
    const b = computeExportBounds();
    const lw = (b.x2 - b.x1) * state.zoom, lh = (b.y2 - b.y1) * state.zoom;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (lw > cw || lh > ch) return false;
    state.panX = Math.round((cw - lw) / 2 - b.x1 * state.zoom);
    state.panY = Math.round((ch - lh) / 2 - b.y1 * state.zoom);
    return true;
  }

  function zoomAt(cx, cy, factor) {
    const wx = (cx - state.panX) / state.zoom, wy = (cy - state.panY) / state.zoom;
    const nz = clamp(state.zoom * factor, 0.2, 6);
    state.panX = cx - wx * nz; state.panY = cy - wy * nz; state.zoom = nz;
    // Dacă după mărire lucrarea încape toată pe ecran, o punem la mijloc.
    // Altfel ar rămâne agățată în colțul din stânga-sus, cu ecranul gol în jur,
    // tocmai când dai zoom out ca s-o vezi întreagă.
    centreazaLucrarea();
    $('czVal').textContent = Math.round(state.zoom * 100) + '%';
    render(); persist();
  }
  function zoomCenter(factor) {
    zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, factor);
  }

  function onWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      const c = evCss(e);
      zoomAt(c.x, c.y, e.deltaY < 0 ? 1.1 : 1/1.1);
      return;
    }
    e.preventDefault();

    // În timpul desenării unei forme: rotița modifică GROSIMEA conturului.
    if (drag && drag.mode === 'draw' && preview) {
      strokeWheelAccum += e.deltaY > 0 ? 1 : -1;
      if (Math.abs(strokeWheelAccum) >= state.strokeWheelStep) {
        const step = (strokeWheelAccum > 0 ? 1 : -1) * (state.strokeWheelDir || 1);
        state.strokeWidth = clamp(state.strokeWidth + step * (state.strokeWheelAmount || 1), 1, 28);
        preview.width = state.strokeWidth;
        $('strokeW').value = state.strokeWidth;
        $('strokeWVal').textContent = state.strokeWidth;
        strokeWheelAccum = 0;
        render(); persist();
      }
      return;
    }

    // Altfel: carusel de unelte (direcția se setează în Setări).
    const list = state.carouselTools.length ? state.carouselTools : TOOLS.filter((t) => t.shape).map((t) => t.id);
    wheelAccum += e.deltaY > 0 ? 1 : -1;
    if (Math.abs(wheelAccum) >= state.wheelStep) {
      const dir = (wheelAccum > 0 ? 1 : -1) * (state.wheelDir || 1);
      let idx = list.indexOf(state.tool);
      if (idx < 0) idx = 0;
      idx = (idx + dir + list.length) % list.length;
      setTool(list[idx]);
      wheelAccum = 0;
    }
    showCarousel(e, list);
  }

  function showCarousel(e, list) {
    const car = $('carousel');
    let html = '';
    for (const id of list) {
      const t = toolById(id);
      if (!t) continue;
      html += '<span class="cz-icon' + (id === state.tool ? ' on' : '') + '" title="' + t.name + '">' + svgIcon(t.icon, 19) + '</span>';
    }
    car.innerHTML = html;
    const c = evCss(e);
    const ww = canvasWrap.clientWidth, wh = canvasWrap.clientHeight;
    let left = c.x + 20, top = c.y - 18;
    const cwid = car.offsetWidth || 0, chei = car.offsetHeight || 0;
    if (left + cwid > ww - 6) left = c.x - 20 - cwid;
    if (left < 6) left = 6;
    top = clamp(top, 6, wh - chei - 6);
    car.style.left = left + 'px';
    car.style.top = top + 'px';
    car.classList.add('show');
    clearTimeout(carouselTimer);
    carouselTimer = setTimeout(() => car.classList.remove('show'), 1000);
  }

  /* ---------- badge cursor (exponent) ---------- */
  function updateBadge(e) {
    const b = $('toolBadge');
    const c = evCss(e);
    b.style.left = (c.x + 13) + 'px';
    b.style.top = (c.y - 16) + 'px';
  }
  function setBadgeIcon() {
    const t = toolById(state.tool);
    $('toolBadge').innerHTML = '<span class="badge-inner">' + svgIcon(t ? t.icon : 'select', 16) + '</span>';
  }

  /* ============================================================
     TOOL / CURSOR
     ============================================================ */
  function setTool(id) {
    if (typeof textInputOpen === 'function' && textInputOpen()) commitText();
    if (id !== 'select') { selection = []; marquee = null; }
    state.tool = id;
    document.querySelectorAll('.tool-btn').forEach((el) => el.classList.toggle('active', el.dataset.tool === id));
    setBadgeIcon();
    updateCursor();
    render();
    persist();
  }
  function updateCursor() {
    if (spaceDown) { canvas.style.cursor = 'grab'; return; }
    const t = toolById(state.tool);
    canvas.style.cursor = t ? t.cursor : 'default';
  }

  /* ============================================================
     ISTORIC (undo / redo)
     ============================================================ */
  function snapshot() { return JSON.stringify(state.shapes); }
  function pushHistory() {
    potrivesteInghetul();
    history = history.slice(0, hindex + 1);
    history.push(snapshot());
    if (history.length > HCAP) history.shift();
    hindex = history.length - 1;
    updateUndoRedo();
    persist();
  }
  function restore(i) {
    state.shapes = JSON.parse(history[i]);
    reId();
    selection = [];
    // Un „undo" care scoate ultimul marcaj dezgheață lățimea, iar rândurile se
    // rup din nou după fereastră. De-aia trebuie și o re-așezare a textului.
    const inainte = latimeInghetata;
    potrivesteInghetul();
    if (inainte !== latimeInghetata) layoutText();
    render();
    updateUndoRedo();
    persist();
  }
  function undo() { if (hindex > 0) { hindex--; restore(hindex); } }
  function redo() { if (hindex < history.length - 1) { hindex++; restore(hindex); } }
  function updateUndoRedo() {
    $('btnUndo').disabled = hindex <= 0;
    $('btnRedo').disabled = hindex >= history.length - 1;
  }

  /* ============================================================
     EXPORT (JPEG / Copiază)
     ============================================================ */
  // „Foaia”: dreptunghiul de lucru, ancorat la (PAGE_PAD, PAGE_PAD) în coordonate-lume,
  // dimensionat ca să încapă integral în pânza vizibilă la zoom 100%. Se ajustează cu fereastra.
  function pageRect() {
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
    return { x: PAGE_PAD, y: PAGE_PAD, w: Math.max(80, w - PAGE_PAD * 2), h: Math.max(80, h - PAGE_PAD * 2) };
  }
  /* Cât loc ocupă tot ce e desenat: fraza plus marcajele. */
  function contentBounds() {
    let b = null;
    const cuprinde = (x1, y1, x2, y2) => {
      if (!b) { b = { x1, y1, x2, y2 }; return; }
      b.x1 = Math.min(b.x1, x1); b.y1 = Math.min(b.y1, y1);
      b.x2 = Math.max(b.x2, x2); b.y2 = Math.max(b.y2, y2);
    };
    // Textul: `w.y` e linia de bază, deci sus urcăm cu mărimea literei, iar jos
    // coborâm cu coada literelor de tip „p" sau „g".
    const fs = state.fontSize;
    for (const w of layout.words) cuprinde(w.x, w.y - fs, w.x + w.w, w.y + fs * 0.3);
    for (const sh of state.shapes) { const sb = shapeBBox(sh); cuprinde(sb.x1, sb.y1, sb.x2, sb.y2); }
    return b;
  }

  /* Chenarul punctat = exact ce intră în captură, și se ia DUPĂ CONȚINUT.
     Strânge fraza și marcajele, cu o margine de respiro, la orice mărire.

     Prima dată îl legasem și de cât cuprinde ecranul, ca să crească la zoom
     out. A ieșit invers decât trebuia: la zoom out ecranul cuprinde mult, iar
     chenarul devenea un dreptunghi mare care nu mai avea nicio treabă cu
     textul. Acum urmărește doar ce e desenat, deci arată la fel la orice
     mărire, iar la zoom out vezi întreaga lucrare în el.

     Pânza goală primește o pagină de pornire cât fereastra, ca să nu rămână
     un chenar de mărimea unui timbru. */
  function computeExportBounds() {
    const c = contentBounds();
    if (!c) {
      const p = pageRect();
      return { x1: p.x, y1: p.y, x2: p.x + p.w, y2: p.y + p.h };
    }
    const m = PAGE_PAD;
    return { x1: c.x1 - m, y1: c.y1 - m, x2: c.x2 + m, y2: c.y2 + m };
  }

  function exportCanvas() {
    const b = computeExportBounds();
    const w = Math.max(1, Math.ceil(b.x2 - b.x1)), h = Math.max(1, Math.ceil(b.y2 - b.y1));
    const off = document.createElement('canvas');
    off.width = w * EXPORT_SCALE; off.height = h * EXPORT_SCALE;
    const c = off.getContext('2d');
    c.scale(EXPORT_SCALE, EXPORT_SCALE);
    c.fillStyle = currentBg(); c.fillRect(0, 0, w, h);
    c.translate(-b.x1, -b.y1);
    drawContent(c);
    return off;
  }

  /* ============================================================
     LUCRĂRILE SALVATE (fila „Lucrări" din notițe)

     Aplicația nu ține minte între sesiuni nici fraza, nici marcajele: așa a
     fost gândită. De-aia o lucrare salvată își duce singură tot ce-i trebuie
     ca să fie readusă întocmai.

     Poza e doar CHIPUL din listă, micșorată dinadins: memoria browserului e
     mică, iar o captură la mărime naturală ar umple-o după câteva salvări.
     Ce se restaurează nu vine din poză, ci din starea salvată alături.
     ============================================================ */
  /* Tot ce face o lucrare să fie ea însăși. Reglajele de desen intră și ele:
     altfel, readusă peste alte reglaje, ar arăta altfel decât ai lăsat-o. */
  function lucrareaCurenta() {
    return {
      text: state.text,
      // Lățimea la care erau rupte rândurile când s-a salvat. Fără ea, o
      // lucrare deschisă pe alt ecran s-ar re-aranja, iar marcajele ar cădea
      // lângă alte cuvinte decât cele pe care le-ai însemnat.
      wrapW: latimeInghetata != null ? latimeInghetata : pageRect().w,
      shapes: JSON.parse(JSON.stringify(state.shapes)),
      view: { zoom: state.zoom, panX: state.panX, panY: state.panY },
      look: {
        fontKey: state.fontKey, fontSize: state.fontSize,
        wordSpacing: state.wordSpacing, lineSpacing: state.lineSpacing,
        markingOpacity: state.markingOpacity, bgIndex: state.bgIndex,
      },
    };
  }

  /* Aduce notița din cont și o pune pe ecran.
     Dacă în cont nu e nimic, dar în browser da, o urcăm noi o dată: altfel
     elevul care tocmai și-a făcut cont ar crede că și-a pierdut însemnările. */
  async function aduNotiteleDinCont() {
    const p = window.qwzkyBoards;
    // Întrebăm dacă puntea ȘTIE de notițe, nu doar dacă există. O punte mai
    // veche, rămasă dintr-o pagină nereîncărcată, ar fi oprit aplicația aici
    // cu o eroare, în loc să meargă mai departe cu notițele din browser.
    if (!p || typeof p.notiteCiteste !== 'function') return;
    if (!(await p.esteLogat())) return;
    const din_cont = await p.notiteCiteste();
    if (din_cont && Array.isArray(din_cont.pages) && din_cont.pages.length) {
      state.postits = din_cont;
      if (typeof state.postits.w !== 'number') state.postits.w = 0;
      if (typeof state.postits.h !== 'number') state.postits.h = 0;
      aplicaMarimeaNotitei();
      renderPostit();
      return;
    }
    const areCeva = (state.postits.pages || []).some((x) => String(x || '').trim());
    if (areCeva) p.notiteScrie(state.postits);
  }

  /* Puntea spre cont, pusă de pagină. Lipsește doar dacă aplicația e deschisă
     de una singură, în afara sitului; atunci ne purtăm ca la un vizitator. */
  const punte = () => window.qwzkyBoards || null;

  /* Numele lucrării: data și ora salvării. Numărul de ordine îl pune lista. */
  function numeleLucrarii() {
    const d = new Date(), doua = (n) => String(n).padStart(2, '0');
    return doua(d.getDate()) + '.' + doua(d.getMonth() + 1) + '.' + d.getFullYear() +
           ' (' + doua(d.getHours()) + ':' + doua(d.getMinutes()) + ')';
  }

  async function salveazaLucrarea() {
    if (!state.text.trim() && !state.shapes.length) { toast('Nu e nimic de salvat'); return; }
    const p = punte();
    if (!p || !(await p.esteLogat())) {
      // Vizitatorul nu pierde aplicația, doar lista. Îl ducem la fila
      // „Lucrări", unde scrie de ce e goală și cum se umple.
      $('postitGroup').classList.add('open');
      const t = $('ptTabWorks');
      if (t) t.click();
      toast('Intră în cont ca să-ți poți salva lucrările');
      return;
    }
    const r = await p.salveaza(numeleLucrarii(), lucrareaCurenta());
    if (!r.ok) { toast(r.motiv || 'Lucrarea nu s-a putut salva'); return; }
    $('postitGroup').classList.add('open');
    const t = $('ptTabWorks');
    if (t) t.click();
    await renderWorks();
    toast('Lucrare salvată în contul tău');
  }

  function restaureazaLucrarea(w) {
    if (!w) return;
    state.text = w.text || '';
    $('inputText').value = state.text;
    state.shapes = JSON.parse(JSON.stringify(w.shapes || []));
    selection = [];
    // Lucrările vechi n-au lățimea salvată; atunci o luăm din fereastră, ca
    // înainte, și cel puțin nu se strică nimic.
    latimeInghetata = state.shapes.length ? (w.wrapW || pageRect().w) : null;
    if (w.view) { state.zoom = w.view.zoom; state.panX = w.view.panX; state.panY = w.view.panY; }
    if (w.look) Object.assign(state, w.look);
    nextId = state.shapes.reduce((m, s) => Math.max(m, s.id || 0), 0) + 1;
    applyStateToUI();
    applyFont();
    layoutText();
    render();
    pushHistory();     // lucrarea readusă e un pas nou, deci „undo" te întoarce
    toast('Lucrare readusă pe pânză');
  }

  /* Lista vine de pe server, deci desenarea ei așteaptă răspunsul.
     Trei stări, nu una: fără cont, gol, plin. Fiecare spune limpede ce e. */
  async function renderWorks() {
    const gazda = $('postitWorks');
    if (!gazda) return;
    const nr = $('ptWorksCount');
    const p = punte();

    if (!p || !(await p.esteLogat())) {
      if (nr) nr.textContent = '';
      gazda.innerHTML =
        '<p class="works-empty">Lucrările se păstrează în contul tău, ca să le găsești de pe orice calculator.' +
        '<br><a class="works-login" href="' + ((p && p.LOGIN) || '/comunitate/login/') + '">Intră în cont</a>' +
        ' și butonul „Salvează" începe să le adune aici.</p>';
      return;
    }

    gazda.innerHTML = '<p class="works-empty">Se încarcă…</p>';
    const lista = await p.lista();
    if (nr) nr.textContent = lista.length || '';
    if (!lista.length) {
      gazda.innerHTML = '<p class="works-empty">Nicio lucrare salvată încă. Apasă „Salvează" sub pânză, iar lucrarea vine aici; o aduci înapoi cu un click.</p>';
      return;
    }
    // Serverul le dă cu cea mai nouă în frunte; noi le numerotăm în ordinea
    // salvării, deci le întoarcem: prima salvată rămâne 1 oricâte ar urma.
    gazda.innerHTML = '<ol class="works-list">' + lista.slice().reverse().map((w) =>
      '<li class="work" data-id="' + w.id + '">' +
      '<button class="work-open" data-open="' + w.id + '" title="Adu lucrarea înapoi pe pânză">' +
      String(w.title).replace(/</g, '&lt;') + '</button>' +
      '<button class="work-del" data-del="' + w.id + '" title="Șterge lucrarea" aria-label="Șterge lucrarea"></button>' +
      '</li>').join('') + '</ol>';
  }

  function downloadDataUrl(url, name) {
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function saveJpeg() {
    const url = exportCanvas().toDataURL('image/jpeg', 0.95);
    if (window.electronAPI && window.electronAPI.saveImage) {
      try {
        const r = await window.electronAPI.saveImage(url);
        if (r && r.ok) toast('Salvat: ' + r.filePath);
        else toast('Salvare anulată');
      } catch (err) { downloadDataUrl(url, 'qwzkySyntax.jpg'); toast('Imagine salvată'); }
    } else { downloadDataUrl(url, 'qwzkySyntax.jpg'); toast('Imagine salvată'); }
  }

  async function copyImg() {
    const off = exportCanvas();
    if (window.electronAPI && window.electronAPI.copyImage) {
      try { await window.electronAPI.copyImage(off.toDataURL('image/png')); toast('Copiat în clipboard'); return; }
      catch (err) { /* fallback */ }
    }
    off.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('Copiat în clipboard');
      } catch (err) { toast('Copierea imaginii nu e disponibilă aici'); }
    }, 'image/png');
  }

  /* ============================================================
     POST-IT
     ============================================================ */
  function renderPostit() {
    const body = $('postitBody');
    body.innerHTML = state.postits.pages[state.postits.cur] || '';
    body.style.fontSize = (14 * (state.postits.zoom || 1)) + 'px';
    $('ptPageLabel').textContent = (state.postits.cur + 1) + ' / ' + state.postits.pages.length;
  }
  function savePostit() {
    state.postits.pages[state.postits.cur] = $('postitBody').innerHTML;
    persist();
  }
  function tableHTML(r, c) {
    let h = '<table class="pt-table"><tbody>';
    for (let i = 0; i < r; i++) { h += '<tr>'; for (let j = 0; j < c; j++) h += '<td><br></td>'; h += '</tr>'; }
    return h + '</tbody></table><div><br></div>';
  }

  function setupPostit() {
    const group = $('postitGroup'), body = $('postitBody');
    $('postitBtn').innerHTML = svgIcon('note', 20);
    $('ptInsertTable').innerHTML = svgIcon('table', 16);
    $('ptDel').innerHTML = svgIcon('trash', 15);
    $('ptPin').innerHTML = svgIcon('pin', 15);

    for (let i = 1; i <= 6; i++) {
      const o1 = document.createElement('option'); o1.value = i; o1.textContent = i; $('ptRows').appendChild(o1);
      const o2 = document.createElement('option'); o2.value = i; o2.textContent = i; $('ptCols').appendChild(o2);
    }
    $('ptRows').value = 2; $('ptCols').value = 2;

    // COMUTATOR CURAT: butonul deschide, butonul închide, și atât.
    //
    // Înainte, panoul se închidea și la orice apăsare în afara lui, dacă nu era
    // prins cu acul. De-acolo venea neprevăzutul: alegeai o culoare, atingeai
    // pânza ca să desenezi, iar notița dispărea. Nici acul nu mai e nevoie
    // pentru asta, dar rămâne, fiindcă are alt rost: ține panoul deschis.
    const panel = $('postitPanel');
    $('postitBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      group.classList.toggle('open');
    });

    body.addEventListener('input', savePostit);
    body.addEventListener('focusout', savePostit);

    function exec(cmd, val) {
      document.execCommand('styleWithCSS', false, true);
      document.execCommand(cmd, false, val || null);
      body.focus(); savePostit();
    }
    // `mousedown` oprit peste tot: fără el, apăsarea pe buton mută cursorul din
    // text și selecția se pierde înainte să apuce comanda s-o folosească.
    const comanda = (idBtn, cmd, icon) => {
      const b = $(idBtn);
      if (!b) return;
      if (icon) b.innerHTML = svgIcon(icon, 15);
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => exec(cmd));
    };
    comanda('ptBold', 'bold');
    comanda('ptItalic', 'italic');
    comanda('ptUnderline', 'underline');
    comanda('ptAlignLeft', 'justifyLeft', 'alignLeft');
    comanda('ptAlignCenter', 'justifyCenter', 'alignCenter');
    comanda('ptAlignRight', 'justifyRight', 'alignRight');
    comanda('ptAlignJustify', 'justifyFull', 'alignJustify');
    $('ptColor').addEventListener('input', () => exec('foreColor', $('ptColor').value));
    $('ptColor').parentElement.addEventListener('mousedown', (e) => { if (e.target.tagName !== 'INPUT') e.preventDefault(); });

    $('ptInsertTable').addEventListener('mousedown', (e) => e.preventDefault());
    $('ptInsertTable').addEventListener('click', () => {
      const r = clamp(parseInt($('ptRows').value, 10) || 2, 1, 6);
      const c = clamp(parseInt($('ptCols').value, 10) || 2, 1, 6);
      body.focus();
      document.execCommand('insertHTML', false, tableHTML(r, c));
      savePostit();
    });

    $('ptZoomIn').addEventListener('click', () => { state.postits.zoom = clamp((state.postits.zoom || 1) * 1.15, 0.6, 2.4); renderPostit(); persist(); });
    $('ptZoomOut').addEventListener('click', () => { state.postits.zoom = clamp((state.postits.zoom || 1) / 1.15, 0.6, 2.4); renderPostit(); persist(); });

    $('ptPin').addEventListener('click', () => {
      postitPinned = !postitPinned;
      $('ptPin').classList.toggle('active', postitPinned);
      group.classList.toggle('pinned', postitPinned);
      if (postitPinned) group.classList.add('open');
    });

    $('ptPrev').addEventListener('click', () => { state.postits.cur = clamp(state.postits.cur - 1, 0, state.postits.pages.length - 1); renderPostit(); });
    $('ptNext').addEventListener('click', () => { state.postits.cur = clamp(state.postits.cur + 1, 0, state.postits.pages.length - 1); renderPostit(); });
    $('ptAdd').addEventListener('click', () => { state.postits.pages.push(''); state.postits.cur = state.postits.pages.length - 1; renderPostit(); persist(); });
    $('ptDel').addEventListener('click', () => {
      if (state.postits.pages.length > 1) {
        state.postits.pages.splice(state.postits.cur, 1);
        state.postits.cur = clamp(state.postits.cur, 0, state.postits.pages.length - 1);
        renderPostit(); persist();
      }
    });

    /* ---- Panoul se trage de colț ----
       Mânerul stă în colțul din stânga-jos, fiindcă panoul e agățat de
       dreapta-sus: acolo sunt cele două laturi care chiar se pot mișca.
       Mărimea se ține minte, ca notița să te aștepte cum ai lăsat-o. */
    const maner = $('ptResize');
    if (maner) {
      let de = null;
      maner.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        maner.setPointerCapture(e.pointerId);
        de = { x: e.clientX, y: e.clientY, w: panel.offsetWidth, h: $('postitBody').offsetHeight };
      });
      maner.addEventListener('pointermove', (e) => {
        if (!de) return;
        // Spre stânga înseamnă mai lat, fiindcă panoul crește dinspre dreapta.
        const w = clamp(de.w + (de.x - e.clientX), 260, 900);
        const h = clamp(de.h + (e.clientY - de.y), 90, 900);
        state.postits.w = Math.round(w);
        state.postits.h = Math.round(h);
        aplicaMarimeaNotitei();
      });
      const gata = () => { if (de) { de = null; persist(); } };
      maner.addEventListener('pointerup', gata);
      maner.addEventListener('pointercancel', gata);
    }

    /* ---- Filele: Notițe / Lucrări ---- */
    const file = [$('ptTabNotes'), $('ptTabWorks')].filter(Boolean);
    file.forEach((t) => t.addEventListener('click', () => {
      const care = t.dataset.tab;
      file.forEach((x) => x.classList.toggle('active', x === t));
      $('postitBody').hidden = care !== 'notes';
      $('postitWorks').hidden = care !== 'works';
      if (care === 'works') renderWorks();
    }));

    aplicaMarimeaNotitei();
    renderPostit();
    renderWorks();
  }

  /* Lățimea și înălțimea alese de utilizator, puse pe panou. */
  function aplicaMarimeaNotitei() {
    const panel = $('postitPanel');
    if (!panel) return;
    if (state.postits.w) panel.style.width = state.postits.w + 'px';
    const h = state.postits.h;
    if (h) {
      $('postitBody').style.height = h + 'px';
      $('postitWorks').style.height = h + 'px';
    }
  }

  /* ============================================================
     CONSTRUIRE UI
     ============================================================ */
  function makeToolButton(id) {
    const t = toolById(id);
    const b = document.createElement('button');
    b.className = 'tool-btn';
    b.dataset.tool = t.id;
    b.title = t.name;
    b.innerHTML = svgIcon(t.icon, 20);
    b.addEventListener('click', () => setTool(t.id));
    return b;
  }
  function buildToolButtons() {
    const util = $('utilTools'), shapes = $('shapeTools');
    util.innerHTML = ''; shapes.innerHTML = '';
    UTIL_TOOLS.forEach((id) => util.appendChild(makeToolButton(id)));
    SHAPE_TOOLS.forEach((id) => shapes.appendChild(makeToolButton(id)));
  }

  // Nuanță mai puternică pentru bulina de fundal (butonul iese mai bine în evidență),
  // dar fundalul aplicat pe pânză rămâne culoarea reală.
  function strongTint(hex) {
    const c = hex.replace('#', '');
    let r = parseInt(c.substr(0, 2), 16) / 255, g = parseInt(c.substr(2, 2), 16) / 255, b = parseInt(c.substr(4, 2), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    if (s < 0.08) return hex; // neutru (alb/gri/închis) — îl lăsăm cum e
    s = Math.min(1, s * 1.9 + 0.22);
    l = clamp(l, 0.42, 0.6);
    const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const R = Math.round(hue2rgb(p, q, h + 1/3) * 255), G = Math.round(hue2rgb(p, q, h) * 255), B = Math.round(hue2rgb(p, q, h - 1/3) * 255);
    const hx = (n) => n.toString(16).padStart(2, '0');
    return '#' + hx(R) + hx(G) + hx(B);
  }

  function buildDots() {
    const wrap = $('bgDots');
    wrap.innerHTML = '';
    state.bgColors.forEach((col, i) => {
      const b = document.createElement('button');
      b.className = 'dot' + (i === state.bgIndex ? ' active' : '');
      b.style.background = strongTint(col);
      b.title = 'Fundal ' + (i + 1);
      b.addEventListener('click', () => { state.bgIndex = i; buildDots(); render(); persist(); });
      wrap.appendChild(b);
    });
  }
  function setStrokeColor(col) {
    state.strokeColor = col;
    $('colorMain').value = col;
    $('colorChip').style.background = col;
    persist();
  }
  function buildFavorites() {
    const wrap = $('favWrap');
    wrap.innerHTML = '';
    state.favorites.forEach((col, i) => {
      const b = document.createElement('button');
      b.className = 'fav';
      b.style.background = col;
      b.title = 'Favorit ' + (i + 1) + ' — atinge: selectează · apăsare lungă: schimbă';
      const inp = document.createElement('input');
      inp.type = 'color'; inp.value = col; inp.className = 'fav-input';
      b.appendChild(inp);
      b.addEventListener('click', (e) => {
        if (e.target === inp) return;
        if (b._lp) { b._lp = false; return; }   // a fost apăsare lungă, nu selecție
        setStrokeColor(col);
      });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); inp.click(); });
      // apăsare lungă (tabletă) -> deschide selectorul de culoare
      let lpTimer = null;
      b.addEventListener('pointerdown', () => { lpTimer = setTimeout(() => { lpTimer = null; b._lp = true; inp.click(); }, 550); });
      const clearLp = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
      b.addEventListener('pointerup', clearLp);
      b.addEventListener('pointercancel', clearLp);
      b.addEventListener('pointerleave', clearLp);
      inp.addEventListener('input', () => {
        state.favorites[i] = inp.value; b.style.background = inp.value;
        setStrokeColor(inp.value); persist();
      });
      wrap.appendChild(b);
    });
  }

  function colorField(val, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'field-color';
    const pick = document.createElement('div'); pick.className = 'pick'; pick.style.background = val;
    const inp = document.createElement('input'); inp.type = 'color'; inp.value = val;
    const hex = document.createElement('span'); hex.className = 'hex'; hex.textContent = val;
    pick.appendChild(inp); wrap.appendChild(pick); wrap.appendChild(hex);
    inp.addEventListener('input', () => { pick.style.background = inp.value; hex.textContent = inp.value; onChange(inp.value); });
    return wrap;
  }

  // control segmentat reutilizabil pentru direcție (Înainte / Înapoi)
  function dirSeg(value, onChange) {
    const seg = document.createElement('div'); seg.className = 'seg';
    [[1, 'Înainte'], [-1, 'Înapoi']].forEach(([v, label]) => {
      const b = document.createElement('button');
      b.className = 'seg-btn' + (value === v ? ' active' : '');
      b.textContent = label;
      b.addEventListener('click', () => {
        onChange(v);
        seg.querySelectorAll('.seg-btn').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      });
      seg.appendChild(b);
    });
    return seg;
  }

  function buildSettings() {
    const bg = $('setBgWrap'); bg.innerHTML = '';
    state.bgColors.forEach((col, i) => bg.appendChild(colorField(col, (v) => { state.bgColors[i] = v; buildDots(); render(); persist(); })));

    const fav = $('setFavWrap'); fav.innerHTML = '';
    state.favorites.forEach((col, i) => fav.appendChild(colorField(col, (v) => { state.favorites[i] = v; buildFavorites(); persist(); })));

    if ($('setWheelStep')) $('setWheelStep').value = state.wheelStep;
    if ($('setStrokeWheelStep')) $('setStrokeWheelStep').value = state.strokeWheelStep;
    if ($('setStrokeWheelAmount')) $('setStrokeWheelAmount').value = state.strokeWheelAmount;

    const wd = $('setWheelDir'); if (wd) { wd.innerHTML = ''; wd.appendChild(dirSeg(state.wheelDir, (v) => { state.wheelDir = v; persist(); })); }
    const swd = $('setStrokeWheelDir'); if (swd) { swd.innerHTML = ''; swd.appendChild(dirSeg(state.strokeWheelDir, (v) => { state.strokeWheelDir = v; persist(); })); }

    const cc = $('setCarouselWrap');
    if (cc) {
      cc.innerHTML = '';
      TOOLS.filter((t) => t.id !== 'select' && t.id !== 'pan').forEach((t) => {
        const lab = document.createElement('label'); lab.className = 'check';
        const cb = document.createElement('input'); cb.type = 'checkbox';
        cb.checked = state.carouselTools.includes(t.id);
        cb.addEventListener('change', () => {
          if (cb.checked) { if (!state.carouselTools.includes(t.id)) state.carouselTools.push(t.id); }
          else state.carouselTools = state.carouselTools.filter((x) => x !== t.id);
          persist();
        });
        const sp = document.createElement('span'); sp.innerHTML = svgIcon(t.icon, 16) + t.name;
        lab.appendChild(cb); lab.appendChild(sp); cc.appendChild(lab);
      });
    }

    const seg = $('setFontFamily'); seg.innerHTML = '';
    [['serif', 'Serif'], ['sans', 'Sans'], ['mono', 'Mono']].forEach(([k, label]) => {
      const b = document.createElement('button');
      b.className = 'seg-btn' + (state.fontKey === k ? ' active' : '');
      b.textContent = label;
      b.addEventListener('click', () => { state.fontKey = k; buildSettings(); applyFont(); });
      seg.appendChild(b);
    });
  }

  /* ---------- aplicări de state ---------- */
  function applyFont() {
    $('inputText').style.fontFamily = fontCss();
    layoutText(); render(); persist();
  }
  function applyUiScale() {
    document.documentElement.style.setProperty('--ui-scale', state.uiScale.toFixed(2));
    $('uiZoomVal').textContent = Math.round(state.uiScale * 100) + '%';
  }
  function applyStateToUI() {
    const it = $('inputText');
    it.value = state.text;
    it.style.fontFamily = fontCss();
    it.style.fontSize = state.fontSize + 'px';

    $('strokeW').value = state.strokeWidth; $('strokeWVal').textContent = state.strokeWidth;
    $('wordSp').value = state.wordSpacing;  $('wordSpVal').textContent = state.wordSpacing;
    $('lineSp').value = state.lineSpacing;  $('lineSpVal').textContent = state.lineSpacing;
    $('opacity').value = Math.round(state.markingOpacity * 100);
    $('opacityVal').textContent = Math.round(state.markingOpacity * 100) + '%';

    $('colorMain').value = state.strokeColor;
    $('colorChip').style.background = state.strokeColor;
    $('czVal').textContent = Math.round(state.zoom * 100) + '%';

    applyUiScale();
    buildDots();
    buildFavorites();
  }

  /* ---------- toast ---------- */
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
  }

  /* ============================================================
     PERSISTENȚĂ
     ============================================================ */
  function serialize() {
    // NU salvăm fraza, marcajele sau vederea — acestea dispar între sesiuni.
    return {
      v:2, fontKey:state.fontKey, fontSize:state.fontSize,
      wordSpacing:state.wordSpacing, lineSpacing:state.lineSpacing, markingOpacity:state.markingOpacity,
      strokeColor:state.strokeColor, strokeWidth:state.strokeWidth, tool:state.tool,
      favorites:state.favorites, bgColors:state.bgColors, bgIndex:state.bgIndex,
      wheelStep:state.wheelStep, wheelDir:state.wheelDir,
      strokeWheelStep:state.strokeWheelStep, strokeWheelDir:state.strokeWheelDir, strokeWheelAmount:state.strokeWheelAmount,
      carouselTools:state.carouselTools, uiScale:state.uiScale,
    };
  }
  function saveNow() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(serialize())); } catch (e) {}
    saveNotes();
  }
  function persist() { clearTimeout(persistTimer); persistTimer = setTimeout(saveNow, 250); }

  /* ---- Notițele ----
     Elevul cu cont le are pe cont, deci le găsește de pe orice calculator.
     Vizitatorul le păstrează în browserul lui: e un carnet de lucru, n-are
     rost să i-l luăm doar fiindcă n-are cont.

     Scriem în browser LA FIECARE tastă, ca plasă, dar pe server mult mai rar:
     o notiță e text care curge, iar o cerere la fiecare literă ar fi și
     risipă, și încetineală. */
  var notiteTimer = null;
  function trimiteNotiteleLaCont() {
    const p = window.qwzkyBoards;
    if (!p || typeof p.notiteScrie !== 'function') return;
    clearTimeout(notiteTimer);
    notiteTimer = setTimeout(async () => {
      if (await p.esteLogat()) p.notiteScrie(state.postits);
    }, 1200);
  }

  function saveNotes() {
    trimiteNotiteleLaCont();
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(state.postits));
      return true;
    } catch (e) {
      // Memoria browserului e de vreo cinci megaocteți, iar fiecare lucrare
      // duce cu ea un chip. Când se umple, o salvare picată în tăcere ar fi
      // cel mai rău lucru: ai crede că lucrarea e la adăpost.
      toast('Nu mai e loc în memoria browserului. Șterge câteva lucrări.');
      return false;
    }
  }
  function loadNotes() {
    let n = null;
    try { n = JSON.parse(localStorage.getItem(NOTES_KEY) || 'null'); } catch (e) {}
    if (n && Array.isArray(n.pages) && n.pages.length) state.postits = n;
    // Notițele vechi n-au câmpurile noi. Le punem noi, ca restul codului să nu
    // fie nevoit să întrebe de fiecare dată dacă există. Ștergem și lucrările
    // rămase din vremea când stăteau aici: acum locul lor e în cont.
    delete state.postits.works;
    if (typeof state.postits.w !== 'number') state.postits.w = 0;
    if (typeof state.postits.h !== 'number') state.postits.h = 0;
    // curăță textele-substituent vechi salvate ca text real
    const stale = ['notițe pentru lecție…', 'notițe pentru lecție...', 'scrie notițe…', 'scrie notițe...'];
    state.postits.pages = state.postits.pages.map((p) => {
      const t = String(p == null ? '' : p).replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, ' ').trim().toLowerCase();
      return stale.includes(t) ? '' : p;
    });
    if (typeof state.postits.cur !== 'number') state.postits.cur = 0;
    state.postits.cur = clamp(state.postits.cur, 0, state.postits.pages.length - 1);
    if (typeof state.postits.zoom !== 'number') state.postits.zoom = 1;
  }

  function loadState() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) {}
    state = JSON.parse(JSON.stringify(DEFAULTS));
    if (saved && typeof saved === 'object') {
      Object.assign(state, saved);
      // fraza/marcajele/vederea pornesc mereu goale
      state.text = ''; state.shapes = []; state.zoom = 1; state.panX = 0; state.panY = 0;
      if (!state.postits || !Array.isArray(state.postits.pages) || !state.postits.pages.length)
        state.postits = JSON.parse(JSON.stringify(DEFAULTS.postits));
      if (!Array.isArray(state.favorites) || state.favorites.length < 5) state.favorites = DEFAULTS.favorites.slice();
      if (!Array.isArray(state.bgColors) || state.bgColors.length < 5) state.bgColors = DEFAULTS.bgColors.slice();
      if (!Array.isArray(state.carouselTools)) state.carouselTools = DEFAULTS.carouselTools.slice();
      if (!FONTS[state.fontKey]) state.fontKey = 'serif';
      state.bgIndex = clamp(state.bgIndex | 0, 0, 4);
      state.markingOpacity = clamp(+state.markingOpacity, 0, 1);
      state.wheelDir = state.wheelDir === -1 ? -1 : 1;
      state.strokeWheelDir = state.strokeWheelDir === -1 ? -1 : 1;
      state.wheelStep = clamp(parseInt(state.wheelStep, 10) || 3, 1, 12);
      state.strokeWheelStep = clamp(parseInt(state.strokeWheelStep, 10) || 3, 1, 12);
      state.strokeWheelAmount = clamp(parseInt(state.strokeWheelAmount, 10) || 1, 1, 6);
    }
    reId();
  }

  // Curăță textul + marcajele + vederea. NOTIȚELE NU se ating (rămân mereu). Fără confirmare.
  function performClearAll() {
    state.text = '';
    state.shapes = [];
    state.zoom = 1; state.panX = 0; state.panY = 0;
    selection = []; marquee = null; preview = null;
    history = []; hindex = -1;
    $('inputText').value = '';
    $('czVal').textContent = '100%';
    layoutText(); render();
    pushHistory();
    persist();
  }
  function clearAll() { performClearAll(); }

  // Ascunde meniurile (header, frază, reglaje, bara de jos), lasă bara de instrumente + pânza.
  function setFocusMode(on) {
    document.body.classList.toggle('focus-mode', on);
    const fb = $('btnFocus');
    if (fb) {
      fb.classList.toggle('active', on);
      fb.innerHTML = svgIcon(on ? 'focusExit' : 'focus', 20);
      fb.title = on ? 'Arată meniurile (Esc)' : 'Ascunde meniurile (lasă pânza)';
    }
    // forțează recalcularea layout-ului, apoi repictează pânza (de mai multe ori, ca să prindem sigur noua dimensiune)
    void canvasWrap.offsetHeight;
    fitCanvas();
    requestAnimationFrame(fitCanvas);
    setTimeout(fitCanvas, 60);
    setTimeout(fitCanvas, 220);
  }
  function isFocusMode() { return document.body.classList.contains('focus-mode'); }

  function openSettings()  { buildSettings(); $('settingsModal').classList.add('open'); }
  function closeSettings() { $('settingsModal').classList.remove('open'); }

  /* ============================================================
     EVENIMENTE GENERALE
     ============================================================ */
  function onTextChange() {
    state.text = $('inputText').value;
    layoutText();
    // Cât timp lucrarea încape pe ecran, o ținem la mijloc și în timp ce scrii:
    // fraza crește în ambele părți deodată, în loc să fugă spre dreapta.
    centreazaLucrarea();
    render(); persist();
  }

  const isTyping = () => {
    const a = document.activeElement;
    return !!a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT' || a.isContentEditable);
  };

  function bindEvents() {
    // canvas
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive:false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerenter', () => { pointerOverCanvas = true; $('toolBadge').style.display = 'block'; });
    canvas.addEventListener('pointerleave', () => { pointerOverCanvas = false; $('toolBadge').style.display = 'none'; });

    // text annotare (multi-rând): Enter = rând nou (ca în Word); se salvează la click în altă parte / schimbarea uneltei
    const ti = $('textInput');
    ti.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); ti.value = ''; ti.style.display = 'none'; textEditPos = null; }
      else e.stopPropagation(); // nu lăsa tastele să ajungă la scurtături când scrii
    });
    ti.addEventListener('input', sizeTextInput);
    ti.addEventListener('blur', () => { if (textInputOpen()) commitText(); });

    // input principal
    $('inputText').addEventListener('input', onTextChange);

    // panel1 tools
    $('btnPaste').innerHTML = svgIcon('paste', 15) + '<span>Lipește</span>';
    $('btnPaste').addEventListener('click', async () => {
      try {
        const t = await navigator.clipboard.readText();
        if (t) {
          const el = $('inputText');
          const s = el.selectionStart, en = el.selectionEnd, val = el.value;
          el.value = val.slice(0, s) + t + val.slice(en);
          el.selectionStart = el.selectionEnd = s + t.length;
          onTextChange();
        }
      } catch (e) { $('inputText').focus(); toast('Apasă Ctrl+V în câmpul de text'); }
    });
    $('btnFontInc').addEventListener('click', () => { state.fontSize = clamp(state.fontSize + 2, 10, 120); $('inputText').style.fontSize = state.fontSize + 'px'; layoutText(); render(); persist(); });
    $('btnFontDec').addEventListener('click', () => { state.fontSize = clamp(state.fontSize - 2, 10, 120); $('inputText').style.fontSize = state.fontSize + 'px'; layoutText(); render(); persist(); });
    $('btnClearText').addEventListener('click', () => { $('inputText').value = ''; onTextChange(); $('inputText').focus(); });

    // toolbar buttons
    $('btnUndo').innerHTML = svgIcon('undo', 20);
    $('btnRedo').innerHTML = svgIcon('redo', 20);
    $('btnClearAnnot').innerHTML = svgIcon('trash', 20);
    $('btnSettings').innerHTML = svgIcon('gear', 20);
    $('btnUndo').addEventListener('click', undo);
    $('btnRedo').addEventListener('click', redo);
    $('btnClearAnnot').addEventListener('click', () => {
      if (!state.shapes.length) return;
      state.shapes = []; selection = []; pushHistory(); render();
    });

    // color + stroke
    $('colorMain').addEventListener('input', () => setStrokeColor($('colorMain').value));
    $('strokeW').addEventListener('input', () => { state.strokeWidth = +$('strokeW').value; $('strokeWVal').textContent = state.strokeWidth; persist(); });

    // sliders sub-panel 2
    $('wordSp').addEventListener('input', () => { state.wordSpacing = +$('wordSp').value; $('wordSpVal').textContent = state.wordSpacing; layoutText(); render(); persist(); });
    $('lineSp').addEventListener('input', () => { state.lineSpacing = +$('lineSp').value; $('lineSpVal').textContent = state.lineSpacing; layoutText(); render(); persist(); });
    $('opacity').addEventListener('input', () => { state.markingOpacity = +$('opacity').value / 100; $('opacityVal').textContent = $('opacity').value + '%'; render(); persist(); });

    // canvas zoom
    $('czOut').innerHTML = svgIcon('zoomOut', 18);
    $('czIn').innerHTML = svgIcon('zoomIn', 18);
    $('czReset').innerHTML = svgIcon('fit', 18);
    $('czIn').addEventListener('click', () => zoomCenter(1.2));
    $('czOut').addEventListener('click', () => zoomCenter(1/1.2));
    $('czReset').addEventListener('click', () => {
      state.zoom = 1; state.panX = 0; state.panY = 0;
      centreazaLucrarea();
      $('czVal').textContent = '100%'; render(); persist();
    });

    // save / copy
    $('btnSave').innerHTML = svgIcon('download', 16) + '<span>JPEG</span>';
    $('btnCopy').innerHTML = svgIcon('copy', 16) + '<span>Copiază</span>';
    $('btnSave').addEventListener('click', saveJpeg);
    $('btnCopy').addEventListener('click', copyImg);
    /* ---- Întoarcerea la lecție ----
       Aplicația nu ține minte fraza și marcajele între sesiuni, deci plecarea
       de aici înseamnă pierderea lor. Înainte se pleca fără niciun cuvânt.
       Acum întreabă, iar dacă vrei să păstrezi, ai butonul „Salvează".
       Nu întreabă degeaba: pânza goală te lasă să pleci pe tăcute. */
    const inapoi = $('backLesson');
    if (inapoi) inapoi.addEventListener('click', (e) => {
      const areLucru = state.text.trim() || state.shapes.length;
      if (!areLucru) return;
      e.preventDefault();
      const ok = window.confirm(
        'Pleci de la tablă?\n\nFraza și marcajele de pe pânză nu se păstrează. ' +
        'Dacă vrei să le găsești data viitoare, apasă întâi „Salvează" (butonul galben de sub pânză).'
      );
      if (ok) location.href = inapoi.getAttribute('href');
    });

    $('btnKeep').innerHTML = svgIcon('note', 16) + '<span>Salvează</span>';
    $('btnKeep').addEventListener('click', salveazaLucrarea);

    // Un singur ascultător pe listă: lucrările se schimbă mereu, iar unul pus
    // pe fiecare poză ar trebui refăcut la fiecare desenare.
    $('postitWorks').addEventListener('click', async (e) => {
      const p = punte();
      if (!p) return;
      const del = e.target.closest('[data-del]');
      if (del) {
        if (await p.sterge(del.dataset.del)) renderWorks();
        return;
      }
      const desc = e.target.closest('[data-open]');
      if (!desc) return;
      const w = await p.deschide(desc.dataset.open);
      if (!w) { toast('Lucrarea nu s-a putut deschide'); return; }
      restaureazaLucrarea(w.data);
    });

    // Puntea se leagă după ce aplicația a pornit (modulele sunt amânate).
    // Când e gata, lista se poate desena cu adevărat.
    document.addEventListener('qwzky:boards-ready', async () => {
      renderWorks();
      await aduNotiteleDinCont();
    });

    // UI zoom
    $('uiZoomIn').addEventListener('click', () => { state.uiScale = clamp(state.uiScale + 0.05, 0.7, 1.3); applyUiScale(); persist(); });
    $('uiZoomOut').addEventListener('click', () => { state.uiScale = clamp(state.uiScale - 0.05, 0.7, 1.3); applyUiScale(); persist(); });

    // collapses
    let collapsed1 = false, prevP1 = '160px';
    $('btnCollapse1').addEventListener('click', () => {
      collapsed1 = !collapsed1;
      const root = document.documentElement;
      if (collapsed1) {
        prevP1 = getComputedStyle(root).getPropertyValue('--p1h').trim() || '160px';
        $('panel1').classList.add('collapsed');
        root.style.setProperty('--p1h', '40px');
        $('btnCollapse1').classList.add('rot');
      } else {
        $('panel1').classList.remove('collapsed');
        root.style.setProperty('--p1h', prevP1);
        $('btnCollapse1').classList.remove('rot');
      }
    });

    // ascunde/arată meniurile (cu ieșire pe Esc)
    $('btnFocus').innerHTML = svgIcon('focus', 20);
    $('btnFocus').addEventListener('click', () => setFocusMode(!isFocusMode()));

    // „Curăță tot” (text + marcaje), notițele rămân
    $('btnClearAll').innerHTML = svgIcon('clearAll', 17) + '<span>Curăță tot</span>';
    $('btnClearAll').addEventListener('click', () => clearAll());

    // click pe antetul „Frază” => focus pe câmpul de text
    $('panel1Head').addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      setTimeout(() => { try { $('inputText').focus(); } catch (err) {} }, 0);
    });

    // settings
    $('btnSettings').addEventListener('click', openSettings);
    $('btnCloseSettings').addEventListener('click', closeSettings);
    $('settingsModal').addEventListener('click', (e) => { if (e.target === $('settingsModal')) closeSettings(); });
    if ($('setWheelStep')) $('setWheelStep').addEventListener('input', () => { state.wheelStep = clamp(parseInt($('setWheelStep').value, 10) || 1, 1, 12); persist(); });
    if ($('setStrokeWheelStep')) $('setStrokeWheelStep').addEventListener('input', () => { state.strokeWheelStep = clamp(parseInt($('setStrokeWheelStep').value, 10) || 1, 1, 12); persist(); });
    if ($('setStrokeWheelAmount')) $('setStrokeWheelAmount').addEventListener('input', () => { state.strokeWheelAmount = clamp(parseInt($('setStrokeWheelAmount').value, 10) || 1, 1, 6); persist(); });

    // splitter
    let splitting = false, startY = 0, startH = 0;
    const vs = $('vsplit');
    vs.addEventListener('pointerdown', (e) => {
      splitting = true; vs.setPointerCapture(e.pointerId);
      startY = e.clientY; startH = $('panel1').getBoundingClientRect().height;
      document.body.classList.add('resizing');
    });
    window.addEventListener('pointermove', (e) => {
      if (!splitting) return;
      const h = clamp(startH + (e.clientY - startY), 64, window.innerHeight * 0.62);
      document.documentElement.style.setProperty('--p1h', h + 'px');
    });
    window.addEventListener('pointerup', () => { if (splitting) { splitting = false; document.body.classList.remove('resizing'); } });

    // keyboard
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isFocusMode()) { setFocusMode(false); return; }
        if ($('settingsModal').classList.contains('open')) { closeSettings(); return; }
        const tix = $('textInput'); if (tix && tix.style.display === 'block') { tix.style.display = 'none'; textEditPos = null; }
        if (selection.length || marquee) { selection = []; marquee = null; render(); }
        return;
      }
      if (e.code === 'Space' && !isTyping()) {
        spaceDown = true; updateCursor();
        if (document.activeElement === document.body) e.preventDefault();
      }
      if (isTyping()) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (ctrl && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selection.length) { e.preventDefault(); deleteSelected(); } return; }
      // Scurtăturile de o literă NU se declanșează decât dacă mouse-ul e pe pânză,
      // ca să nu interfereze niciodată cu scrisul în câmpul de text.
      if (!pointerOverCanvas) return;
      // „x" pentru săgeata de dedesubt: „c" era luat de sora ei de deasupra.
      const map = { v:'select', p:'pencil', r:'rect', o:'circle', l:'line', a:'arrow', c:'curvedArrow', x:'curvedArrowDown', z:'zigzag', w:'wavy', t:'text', e:'eraser' };
      const k = e.key.toLowerCase();
      if (map[k]) setTool(map[k]);
    });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') { spaceDown = false; updateCursor(); } });

    // resize
    const ro = new ResizeObserver(() => fitCanvas());
    ro.observe(canvasWrap);
    window.addEventListener('resize', fitCanvas);
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    canvas = $('canvas');
    canvasWrap = $('canvasWrap');
    ctx = canvas.getContext('2d');

    loadState();
    loadNotes();
    buildToolButtons();
    applyStateToUI();
    buildSettings();
    setupPostit();
    bindEvents();

    fitCanvas();
    requestAnimationFrame(fitCanvas);

    history = [snapshot()]; hindex = 0; updateUndoRedo();
    setTool(state.tool || 'select');

    // câmpul de text e gata de scris la pornire
    setTimeout(() => { try { $('inputText').focus(); } catch (e) {} }, 60);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
