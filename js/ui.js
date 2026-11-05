// Shared page pieces: the history, logos, school labels, sport labels.

import { logoFor } from './logos.js?v=20261105152646';
import { SPORTS } from './sports.js?v=20261105152646';

// Logo files in this app (img/conf/) carry this release's version, like the
// scripts do, so a redrawn logo shows right away instead of a cached copy.
const RELEASE = (() => { try { return new URL(import.meta.url).searchParams.get('v') || ''; } catch { return ''; } })();
const assetUrl = u => (RELEASE && /^img\//.test(u || '') ? `${u}${u.includes('?') ? '&' : '?'}v=${RELEASE}` : u);

// Seasons are academic years: the 2030 season is "2030–31". Years stay
// numbers in the data; this is only how they read on screen.
export const seasonLabel = y => (Number.isFinite(+y) && y !== '' && y != null ? `${y}–${String((+y + 1) % 100).padStart(2, '0')}` : String(y ?? ''));
// A span of seasons: "2030–31" for one, "2030–35" for 2030–31 through 2034–35.
export const seasonSpan = (a, b) => (a === b ? seasonLabel(a) : `${a}–${String((+b + 1) % 100).padStart(2, '0')}`);

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

// Conference logos the owner later swapped from drawn ones to links (the same
// list as the dynasty apps' CONF_LOGO_LINKS): older backups still name the
// drawn file.
const CONF_LOGO_LINKS = {
  bigten: 'https://content.sportslogos.net/logos/153/4661/full/big_ten_conference_logo_primary_20115933.png',
  ivy: 'https://content.sportslogos.net/logos/153/4824/full/ivy_league_logo_primary_2019_sportslogosnet-9024.png',
  metro: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/METRO_Primary_LtBG.png/500px-METRO_Primary_LtBG.png',
  pac10: 'https://content.sportslogos.net/logos/153/4945/full/pacific-10_conference_logo_wordmark_1995_sportslogosnet-1134.png',
  uaa: 'https://dbukjj6eu5tsf.cloudfront.net/uaasports.info/images/responsive_2023/logo-main.svg',
};
const confLogoUrl = url => { const m = /^img\/conf\/(\w+)\.svg$/.exec(url || ''); return (m && CONF_LOGO_LINKS[m[1]]) || url; };

export function confLogo(d, c, size = 18) {
  const info = d?.conferences?.[c] || {};
  const badge = `<span class="tbadge" style="width:${size}px;height:${size}px;font-size:${size * 0.34}px;background:${esc(info.color || '#555')};color:#fff">${esc((info.abbr || c).slice(0, 4))}</span>`;
  if (info.logo) return `<img src="${esc(assetUrl(confLogoUrl(info.logo)))}" alt="" width="${size}" height="${size}" style="vertical-align:middle;object-fit:contain" data-fb="${esc(badge)}" onerror="this.outerHTML=this.dataset.fb">`;
  return badge;
}
export const sportTag = sport => `<span class="badge sport-${sport.gender}">${esc(sport.name)}</span>`;
export const rec = r => `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`;
export const confRec = r => `${r.cw}-${r.cl}${r.ct ? `-${r.ct}` : ''}`;
