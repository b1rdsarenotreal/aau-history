// A conference's pages, like a league website: a header in the conference's
// color with its logo, a tab for every sport it sponsors, and
// - all sports: its members by sport, this season's champions in every sport,
//   national titles its members have won, and its title leaders;
// - one sport: a season picked by year with the standings, the conference
//   tournament bracket, the members in the national tournament, and the
//   conference's history in that sport (champions season by season).
// Routes: #/conferences, #/conference/<name>, #/conference/<name>/<sport>,
// #/conference/<name>/<sport>/<year>.

import { app, esc, dynasties, logoImg, confLogo, rec, confRec, seasonLabel, readableOn } from './ui.js?v=20261107145114';
import { schoolUrl } from './school.js?v=20261107145114';
import { tournamentUrl, bracketHtml, eventCard, nameNeed, isDouble, deBracketHtml } from './tournament.js?v=20261107145114';
import { FINISH_LABEL } from './cup.js?v=20261107145114';
import { pct } from './extract.js?v=20261107145114';

const enc = encodeURIComponent;
export const conferenceUrl = (name, sport, year) => `#/conference/${enc(name)}${sport ? `/${enc(sport)}` : ''}${sport && year ? `/${year}` : ''}`;
const ordinal = n => `${n}${[, 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1) && n % 10] || 'th'}`;
const pct3 = r => (r.w + r.l + r.t ? pct(r).toFixed(3).replace(/^0/, '') : '—');
const hex = c => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : null);

// Every conference in the history: name, look (from the newest dynasty that
// has it) and, per sport, the seasons it played.
export function allConferences() {
  const out = {};
  for (const d of dynasties()) {
    for (const [y, s] of Object.entries(d.years)) {
      for (const t of Object.values(s.teams)) {
        if (!t.conf || t.conf === 'Independent') continue;
        const c = (out[t.conf] ||= { name: t.conf, sports: {}, look: null, d: null });
        (c.sports[d.sport.id] ||= { d, years: new Set() }).years.add(+y);
        const info = d.conferences?.[t.conf];
        if (info && (!c.look || (info.logo && !c.look.logo))) { c.look = info; c.d = d; }
      }
    }
  }
  for (const c of Object.values(out)) c.d ||= Object.values(c.sports)[0].d;
  return out;
}
const look = c => ({ color: hex(c.look?.color) || '#33424d', abbr: c.look?.abbr || c.name });

// A sport's conference season: the members, sorted by conference standing
// (points with ties, else winning percentage), with places ("T-2nd").
function standings(d, s, conf) {
  const score = r => (r.cw + r.cl + r.ct ? (d.sport.ties ? (3 * r.cw + r.ct) / (r.cw + r.cl + r.ct) : (r.cw + r.ct / 2) / (r.cw + r.cl + r.ct)) : -1);
  const rows = Object.entries(s.teams).filter(([, t]) => t.conf === conf).map(([name, t]) => ({ name, t, sc: score(t) }));
  rows.sort((a, b) => b.sc - a.sc || (b.t.regChamp ? 1 : 0) - (a.t.regChamp ? 1 : 0) || pct(b.t) - pct(a.t) || a.name.localeCompare(b.name));
  rows.forEach(r => {
    const better = rows.filter(x => x.sc > r.sc + 1e-9).length, same = rows.filter(x => Math.abs(x.sc - r.sc) < 1e-9).length;
    r.place = r.sc < 0 ? '' : `${same > 1 ? 'T-' : ''}${ordinal(better + 1)}`;
  });
  return rows;
}
const finishText = (s, t) => (t.finish === 'finals' ? s.finalsName : t.finish === 'champion' ? 'National champions' : FINISH_LABEL[t.finish] || '');
const team = (n, sport, y, size = 18) => `<span class="team">${logoImg(n, size)}<a class="team-link" href="${schoolUrl(n, sport, y)}">${esc(n)}</a></span>`;

// ---------- one sport ----------

function standingsHtml(d, y, s, conf) {
  const rows = standings(d, s, conf);
  const ties = d.sport.ties;
  return `<div class="table-wrap"><table class="conf-standings"><thead><tr><th class="num">#</th><th>School</th><th class="num">Conf.</th>${ties ? '<th class="num" title="3 a win, 1 a tie">Pts</th>' : '<th class="num">Pct.</th>'}<th class="num">Overall</th><th class="num">Pct.</th><th>National tournament</th><th class="num" title="Final poll">Rank</th><th class="hide-sm">Coach</th></tr></thead><tbody>
    ${rows.map(({ name, t, place }) => `<tr class="${t.regChamp ? 'champ-row' : ''}"><td class="num">${place}</td>
      <td>${team(name, d.sport.id, y)}${t.regChamp ? ' <span class="badge" title="Regular-season champions">Champions</span>' : ''}${t.tourneyChamp ? ' <span class="badge gold" title="Conference tournament champions">Tournament</span>' : ''}</td>
      <td class="num"><b>${t.cw + t.cl + t.ct ? confRec(t) : '—'}</b></td>
      <td class="num">${t.cw + t.cl + t.ct ? (ties ? 3 * t.cw + t.ct : pct3({ w: t.cw, l: t.cl, t: t.ct })) : ''}</td>
      <td class="num">${rec(t)}</td><td class="num">${pct3(t)}</td>
      <td class="small">${t.finish ? `${t.finish === 'champion' ? '🏆 ' : ''}${esc(finishText(s, t))}${t.seed ? ` <span class="muted">· ${t.seed} seed</span>` : ''}` : '<span class="muted">—</span>'}</td>
      <td class="num">${t.rank ?? '<span class="muted">NR</span>'}</td><td class="small hide-sm">${esc(t.coach || '')}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function confTournamentHtml(d, y, s, conf) {
  const ev = s.ct?.[conf];
  if (!ev) {
    const champ = Object.entries(s.teams).find(([, t]) => t.conf === conf && t.tourneyChamp)?.[0];
    if (champ) return `<p>${team(champ, d.sport.id, y)} won the tournament. <span class="muted small">Upload this sport's backup again to see the bracket.</span></p>`;
    return null;
  }
  const ctx = { sport: d.sport, year: y, reg: s.reg ?? d.sport.reg };
  const seedFor = t => { const i = ev.s.indexOf(t); return i >= 0 ? i + 1 : ''; };
  const head = `<p class="small muted">${ev.s.length} teams${ev.v ? ` · ${esc(ev.v)}` : ev.h ? ` · hosted by ${esc(ev.h)}` : ''}${ev.c ? ` · <b>Champion: ${esc(ev.c)}</b>` : ''}</p>`;
  const bw = Math.max(190, nameNeed(ev.s));
  if (isDouble(ev)) return `${head}<div class="nt-scroll">${deBracketHtml(ctx, ev, seedFor, { bw })}</div>`;
  if (ev.k !== 'single') return head + eventCard(ctx, ev, (t, i) => (i != null ? i + 1 : seedFor(t)), '');
  return `${head}<div class="nt-scroll">${bracketHtml(ctx, ev, seedFor, { bw })}</div>`;
}

function nationalHtml(d, y, s, conf) {
  const rows = standings(d, s, conf).filter(r => r.t.finish).sort((a, b) => (a.t.seed ?? 99) - (b.t.seed ?? 99));
  if (!s.fieldSize) return '<p class="muted">The national tournament hasn\'t been picked yet.</p>';
  if (!rows.length) return `<p class="muted">No member made the national tournament.${s.nt ? ` <a href="${tournamentUrl(d.sport.id, y)}">Bracket →</a>` : ''}</p>`;
  const w = rows.reduce((a, r) => a + r.t.natW, 0), l = rows.reduce((a, r) => a + r.t.natL, 0);
  return `<p class="small muted">${rows.length} of ${s.fieldSize} teams · ${w}-${l} in the tournament${s.nt ? ` · <a href="${tournamentUrl(d.sport.id, y)}">Bracket →</a>` : ''}</p>
    <div class="table-wrap"><table><thead><tr><th class="num">Seed</th><th>School</th><th>Bid</th><th class="num">W-L</th><th>Finish</th></tr></thead><tbody>
    ${rows.map(({ name, t }) => `<tr class="${t.finish === 'champion' ? 'champ-row' : ''}"><td class="num">${t.seed ?? ''}</td><td>${team(name, d.sport.id, y)}</td><td class="small">${(s.nt?.field || []).some(f => f[0] === name && f[2]) ? 'Automatic' : s.nt ? 'At-large' : ''}</td><td class="num">${t.natW}-${t.natL}</td><td>${t.finish === 'champion' ? '🏆 ' : ''}${esc(finishText(s, t))}</td></tr>`).join('')}
    </tbody></table></div>`;
}

function historyHtml(d, conf, years) {
  const rank = { champion: 5, 'runner-up': 4, finals: 3, super: 2, field: 1 };
  return `<div class="table-wrap"><table><thead><tr><th>Season</th><th>Regular-season champions</th><th>Tournament champion</th><th class="num" title="Members in the national tournament">Bids</th><th>Best national finish</th></tr></thead><tbody>
    ${[...years].sort((a, b) => b - a).map(y => {
      const s = d.years[y];
      const mem = Object.entries(s.teams).filter(([, t]) => t.conf === conf);
      const reg = mem.filter(([, t]) => t.regChamp).map(([n]) => n), tour = mem.find(([, t]) => t.tourneyChamp)?.[0];
      const bids = mem.filter(([, t]) => t.finish);
      const best = [...bids].sort((a, b) => (rank[b[1].finish] || 0) - (rank[a[1].finish] || 0) || (a[1].seed ?? 99) - (b[1].seed ?? 99))[0];
      return `<tr><td><a href="${conferenceUrl(conf, d.sport.id, y)}">${seasonLabel(y)}</a>${s.complete ? '' : '<span class="muted">*</span>'}</td>
        <td>${reg.length ? reg.map(n => team(n, d.sport.id, y, 16)).join(' ') : '<span class="muted">—</span>'}</td>
        <td>${tour ? team(tour, d.sport.id, y, 16) : '<span class="muted">—</span>'}</td>
        <td class="num">${s.fieldSize ? bids.length : ''}</td>
        <td class="small">${best ? `${best[1].finish === 'champion' ? '🏆 ' : ''}${esc(best[0])}, ${esc(finishText(s, best[1]).toLowerCase())}` : '<span class="muted">—</span>'}</td></tr>`;
    }).join('')}
  </tbody></table></div>`;
}

function renderSport(c, sportId, yearArg) {
  const { d, years } = c.sports[sportId];
  const ys = [...years].sort((a, b) => a - b);
  const y = ys.includes(+yearArg) ? +yearArg : ys[ys.length - 1];
  const s = d.years[y];
  const ct = confTournamentHtml(d, y, s, c.name);
  return `
    <div class="card">
      <div class="row season-head"><h2 style="margin:0">${seasonLabel(y)} ${esc(d.sport.name)}</h2>${s.complete ? '' : '<span class="badge">In progress</span>'}<span class="spacer"></span>
        <label class="small muted">Season <select id="cf-year">${[...ys].reverse().map(v => `<option value="${v}" ${v === y ? 'selected' : ''}>${seasonLabel(v)}</option>`).join('')}</select></label></div>
      <h3>Standings</h3>${standingsHtml(d, y, s, c.name)}
    </div>
    ${ct ? `<div class="card"><h2>Conference tournament</h2>${ct}</div>` : ''}
    <div class="card"><h2>National tournament</h2>${nationalHtml(d, y, s, c.name)}</div>
    <div class="card"><h2>${esc(d.sport.name)} champions</h2>${historyHtml(d, c.name, ys)}</div>`;
}

// ---------- all sports ----------

function renderAll(c, order) {
  // Members: the schools in the conference in each sport's newest season.
  const latest = Object.fromEntries(order.map(id => { const { d, years } = c.sports[id]; const y = Math.max(...years); return [id, { d, y, s: d.years[y] }]; }));
  const members = {};
  for (const id of order) for (const [n, t] of Object.entries(latest[id].s.teams)) if (t.conf === c.name) (members[n] ||= new Set()).add(id);
  const names = Object.keys(members).sort((a, b) => members[b].size - members[a].size || a.localeCompare(b));
  // Titles over every season, and national titles members won.
  const tally = {};
  const nat = [];
  for (const id of order) {
    const { d, years } = c.sports[id];
    for (const y of years) for (const [n, t] of Object.entries(d.years[y].teams)) {
      if (t.conf !== c.name) continue;
      const x = (tally[n] ||= { reg: 0, tour: 0, nat: 0 });
      if (t.regChamp) x.reg++;
      if (t.tourneyChamp) x.tour++;
      if (t.finish === 'champion') { x.nat++; nat.push({ n, d, y }); }
    }
  }
  const leaders = Object.entries(tally).filter(([, x]) => x.reg + x.tour + x.nat).sort((a, b) => b[1].nat - a[1].nat || b[1].reg + b[1].tour - (a[1].reg + a[1].tour) || a[0].localeCompare(b[0])).slice(0, 12);
  const kpi = (v, l) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const bids = order.reduce((a, id) => a + Object.values(latest[id].s.teams).filter(t => t.conf === c.name && t.finish).length, 0);
  return `
    <div class="kpis">${kpi(order.length, 'Sports')}${kpi(names.length, 'Member schools')}${kpi(nat.length, 'National titles')}${kpi(bids, 'National tournament bids, latest seasons')}</div>
    <div class="card"><h2>Latest champions</h2><div class="table-wrap"><table><thead><tr><th>Sport</th><th>Season</th><th>Regular season</th><th>Tournament</th><th>National tournament</th></tr></thead><tbody>
      ${order.map(id => { const { d, y, s } = latest[id];
        const mem = Object.entries(s.teams).filter(([, t]) => t.conf === c.name);
        const reg = mem.filter(([, t]) => t.regChamp).map(([n]) => n), tour = mem.find(([, t]) => t.tourneyChamp)?.[0];
        const champ = mem.find(([, t]) => t.finish === 'champion')?.[0], b = mem.filter(([, t]) => t.finish).length;
        return `<tr><td><a href="${conferenceUrl(c.name, id)}"><b>${esc(d.sport.name)}</b></a></td><td class="small">${seasonLabel(y)}${s.complete ? '' : ' <span class="muted">(in progress)</span>'}</td>
          <td>${reg.length ? reg.map(n => team(n, id, y, 16)).join(' ') : '<span class="muted">—</span>'}</td><td>${tour ? team(tour, id, y, 16) : '<span class="muted">—</span>'}</td>
          <td class="small">${champ ? `🏆 ${esc(champ)}` : s.fieldSize ? `${b} bid${b === 1 ? '' : 's'}` : '<span class="muted">—</span>'}</td></tr>`; }).join('')}
    </tbody></table></div></div>
    <div class="card"><h2>Members</h2><div class="table-wrap"><table class="members"><thead><tr><th>School</th>${order.map(id => `<th class="num" title="${esc(c.sports[id].d.sport.name)}">${esc(c.sports[id].d.sport.short)}</th>`).join('')}</tr></thead><tbody>
      ${names.map(n => `<tr><td>${team(n, null, null)}</td>${order.map(id => `<td class="num">${members[n].has(id) ? '<span class="dot" title="Member">●</span>' : ''}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div><p class="small muted">Members in each sport's latest season.</p></div>
    ${nat.length ? `<div class="card"><h2>National champions</h2><ul class="nat-list">${nat.sort((a, b) => b.y - a.y || a.d.sport.name.localeCompare(b.d.sport.name)).map(x => `<li><span class="muted">${seasonLabel(x.y)}</span> ${team(x.n, x.d.sport.id, x.y, 16)} <span class="small">· <a href="${tournamentUrl(x.d.sport.id, x.y)}">${esc(x.d.sport.name)}</a></span></li>`).join('')}</ul></div>` : ''}
    ${leaders.length ? `<div class="card"><h2>Title leaders</h2><div class="table-wrap"><table><thead><tr><th>School</th><th class="num">National</th><th class="num" title="Regular-season conference titles">Conf.</th><th class="num" title="Conference tournament titles">Tourn.</th></tr></thead><tbody>
      ${leaders.map(([n, x]) => `<tr><td>${team(n, null, null)}</td><td class="num">${x.nat ? `<b>${x.nat}</b>` : ''}</td><td class="num">${x.reg || ''}</td><td class="num">${x.tour || ''}</td></tr>`).join('')}
    </tbody></table></div><p class="small muted">Every sport and season in the history, while in the conference.</p></div>` : ''}`;
}

export function renderConference(parts) {
  const [name, sportId, year] = parts;
  const all = allConferences();
  const c = all[name];
  if (!c) { app.innerHTML = `<div class="empty">No history for ${esc(name || 'that conference')} yet. <a href="#/conferences">All conferences</a></div>`; return; }
  const order = dynasties().map(d => d.sport.id).filter(id => c.sports[id]);
  const active = c.sports[sportId] ? sportId : null;
  const { color } = look(c), ink = readableOn(color);
  app.innerHTML = `
    <div class="sch-hero conf-hero" style="--c1:${color};--c2:#ffffff;--hi:${ink}">
      <div class="sch-logo conf-logo">${confLogo(c.d, c.name, 76)}</div>
      <div class="sch-id"><h1>${esc(c.name)}</h1><div class="sch-sub">${order.length} sport${order.length > 1 ? 's' : ''}</div></div>
    </div>
    <nav class="sch-tabs" style="--c1:${color}"><a href="${conferenceUrl(c.name)}" class="${active ? '' : 'active'}">All sports</a>${order.map(id => `<a href="${conferenceUrl(c.name, id)}" class="${id === active ? 'active' : ''}">${esc(c.sports[id].d.sport.name)}</a>`).join('')}</nav>
    ${active ? renderSport(c, active, year) : renderAll(c, order)}`;
  const sel = document.getElementById('cf-year');
  if (sel) sel.onchange = () => { location.hash = conferenceUrl(c.name, active, sel.value); };
}

// The Conferences page: a card per conference.
export function renderConferences() {
  const all = Object.values(allConferences());
  if (!all.length) { app.innerHTML = '<div class="empty">Upload a dynasty backup on the Data page to see its conferences.</div>'; return; }
  all.sort((a, b) => Object.keys(b.sports).length - Object.keys(a.sports).length || a.name.localeCompare(b.name));
  app.innerHTML = `<div class="section-head"><h1>Conferences</h1><span class="muted">${all.length} conferences</span></div>
    <div class="conf-grid">${all.map(c => {
      const { color } = look(c), ink = readableOn(color), n = Object.keys(c.sports).length;
      const schools = new Set();
      for (const { d, years } of Object.values(c.sports)) { const y = Math.max(...years); for (const [s, t] of Object.entries(d.years[y].teams)) if (t.conf === c.name) schools.add(s); }
      return `<a class="conf-card" href="${conferenceUrl(c.name)}" style="--c1:${color};--hi:${ink}"><span class="cc-logo">${confLogo(c.d, c.name, 56)}</span><span class="cc-name">${esc(c.name)}</span><span class="cc-sub">${n} sport${n > 1 ? 's' : ''} · ${schools.size} schools</span></a>`;
    }).join('')}</div>`;
}
