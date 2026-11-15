(function () {
  'use strict';
  const { FAMILIES, PIECES, COLORS } = window.SO_PIECES;
  const N = 8;

  // ---------- scoring (modelled on community descriptions of the genre's usual formula) ----------
  const PTS_PER_BLOCK = 10;          // per square placed
  const PTS_PER_LINE_CLEAR = 100;    // base value of a clearing move
  const BOARD_CLEAR_BONUS = 3000;    // emptying the whole board
  function multiLine(n) { return n >= 4 ? 10 : [0, 1, 3, 6][n]; } // 1, 2, 3, 4+ lines at once
  function streakMult(streak) { return 1 + 0.5 * (streak - 1); }  // 1st clear ×1, then ×1.5, ×2 …

  // ---------- seeded RNG ----------
  function hashStr(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    return h1 >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Each tray gets its own stream, so a reroll in one tray never shifts later trays.
  function trayRng(seed, trayNo, attempt) {
    return mulberry32(hashStr(seed + '|' + trayNo + '|' + attempt));
  }
  function pickWeighted(list, rng) {
    const total = list.reduce((s, p) => s + p.weight, 0);
    let r = rng() * total;
    for (const p of list) { r -= p.weight; if (r < 0) return p; }
    return list[list.length - 1];
  }

  // ---------- board logic ----------
  function fitsAt(board, piece, cx, cy) {
    if (cx < 0 || cy < 0 || cx + piece.w > N || cy + piece.h > N) return false;
    for (const [x, y] of piece.cells) if (board[(cy + y) * N + cx + x] !== -1) return false;
    return true;
  }
  function fitsAnywhere(board, piece) {
    for (let y = 0; y <= N - piece.h; y++)
      for (let x = 0; x <= N - piece.w; x++)
        if (fitsAt(board, piece, x, y)) return true;
    return false;
  }
  function linesIfPlaced(board, piece, cx, cy) {
    const b = board.slice();
    for (const [x, y] of piece.cells) b[(cy + y) * N + cx + x] = 0;
    const rows = [], cols = [];
    for (let i = 0; i < N; i++) {
      let r = true, c = true;
      for (let j = 0; j < N; j++) {
        if (b[i * N + j] === -1) r = false;
        if (b[j * N + i] === -1) c = false;
      }
      if (r) rows.push(i);
      if (c) cols.push(i);
    }
    return { rows, cols };
  }

  function applyMove(board, piece, cx, cy) {
    const b = board.slice();
    for (const [x, y] of piece.cells) b[(cy + y) * N + cx + x] = 0;
    const { rows, cols } = linesIfPlaced(board, piece, cx, cy);
    rows.forEach(r => { for (let i = 0; i < N; i++) b[r * N + i] = -1; });
    cols.forEach(c => { for (let i = 0; i < N; i++) b[i * N + c] = -1; });
    return b;
  }
  // Can every piece in `pieces` be placed, in some order, counting line clears in between?
  function solvable(board, pieces) {
    if (pieces.length === 0) return true;
    if (pieces.length === 1) return fitsAnywhere(board, pieces[0]);
    for (let k = 0; k < pieces.length; k++) {
      const p = pieces[k], rest = pieces.filter((_, i) => i !== k);
      for (let y = 0; y <= N - p.h; y++)
        for (let x = 0; x <= N - p.w; x++)
          if (fitsAt(board, p, x, y) && solvable(applyMove(board, p, x, y), rest)) return true;
    }
    return false;
  }

  // The solvable-tray guarantee: the ONLY board-aware rule.
  // Every new tray can be fully placed. Losing means earlier placements boxed you in.
  function rollTray(seed, trayNo, board) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const rng = trayRng(seed, trayNo, attempt);
      const tray = [0, 1, 2].map(() => makeTrayPiece(pickWeighted(PIECES, rng), rng));
      if (solvable(board, tray.map(t => t.piece))) return tray;
    }
    // Rare (crowded board): build the tray one slot at a time, each a weighted pick
    // among pieces that keep the tray solvable. A single square always qualifies.
    const rng = trayRng(seed, trayNo, 'fallback');
    const chosen = [];
    for (let i = 0; i < 3; i++) {
      const ok = PIECES.filter(p => solvable(board, chosen.concat([p])));
      chosen.push(pickWeighted(ok, rng));
    }
    return chosen.map(p => makeTrayPiece(p, rng));
  }
  function makeTrayPiece(piece, rng) {
    return { piece, color: Math.floor(rng() * COLORS.length) };
  }

  // ---------- storage ----------
  function load(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  function todaySeed() {
    const d = new Date();
    return 'daily-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function randomSeed() { return Math.random().toString(36).slice(2, 8); }

  // ---------- state ----------
  const S = {
    seed: '', board: [], tray: [], trayNo: 0, score: 0, combo: 0, miss: 0,
    placed: 0, linesCleared: 0, bestCombo: 0, over: false,
    best: load('so-best', 0),
  };
  const fx = { clears: [], pops: [], shake: 0 };

  function newGame(seed) {
    S.seed = seed;
    S.board = new Array(N * N).fill(-1);
    S.trayNo = 0; S.score = 0; S.combo = 0; S.miss = 0;
    S.placed = 0; S.linesCleared = 0; S.bestCombo = 0; S.over = false;
    S.tray = rollTray(S.seed, S.trayNo, S.board);
    fx.clears = []; fx.pops = [];
    $over.open && $over.close();
    updateHud();
  }

  function place(slot, cx, cy) {
    const t = S.tray[slot];
    if (!t || !fitsAt(S.board, t.piece, cx, cy)) return false;
    const { rows, cols } = linesIfPlaced(S.board, t.piece, cx, cy);
    for (const [x, y] of t.piece.cells) S.board[(cy + y) * N + cx + x] = t.color;
    S.tray[slot] = null;
    S.placed++;

    let gained = t.piece.cells.length * PTS_PER_BLOCK;
    const lines = rows.length + cols.length;
    if (lines > 0) {
      S.combo++; S.miss = 0;
      S.bestCombo = Math.max(S.bestCombo, S.combo);
      S.linesCleared += lines;
      const cleared = new Set();
      rows.forEach(r => { for (let i = 0; i < N; i++) cleared.add(r * N + i); });
      cols.forEach(c => { for (let i = 0; i < N; i++) cleared.add(i * N + c); });
      const now = performance.now();
      cleared.forEach(idx => { fx.clears.push({ idx, color: S.board[idx], t: now }); S.board[idx] = -1; });
      const mult = streakMult(S.combo);
      gained += Math.round(PTS_PER_LINE_CLEAR * multiLine(lines) * mult);
      let label = '+' + gained.toLocaleString();
      if (S.board.every(v => v === -1)) { gained += BOARD_CLEAR_BONUS; label = 'CLEAN SWEEP +' + gained.toLocaleString(); }
      else if (mult > 1) label += '  ×' + mult;
      fx.pops.push({ text: label, x: cx + t.piece.w / 2, y: cy + t.piece.h / 2, t: now });
      fx.shake = Math.min(12, 3 + lines * 2);
    } else {
      S.miss++;
      if (S.miss >= 3) S.combo = 0;
    }
    S.score += gained;

    if (S.tray.every(x => x === null)) {
      S.trayNo++;
      S.tray = rollTray(S.seed, S.trayNo, S.board);
    }
    if (!S.tray.some(x => x && fitsAnywhere(S.board, x.piece))) gameOver();
    updateHud();
    return true;
  }

  function gameOver() {
    S.over = true;
    if (S.score > S.best) { S.best = S.score; save('so-best', S.best); }
    if (S.seed.startsWith('daily-')) {
      const k = 'so-' + S.seed;
      if (S.score > load(k, 0)) save(k, S.score);
    }
    setTimeout(() => {
      $('#final-score').textContent = S.score.toLocaleString();
      $('#final-detail').textContent =
        `${S.placed} pieces · ${S.linesCleared} lines · best combo ×${S.bestCombo} · seed "${S.seed}"`;
      $over.showModal();
    }, 650);
  }

  // ---------- DOM / HUD ----------
  const $ = s => document.querySelector(s);
  const $over = $('#over'), $info = $('#info');
  function updateHud() {
    $('#score').textContent = S.score.toLocaleString();
    $('#best').textContent = Math.max(S.best, S.score).toLocaleString();
    $('#combo').textContent = S.combo > 0 ? '×' + streakMult(S.combo + 1) + (S.miss ? ' ' + '•'.repeat(3 - S.miss) : '') : '–';
    let line = 'Seed: ' + S.seed;
    if (S.seed.startsWith('daily-')) line += ' · today\'s best ' + load('so-' + S.seed, 0).toLocaleString();
    $('#seed-line').textContent = line;
  }

  // odds table
  (function buildOdds() {
    const total = FAMILIES.reduce((s, f) => s + f.weight, 0);
    $('#odds').innerHTML = FAMILIES.map(f =>
      `<tr><td>${f.name}</td><td>${(100 * f.weight / total).toFixed(1)}%</td></tr>`).join('');
  })();

  $('#btn-new').onclick = () => newGame(randomSeed());
  $('#btn-daily').onclick = () => newGame(todaySeed());
  $('#btn-info').onclick = () => $info.showModal();
  $('#btn-close').onclick = () => $info.close();
  $('#btn-retry').onclick = () => newGame(S.seed);
  $('#btn-again').onclick = () => newGame(randomSeed());
  $('#btn-seed').onclick = () => {
    const v = $('#seed-field').value.trim();
    if (v) { $info.close(); newGame(v); }
  };

  // ---------- canvas / layout ----------
  const cvs = $('#game');
  const ctx = cvs.getContext('2d');
  const L = { w: 0, h: 0, pad: 0, cell: 0, bx: 0, by: 0, bs: 0, ty: 0, th: 0, mini: 0 };

  function layout() {
    const w = Math.min(cvs.parentElement.clientWidth, 480);
    const pad = Math.round(w * 0.03);
    const bs = w - pad * 2;
    const cell = bs / N;
    const th = cell * 3.4;
    const h = pad + bs + th;
    const dpr = window.devicePixelRatio || 1;
    cvs.style.width = w + 'px'; cvs.style.height = h + 'px';
    cvs.width = Math.round(w * dpr); cvs.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Object.assign(L, { w, h, pad, cell, bx: pad, by: pad, bs, ty: pad + bs, th, mini: cell * 0.55 });
  }
  window.addEventListener('resize', layout);

  function slotRect(i) {
    const sw = L.w / 3;
    return { x: sw * i, y: L.ty, w: sw, h: L.th };
  }

  // ---------- drag ----------
  let drag = null; // {slot, x, y, lift, pointerId}

  function pos(e) {
    const r = cvs.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function dropCell() {
    if (!drag) return null;
    const p = S.tray[drag.slot].piece;
    const px = drag.x - (p.w * L.cell) / 2;
    const py = drag.y - drag.lift - (p.h * L.cell) / 2;
    const cx = Math.round((px - L.bx) / L.cell);
    const cy = Math.round((py - L.by) / L.cell);
    return { cx, cy, ok: fitsAt(S.board, p, cx, cy) };
  }

  cvs.addEventListener('pointerdown', e => {
    if (S.over || drag) return;
    const { x, y } = pos(e);
    if (y < L.ty) return;
    const slot = Math.min(2, Math.floor(x / (L.w / 3)));
    if (!S.tray[slot]) return;
    const p = S.tray[slot].piece;
    const lift = e.pointerType === 'mouse' ? 0 : L.cell * (p.h / 2 + 1.4);
    drag = { slot, x, y, lift, pointerId: e.pointerId };
    cvs.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  cvs.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    Object.assign(drag, pos(e));
    e.preventDefault();
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = dropCell();
    if (d && d.ok) place(drag.slot, d.cx, d.cy);
    drag = null;
  }
  cvs.addEventListener('pointerup', endDrag);
  cvs.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.pointerId) drag = null; });

  // ---------- drawing ----------
  function block(x, y, s, color, alpha = 1) {
    const r = s * 0.18, g = s * 0.06;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    roundRect(x + g, y + g, s - 2 * g, s - 2 * g, r); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    roundRect(x + g * 2, y + g * 2, s - 4 * g, (s - 4 * g) * 0.38, r * 0.7); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    roundRect(x + g, y + s - g - s * 0.16, s - 2 * g, s * 0.16, r * 0.6); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw(now) {
    ctx.clearRect(0, 0, L.w, L.h);
    let sx = 0, sy = 0;
    if (fx.shake > 0.2) { sx = (Math.random() - 0.5) * fx.shake; sy = (Math.random() - 0.5) * fx.shake; fx.shake *= 0.85; }
    ctx.save(); ctx.translate(sx, sy);

    // board background
    ctx.fillStyle = '#1e1b30';
    roundRect(L.bx - 4, L.by - 4, L.bs + 8, L.bs + 8, 14); ctx.fill();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#262240' : '#2a2646';
      roundRect(L.bx + x * L.cell + 1.5, L.by + y * L.cell + 1.5, L.cell - 3, L.cell - 3, L.cell * 0.14); ctx.fill();
    }

    // preview
    const d = drag && dropCell();
    let hl = null;
    if (d && d.ok) {
      const { rows, cols } = linesIfPlaced(S.board, S.tray[drag.slot].piece, d.cx, d.cy);
      hl = new Set();
      rows.forEach(r => { for (let i = 0; i < N; i++) hl.add(r * N + i); });
      cols.forEach(c => { for (let i = 0; i < N; i++) hl.add(i * N + c); });
    }

    // placed blocks
    for (let i = 0; i < N * N; i++) {
      if (S.board[i] === -1) continue;
      const color = hl && hl.has(i) ? COLORS[S.tray[drag.slot].color] : COLORS[S.board[i]];
      block(L.bx + (i % N) * L.cell, L.by + Math.floor(i / N) * L.cell, L.cell, color);
    }
    if (d && d.ok) {
      const t = S.tray[drag.slot];
      for (const [x, y] of t.piece.cells)
        block(L.bx + (d.cx + x) * L.cell, L.by + (d.cy + y) * L.cell, L.cell, COLORS[t.color], 0.35);
      if (hl) hl.forEach(i => {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        roundRect(L.bx + (i % N) * L.cell + 1.5, L.by + Math.floor(i / N) * L.cell + 1.5, L.cell - 3, L.cell - 3, L.cell * 0.14); ctx.fill();
      });
    }

    // clear effects
    fx.clears = fx.clears.filter(c => now - c.t < 420);
    for (const c of fx.clears) {
      const k = (now - c.t) / 420;
      const s = L.cell * (1 - k * 0.6);
      const x = L.bx + (c.idx % N) * L.cell + (L.cell - s) / 2;
      const y = L.by + Math.floor(c.idx / N) * L.cell + (L.cell - s) / 2;
      block(x, y, s, k < 0.25 ? '#ffffff' : COLORS[c.color], 1 - k);
    }

    // tray
    for (let i = 0; i < 3; i++) {
      const t = S.tray[i];
      if (!t || (drag && drag.slot === i)) continue;
      const r = slotRect(i), p = t.piece;
      const fits = fitsAnywhere(S.board, p);
      const s = Math.min(L.mini, (r.w - 16) / p.w, (r.h - 16) / p.h);
      const ox = r.x + (r.w - p.w * s) / 2, oy = r.y + (r.h - p.h * s) / 2;
      for (const [x, y] of p.cells) block(ox + x * s, oy + y * s, s, fits ? COLORS[t.color] : '#55506e', fits ? 1 : 0.6);
    }

    // dragged piece
    if (drag) {
      const t = S.tray[drag.slot], p = t.piece;
      const ox = drag.x - (p.w * L.cell) / 2, oy = drag.y - drag.lift - (p.h * L.cell) / 2;
      for (const [x, y] of p.cells) block(ox + x * L.cell, oy + y * L.cell, L.cell, COLORS[t.color], 0.95);
    }

    // score pops
    fx.pops = fx.pops.filter(pp => now - pp.t < 1100);
    for (const pp of fx.pops) {
      const k = (now - pp.t) / 1100;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = `800 ${Math.round(L.cell * 0.55)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = '#14121f';
      const x = Math.max(L.w * 0.25, Math.min(L.w * 0.75, L.bx + pp.x * L.cell));
      const y = L.by + pp.y * L.cell - k * L.cell * 1.2;
      ctx.strokeText(pp.text, x, y);
      ctx.fillStyle = '#fff'; ctx.fillText(pp.text, x, y);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    requestAnimationFrame(draw);
  }

  // ---------- boot ----------
  layout();
  newGame(todaySeed());
  requestAnimationFrame(draw);

  // exposed for tests
  window.SO_TEST = { S, place, newGame, fitsAt, fitsAnywhere, rollTray, solvable };
})();
