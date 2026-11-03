// Shared page pieces: the history, logos, school labels, sport labels.

import { logoFor } from './logos.js?v=20261102231628';
import { SPORTS } from './sports.js?v=20261102231628';

export const ctx = { history: null, render: () => {} };
export const app = document.getElementById('app');
export const modal = document.getElementById('modal');
export const $ = (sel, root = app) => root.querySelector(sel);
export const $$ = (sel, root = app) => [...root.querySelectorAll(sel)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function toast(msg, error = false) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toast.t); toast.t = setTimeout(() => (el.className = 'toast'), 3200);
}

// Dynasties in a steady order: women's sports, then men's, by name.
export function dynasties() {
  const order = Object.keys(SPORTS);
  return Object.values(ctx.history?.dynasties || {}).sort((a, b) => {
    const ia = order.indexOf(a.sport.id), ib = order.indexOf(b.sport.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.sport.name.localeCompare(b.sport.name);
  });
}

// The look of a school (colors, abbreviation, logo) from whichever dynasty
// saw it most recently.
export function schoolLook(name) {
  let best = null;
  for (const d of dynasties()) if (d.schools?.[name]) best = { ...best, ...d.schools[name], logo: d.schools[name].logo || best?.logo || null };
  return best || { school: name };
}
export function allSchools() {
  const set = new Set();
  for (const d of dynasties()) for (const s of Object.values(d.years)) for (const t of Object.keys(s.teams)) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b));
}

function readableOn(bg) {
  const m = /^#?([0-9a-f]{6})$/i.exec(bg || '');
  if (!m) return '#fff';
  const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#111' : '#fff';
}
const initials = name => String(name).replace(/[^A-Za-z0-9 &-]/g, '').split(/[\s&-]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase();

export function logoImg(name, size = 20) {
  const t = schoolLook(name);
  const url = logoFor({ school: name, logoOverride: t.logo }, { Penn: 'Pennsylvania' });
  const badge = `<span class="tbadge" style="width:${size}px;height:${size}px;font-size:${Math.max(7, size * 0.38)}px;background:${esc(t.color || '#666')};color:${esc(readableOn(t.color))}">${esc(t.abbr || initials(name))}</span>`;
  if (!url) return badge;
  return `<span class="logo" data-fb="${esc(badge)}" style="width:${size}px;height:${size}px"><img src="${esc(url)}" alt="" width="${size}" height="${size}" loading="lazy" onerror="this.parentNode.outerHTML=this.parentNode.dataset.fb"></span>`;
}
export const schoolHref = name => `#/school/${encodeURIComponent(name)}`;
export const school = (name, size = 18) => (name ? `<span class="team">${logoImg(name, size)}<a class="team-link" href="${schoolHref(name)}">${esc(name)}</a></span>` : '<span class="muted">—</span>');

export function confLogo(d, c, size = 18) {
  const info = d?.conferences?.[c] || {};
  if (info.logo) return `<img src="${esc(info.logo)}" alt="" width="${size}" height="${size}" style="vertical-align:middle;object-fit:contain">`;
  return `<span class="tbadge" style="width:${size}px;height:${size}px;font-size:${size * 0.34}px;background:${esc(info.color || '#555')};color:#fff">${esc((info.abbr || c).slice(0, 4))}</span>`;
}
export const sportTag = sport => `<span class="badge sport-${sport.gender}">${esc(sport.name)}</span>`;
export const rec = r => `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`;
export const confRec = r => `${r.cw}-${r.cl}${r.ct ? `-${r.ct}` : ''}`;
