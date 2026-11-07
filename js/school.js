// A school's pages, like a team website: a header in the school's colors,
// a tab for every sport it plays, and
// - all sports: the banners (national titles, regular-season conference
//   titles and conference tournament titles), All-Sports Cup finishes and a
//   card per sport;
// - one sport: its banners, a season picked by year (snapshot and schedule
//   with results), a short program history, coaches and every season.
// Routes: #/school/<name>, #/school/<name>/<sport>, #/school/<name>/<sport>/<year>.

import { ctx, app, esc, dynasties, schoolLook, logoImg, confLogo, rec, confRec, seasonLabel, seasonSpan } from './ui.js?v=20261107144328';
import { tournamentUrl } from './tournament.js?v=20261107144328';
import { conferenceUrl } from './conference.js?v=20261107144328';
import { cupStandings, cupYears, FINISH_LABEL } from './cup.js?v=20261107144328';
import { schoolSeasons, schoolTotals } from './views.js?v=20261107144328';
import { pct } from './extract.js?v=20261107144328';

const enc = encodeURIComponent;
export const schoolUrl = (name, sport, year) => `#/school/${enc(name)}${sport ? `/${enc(sport)}` : ''}${sport && year ? `/${year}` : ''}`;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAME = { Mon: 'Mon.', Tue: 'Tue.', Wed: 'Wed.', Thu: 'Thu.', Fri: 'Fri.', Sat: 'Sat.', Sun: 'Sun.' };
const MON = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const ordinal = n => `${n}${[, 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1) && n % 10] || 'th'}`;
const pct3 = r => (r.w + r.l + r.t ? pct(r).toFixed(3).replace(/^0/, '') : '—');

const lum = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); if (!m) return 0; const n = parseInt(m[1], 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
// Text on a gold national-title banner: the school's darker color, or
// near-black when both its colors are light.
const goldInk = (c1, c2) => (lum(c1) < 0.35 ? c1 : lum(c2) < 0.35 ? c2 : '#1d2329');
function readableOn(bg) {
  const m = /^#?([0-9a-f]{6})$/i.exec(bg || '');
  if (!m) return '#fff';
  const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#111' : '#fff';
}
// The school's colors, with a fallback for a second color too close to the first.
function colorsOf(name) {
  const look = schoolLook(name);
  const c1 = /^#[0-9a-f]{6}$/i.test(look.color || '') ? look.color : '#33424d';
  let c2 = /^#[0-9a-f]{6}$/i.test(look.altColor || '') ? look.altColor : '#ffffff';
  if (c2.toLowerCase() === c1.toLowerCase()) c2 = '#ffffff';
  return { c1, c2, ink: readableOn(c1) };
}

// ---------- banners ----------

// Every banner a school has earned, in one sport or all: national titles
// first, then regular-season and tournament conference titles, newest first.
export function bannersOf(name, sportId = null) {
  const out = [];
  for (const d of dynasties()) {
    if (sportId && d.sport.id !== sportId) continue;
    for (const [y, s] of Object.entries(d.years)) {
      const t = s.teams[name];
      if (!t) continue;
      if (t.finish === 'champion') out.push({ kind: 'national', d, y: +y, title: 'National Champions' });
      if (t.regChamp && t.conf) out.push({ kind: 'reg', d, y: +y, conf: t.conf, title: 'Champions', full: `${t.conf} Champions` });
      if (t.tourneyChamp && t.conf) out.push({ kind: 'tourney', d, y: +y, conf: t.conf, title: 'Tournament Champions', full: `${t.conf} Tournament Champions` });
    }
  }
  const rank = { national: 0, reg: 1, tourney: 2 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || b.y - a.y || a.d.sport.name.localeCompare(b.d.sport.name));
}
function bannerHtml(name, b, showSport) {
  const { c1, c2, ink } = colorsOf(name);
  return `<a class="banner ${b.kind}" href="${b.kind === 'national' ? tournamentUrl(b.d.sport.id, b.y) : conferenceUrl(b.conf, b.d.sport.id, b.y)}" style="--bc:${c1};--bt:${c2};--bi:${ink};--gi:${goldInk(c1, c2)}" title="${esc(`${seasonLabel(b.y)} ${b.full || b.title} · ${b.d.sport.name}${b.kind === 'national' ? ' · see the national tournament' : ' · see the conference season'}`)}">
    <span class="bn-logo">${logoImg(name, 30)}</span>
    ${b.kind === 'national' ? '<span class="bn-star">★</span>' : ''}
    <span class="bn-year">${seasonLabel(b.y)}</span>
    ${b.conf ? `<span class="bn-conf" title="${esc(b.conf)}">${confLogo(b.d, b.conf, 40)}</span>` : ''}
    <span class="bn-title">${esc(b.title)}</span>
    ${showSport ? `<span class="bn-sport">${esc(b.d.sport.name)}</span>` : ''}
  </a>`;
}
function rafters(name, list, showSport, empty) {
  if (!list.length) return `<div class="rafters empty-rafters"><p class="muted">${empty}</p></div>`;
  const count = k => list.filter(b => b.kind === k).length;
  const sum = [['national', 'national title'], ['reg', 'regular-season conference title'], ['tourney', 'conference tournament title']]
    .map(([k, l]) => (count(k) ? `${count(k)} ${l}${count(k) > 1 ? 's' : ''}` : '')).filter(Boolean).join(' · ');
  return `<div class="rafters"><div class="rafter-bar"></div><div class="banner-row">${list.map(b => bannerHtml(name, b, showSport)).join('')}</div></div><p class="small muted banner-sum">${sum}</p>`;
}

// ---------- schedule ----------

// A game's calendar date from its sport's calendar: week and day, a week
// later for a postseason game played after its event's weekend (order 7 or
// more, or a Monday to Wednesday game after an earlier one later in the week).
function gameDay(d, y, g, games) {
  const start = d.sport.start?.(y);
  if (!start || !g.w) return null;
  let n = (g.w - 1) * 7 + Math.max(0, DOW.indexOf(g.d));
  const after = (g.o ?? 0) >= 7 || (g.t && g.t !== 'conf' && ['Mon', 'Tue', 'Wed'].includes(g.d)
    && games.some(x => x.e && x.e === g.e && x.w === g.w && (x.o ?? 0) < (g.o ?? 0) && DOW.indexOf(x.d) > DOW.indexOf(g.d)));
  if (after) n += 7;
  const date = new Date(start); date.setUTCDate(date.getUTCDate() + n);
  return date;
}
// The score note: overtimes, extra innings or a shortened game, and the shootout.
function scoreNote(d, s, g) {
  const reg = s.reg ?? d.sport.reg;
  let note = '';
  if (reg && g.x && g.x !== reg) {
    if (d.sport.innings) note = `${g.x} inn.`;
    else if (g.x > reg) note = g.x - reg === 1 ? 'OT' : `${g.x - reg}OT`;
  }
  return note;
}
function resultCell(d, s, name, g) {
  if (g.hr == null) return '<span class="muted">—</span>';
  const home = g.h === name, us = home ? g.hr : g.ar, them = home ? g.ar : g.hr;
  let res = us > them ? 'W' : us < them ? 'L' : 'T';
  let pk = '';
  if (g.pk) {
    const [ph, pa] = g.pk, pus = home ? ph : pa, pthem = home ? pa : ph;
    const so = d.sport.pkWins ? 'SO' : 'PK';
    if (d.sport.pkWins) res = pus > pthem ? 'W' : 'L';
    pk = d.sport.pkWins ? ` ${so} ${pus}-${pthem}` : `, ${pus > pthem ? 'won' : 'lost'} ${pus}-${pthem} on PKs`;
  }
  const note = scoreNote(d, s, g);
  return `<span class="res res-${res}">${res}</span> ${us}-${them}${note || pk ? ` <span class="muted small rnote">(${[note, pk.trim()].filter(Boolean).join(', ')})</span>` : ''}`;
}
function scheduleHtml(d, y, s, name) {
  const games = (s.games || []).filter(g => g.h === name || g.a === name);
  if (!games.length) return '<p class="muted">No schedule for this season. Upload its backup again to add it (schedules are kept from now on).</p>';
  const rows = games.map(g => ({ g, date: gameDay(d, y, g, s.games) }))
    .sort((a, b) => (a.date && b.date ? a.date - b.date : 0) || a.g.w - b.g.w || DOW.indexOf(a.g.d) - DOW.indexOf(b.g.d) || (a.g.o ?? 0) - (b.g.o ?? 0));
  const typeName = { conf: 'Conference tournament', regional: 'National tournament', super: 'National tournament', mcws: s.finalsName || 'National finals' };
  return `<div class="table-wrap"><table class="sched"><thead><tr><th>Date</th><th>Opponent</th><th>Result</th><th class="hide-sm"></th></tr></thead><tbody>
    ${rows.map(({ g, date }) => {
      const home = g.h === name, opp = home ? g.a : g.h;
      const where = g.n ? 'vs.' : home ? 'vs.' : 'at';
      const place = g.v || (g.hs && g.hs !== name && g.hs !== opp ? g.hs : '') || (g.t === 'mcws' ? s.venue : '');
      const site = g.n ? `<span class="muted small"> · ${esc(place ? `at ${place}` : 'neutral site')}</span>` : '';
      const label = g.t ? (g.lb || typeName[g.t] || '') : (g.lb || '');
      const tag = g.t ? `<span class="sched-tag ${g.t === 'conf' ? 'ct' : 'nt'}">${esc(label)}</span>` : g.c ? '<span class="sched-tag conf">Conference</span>' : label ? `<span class="sched-tag">${esc(label)}</span>` : '';
      return `<tr class="${g.t ? 'post' : ''}"><td class="nowrap dt">${date ? `<span class="dw">${DAY_NAME[g.d] || g.d}</span> <span class="md">${MON[date.getUTCMonth()]} ${date.getUTCDate()}</span>` : `Week ${g.w} · ${esc(g.d || '')}`}</td>
        <td><span class="team">${where} ${logoImg(opp, 18)}<a class="team-link" href="${schoolUrl(opp, d.sport.id, y)}">${esc(opp)}</a>${g.c ? '<span class="conf-mark" title="Conference game">*</span>' : ''}</span>${site}<span class="show-sm">${tag}</span></td>
        <td class="nowrap">${resultCell(d, s, name, g)}</td><td class="hide-sm">${tag}</td></tr>`;
    }).join('')}
  </tbody></table></div><p class="small muted">* conference ${d.sport.unit || 'game'}</p>`;
}

// ---------- one sport ----------

// A team's place in its conference standings that season ("2nd", "T-3rd").
function confPlace(d, s, name) {
  const t = s.teams[name];
  if (!t?.conf || !(t.cw + t.cl + t.ct)) return null;
  const score = r => (d.sport.ties ? (3 * r.cw + r.ct) / (r.cw + r.cl + r.ct) : (r.cw + r.ct / 2) / (r.cw + r.cl + r.ct));
  const mates = Object.values(s.teams).filter(x => x.conf === t.conf && x.cw + x.cl + x.ct);
  const me = score(t), better = mates.filter(x => score(x) > me + 1e-9).length, same = mates.filter(x => Math.abs(score(x) - me) < 1e-9).length;
  return `${same > 1 ? 'T-' : ''}${ordinal(better + 1)}`;
}
function finishLine(d, s, t) {
  if (!t.finish) return 'Did not make the national tournament';
  const what = t.finish === 'champion' ? '🏆 National champions' : t.finish === 'finals' ? `Reached the ${s.finalsName}` : t.finish === 'runner-up' ? 'National runner-up' : t.finish === 'super' ? 'Reached the super regionals' : 'National tournament';
  return `${what}${t.seed ? ` · ${t.seed} seed` : ''}${t.natW + t.natL ? ` · ${t.natW}-${t.natL}` : ''}`;
}
// Coaches in order, each with their run of seasons.
function coachRuns(rows) {
  const runs = [];
  for (const r of rows) {
    const name = r.t.coach || 'Unknown';
    const last = runs[runs.length - 1];
    if (last && last.name === name && last.to === r.y - 1) { last.to = r.y; last.rows.push(r); } else runs.push({ name, from: r.y, to: r.y, rows: [r] });
  }
  return runs.map(run => {
    const tot = { w: 0, l: 0, t: 0 };
    for (const { t } of run.rows) { tot.w += t.w; tot.l += t.l; tot.t += t.t; }
    return { ...run, tot, nat: run.rows.filter(r => r.t.finish === 'champion').length, reg: run.rows.filter(r => r.t.regChamp).length, tour: run.rows.filter(r => r.t.tourneyChamp).length, bids: run.rows.filter(r => r.t.finish).length };
  });
}
// A few sentences on the program, from its seasons.
function synopsis(name, d, rows) {
  const tot = { w: 0, l: 0, t: 0, cw: 0, cl: 0, ct: 0 };
  for (const { t } of rows) for (const k of Object.keys(tot)) tot[k] += t[k] || 0;
  const done = rows.filter(r => r.s.complete);
  const nat = rows.filter(r => r.t.finish === 'champion'), reg = rows.filter(r => r.t.regChamp), tour = rows.filter(r => r.t.tourneyChamp), bids = done.filter(r => r.t.finish);
  const finals = rows.filter(r => ['champion', 'runner-up', 'finals'].includes(r.t.finish));
  const span = seasonSpan(rows[0].y, rows[rows.length - 1].y);
  const look = schoolLook(name), team = look.mascot ? `the ${look.mascot}` : name;
  const out = [`${name} has played ${rows.length} season${rows.length === 1 ? '' : 's'} of ${d.sport.name.toLowerCase()} in the dynasty (${span}), going ${rec(tot)} overall (${pct3(tot)})${tot.cw + tot.cl + tot.ct ? ` and ${confRec(tot)} in conference play` : ''}.`];
  const honors = [];
  if (nat.length) honors.push(`${nat.length === 1 ? 'a national title' : `${nat.length} national titles`} (${nat.map(r => seasonLabel(r.y)).join(', ')})`);
  if (reg.length) honors.push(`${reg.length} regular-season conference title${reg.length > 1 ? 's' : ''}`);
  if (tour.length) honors.push(`${tour.length} conference tournament title${tour.length > 1 ? 's' : ''}`);
  if (honors.length) out.push(`The program has won ${honors.length > 1 ? `${honors.slice(0, -1).join(', ')} and ${honors[honors.length - 1]}` : honors[0]}.`);
  if (done.length) out.push(bids.length ? `It has made the national tournament ${bids.length} time${bids.length > 1 ? 's' : ''} in ${done.length} finished season${done.length > 1 ? 's' : ''}${finals.length && !nat.length ? `, reaching the ${rows[0].s.finalsName} ${finals.length === 1 ? 'once' : `${finals.length} times`}` : ''}.` : `It hasn't made the national tournament yet.`);
  const rank = r => (r.t.finish === 'champion' ? 5 : r.t.finish === 'runner-up' ? 4 : r.t.finish === 'finals' ? 3 : r.t.finish === 'super' ? 2 : r.t.finish ? 1 : 0);
  const best = [...done].sort((a, b) => rank(b) - rank(a) || pct(b.t) - pct(a.t))[0];
  if (best && rows.length > 1) out.push(`Best season: ${seasonLabel(best.y)}, ${rec(best.t)}${best.t.finish ? `, ${best.t.finish === 'champion' ? 'national champions' : best.t.finish === 'finals' ? `a trip to the ${best.s.finalsName}` : (FINISH_LABEL[best.t.finish] || '').toLowerCase()}` : best.t.regChamp ? ', conference champions' : ''}.`);
  const runs = coachRuns(rows), cur = runs[runs.length - 1];
  if (cur && cur.name !== 'Unknown') out.push(`${cur.name} has coached ${team} since ${seasonLabel(cur.from)}${cur.rows.length > 1 ? `, going ${rec(cur.tot)}` : ''}.`);
  return out.join(' ');
}

function renderSport(name, d, yearArg) {
  const rows = schoolSeasons(name).filter(r => r.d.sport.id === d.sport.id).sort((a, b) => a.y - b.y);
  const years = rows.map(r => r.y);
  const y = years.includes(+yearArg) ? +yearArg : years[years.length - 1];
  const cur = rows.find(r => r.y === y), { s, t } = cur;
  const place = confPlace(d, s, name);
  const snap = (v, l) => `<div class="snap"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const titles = [t.regChamp ? 'Regular-season conference champions' : '', t.tourneyChamp ? 'Conference tournament champions' : ''].filter(Boolean);
  const runs = coachRuns(rows);
  return `
    <div class="card">
      <div class="row season-head"><h2 style="margin:0">${seasonLabel(y)} ${esc(d.sport.name)}</h2>${s.complete ? '' : '<span class="badge">In progress</span>'}<span class="spacer"></span>
        <label class="small muted">Season <select id="sch-year">${[...years].reverse().map(v => `<option value="${v}" ${v === y ? 'selected' : ''}>${seasonLabel(v)}</option>`).join('')}</select></label></div>
      <div class="snaps">
        ${snap(rec(t), 'Overall')}
        ${t.cw + t.cl + t.ct ? snap(confRec(t), `${t.conf ? `<a href="${conferenceUrl(t.conf, d.sport.id, y)}" title="${esc(t.conf)}">${confLogo(d, t.conf, 14)} Conference</a>` : 'Conference'}${place ? ` · ${place}` : ''}`) : ''}
        ${snap(t.rank ? `#${t.rank}` : 'NR', 'Final ranking')}
        ${snap(esc(t.coach || '—'), 'Coach')}
      </div>
      <p class="season-line">${s.complete || t.finish ? esc(finishLine(d, s, t)).replace('🏆', '🏆') : 'Season in progress'}${t.finish && s.nt ? ` · <a href="${tournamentUrl(d.sport.id, Object.keys(d.years).find(k => d.years[k] === s))}">Bracket →</a>` : ''}${titles.length ? ` · <b>${titles.join(' · ')}</b>` : ''}</p>
      <h3>Schedule and results</h3>
      ${scheduleHtml(d, y, s, name)}
    </div>
    <div class="card"><h2>${esc(d.sport.name)} banners</h2>${rafters(name, bannersOf(name, d.sport.id), false, 'No banners in this sport yet.')}</div>
    <div class="card"><h2>Program history</h2><p class="synopsis">${esc(synopsis(name, d, rows))}</p>
      <div class="table-wrap"><table><thead><tr><th>Season</th><th>Coach</th><th class="num">Record</th><th class="num">Conf.</th><th>Titles</th><th>National tournament</th><th class="num">Final rank</th></tr></thead><tbody>
        ${[...rows].reverse().map(r => `<tr class="${r.y === y ? 'cur' : ''}"><td><a href="${schoolUrl(name, d.sport.id, r.y)}">${seasonLabel(r.y)}</a>${r.s.complete ? '' : '<span class="muted">*</span>'}</td><td class="small">${esc(r.t.coach || '—')}</td><td class="num">${rec(r.t)}</td><td class="num">${r.t.cw + r.t.cl + r.t.ct ? confRec(r.t) : ''}${confPlace(d, r.s, name) ? ` <span class="muted small">${confPlace(d, r.s, name)}</span>` : ''}</td>
          <td>${r.t.regChamp ? '<span class="badge">Reg. season</span> ' : ''}${r.t.tourneyChamp ? '<span class="badge gold">Tournament</span>' : ''}</td>
          <td class="small">${r.t.finish ? esc(finishLine(d, r.s, r.t)) : '<span class="muted">—</span>'}</td><td class="num">${r.t.rank ?? '<span class="muted">NR</span>'}</td></tr>`).join('')}
      </tbody></table></div></div>
    <div class="card"><h2>Coaches</h2><div class="table-wrap"><table><thead><tr><th>Coach</th><th>Seasons</th><th class="num">Record</th><th class="num">Pct.</th><th class="num" title="Regular-season conference titles">Conf.</th><th class="num" title="Conference tournament titles">Tourn.</th><th class="num" title="National tournament appearances">Bids</th><th class="num">Nat. titles</th></tr></thead><tbody>
      ${[...runs].reverse().map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${seasonSpan(c.from, c.to)} <span class="muted small">(${c.rows.length})</span></td><td class="num">${rec(c.tot)}</td><td class="num">${pct3(c.tot)}</td><td class="num">${c.reg || ''}</td><td class="num">${c.tour || ''}</td><td class="num">${c.bids || ''}</td><td class="num">${c.nat ? `<b>${c.nat}</b>` : ''}</td></tr>`).join('')}
    </tbody></table></div></div>`;
}

// ---------- all sports ----------

function renderAll(name, sportOrder, bySport) {
  const x = schoolTotals(name);
  const cupRows = cupYears(ctx.history).map(y => { const c = cupStandings(ctx.history, y); const i = c.schools.findIndex(s => s.school === name); return i < 0 ? null : { y, rank: i + 1, ...c.schools[i], of: c.schools.length }; }).filter(Boolean).reverse();
  const kpi = (v, l) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  return `
    <div class="kpis">${kpi(x.titles, 'National titles')}${kpi(x.reg, 'Conference titles')}${kpi(x.tour, 'Conference tournament titles')}${kpi(x.bids, 'National tournaments')}${kpi(x.cups, 'All-Sports Cups')}${kpi(rec(x), 'All-time, every sport')}</div>
    <div class="card"><h2>Banners</h2>${rafters(name, bannersOf(name), true, 'No banners yet: national titles and conference titles hang here.')}</div>
    <div class="sport-cards">${sportOrder.map(id => {
      const { d, rows } = bySport[id], last = rows[rows.length - 1];
      const tot = rows.reduce((a, r) => ({ w: a.w + r.t.w, l: a.l + r.t.l, t: a.t + r.t.t }), { w: 0, l: 0, t: 0 });
      const n = bannersOf(name, id).length;
      return `<a class="card sport-card" href="${schoolUrl(name, id)}"><div class="sc-name">${esc(d.sport.name)}</div>
        <div class="sc-rec"><b>${rec(last.t)}</b> <span class="muted small">${seasonLabel(last.y)}${last.t.conf ? ` · ${esc(d.conferences?.[last.t.conf]?.abbr || last.t.conf)}` : ''}</span></div>
        <div class="small">${last.s.complete || last.t.finish ? esc(finishLine(d, last.s, last.t)) : 'In progress'}</div>
        <div class="small muted">All-time ${rec(tot)}${n ? ` · ${n} banner${n > 1 ? 's' : ''}` : ''}</div></a>`;
    }).join('')}</div>
    ${cupRows.length ? `<div class="card"><h2>All-Sports Cup</h2><div class="table-wrap"><table><thead><tr><th>Season</th><th class="num">Rank</th><th class="num">Points</th>${dynasties().map(d => `<th class="num" title="${esc(d.sport.name)}">${esc(d.sport.short)}</th>`).join('')}</tr></thead><tbody>
      ${cupRows.map(c => `<tr><td>${seasonLabel(c.y)}</td><td class="num"><b>${c.rank}</b> <span class="muted small">of ${c.of}</span></td><td class="num"><b>${c.total}</b></td>${dynasties().map(d => `<td class="num">${c.bySport[d.sport.id] ?? '<span class="muted">—</span>'}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div></div>` : ''}`;
}

export function renderSchool(parts) {
  const [name, sportId, year] = parts;
  const rows = schoolSeasons(name);
  if (!rows.length) { app.innerHTML = `<div class="empty">No history for ${esc(name)} yet. <a href="#/schools">All schools</a></div>`; return; }
  const look = schoolLook(name), { c1, c2, ink } = colorsOf(name);
  const bySport = {};
  for (const r of rows) (bySport[r.d.sport.id] ||= { d: r.d, rows: [] }).rows.push(r);
  for (const v of Object.values(bySport)) v.rows.sort((a, b) => a.y - b.y);
  const sportOrder = dynasties().map(d => d.sport.id).filter(id => bySport[id]);
  const active = bySport[sportId] ? sportId : null;
  const nTitles = bannersOf(name).filter(b => b.kind === 'national').length;
  app.innerHTML = `
    <div class="sch-hero" style="--c1:${c1};--c2:${c2};--hi:${ink}">
      <div class="sch-logo">${logoImg(name, 76)}</div>
      <div class="sch-id"><h1>${esc(name)}</h1><div class="sch-sub">${esc(look.mascot || '')}${look.mascot ? ' · ' : ''}${sportOrder.length} sport${sportOrder.length > 1 ? 's' : ''}${nTitles ? ` · ${nTitles} national title${nTitles > 1 ? 's' : ''}` : ''}</div></div>
    </div>
    <nav class="sch-tabs" style="--c1:${c1}"><a href="${schoolUrl(name)}" class="${active ? '' : 'active'}">All sports</a>${sportOrder.map(id => `<a href="${schoolUrl(name, id)}" class="${id === active ? 'active' : ''}">${esc(bySport[id].d.sport.name)}</a>`).join('')}</nav>
    ${active ? renderSport(name, bySport[active].d, year) : renderAll(name, sportOrder, bySport)}`;
  const sel = document.getElementById('sch-year');
  if (sel) sel.onchange = () => { location.hash = schoolUrl(name, active, sel.value); };
}
