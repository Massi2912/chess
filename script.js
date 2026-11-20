'use strict';
/* ==========================================================================
   TEIL 1: SPIELLOGIK (Regeln, Zuggenerierung)
   Brett: Array mit 64 Feldern, Index 0 = a8, 63 = h1. Figur = 'wP', 'bK' ...
   ========================================================================== */
const U = {K:'♚',Q:'♛',R:'♜',B:'♝',N:'♞',P:'♟'}; // gefüllte Symbole, Farbe per CSS
const VAL = {P:100,N:320,B:330,R:500,Q:900,K:0};
const LET = {K:'K',Q:'D',R:'T',B:'L',N:'S'};          // deutsche Figurenbuchstaben
const PNAME = {Q:'Dame',R:'Turm',B:'Läufer',N:'Springer',K:'König',P:'Bauer'};
const N8 = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const D8 = [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]; // 0-3 diagonal, 4-7 gerade
const sqn = q => 'abcdefgh'[q & 7] + (8 - (q >> 3));
const other = c => c === 'w' ? 'b' : 'w';

function startPos() {
  const b = Array(64).fill(null), back = 'RNBQKBNR';
  for (let i = 0; i < 8; i++) { b[i]='b'+back[i]; b[8+i]='bP'; b[48+i]='wP'; b[56+i]='w'+back[i]; }
  // c = Rochaderechte, ep = En-passant-Feld, hm = Halbzüge seit Schlag/Bauernzug
  return {b, t:'w', c:'KQkq', ep:-1, hm:0, fm:1};
}

// Wird Feld q von Farbe "by" angegriffen?
function att(s, q, by) {
  const r = q >> 3, c = q & 7, b = s.b;
  const at = (R, C, p) => R>=0 && R<8 && C>=0 && C<8 && b[R*8+C] === by+p;
  const pr = by === 'w' ? r+1 : r-1;
  if (at(pr,c-1,'P') || at(pr,c+1,'P')) return true;
  for (const [d,e] of N8) if (at(r+d,c+e,'N')) return true;
  for (let i = 0; i < 8; i++) {
    const [d,e] = D8[i];
    if (at(r+d,c+e,'K')) return true;
    for (let R=r+d, C=c+e; R>=0&&R<8&&C>=0&&C<8; R+=d, C+=e) {
      const p = b[R*8+C];
      if (p) { if (p[0]===by && (p[1]==='Q' || p[1]===(i<4?'B':'R'))) return true; break; }
    }
  }
  return false;
}

// Pseudolegale Züge (Königssicherheit wird erst in legal() geprüft)
function gen(s) {
  const m = [], b = s.b, t = s.t, o = other(t);
  for (let q = 0; q < 64; q++) {
    const p = b[q]; if (!p || p[0] !== t) continue;
    const r = q>>3, c = q&7, k = p[1];
    const add = (to, x) => m.push({f:q, t:to, p, cap:b[to]||null, ...x});
    if (k === 'P') {
      const d = t==='w'?-1:1, st = t==='w'?6:1, pr = t==='w'?0:7, R = r+d;
      const push = (to, x) => { if ((to>>3)===pr) for (const z of 'QRBN') add(to,{pr:z,...x}); else add(to,x); };
      if (R<0 || R>7) continue;
      if (!b[R*8+c]) { push(R*8+c); if (r===st && !b[(R+d)*8+c]) add((R+d)*8+c,{dp:1}); }
      for (const e of [-1,1]) {
        const C = c+e; if (C<0||C>7) continue;
        const to = R*8+C;
        if (b[to] && b[to][0]===o) push(to);
        else if (to === s.ep) add(to,{ep:1, cap:o+'P'}); // En passant
      }
    } else if (k==='N' || k==='K') {
      for (const [d,e] of (k==='N'?N8:D8)) {
        const R=r+d, C=c+e; if (R<0||R>7||C<0||C>7) continue;
        const to = R*8+C; if (!b[to] || b[to][0]===o) add(to);
      }
      if (k==='K' && !att(s,q,o)) { // Rochade: König nicht im Schach, Felder frei und nicht bedroht
        const ks = t==='w'?'K':'k', qs = t==='w'?'Q':'q';
        if (s.c.includes(ks) && !b[q+1] && !b[q+2] && b[q+3]===t+'R' && !att(s,q+1,o) && !att(s,q+2,o)) add(q+2,{cs:1});
        if (s.c.includes(qs) && !b[q-1] && !b[q-2] && !b[q-3] && b[q-4]===t+'R' && !att(s,q-1,o) && !att(s,q-2,o)) add(q-2,{cs:-1});
      }
    } else {
      const from = k==='R'?4:0, to2 = k==='B'?4:8;
      for (let i=from; i<to2; i++) {
        const [d,e] = D8[i];
        for (let R=r+d, C=c+e; R>=0&&R<8&&C>=0&&C<8; R+=d, C+=e) {
          const to = R*8+C;
          if (b[to]) { if (b[to][0]===o) add(to); break; }
          add(to);
        }
      }
    }
  }
  return m;
}

// Zug ausführen (liefert neuen Zustand, Original bleibt unverändert)
function mk(s, m) {
  const b = s.b.slice(), t = s.t;
  b[m.t] = m.pr ? t+m.pr : m.p; b[m.f] = null;
  if (m.ep) b[m.t + (t==='w'?8:-8)] = null;
  if (m.cs > 0) { b[m.f+1] = b[m.f+3]; b[m.f+3] = null; }
  if (m.cs < 0) { b[m.f-1] = b[m.f-4]; b[m.f-4] = null; }
  let c = s.c; const rm = x => { c = c.replace(x,''); };
  if (m.p[1]==='K') { rm(t==='w'?'K':'k'); rm(t==='w'?'Q':'q'); }
  for (const q of [m.f, m.t]) { if (q===63) rm('K'); if (q===56) rm('Q'); if (q===7) rm('k'); if (q===0) rm('q'); }
  return {b, t:other(t), c, ep: m.dp ? (m.f+m.t)/2 : -1,
          hm: (m.p[1]==='P' || m.cap) ? 0 : s.hm+1, fm: s.fm + (t==='b'?1:0)};
}

const inChk = s => att(s, s.b.indexOf(s.t+'K'), other(s.t));
// Legale Züge: eigener König darf nach dem Zug nicht angegriffen sein (deckt Fesselungen und En-passant-Fesselung ab)
function legal(s) {
  const t = s.t, o = other(t);
  return gen(s).filter(m => { const n = mk(s,m); return !att(n, n.b.indexOf(t+'K'), o); });
}

// Unzureichendes Material: K-K, K+L/S gegen K, nur Läufer auf gleichfarbigen Feldern
function insuff(b) {
  const ps = [];
  for (let q=0; q<64; q++) { const p=b[q]; if (p && p[1]!=='K') ps.push([p,q]); }
  if (!ps.length) return true;
  if (ps.some(([p]) => 'PRQ'.includes(p[1]))) return false;
  if (ps.length === 1) return true;
  return ps.every(([p]) => p[1]==='B') && new Set(ps.map(([,q]) => ((q>>3)+(q&7))&1)).size === 1;
}
const key = s => s.b.join(',') + s.t + s.c + s.ep; // für Stellungswiederholung

// Algebraische Notation (deutsch): Sf3, O-O, exd5, e8=D+
function san(s, m, lg) {
  let x = '';
  if (m.cs) x = m.cs>0 ? 'O-O' : 'O-O-O';
  else {
    const k = m.p[1];
    if (k === 'P') { if (m.cap) x = 'abcdefgh'[m.f&7] + 'x'; }
    else {
      x = LET[k];
      const amb = lg.filter(o => o.p===m.p && o.t===m.t && o.f!==m.f); // Mehrdeutigkeit auflösen
      if (amb.length) {
        if (!amb.some(o => (o.f&7)===(m.f&7))) x += 'abcdefgh'[m.f&7];
        else if (!amb.some(o => (o.f>>3)===(m.f>>3))) x += 8-(m.f>>3);
        else x += sqn(m.f);
      }
      if (m.cap) x += 'x';
    }
    x += sqn(m.t); if (m.pr) x += '=' + LET[m.pr];
  }
  const n = mk(s,m);
  if (inChk(n)) x += legal(n).length ? '+' : '#';
  return x;
}

/* ==========================================================================
   TEIL 2: KÜNSTLICHE INTELLIGENZ
   ========================================================================== */
const rows = (...r) => r.flat();
const PST = { // Positionstabellen aus Sicht von Weiss (Index 0 = a8)
  P: rows([0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],
          [0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]),
  N: rows([-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],
          [-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]),
  B: rows([-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],
          [-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]),
  R: rows(Array(8).fill(0),[5,10,10,10,10,10,10,5],Array(40).fill(0),[0,0,0,5,5,0,0,0]),
  K: rows(...Array(4).fill([-30,-40,-40,-50,-50,-40,-40,-30]),[-20,-30,-30,-40,-40,-30,-30,-20],
          [-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]),
};
// Bewertung aus Sicht von Weiss (Material, optional + Positionstabellen)
function ev(b, pst) {
  let v = 0;
  for (let q=0; q<64; q++) {
    const p = b[q]; if (!p) continue;
    const w = p[0]==='w', x = VAL[p[1]] + (pst && PST[p[1]] ? PST[p[1]][w ? q : q^56] : 0);
    v += w ? x : -x;
  }
  return v;
}
// Zugsortierung: Schläge (wertvolles Opfer, billiger Angreifer) und Umwandlungen zuerst
function order(lg) {
  const sc = m => (m.cap ? VAL[m.cap[1]]*10 - VAL[m.p[1]] : 0) + (m.pr ? 800 : 0);
  lg.sort((a,b) => sc(b) - sc(a));
}
// Negamax mit Alpha-Beta-Pruning
function search(s, d, a, b, pst, srt) {
  const lg = legal(s);
  if (!lg.length) return inChk(s) ? -99999 - d : 0; // Matt: je früher, desto besser
  if (d === 0) return (s.t==='w'?1:-1) * ev(s.b, pst);
  if (srt) order(lg);
  for (const m of lg) {
    const v = -search(mk(s,m), d-1, -b, -a, pst, srt);
    if (v >= b) return b;
    if (v > a) a = v;
  }
  return a;
}
const pick = a => a[Math.floor(Math.random()*a.length)];
function botMove(s, lvl) {
  const lg = legal(s);
  if (lvl === 'leicht') { // überwiegend zufällig, manchmal Schlag auf ungedeckte Figur
    const caps = lg.filter(m => m.cap && !att(mk(s,m), m.t, other(s.t)));
    return caps.length && Math.random() < .1 ? pick(caps) : pick(lg);
  }
  const hard = lvl === 'schwer';
  const d = hard ? 2 : 1; // bewusst flach gehalten, damit die Bots schlagbar sind
  if (Math.random() < (hard ? .04 : .25)) return pick(lg); // gelegentlicher Fehlzug
  if (hard) order(lg);
  let best = null, ba = -Infinity;
  for (const m of lg) {
    // Zufallskomponente: Bot wählt nicht immer den besten Zug
    const v = -search(mk(s,m), d-1, -Infinity, hard ? -ba : Infinity, hard, hard) + Math.random()*(hard ? 25 : 150);
    if (v > ba) { ba = v; best = m; }
  }
  return best;
}

/* ==========================================================================
   TEIL 3: BENUTZEROBERFLÄCHE
   ========================================================================== */
const $ = id => document.getElementById(id);
const board = $('board');
const LV = {leicht:'Leicht', mittel:'Mittel', schwer:'Schwer'};
const nameOf = c => c==='w' ? 'Weiss' : 'Schwarz';
const G = {tg:new Map(), hist:[], keys:[], s:startPos(), over:true, fc:52, ms:{w:0,b:0}};
const sqEl = q => board.children[G.flip ? 63-q : q];
const mat = c => G.s.b.reduce((n,p) => n + (p && p[0]===c ? VAL[p[1]] : 0), 0);
const fmt = ms => { const t = Math.max(0, Math.ceil(ms/1000)); return Math.floor(t/60) + ':' + String(t%60).padStart(2,'0'); };

function newGame() {
  G.tok = (G.tok||0) + 1; G.thinking = false; G.over = false;
  G.mode = $('mode').value; G.lvl = $('lvl').value;
  const c = $('col').value; G.human = c==='z' ? pick(['w','b']) : c;
  G.flip = G.mode==='bot' && G.human==='b'; // aus Sicht von Schwarz, wenn Spieler Schwarz wählt
  G.s = startPos(); G.hist = []; G.keys = [key(G.s)]; G.last = null; G.anim = null;
  const min = +$('time').value; G.timeOn = min > 0; G.ms = {w:min*60000, b:min*60000}; G.lt = Date.now();
  G.endT = ''; G.intro = true; G.fc = G.flip ? 11 : 52;
  document.body.classList.toggle('p2', G.mode==='2p');
  $('endDlg').close?.();
  go();
}
// Nach jedem Zug: legale Züge neu berechnen, Spielende prüfen, ggf. Bot starten
function go() {
  G.lg = legal(G.s); G.sel = null; G.tg = new Map();
  const r = result();
  if (r) return finish(r[0], r[1]);
  render(); save(); schedBot();
}
function result() {
  const s = G.s;
  if (!G.lg.length) return inChk(s) ? ['Schachmatt!', nameOf(other(s.t)) + ' gewinnt.'] : ['Patt', 'Unentschieden – kein legaler Zug möglich.'];
  if (insuff(s.b)) return ['Remis', 'Unzureichendes Material.'];
  if (s.hm >= 100) return ['Remis', '50-Züge-Regel.'];
  const k = G.keys[G.keys.length-1];
  if (G.keys.filter(x => x===k).length >= 3) return ['Remis', 'Dreifache Stellungswiederholung.'];
  return null;
}
function finish(t, r) {
  G.over = true; G.thinking = false; G.tok++; G.endT = t + ' ' + r;
  save();
  render(); endFx(t);
  $('endT').textContent = t; $('endR').textContent = r;
  setTimeout(() => { if (G.over && !$('endDlg').open) $('endDlg').showModal(); }, 600);
}
function schedBot() {
  if (G.over || G.mode!=='bot' || G.s.t===G.human) return;
  G.thinking = true; stat(); bars();
  const tk = G.tok;
  setTimeout(() => { // kurze Denkpause; Rechnen erst nach dem Zeichnen von "Bot denkt..."
    if (tk !== G.tok) return;
    const m = botMove(G.s, G.lvl);
    G.thinking = false; G.noAnim = false;
    doMove(m);
  }, 450);
}
const canMove = () => !G.over && !G.thinking && (G.mode==='2p' || G.s.t===G.human);

function doMove(m) {
  G.hist.push({s:G.s, m, sn:san(G.s, m, G.lg)});
  G.s = mk(G.s, m); G.last = m; G.anim = m; G.keys.push(key(G.s));
  go();
}
function tryMove(f, t) {
  const ms = G.lg.filter(m => m.f===f && m.t===t);
  if (!ms.length) return;
  if (ms.length === 1) return doMove(ms[0]);
  // Bauernumwandlung: Auswahldialog
  const box = $('promoBtns'); box.innerHTML = '';
  for (const z of 'QRBN') {
    const b = document.createElement('button');
    b.className = G.s.t; b.innerHTML = svg(G.s.t+z); b.setAttribute('aria-label', PNAME[z]); b.title = PNAME[z];
    b.onclick = () => { $('promo').close(); doMove(ms.find(m => m.pr===z)); };
    box.append(b);
  }
  $('promo').showModal();
}
function select(q) {
  G.sel = q; G.fc = q;
  G.tg = new Map(G.lg.filter(m => m.f===q).map(m => [m.t, !!m.cap]));
  render();
}
function activate(q) {
  if (G.sel!=null && G.tg.has(q)) return tryMove(G.sel, q);
  const p = G.s.b[q];
  if (p && p[0]===G.s.t) select(q); else { G.sel = null; G.tg = new Map(); render(); }
}

// ---- Eigene SVG-Figuren (Farben kommen per CSS-Variablen) ----
const BASE = '<path d="M8.5 40.5h28a1 1 0 0 0 1-1v-2.7h-30v2.7a1 1 0 0 0 1 1z"/><path d="M11 36.8h23l-1.2-3.6H12.2z"/><path class="hl" d="M9.5 37.6h26v1.1h-26z"/>';
const PS = { // Körper zuerst, dann Sockel, dann Licht (hl), Schatten (sh) und Details (d)
  P:'<path d="M15.5 33.2c.5-6 2.5-9 5-12h4c2.5 3 4.5 6 5 12z"/><path d="M16.5 20.3h12c.6 0 1 .4 1 1v1c0 .6-.4 1-1 1h-12c-.6 0-1-.4-1-1v-1c0-.6.4-1 1-1z"/><circle cx="22.5" cy="13" r="6"/>'+BASE+
     '<circle class="hl" cx="20.3" cy="10.8" r="2"/><path class="sh" d="M26.200 22.800c1.500 3 2.300 6 2.600 10.400h-2.800c-.2-4-.8-7-1.800-10.400z"/><path class="sh" d="M26.500 9.500a6 6 0 0 1-3 8.700 6 6 0 0 0 3-8.700z"/>',
  R:'<path d="M12.5 8.500H17V12h3V8.500h5V12h3V8.500h4.500V18l-3.800 3.200v12h-12.800v-12L12.500 18z"/>'+BASE+
     '<path class="hl" d="M13.800 9.800h2v3h-2zM17 21.800h2v11.200h-2z"/><path class="sh" d="M26.500 21.800h2.300v11.200h-2.300z"/><path class="d" d="M12.500 17.800h20"/><path class="d" d="M22.500 24.500v4.500" style="stroke-width:2.4"/>',
  N:'<path d="M14 33.2C13.500 29.500 15 26.800 18 24.800L12 27.600C10 28.400 8.200 27 8.300 25.300 8.500 23.200 10.500 20.800 13.500 17.500 16 14.800 18.800 12 20.500 9.800L21.800 5.200 25 9C30.500 10.500 35 17 35.500 25L35.500 33.200Z"/>'+BASE+
     '<path class="sh" d="M30.500 33.200c1-6 .5-12-1-17 3 2 6 5.500 6.500 9.500v7.500z"/><path class="hl" d="M13.600 18.600c2.400-2.400 4.900-5 6.600-8.100l.4 1.600c-1.700 3-4.200 5.600-6.700 8z"/>'+
     '<path class="d" d="M27 12c3 2 5.500 6.500 6 12"/><path class="d" d="M24.500 14.500c3 2.500 4.500 6 5 11"/><path class="d" d="M22 17.500c2.500 2 3.500 5 3.800 9"/>'+
     '<path class="d" d="M17.200 15.800h.01" style="stroke-width:3.4"/><path class="d" d="M10.200 24.800h.01" style="stroke-width:2.4"/><path class="d" d="M9.800 27l4.200-1.600"/>'+
     '<path class="d" d="M15.500 21c1.200 1.600 1.800 3.200 1.600 4.600"/><path class="d" d="M12.500 18.800l3.200 4.200"/><path class="d" d="M22.800 7.600l.8 1.700"/>',
  B:'<circle cx="22.5" cy="6.800" r="2.600"/><path d="M22.500 9c5.500 3.500 8 8 7.200 12.500-.4 2.500-2 4-2.500 6H17.800c-.5-2-2.100-3.500-2.500-6C14.500 17 17 12.500 22.500 9z"/><path d="M15.500 33.200v-2.200c0-1.200 1-2.200 2.200-2.200h9.600c1.200 0 2.200 1 2.200 2.200v2.200z"/>'+BASE+
     '<path class="hl" d="M18.500 18c.5-2.500 2-4.500 4-6-2 2.500-3 5.500-2.500 9z"/><path class="sh" d="M27 14.500c1.800 2.500 2.500 5.500 1.800 8.500-.3 1.700-1.100 3-1.800 4.500z"/><path class="d" d="M22.500 12.500v6"/><path class="d" d="M20 15.200h5"/><path class="d" d="M17.500 28.800h10"/>',
  Q:'<path d="M9.500 14L14 29l2-14.500 3.500 14L22.500 12.500l3 16L29 14.500l2 14.500 4.500-15-1.500 19.200H11z"/><circle cx="9.500" cy="12.500" r="2.300"/><circle cx="16" cy="12" r="2.300"/><circle cx="22.500" cy="10" r="2.700"/><circle cx="29" cy="12" r="2.300"/><circle cx="35.500" cy="12.500" r="2.300"/>'+BASE+
     '<path class="hl" d="M12 20l1.200 8-1.400.4z"/><path class="sh" d="M31.500 22.500l2.800-6.500-1.200 14.800-1.600.4z"/><path class="d" d="M11.800 30.500h21.400"/><path class="d" d="M14.500 24.500h16"/>',
  K:'<path d="M20.800 3.500h3.400v2.500h2.500v3.300h-2.500v2.500h-3.400V9.300h-2.500V6h2.500z"/><path d="M13 17c0-3 4-5 9.500-5s9.500 2 9.500 5c0 2-1 3-1.500 4.500l3 11.700h-22l3-11.700C14 20 13 19 13 17z"/>'+BASE+
     '<path class="hl" d="M15 17c1-1.500 3-2.500 5-3-2 1-3.500 2.500-4 4zM15.500 23l-1.500 9.500h1.600z"/><path class="sh" d="M30 21.500l2.800 11.700h-2.500l-1.600-11z"/><path class="d" d="M14.500 24.500h16"/><path class="d" d="M16 17c4-2 9-2 13 0"/><path class="d" d="M22.500 6v4.500M20.300 8.100h4.400"/>',
};
const svg = p => `<svg viewBox="0 0 45 45" aria-hidden="true">${PS[p[1]]}</svg>`;

// ---- Animationen (Web Animations API, respektiert "weniger Bewegung") ----
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const spawn = (sq, cls, html) => { const e = document.createElement('span'); e.className = cls; e.innerHTML = html||''; sq.append(e); return e; };
// Figur gleitet mit kleinem Hüpfer vom alten zum neuen Feld
function slide(f, t, lift) {
  const pc = sqEl(t).firstElementChild; if (!pc || calm) return;
  const a = sqEl(f).getBoundingClientRect(), z = sqEl(t).getBoundingClientRect(), dx = a.left-z.left, dy = a.top-z.top;
  pc.style.zIndex = 20;
  pc.animate([{transform:`translate(${dx}px,${dy}px) scale(1)`},
              {transform:`translate(${dx/2}px,${dy/2}px) scale(${lift})`, offset:.5},
              {transform:'none'}], {duration:340, easing:'cubic-bezier(.3,.7,.3,1)'}).onfinish = () => pc.style.zIndex = '';
}
// Funkenregen beim Schlagen
function burst(q, col) {
  if (calm) return;
  const sq = sqEl(q);
  for (let i=0; i<16; i++) {
    const d = spawn(sq, 'part'), a = Math.random()*6.28, r = sq.offsetWidth*(.5+Math.random()*.8);
    d.style.background = i%3 ? col : '#f0b432';
    d.animate([{transform:'translate(-50%,-50%) scale(1)', opacity:1},
               {transform:`translate(calc(-50% + ${Math.cos(a)*r}px),calc(-50% + ${Math.sin(a)*r}px)) scale(0)`, opacity:0}],
              {duration:450+Math.random()*350, easing:'ease-out'}).onfinish = () => d.remove();
  }
}
// Geschlagene Figur wirbelt davon
function ghost(q, p) {
  if (calm) return;
  const g = spawn(sqEl(q), 'pc ghost ' + p[0], svg(p));
  g.animate([{transform:'scale(1) rotate(0)', opacity:1}, {transform:'scale(1.7) rotate(50deg)', opacity:0}],
            {duration:500, easing:'ease-out'}).onfinish = () => g.remove();
}
const shake = () => !calm && board.animate([{transform:'none'},{transform:'translate(-4px,2px)'},{transform:'translate(4px,-2px)'},{transform:'translate(-2px,1px)'},{transform:'none'}], {duration:240});
// Effekte zum zuletzt gespielten Zug
function fx() {
  const m = G.anim, skip = G.noAnim; G.anim = null; G.noAnim = false;
  if (!m) return;
  const mover = other(G.s.t);
  if (!skip && !m.pr) slide(m.f, m.t, 1.28);
  if (m.cs) slide(m.cs>0 ? m.f+3 : m.f-4, m.cs>0 ? m.f+1 : m.f-1, 1.12); // Turm bei der Rochade
  if (m.cap) { const cq = m.ep ? m.t + (mover==='w' ? 8 : -8) : m.t; ghost(cq, m.cap); burst(cq, m.cap[0]==='w' ? '#fffdf5' : '#7a4b68'); shake(); }
  if (m.pr) { // Umwandlung: neue Figur dreht sich ein
    const pc = sqEl(m.t).firstElementChild;
    if (pc && !calm) pc.animate([{transform:'scale(0) rotate(-200deg)'},{transform:'scale(1.4) rotate(15deg)', offset:.6},{transform:'none'}], {duration:650, easing:'ease-out'});
    burst(m.t, '#f0b432');
  }
}
// Neue Partie: Figuren fallen wellenförmig aufs Brett
function intro() {
  if (calm) return;
  board.querySelectorAll('.pc').forEach((pc,i) => pc.animate(
    [{opacity:0, transform:'translateY(-150%) scale(.5) rotate(-25deg)'},{opacity:1, transform:'none'}],
    {duration:520, delay:i*16, easing:'cubic-bezier(.2,1.4,.4,1)', fill:'backwards'}));
}
function confetti() {
  const cols = ['#f0b432','#7a4b68','#fffdf5','#e0527a','#4fb3a5'];
  for (let i=0; i<80; i++) {
    const d = document.createElement('i'); d.className = 'conf';
    d.style.cssText = `left:${Math.random()*100}vw;background:${cols[i%5]}`; document.body.append(d);
    d.animate([{transform:'translate(0,-20px) rotate(0)'},{transform:`translate(${(Math.random()-.5)*240}px,105vh) rotate(${Math.random()*900}deg)`}],
      {duration:1800+Math.random()*1800, delay:Math.random()*700, easing:'ease-in', fill:'backwards'}).onfinish = () => d.remove();
  }
}
// Spielende: Verlierer-König kippt um, Konfetti für den Sieg
function endFx(t) {
  if (calm) return;
  if (t === 'Schachmatt!') {
    const k = sqEl(G.s.b.indexOf(G.s.t+'K')).firstElementChild;
    if (k) k.animate([{transform:'none'},{transform:'rotate(88deg) translate(12%,18%)'}], {duration:800, delay:450, fill:'forwards', easing:'cubic-bezier(.5,0,.9,.5)'});
  }
  if (/Schachmatt|Zeit/.test(t) && (G.mode==='2p' || G.s.t!==G.human)) confetti();
}

// ---- Rendering ----
function render() {
  const s = G.s, kq = inChk(s) ? s.b.indexOf(s.t+'K') : -1;
  board.innerHTML = '';
  for (let i=0; i<64; i++) {
    const q = G.flip ? 63-i : i, r = q>>3, c = q&7, p = s.b[q], d = document.createElement('div');
    d.className = 'sq ' + ((r+c)&1 ? 'dk' : 'lt') + (G.last && (G.last.f===q || G.last.t===q) ? ' last' : '') +
      (G.sel===q ? ' sel' : '') + (p && p[0]===s.t && canMove() ? ' mv' : '') + (G.tg.has(q) ? (G.tg.get(q) ? ' tgc' : ' tg') : '') + (q===kq ? ' chk' : '');
    d.dataset.q = q; d.setAttribute('role','gridcell'); d.tabIndex = q===G.fc ? 0 : -1;
    d.setAttribute('aria-label', sqn(q) + ', ' + (p ? nameOf(p[0]).toLowerCase() + 'er ' + PNAME[p[1]] : 'leer') +
      (G.sel===q ? ', ausgewählt' : '') + (G.tg.has(q) ? ', mögliches Ziel' : ''));
    if (i%8===0) d.dataset.r = 8-r;
    if (i>=56) d.dataset.f = 'abcdefgh'[c];
    if (p) { const e = document.createElement('span'); e.className = 'pc ' + p[0]; e.innerHTML = svg(p); d.append(e); }
    board.append(d);
  }
  if (G.kb) sqEl(G.fc).focus();
  if (G.intro) { G.intro = false; intro(); }
  fx();
  bars(); stat();
}
function bars() {
  const bot = G.flip ? 'b' : 'w', top = other(bot), bm = G.mode==='bot';
  const nm = c => bm ? (c===G.human ? 'Du' : `Bot ${LV[G.lvl]}`) : nameOf(c);
  for (const [id,c] of [['pBot',bot],['pTop',top]]) {
    const e = $(id);
    e.querySelector('.nm').textContent = bm ? `${nm(c)} (${nameOf(c)})` : nameOf(c);
    e.classList.toggle('cw', c==='w'); e.classList.toggle('cb', c==='b');
    e.classList.toggle('act', G.s.t===c && !G.over);
    const caps = G.hist.filter(h => h.m.cap && h.s.t===c).map(h => h.m.cap).sort((x,y) => VAL[y[1]]-VAL[x[1]]);
    const diff = (mat(c) - mat(other(c))) / 100;
    e.querySelector('.cp').innerHTML = caps.map(p => `<i class="${p[0]}">${svg(p)}</i>`).join('') + (diff>0 ? ` <b>+${diff}</b>` : '');
    const ck = e.querySelector('.ck'); ck.textContent = G.timeOn ? fmt(G.ms[c]) : ''; ck.classList.toggle('low', G.timeOn && G.ms[c] < 30000 && !G.over);
  }
}
function stat() {
  document.body.classList.toggle('think', !!G.thinking);
  $('status').textContent = G.over ? G.endT : G.thinking ? 'Bot denkt...' :
    nameOf(G.s.t) + ' ist am Zug' + (inChk(G.s) ? ' – Schach!' : '');
}

// ---- Eingabe: Klick, Drag & Drop, Tastatur ----
board.addEventListener('pointerdown', e => {
  const sq = e.target.closest('.sq'); G.kb = false;
  if (!sq || !canMove()) return;
  const q = +sq.dataset.q, p = G.s.b[q];
  if (G.sel!=null && G.tg.has(q)) return tryMove(G.sel, q);
  if (p && p[0]===G.s.t) { select(q); startDrag(e, q); } else activate(q);
});
function startDrag(e, q) {
  const el = sqEl(q).firstElementChild; if (!el) return;
  const x0 = e.clientX, y0 = e.clientY; let moved = false;
  const mv = ev => {
    const dx = ev.clientX-x0, dy = ev.clientY-y0;
    if (!moved && Math.hypot(dx,dy) < 6) return;
    moved = true; el.classList.add('drag'); el.style.transform = `translate(${dx}px,${dy}px)`;
  };
  const up = ev => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
    if (!moved) return;
    const sq = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.sq'), to = sq ? +sq.dataset.q : -1;
    if (G.tg.has(to)) { G.noAnim = true; tryMove(q, to); }
    else { el.classList.remove('drag'); el.style.transform = ''; }
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}
board.addEventListener('keydown', e => {
  const dir = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]}[e.key];
  G.kb = true;
  if (dir) {
    e.preventDefault();
    const i = G.flip ? 63-G.fc : G.fc;
    const x = Math.min(7, Math.max(0, (i&7)+dir[0])), y = Math.min(7, Math.max(0, (i>>3)+dir[1]));
    G.fc = G.flip ? 63-(y*8+x) : y*8+x; render();
  } else if (e.key==='Enter' || e.key===' ') { e.preventDefault(); if (canMove()) activate(G.fc); }
  else if (e.key==='Escape') { G.sel = null; G.tg = new Map(); render(); }
});

// ---- Buttons ----
$('new').onclick = $('endNew').onclick = newGame;
$('endClose').onclick = () => $('endDlg').close();
$('mode').onchange = () => document.body.classList.toggle('p2', $('mode').value==='2p');
// Einstellungen gelten sofort, solange noch kein Zug gespielt wurde (sonst erst mit "Partie starten")
document.querySelectorAll('.panel select').forEach(s => s.addEventListener('change', () => { if (!G.hist.length || G.over) newGame(); }));
// Schachuhr: läuft für die Seite am Zug
setInterval(() => {
  if (G.over || !G.timeOn) return;
  const n = Date.now(); G.ms[G.s.t] -= n - G.lt; G.lt = n;
  if (G.ms[G.s.t] <= 0) { G.ms[G.s.t] = 0; return finish('Zeit abgelaufen', nameOf(other(G.s.t)) + ' gewinnt auf Zeit.'); }
  bars();
}, 250);
// ---- Speichern: Einstellungen und laufende Partie im localStorage ----
const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem('schach.' + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('schach.' + k, JSON.stringify(v)); } catch {} }
};
// Einstellungen: müssen vor dem Bau der eigenen Auswahllisten geladen werden
const SETTINGS = ['mode', 'lvl', 'col', 'time'];
(function loadSettings() {
  const st = LS.get('settings'); if (!st) return;
  for (const id of SETTINGS) {
    const sel = $(id);
    if (typeof st[id] === 'string' && [...sel.options].some(o => o.value === st[id])) sel.value = st[id];
  }
  document.body.classList.toggle('p2', $('mode').value === '2p');
})();
const saveSettings = () => LS.set('settings', Object.fromEntries(SETTINGS.map(id => [id, $(id).value])));
SETTINGS.forEach(id => $(id).addEventListener('change', saveSettings));

// Partie: nur die Züge werden gespeichert (kompakt); Stellung, Notation und Schlagliste entstehen beim Laden durch Nachspielen
function save() {
  if (!G.mode) return;
  LS.set('game', {v:1, mode:G.mode, lvl:G.lvl, human:G.human, timeOn:G.timeOn,
    ms:{w:Math.round(G.ms.w), b:Math.round(G.ms.b)}, over:G.over, endT:G.endT,
    mv:G.hist.map(h => [h.m.f, h.m.t, h.m.pr || ''])});
}
function restore() {
  const d = LS.get('game');
  if (!d || d.v !== 1 || !Array.isArray(d.mv)) return false;
  try {
    let s = startPos(); const hist = [], keys = [key(s)];
    for (const [f, t, pr] of d.mv) {
      const lg = legal(s), m = lg.find(x => x.f===f && x.t===t && (x.pr || '')===pr);
      if (!m) return false; // beschädigte Speicherung: lieber neu starten
      hist.push({s, m, sn:san(s, m, lg)}); s = mk(s, m); keys.push(key(s));
    }
    G.tok = (G.tok||0) + 1; G.thinking = false; G.noAnim = false; G.anim = null; G.sel = null;
    G.mode = d.mode==='2p' ? '2p' : 'bot'; G.lvl = LV[d.lvl] ? d.lvl : 'mittel'; G.human = d.human==='b' ? 'b' : 'w';
    G.flip = G.mode==='bot' && G.human==='b';
    G.s = s; G.hist = hist; G.keys = keys; G.last = hist.length ? hist[hist.length-1].m : null;
    G.timeOn = !!d.timeOn; G.ms = {w:+d.ms?.w || 0, b:+d.ms?.b || 0}; G.lt = Date.now(); // Zeit bei geschlossener Seite läuft nicht weiter
    G.over = false; G.endT = ''; G.intro = false; G.fc = G.flip ? 11 : 52;
    document.body.classList.toggle('p2', G.mode==='2p');
    if (d.over) { G.over = true; G.endT = String(d.endT || ''); G.lg = legal(s); G.tg = new Map(); render(); }
    else go();
    return true;
  } catch { return false; }
}
// ---- Themes: Brett und Figuren (Farben per CSS-Variablen, Auswahl per Farbfeld im Panel) ----
const BOARDS = [
  {id:'pflaume',  n:'Pflaume',  lt:'#efe6d3', dk:'#7a4b68', fr:'#3a2340'},
  {id:'holz',     n:'Holz',     lt:'#f0d9b5', dk:'#b58863', fr:'#4a2f1a'},
  {id:'turnier',  n:'Turnier',  lt:'#eeeed2', dk:'#769656', fr:'#1f3a24'},
  {id:'eis',      n:'Eis',      lt:'#dee3e6', dk:'#7f9bab', fr:'#24384a'},
  {id:'ozean',    n:'Ozean',    lt:'#d6ecf0', dk:'#2f7f8f', fr:'#10343b'},
  {id:'schiefer', n:'Schiefer', lt:'#b8bcc4', dk:'#4b5160', fr:'#1c1f27'},
  {id:'nacht',    n:'Nacht',    lt:'#9aa5c4', dk:'#3b4678', fr:'#141a3a'},
  {id:'koralle',  n:'Koralle',  lt:'#fff1dc', dk:'#e2725b', fr:'#5a2418'},
  {id:'rose',     n:'Rosé',     lt:'#fbe4e0', dk:'#d9798a', fr:'#5a2335'},
  {id:'kontrast', n:'Hoher Kontrast', lt:'#f7f7f7', dk:'#4d4d4d', fr:'#111111'}
];
// w/b = [Füllung, Kontur, Details] für Weiss/Schwarz; sh = Stärke von [Licht Weiss, Schatten Weiss, Licht Schwarz, Schatten Schwarz]
const PIECES = [
  {id:'elfenbein', n:'Elfenbein & Ebenholz', w:['#fffdf5','#2a1b2c','#2a1b2c'], b:['#2b1a33','#0d0612','#e9dcf0'], sh:[.4,.2,.22,.35]},
  {id:'silber',    n:'Silber & Gold',        w:['#e6ebf1','#36404d','#36404d'], b:['#c28a1f','#47300a','#ffeab0'], sh:[.55,.25,.4,.3]},
  {id:'rotblau',   n:'Rot & Blau',           w:['#f2706e','#55101a','#fff1f0'], b:['#3f6fd6','#0f1f4d','#e8efff'], sh:[.4,.3,.4,.3]},
  {id:'jade',      n:'Jade & Nacht',         w:['#e7fbef','#14532d','#14532d'], b:['#1d6b52','#06231a','#d6fff0'], sh:[.5,.2,.35,.3]},
  {id:'meer',      n:'Perlmutt & Tiefsee',   w:['#e4f6ff','#0b3a5c','#0b3a5c'], b:['#0f5f8f','#04202f','#d9f2ff'], sh:[.5,.2,.35,.3]},
  {id:'kupfer',    n:'Sand & Kupfer',        w:['#ffe9d6','#5b2a12','#5b2a12'], b:['#8a3b1f','#2b0f05','#ffe3cf'], sh:[.45,.22,.3,.32]},
  {id:'violett',   n:'Flieder & Violett',    w:['#f3e8ff','#3b1a66','#3b1a66'], b:['#6d3fc4','#1e0b44','#efe3ff'], sh:[.45,.22,.3,.32]},
  {id:'flach',     n:'Flach',                w:['#ffffff','#1f1f24','#1f1f24'], b:['#26262c','#000000','#ffffff'], sh:[0,0,0,0]}
];
const LOOK = {board:BOARDS[0].id, pieces:PIECES[0].id};
const themeOf = k => (k==='board' ? BOARDS : PIECES).find(t => t.id===LOOK[k]);
const swBoard = t => `conic-gradient(${t.dk} 25%,${t.lt} 0 50%,${t.dk} 0 75%,${t.lt} 0)`;
const swPieces = t => `radial-gradient(circle at 29% 50%,${t.w[0]} 0 25%,${t.w[1]} 28% 36%,transparent 38%),radial-gradient(circle at 71% 50%,${t.b[0]} 0 25%,${t.b[1]} 28% 36%,transparent 38%),linear-gradient(135deg,#6f5a82,#3a2347)`;
function applyLook() {
  const B = themeOf('board'), P = themeOf('pieces'), st = document.body.style;
  st.setProperty('--lt', B.lt); st.setProperty('--dk', B.dk); st.setProperty('--plum', B.fr);
  [['wf','ws','wd'], ['sf','ss','sd']].forEach((names, i) => names.forEach((n, j) => st.setProperty('--' + n, P[i ? 'b' : 'w'][j])));
  ['hl-o','sh-o','hl-ob','sh-ob'].forEach((n, i) => st.setProperty('--' + n, P.sh[i]));
  // Schriftfarbe der Spielerleisten je nach Helligkeit der Figurenfarbe
  const ink = h => (parseInt(h.substr(1,2),16)*299 + parseInt(h.substr(3,2),16)*587 + parseInt(h.substr(5,2),16)*114) / 1000 >= 140 ? '#1b1020' : '#ffffff';
  st.setProperty('--wt', ink(P.w[0])); st.setProperty('--st', ink(P.b[0]));
  document.querySelectorAll('#look button').forEach(b => b.setAttribute('aria-pressed', LOOK[b.dataset.k]===b.dataset.id));
}
(function initLook() {
  const sv = LS.get('theme');
  if (sv && BOARDS.some(t => t.id===sv.board)) LOOK.board = sv.board;
  if (sv && PIECES.some(t => t.id===sv.pieces)) LOOK.pieces = sv.pieces;
  [['board','Brett',BOARDS,swBoard], ['pieces','Figuren',PIECES,swPieces]].forEach(([k, label, list, paint]) => {
    const row = document.createElement('div'), head = document.createElement('div'), sw = document.createElement('div');
    row.className = 'lk'; head.className = 'lk-h'; head.textContent = label; sw.className = 'sw';
    list.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', label + ': ' + t.n);
      b.dataset.k = k; b.dataset.id = t.id; b.style.background = paint(t);
      b.onclick = () => { LOOK[k] = t.id; applyLook(); LS.set('theme', LOOK); };
      sw.append(b);
    });
    row.append(head, sw); $('look').append(row);
  });
  applyLook();
})();

addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

// ---- Eigene Auswahllisten (statt der Standardliste des Browsers) ----
document.querySelectorAll('.panel select').forEach(sel => {
  const wrap = document.createElement('div'); wrap.className = 'dd';
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'dd-btn';
  btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
  const list = document.createElement('ul'); list.className = 'dd-list'; list.setAttribute('role', 'listbox'); list.hidden = true;
  sel.classList.add('dd-native'); sel.tabIndex = -1;
  const opts = [...sel.options];
  const sync = () => { btn.textContent = sel.selectedOptions[0].textContent; [...list.children].forEach((li,i) => li.setAttribute('aria-selected', opts[i].selected)); };
  const close = () => { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  const pickIdx = i => { sel.selectedIndex = i; sel.dispatchEvent(new Event('change')); sync(); };
  opts.forEach((o,i) => {
    const li = document.createElement('li'); li.setAttribute('role', 'option'); li.textContent = o.textContent;
    li.onclick = e => { e.preventDefault(); pickIdx(i); close(); btn.focus(); };
    list.append(li);
  });
  btn.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    if (!list.hidden) return close();
    document.querySelectorAll('.dd-list').forEach(l => l.hidden = true);
    list.hidden = false; btn.setAttribute('aria-expanded', 'true');
  };
  btn.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      pickIdx(Math.min(opts.length-1, Math.max(0, sel.selectedIndex + (e.key === 'ArrowDown' ? 1 : -1))));
    }
  });
  wrap.append(btn, list); sel.after(wrap); sync();
});
document.addEventListener('click', () => document.querySelectorAll('.dd-list').forEach(l => l.hidden = true));

// ---- Mobil: Einstellungen als Menü von unten ----
(function initMenu() {
  const set = o => { document.body.classList.toggle('menu-open', o); $('menuBtn').setAttribute('aria-expanded', String(o)); };
  $('menuBtn').onclick = () => set(!document.body.classList.contains('menu-open'));
  $('menuX').onclick = $('scrim').onclick = () => set(false);
  $('new').addEventListener('click', () => set(false));
  addEventListener('keydown', e => { if (e.key==='Escape') set(false); });
})();

G.lt = Date.now();
if (!restore()) newGame();