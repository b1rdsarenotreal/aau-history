// The national tournament of one sport and season, drawn like a TV bracket:
// four regions in the corners (the left two flowing right, the right two
// flowing left) and the finals in the middle. Regions played as single
// elimination are drawn round by round; regionals, super regionals and
// finals brackets played another way (double elimination, a series) are
// cards with their teams and games.
// Route: #/tournament/<sport>/<year>.

import { app, esc, dynasties, logoImg, seasonLabel, schoolLook } from './ui.js?v=20261112233706';
import { schoolUrl } from './school.js?v=20261112233706';

const enc = encodeURIComponent;
export const tournamentUrl = (sport, year) => `#/tournament/${enc(sport)}${year != null ? `/${year}` : ''}`;

// Bracket geometry (px): a match box, the column step and the slot step.
const BH = 50, SLOT = 66;
// Box widths for the page being drawn, fitted to the window (fitSizes):
// corner brackets use `bw` with a `gap` between rounds, one-bracket fields
// `one` with `oneGap`.
let SIZE = { bw: 146, gap: 16, one: 186, oneGap: 28 };

// Seeds 1..n in bracket order (1 v n on top, then the halves), as the apps
// pair regions and regionals.
function bracketOrder(n) {
  let o = [1, 2];
  while (o.length < n) { const m = o.length * 2; o = o.flatMap(s => [s, m + 1 - s]); }
  return o.filter(s => s <= n);
}

// The team on one side of a node: a seed of the event, or the winner or
// loser of another node.
function sideTeam(ev, byKey, s) {
  if (typeof s === 'number') return ev.s[s] ?? null;
  if (s === 'bye') return null;
  if (typeof s === 'string') {
    const i = s.indexOf(':'), k = s.slice(0, i), key = s.slice(i + 1);
    if (k === 't') return key; // a team placed by name (the one-bracket view)
    const n = byKey[key];
    if (!n) return null;
    const r = k === 'w' ? n.w : n.l;
    if (r && r !== '__bye__') return r;
    // A game against a bye: its winner is the other side, known before it's
    // "played" (and its loser is the bye).
    const byeSide = x => x === 'bye' || (typeof x === 'number' && x >= ev.s.length) || (typeof x === 'string' && x.startsWith('l:') && byKey[x.slice(2)] && byeOf(ev, byKey, byKey[x.slice(2)]));
    if (k === 'w' && (byeSide(n.a) || byeSide(n.b))) return sideTeam(ev, byKey, byeSide(n.a) ? n.b : n.a);
    return null;
  }
  return null;
}
// Whether a node is a game against a bye (a seed past the field, or the
// loser of such a game).
function byeOf(ev, byKey, n, depth = 0) {
  if (depth > 8) return false;
  if (n.l === '__bye__') return true;
  const b = x => x === 'bye' || (typeof x === 'number' && x >= ev.s.length) || (typeof x === 'string' && x.startsWith('l:') && byKey[x.slice(2)] && byeOf(ev, byKey, byKey[x.slice(2)], depth + 1));
  return b(n.a) || b(n.b);
}
const scoreOf = (g, t) => (g && g.hr != null ? (g.h === t ? g.hr : g.ar) : null);
function extraText(sport, reg, g) {
  if (!g || g.hr == null) return '';
  let s = '';
  if (g.x && reg && g.x > reg) s = sport.innings ? `${g.x} inn.` : g.x - reg > 1 ? `${g.x - reg}OT` : 'OT';
  if (g.pk) { const [h, a] = g.pk; s += `${s ? ' · ' : ''}${Math.max(h, a)}-${Math.min(h, a)} ${sport.pkWins ? 'SO' : 'PK'}`; }
  return s;
}

// An undecided side: "Winner of Game 1", "Loser of G4", or TBD.
function pending(byKey, side, ev = null) {
  if (typeof side !== 'string' || !/^[wl]:/.test(side)) return 'TBD';
  const n = byKey[side.slice(2)], name = n ? shortLabel(n) : side.slice(2);
  // The winner of a game against a bye is whoever comes from its other side.
  if (ev && n && side[0] === 'w' && byeOf(ev, byKey, n)) {
    const b = x => x === 'bye' || (typeof x === 'number' && x >= ev.s.length) || (typeof x === 'string' && x.startsWith('l:') && byKey[x.slice(2)] && byeOf(ev, byKey, byKey[x.slice(2)]));
    return pending(byKey, b(n.a) ? n.b : n.a, ev);
  }
  return `${side[0] === 'w' ? 'Winner' : 'Loser'} of ${name}`;
}
const shortLabel = n => (n.lb || n.k).replace(/\s*\((elimination|if necessary)\)/i, '');

// One match box: two rows (seed, logo, school, score), the winner bold.
function matchBox(ctx, ev, byKey, n, seedFor) {
  const ta = sideTeam(ev, byKey, n.a), tb = sideTeam(ev, byKey, n.b), g = n.g;
  // A seed past the end of the event's seeds is a bye.
  const isBye = side => side === 'bye' || (typeof side === 'number' && side >= ev.s.length);
  const row = (t, side) => {
    if (isBye(side)) return '<div class="nt-row bye"><span class="nt-seed"></span><span class="nt-logo"></span><span class="nt-name muted">Bye</span><span class="nt-score"></span></div>';
    const sc = scoreOf(g, t), won = n.w && n.w === t, lost = n.w && n.w !== t && t;
    // The winner's score sits in a box of its school's color, as in the
    // dynasty apps' brackets.
    const tc = won ? schoolLook(t).color : null;
    return `<div class="nt-row${won ? ' won' : ''}${lost ? ' lost' : ''}"${tc && /^#[0-9a-f]{3,8}$/i.test(tc) ? ` style="--tc:${tc}"` : ''}>
      <span class="nt-seed">${t ? esc(seedFor(t) ?? '') : ''}</span>
      ${t ? `<span class="nt-logo">${logoImg(t, 16)}</span><a class="nt-name" href="${schoolUrl(t, ctx.sport.id, ctx.year)}" title="${esc(t)}">${esc(t)}</a>` : `<span class="nt-name muted">${esc(pending(byKey, side, ev))}</span>`}
      <span class="nt-score">${sc ?? ''}</span></div>`;
  };
  const extra = extraText(ctx.sport, ctx.reg, g);
  return `<div class="nt-match" title="${esc(n.lb || '')}">${row(ta, n.a)}${row(tb, n.b)}${extra ? `<span class="nt-extra">${esc(extra)}</span>` : ''}</div>`;
}

// A single-elimination event drawn as a bracket. Every first-round game and
// every team with a bye takes a slot; a later game sits halfway between the
// two it comes from. `mirror` flows right to left.
export function bracketHtml(ctx, ev, seedFor, { mirror = false, title = '', wide = false, bw = 0 } = {}) {
  // A wide bracket (the one-bracket view) gets its own, wider boxes; `bw`
  // sets the width outright (conference pages).
  const BW = bw || (wide ? SIZE.one : SIZE.bw), CW = BW + (bw || wide ? SIZE.oneGap : SIZE.gap);
  // A game against a bye isn't drawn (the owner's call): the team with the
  // bye starts in the next round, next to an empty slot.
  const bye = x => x === 'bye' || (typeof x === 'number' && x >= ev.s.length);
  const nodes = ev.nodes.filter(n => !n.cond && !bye(n.a) && !bye(n.b));
  if (!nodes.length) return '';
  const byKey = Object.fromEntries(ev.nodes.map(n => [n.k, n]));
  const drawn = new Set(nodes.map(n => n.k));
  const fed = new Set(nodes.flatMap(n => [n.a, n.b]).filter(s => typeof s === 'string' && s.startsWith('w:')).map(s => s.slice(2)));
  const roots = nodes.filter(n => !fed.has(n.k));
  const minDp = Math.min(...nodes.map(n => n.dp || 1));
  let slot = 0;
  const pos = {};
  const place = n => {
    const sides = [n.a, n.b];
    const kids = sides.map(s => (typeof s === 'string' && s.startsWith('w:') && drawn.has(s.slice(2)) ? byKey[s.slice(2)] : null));
    let y;
    if (!kids.some(Boolean)) y = slot++;
    else {
      const ys = kids.map(k => (k ? place(k) : slot++));
      y = (ys[0] + ys[1]) / 2;
    }
    pos[n.k] = { x: (n.dp || 1) - minDp, y };
    return y;
  };
  roots.forEach(place);
  const cols = Math.max(...Object.values(pos).map(p => p.x)) + 1;
  const W = (cols - 1) * CW + BW, H = Math.max(slot, 1) * SLOT - (SLOT - BH);
  const top = p => p.y * SLOT;
  // Elbow lines from each game to the row it feeds in the next one.
  const lines = [];
  for (const n of nodes) {
    const p = pos[n.k];
    [n.a, n.b].forEach((s, i) => {
      if (!(typeof s === 'string' && s.startsWith('w:')) || !pos[s.slice(2)]) return;
      const c = pos[s.slice(2)];
      const x1 = c.x * CW + BW, y1 = top(c) + BH / 2, x2 = p.x * CW, y2 = top(p) + (i ? BH * 0.75 : BH * 0.25), xm = (x1 + x2) / 2;
      lines.push(`M${x1} ${y1}H${xm}V${y2}H${x2}`);
    });
  }
  const rounds = [...new Set(nodes.map(n => n.dp || 1))].sort((a, b) => a - b).map(d => nodes.find(n => (n.dp || 1) === d)?.lb || '');
  return `<div class="nt-bracket${mirror ? ' mirror' : ''}">
    ${title}
    <div class="nt-rounds" style="width:${W}px">${rounds.map((r, i) => `<span style="left:${i * CW}px;width:${BW}px">${esc(r)}</span>`).join('')}</div>
    <div class="nt-tree" style="width:${W}px;height:${H}px">
      <svg class="nt-lines" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${lines.join('')}"/></svg>
      ${nodes.map(n => { const p = pos[n.k]; return `<div class="nt-slot" style="left:${p.x * CW}px;top:${top(p)}px;--bw:${BW}px">${matchBox(ctx, ev, byKey, n, seedFor)}</div>`; }).join('')}
    </div></div>`;
}

// A regional, super regional or finals bracket played some other way
// (double elimination, a series): its teams with their record there, and
// its games.
export function eventCard(ctx, ev, seedFor, title) {
  const byKey = Object.fromEntries(ev.nodes.map(n => [n.k, n]));
  const played = ev.nodes.filter(n => n.g && n.g.hr != null);
  const recs = Object.fromEntries(ev.s.map(t => [t, { w: 0, l: 0 }]));
  for (const n of played) { if (recs[n.w]) recs[n.w].w++; if (recs[n.l]) recs[n.l].l++; }
  const teams = ev.s.map((t, i) => `<div class="nt-row${ev.c === t ? ' won' : ev.c ? ' lost' : ''}">
    <span class="nt-seed">${esc(seedFor(t, i) ?? '')}</span><span class="nt-logo">${logoImg(t, 16)}</span>
    <a class="nt-name" href="${schoolUrl(t, ctx.sport.id, ctx.year)}">${esc(t)}</a>
    <span class="nt-score small">${recs[t].w}-${recs[t].l}</span></div>`).join('');
  const gameLine = n => {
    const g = n.g, ta = sideTeam(ev, byKey, n.a), tb = sideTeam(ev, byKey, n.b);
    const w = n.w, l = n.w === ta ? tb : ta;
    const ex = extraText(ctx.sport, ctx.reg, g);
    return `<li><span class="muted">${esc(n.lb || n.k)}:</span> ${esc(w)} ${scoreOf(g, w)}, ${esc(l)} ${scoreOf(g, l)}${ex ? ` <span class="muted">(${esc(ex)})</span>` : ''}</li>`;
  };
  return `<div class="nt-card">
    <div class="nt-card-head">${title}</div>
    <div class="nt-match">${teams}</div>
    ${played.length ? `<details class="nt-games"><summary>${played.length} ${ctx.sport.unit === 'match' ? 'match' : 'game'}${played.length > 1 ? (ctx.sport.unit === 'match' ? 'es' : 's') : ''}</summary><ol>${played.map(gameLine).join('')}</ol></details>` : ''}
  </div>`;
}

// Double elimination (a softball or baseball regional, a World Series
// bracket, a conference tournament): the winners' bracket on top, the
// elimination bracket under it, the final at the right between them and the
// "if necessary" game under the final. Each box carries its game's name;
// a team that dropped down shows as "Loser of Game 1" until it's decided.
export const isDouble = ev => ev.k !== 'single' && ev.nodes.some(n => n.sec === 'L');
const DE_SLOT = 76, DE_TOP = 40, DE_GAP = 52;
// Games against a bye in a double-elimination bracket: a seed past the
// field, and every elimination game fed by the loser of one (whose loser is
// a bye too). They aren't drawn (the owner's rule): the team starts where
// its first real game is.
function byeGames(ev) {
  const byKey = Object.fromEntries(ev.nodes.map(n => [n.k, n]));
  const out = new Set();
  const isBye = x => x === 'bye' || (typeof x === 'number' && x >= ev.s.length) || (typeof x === 'string' && x.startsWith('l:') && out.has(x.slice(2)));
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of ev.nodes) if (!out.has(n.k) && (isBye(n.a) || isBye(n.b) || n.l === '__bye__')) { out.add(n.k); grew = true; }
  }
  return out;
}
function deLayout(ev) {
  const byKey = Object.fromEntries(ev.nodes.map(n => [n.k, n]));
  const hidden = byeGames(ev);
  const pos = {};
  let maxX = 0;
  const lay = (sec, y0) => {
    const nodes = ev.nodes.filter(n => n.sec === sec && !n.cond && !hidden.has(n.k));
    const c0 = nodes.length ? Math.min(...nodes.map(n => n.col ?? 0)) : 0; // a column of byes drops out
    const inSec = new Set(nodes.map(n => n.k));
    const kidsOf = n => [n.a, n.b].map(x => (typeof x === 'string' && x.startsWith('w:') && inSec.has(x.slice(2)) ? byKey[x.slice(2)] : null));
    const fed = new Set(nodes.flatMap(n => kidsOf(n).filter(Boolean).map(k => k.k)));
    let slot = 0;
    const place = n => {
      if (pos[n.k]) return pos[n.k].slot;
      const kids = kidsOf(n).filter(Boolean);
      const y = kids.length ? kids.map(place).reduce((a, b) => a + b, 0) / kids.length : slot++;
      pos[n.k] = { x: (n.col ?? 0) - c0, slot: y, sec };
      maxX = Math.max(maxX, (n.col ?? 0) - c0);
      return y;
    };
    nodes.filter(n => !fed.has(n.k)).forEach(place);
    for (const n of nodes) if (pos[n.k]) pos[n.k].y = y0 + pos[n.k].slot * DE_SLOT;
    const roots = nodes.filter(n => !fed.has(n.k));
    return { slots: Math.max(slot, 1), root: roots[roots.length - 1] };
  };
  const W = lay('W', DE_TOP);
  const lTop = DE_TOP + W.slots * DE_SLOT + DE_GAP;
  const L = lay('L', lTop);
  const fx = maxX + 1;
  const fin = ev.nodes.filter(n => !hidden.has(n.k) && (n.sec === 'F' || (!n.sec && !pos[n.k])));
  const wy = W.root ? pos[W.root.k].y : DE_TOP, ly = L.root ? pos[L.root.k].y : lTop;
  let fy = (wy + ly) / 2;
  for (const n of fin) { pos[n.k] = { x: fx, y: fy, sec: 'F' }; fy += DE_SLOT + 6; }
  const H = Math.max(...Object.values(pos).map(p => p.y)) + BH + 4;
  return { pos, byKey, cols: fx + 1, H, lTop };
}
export const deCols = ev => deLayout(ev).cols;
export function deBracketHtml(ctx, ev, seedFor, { mirror = false, title = '', bw = 0 } = {}) {
  const BW = bw || SIZE.bw, CW = BW + SIZE.oneGap;
  const { pos, byKey, cols, H, lTop } = deLayout(ev);
  const W = (cols - 1) * CW + BW;
  const lines = [];
  for (const n of ev.nodes) {
    const p = pos[n.k];
    if (!p || n.cond) continue;
    [n.a, n.b].forEach((x, i) => {
      if (!(typeof x === 'string' && x.startsWith('w:')) || !pos[x.slice(2)]) return;
      const c = pos[x.slice(2)];
      const x1 = c.x * CW + BW, y1 = c.y + BH / 2, x2 = p.x * CW, y2 = p.y + (i ? BH * 0.75 : BH * 0.25), xm = x1 + (x2 - x1) / 2;
      lines.push(`M${x1} ${y1}H${xm}V${y2}H${x2}`);
    });
  }
  const label = (txt, y) => `<div class="nt-slot nt-sec" style="left:0;top:${y}px;--bw:${W}px"><span>${esc(txt)}</span></div>`;
  const box = n => {
    const p = pos[n.k];
    const skipped = n.cond && !n.g && (ev.c || n.w == null) && ev.c;
    return `<div class="nt-slot de${n.cond ? ' ifnec' : ''}${skipped ? ' skipped' : ''}" style="left:${p.x * CW}px;top:${p.y}px;--bw:${BW}px"><div class="nt-glabel">${esc(n.cond ? (skipped ? 'If necessary (not needed)' : `${shortLabel(n)}, if necessary`) : (n.lb || n.k))}</div>${matchBox(ctx, ev, byKey, n, seedFor)}</div>`;
  };
  return `<div class="nt-bracket de-bracket${mirror ? ' mirror' : ''}">
    ${title}
    <div class="nt-tree" style="width:${W}px;height:${H}px">
      <svg class="nt-lines" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${lines.join('')}"/></svg>
      ${label("Winners' bracket", 0)}${label('Elimination bracket', lTop - DE_TOP + 4)}
      ${ev.nodes.filter(n => pos[n.k]).map(box).join('')}
    </div></div>`;
}

const evTitle = (ev, fallback) => `<b>${esc(ev.n || fallback)}</b>${ev.v ? `<span class="muted small"> · ${esc(ev.v)}</span>` : ev.home ? '<span class="muted small"> · at the higher seed\'s home</span>' : ''}`;

// One event at a corner: a bracket for single elimination, else a card.
function cornerEvent(ctx, ev, mirror, natSeed) {
  if (ev.k === 'single') {
    const seedFor = t => { const i = ev.s.indexOf(t); return i >= 0 ? i + 1 : ''; };
    return bracketHtml(ctx, ev, seedFor, { mirror, title: `<div class="nt-ev-title">${evTitle(ev, 'Region')}${ev.c ? `<span class="nt-ev-champ">${logoImg(ev.c, 16)} ${esc(ev.c)}</span>` : ''}</div>` });
  }
  if (isDouble(ev)) {
    const seedFor = t => { const i = ev.s.indexOf(t); return i >= 0 ? i + 1 : ''; };
    return deBracketHtml(ctx, ev, seedFor, { mirror, title: `<div class="nt-ev-title">${evTitle(ev, 'Regional')}${ev.c ? `<span class="nt-ev-champ">${logoImg(ev.c, 16)} ${esc(ev.c)}</span>` : ''}</div>` });
  }
  const seedFor = (t, i) => (i != null ? `${i + 1}${natSeed[t] ? ` · #${natSeed[t]}` : ''}` : natSeed[t] ?? '');
  return eventCard(ctx, ev, seedFor, evTitle(ev, ev.st === 'sup' ? 'Super regional' : 'Regional'));
}

// The finals in the middle: semifinals either side of the final, or the
// finals brackets and the championship series.
function centerHtml(ctx, s, nt, natSeed) {
  const fin = nt.events.find(e => e.st === 'fin');
  const champ = s.champion ? `<div class="nt-champion"><span class="nt-trophy">🏆</span>${logoImg(s.champion, 44)}<div><div class="small muted">National champion</div><a href="${schoolUrl(s.champion, ctx.sport.id, ctx.year)}"><b>${esc(s.champion)}</b></a></div></div>` : '';
  const head = `<div class="nt-center-head"><img class="nt-mark" src="img/aau-block.svg" alt=""><div class="nt-finals-name">${esc(s.finalsName || ctx.sport.finals)}</div>${s.venue ? `<div class="small muted">${esc(s.venue)}</div>` : ''}</div>`;
  const seedFor = t => natSeed[t] ?? '';
  if (fin && fin.k === 'single') {
    const byKey = Object.fromEntries(fin.nodes.map(n => [n.k, n]));
    const live = fin.nodes.filter(n => !n.cond);
    const maxDp = Math.max(...live.map(n => n.dp || 1));
    const final = live.find(n => (n.dp || 1) === maxDp);
    const semis = live.filter(n => (n.dp || 1) === maxDp - 1);
    if (live.length === 3 && final && semis.length === 2) {
      const box = (n, label) => `<div class="nt-fbox"><div class="nt-flabel">${esc(label)}</div>${matchBox(ctx, fin, byKey, n, seedFor)}</div>`;
      return `<div class="nt-center">${head}${champ}<div class="nt-final4">${box(semis[0], n0(semis[0]))}${box(final, 'Championship')}${box(semis[1], n0(semis[1]))}</div></div>`;
    }
    // Any other size (a whole field at one site): the full bracket.
    return `<div class="nt-center wide">${head}${champ}${bracketHtml(ctx, fin, seedFor, { wide: true })}</div>`;
  }
  const brackets = nt.events.filter(e => e.st === 'finb');
  const series = nt.events.find(e => e.st === 'fins');
  const seedNat = t => natSeed[t] ?? '';
  return `<div class="nt-center">${head}${champ}<div class="nt-finb">
    ${brackets.map((e, i) => (isDouble(e) ? deBracketHtml(ctx, e, seedNat, { title: `<div class="nt-ev-title"><b>Bracket ${esc(e.b || i + 1)}</b>${e.c ? `<span class="nt-ev-champ">${logoImg(e.c, 16)} ${esc(e.c)}</span>` : ''}</div>` }) : eventCard(ctx, e, seedNat, `<b>Bracket ${esc(e.b || i + 1)}</b>`))).join('')}
    ${series ? eventCard(ctx, series, seedNat, '<b>Championship series</b>') : ''}</div></div>`;
}
// The one-bracket view: the finals' heading and champion over the whole bracket.
function oneHtml(ctx, s, ev, natSeed) {
  const champ = s.champion ? `<div class="nt-champion"><span class="nt-trophy">🏆</span>${logoImg(s.champion, 44)}<div><div class="small muted">National champion</div><a href="${schoolUrl(s.champion, ctx.sport.id, ctx.year)}"><b>${esc(s.champion)}</b></a></div></div>` : '';
  const head = `<div class="nt-center-head"><img class="nt-mark" src="img/aau-block.svg" alt=""><div class="nt-finals-name">${esc(s.finalsName || ctx.sport.finals)}</div>${s.venue ? `<div class="small muted">${esc(s.venue)}</div>` : ''}${ev.home ? '<div class="small muted">Earlier rounds at the higher seed\'s home</div>' : ''}</div>`;
  return `<div class="nt-center wide">${head}${champ}${bracketHtml(ctx, ev, t => natSeed[t] ?? '', { wide: true })}</div>`;
}
const n0 = n => (n.lb && /semi/i.test(n.lb) ? 'National semifinal' : n.lb || 'Semifinal');

// Regions (or regionals and super regionals) by corner. With P paths the
// bracket order 1, P, P/2, ... is cut into four: top left, bottom left, top
// right, bottom right, so the left side meets in one semifinal.
function corners(nt) {
  const regs = nt.events.filter(e => e.st === 'reg').sort((a, b) => (a.p ?? 0) - (b.p ?? 0));
  const sups = nt.events.filter(e => e.st === 'sup');
  const P = regs.length;
  const out = [[], [], [], []];
  if (!P) return out;
  const order = bracketOrder(P);
  const per = Math.max(1, Math.ceil(P / 4));
  const cornerOf = p => Math.min(3, Math.floor(order.indexOf(p + 1) / per));
  for (const e of regs) out[cornerOf(e.p ?? regs.indexOf(e))].push(e);
  for (const e of sups) {
    const r = regs.find(x => e.s.includes(x.c));
    out[r ? cornerOf(r.p ?? regs.indexOf(r)) : 0].push(e);
  }
  return out;
}

// A field of ONE_BRACKET_MAX teams or fewer is drawn as one bracket, regions
// and finals together (the owner's call, Nov. 2026), when every region and
// the finals are single elimination. Regions keep their paths: path k feeds
// the finals' seed k. Every team shows its national seed.
const ONE_BRACKET_MAX = 12;
function oneBracket(nt) {
  const regs = nt.events.filter(e => e.st === 'reg');
  const fin = nt.events.find(e => e.st === 'fin');
  if (nt.field.length > ONE_BRACKET_MAX || !regs.length || !fin || fin.k !== 'single' || nt.events.some(e => e.st === 'sup') || regs.some(e => e.k !== 'single')) return null;
  const nodes = [], rootOf = {};
  let depth = 0;
  for (const r of regs) {
    const p = r.p ?? regs.indexOf(r);
    const live = r.nodes.filter(n => !n.cond);
    const side = x => (typeof x === 'number' ? (x < r.s.length ? `t:${r.s[x]}` : 'bye') : typeof x === 'string' ? `${x.slice(0, 2)}${p}.${x.slice(2)}` : x);
    const fed = new Set(live.flatMap(n => [n.a, n.b]).filter(x => typeof x === 'string' && x.startsWith('w:')).map(x => x.slice(2)));
    for (const n of live) {
      nodes.push({ ...n, k: `${p}.${n.k}`, a: side(n.a), b: side(n.b) });
      if (!fed.has(n.k)) rootOf[p] = `${p}.${n.k}`;
      depth = Math.max(depth, n.dp || 1);
    }
  }
  for (const n of fin.nodes.filter(x => !x.cond)) {
    const side = x => (typeof x === 'number' ? (rootOf[x] ? `w:${rootOf[x]}` : 'bye') : typeof x === 'string' ? `${x.slice(0, 2)}F.${x.slice(2)}` : x);
    nodes.push({ ...n, k: `F.${n.k}`, a: side(n.a), b: side(n.b), dp: (n.dp || 1) + depth });
  }
  return { s: [], nodes, k: 'single', home: regs.every(r => r.home) };
}

// Rounds a bracket draws (games against a bye aren't drawn).
function drawnCols(ev) {
  const bye = x => x === 'bye' || (typeof x === 'number' && x >= ev.s.length);
  return new Set(ev.nodes.filter(n => !n.cond && !bye(n.a) && !bye(n.b)).map(n => n.dp || 1)).size;
}
// The width the longest school name needs, in a match box's bold 12.5px
// type, plus the box's seed, logo, score and padding.
let measureCtx = null;
export function nameNeed(names) {
  measureCtx ||= document.createElement('canvas').getContext('2d');
  measureCtx.font = "700 12.5px 'Inter', system-ui, sans-serif";
  return Math.ceil(Math.max(80, ...names.map(t => measureCtx.measureText(t).width))) + 80;
}
// Box widths that fill the page: as wide as fits (up to a limit), and never
// narrower than the longest school name needs (the page scrolls sideways
// then).
function fitSizes(nt, one, corners4) {
  const cs = getComputedStyle(app);
  const avail = Math.max(300, (app.clientWidth || window.innerWidth) - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0) - 16);
  const need = nameNeed(nt.field.map(f => f[0])), extra = grow.key === growKey() ? grow.px : 0;
  const fit = (total, lo, hi) => { let bw = hi; while (bw > lo && total(bw) > avail) bw -= 2; return bw; };
  if (one) {
    const cols = drawnCols(one);
    const bw = fit(w => (cols - 1) * (w + SIZE.oneGap) + w + 40, 150, 320);
    return { ...SIZE, one: Math.max(bw, need) + extra };
  }
  const evs = corners4.flat(), cards = evs.some(e => e.k !== 'single' && !isDouble(e));
  const cols = Math.max(1, ...evs.filter(e => e.k === 'single').map(drawnCols));
  const deC = Math.max(0, ...evs.filter(isDouble).map(deCols));
  const deW = (w, c) => (c - 1) * (w + SIZE.oneGap) + w;
  const cornerW = w => Math.max(cards ? w + 40 : 0, (cols - 1) * (w + SIZE.gap) + w, deC ? deW(w, deC) : 0);
  const fin = nt.events.find(e => e.st === 'fin');
  const finb = nt.events.filter(e => e.st === 'finb'), finDe = Math.max(0, ...finb.filter(isDouble).map(deCols));
  const centerW = w => (fin && fin.k === 'single' ? Math.max(230, w + 64) : finDe ? 2 * deW(w, finDe) + 14 + 34 : 2 * (w + 40) + 14 + 34);
  // Double-elimination regionals are wide: the finals go on top, the
  // corners under them (the board's 'tall' layout).
  const stacked = window.innerWidth <= 900 || tallBoard(corners4); // corners stack under the finals
  const total = w => (window.innerWidth <= 900 ? Math.max(cornerW(w), centerW(w)) : stacked ? Math.max(centerW(w), 2 * cornerW(w) + 22) : 2 * cornerW(w) + centerW(w) + 52);
  const bw = fit(total, 130, 300);
  return { ...SIZE, bw: Math.max(bw, need) + extra, one: Math.max(bw, need) + extra };
}

const tallBoard = corners4 => corners4.flat().some(isDouble);

// The canvas guess at a name's width can fall short of the page's own type;
// after drawing, any name still cut off widens the boxes by what's missing
// and the bracket is drawn once more (remembered for this page and width).
let grow = { key: '', px: 0 };
const growKey = () => `${location.hash}|${window.innerWidth}`;

export function renderTournament(parts = [], again = false) {
  if (!again && grow.key !== growKey()) grow = { key: '', px: 0 };
  const ds = dynasties().filter(d => Object.values(d.years).some(s => s.champion || s.fieldSize));
  if (!ds.length) { app.innerHTML = '<div class="empty">Upload a dynasty backup on the Data page to see its national tournaments.</div>'; return; }
  const d = ds.find(x => x.sport.id === parts[0]) || ds[0];
  const years = Object.keys(d.years).map(Number).filter(y => d.years[y].fieldSize).sort((a, b) => b - a);
  const year = years.includes(+parts[1]) ? +parts[1] : years[0];
  const s = d.years[year];
  const pick = `<div class="nt-pick">
    <select id="nt-sport" aria-label="Sport">${ds.map(x => `<option value="${esc(x.sport.id)}" ${x === d ? 'selected' : ''}>${esc(x.sport.name)}</option>`).join('')}</select>
    <select id="nt-year" aria-label="Season">${years.map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${seasonLabel(y)}</option>`).join('')}</select></div>`;
  const headline = `<div class="section-head nt-head"><div><div class="small muted nt-kicker">${esc(d.sport.name)}</div><h1>${s ? `${seasonLabel(year)} AAU National Tournament` : 'AAU National Tournament'}</h1></div>${pick}</div>`;
  let body;
  if (!s) body = `<div class="empty">No national tournament in the ${esc(d.sport.name)} history yet.</div>`;
  else if (!s.nt) body = `<div class="empty">This season was saved before AAU History kept brackets. Upload the ${esc(d.sport.name)} backup again on the Data page to see the ${seasonLabel(year)} bracket.</div>`;
  else {
    const ctx = { sport: d.sport, year, reg: s.reg || d.sport.reg || null };
    const natSeed = Object.fromEntries(s.nt.field.map(([t, seed]) => [t, seed]));
    const one = oneBracket(s.nt);
    const [tl, bl, tr, br] = one ? [[], [], [], []] : corners(s.nt);
    SIZE = fitSizes(s.nt, one, [tl, bl, tr, br]);
    const corner = (list, mirror, cls) => `<div class="nt-corner ${cls}">${list.map(e => cornerEvent(ctx, e, mirror, natSeed)).join('')}</div>`;
    const hasCorners = tl.length + bl.length + tr.length + br.length > 0;
    const field = s.nt.field.slice().sort((a, b) => a[1] - b[1]);
    body = `<div class="nt-scroll"><div class="nt-board${hasCorners ? '' : ' solo'}${hasCorners && tallBoard([tl, bl, tr, br]) ? ' tall' : ''}" style="--bw:${SIZE.bw}px">
        ${hasCorners ? `${corner(tl, false, 'tl')}${corner(bl, false, 'bl')}` : ''}
        ${one ? oneHtml(ctx, s, one, natSeed) : centerHtml(ctx, s, s.nt, natSeed)}
        ${hasCorners ? `${corner(tr, true, 'tr')}${corner(br, true, 'br')}` : ''}
      </div></div>
      <div class="card nt-field"><h2>The field</h2><p class="small muted" style="margin-top:0">${field.length} teams by national seed. ★ automatic bid.</p>
        <ol class="nt-field-list">${field.map(([t, seed, auto]) => `<li><span class="nt-seed">${seed}</span>${logoImg(t, 16)} <a href="${schoolUrl(t, d.sport.id, year)}">${esc(t)}</a>${auto ? ' <span class="muted" title="Automatic bid">★</span>' : ''}${s.teams[t] ? ` <span class="muted small">${s.teams[t].w}-${s.teams[t].l}${s.teams[t].t ? `-${s.teams[t].t}` : ''}</span>` : ''}</li>`).join('')}</ol></div>`;
  }
  app.innerHTML = `${headline}${body}`;
  const short = Math.max(0, ...[...app.querySelectorAll('.nt-name')].map(e => e.scrollWidth - e.clientWidth));
  if (short > 0 && !again) { grow = { key: growKey(), px: (grow.key === growKey() ? grow.px : 0) + short + 2 }; return renderTournament(parts, true); }
  // A board still wider than the page shrinks to fit (down to 72%), as the
  // dynasty apps' full bracket does, instead of hiding the right-hand regions.
  const scr = app.querySelector('.nt-scroll'), bd = app.querySelector('.nt-board');
  if (scr && bd && window.innerWidth > 900) { const z = (scr.clientWidth - 2) / bd.scrollWidth; if (z < 1) bd.style.zoom = String(Math.max(0.72, z)); }
  const go = (sp, y) => { location.hash = tournamentUrl(sp, y); };
  const sp = document.getElementById('nt-sport'), yr = document.getElementById('nt-year');
  if (sp) sp.onchange = () => go(sp.value);
  if (yr) yr.onchange = () => go(d.sport.id, yr.value);
}
