// Pages: home, champions, schools, a school, the all-sports cup, and data.

import { ctx, app, modal, $, $$, esc, toast, dynasties, allSchools, school, schoolLook, logoImg, confLogo, sportTag, rec, confRec } from './ui.js?v=20261102010239';
import { SPORTS, detectSport, customSport, isDynastyBackup } from './sports.js?v=20261102010239';
import { extractDynasty, EXTRACT_VERSION } from './extract.js?v=20261102010239';
import { saveHistory, mergeDynasty, exportHistory, isHistoryBackup, emptyHistory } from './store.js?v=20261102010239';
import { cupStandings, cupYears, finishPoints, FINISH_LABEL, CUP_POINTS } from './cup.js?v=20261102010239';

const ui = { champSport: 'all', cupYear: null, cupGender: 'all', cupView: 'schools', schoolSport: 'all', schoolFilter: '' };
const finishText = (d, s, t) => (t.finish === 'finals' ? s.finalsName : FINISH_LABEL[t.finish] || '');

// ---------- uploading ----------

const readFile = file => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => { try { resolve(JSON.parse(r.result)); } catch { reject(new Error(`${file.name} isn't a JSON backup.`)); } };
  r.onerror = () => reject(r.error);
  r.readAsText(file);
});

// Read the chosen files: dynasty backups are added (asking about the sport
// when it isn't sure), an AAU History backup replaces the whole history.
export async function handleFiles(files) {
  for (const file of files) {
    let data;
    try { data = await readFile(file); } catch (e) { toast(e.message, true); continue; }
    if (isHistoryBackup(data)) {
      if (!confirm(`Restore ${file.name}? It replaces the whole history in this browser.`)) continue;
      ctx.history = { ...emptyHistory(), ...data };
      await saveHistory(ctx.history); toast('History restored.'); ctx.render(); continue;
    }
    if (!isDynastyBackup(data)) { toast(`${file.name} isn't a dynasty backup (it has no seasons).`, true); continue; }
    const found = detectSport(data);
    const sport = found.sure && !ctx.forceAsk ? found.sport : await askSport(file.name, found.sport);
    if (!sport) continue;
    const ext = extractDynasty(data, sport);
    if (!Object.keys(ext.years).length) { toast(`${file.name} has no played matches yet, so there's no history to add.`, true); continue; }
    const r = mergeDynasty(ctx.history, ext, { fileName: file.name });
    await saveHistory(ctx.history);
    toast(`${sport.name}: ${r.added} season${r.added === 1 ? '' : 's'} added, ${r.updated} updated${r.kept ? `, ${r.kept} kept from before` : ''}.`);
  }
  ctx.render();
}

// Which sport is this? Known sports, or a new one by name.
function askSport(fileName, guess) {
  return new Promise(resolve => {
    modal.innerHTML = `<div class="modal-head"><h2>Which sport is this?</h2></div>
      <div class="modal-body stack">
        <p class="small muted" style="margin:0">${esc(fileName)} looks like a dynasty backup, but AAU History couldn't tell which sport it is.</p>
        <label class="field">Sport <select id="as-sport">${Object.values(SPORTS).map(s => `<option value="${s.id}" ${s.id === guess.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}<option value="__new" ${guess.custom ? 'selected' : ''}>A new sport…</option></select></label>
        <div class="row" id="as-new" ${guess.custom ? '' : 'hidden'}>
          <label class="field" style="flex:1">Name <input type="text" id="as-name" value="${esc(guess.custom ? guess.name : '')}" placeholder="Lacrosse"></label>
          <label class="field">For <select id="as-gender"><option value="women" ${guess.gender === 'women' ? 'selected' : ''}>Women</option><option value="men" ${guess.gender === 'men' ? 'selected' : ''}>Men</option></select></label>
          <label class="check"><input type="checkbox" id="as-ties"> Level matches can end as ties</label>
        </div>
      </div>
      <div class="modal-foot"><span class="spacer"></span><button class="btn" id="as-cancel">Skip this file</button><button class="btn primary" id="as-ok">Add to history</button></div>`;
    const sel = $('#as-sport', modal);
    sel.onchange = () => { $('#as-new', modal).hidden = sel.value !== '__new'; };
    const done = v => { modal.close(); resolve(v); };
    $('#as-cancel', modal).onclick = () => done(null);
    $('#as-ok', modal).onclick = () => {
      if (sel.value !== '__new') return done(SPORTS[sel.value]);
      const name = $('#as-name', modal).value.trim();
      if (!name) return toast('Give the sport a name.', true);
      const g = $('#as-gender', modal).value;
      const sp = customSport(`${g === 'men' ? "Men's" : "Women's"} ${name.replace(/^(wo)?men'?s\s+/i, '')}`, g);
      sp.ties = $('#as-ties', modal).checked;
      done(sp);
    };
    modal.onclose = () => resolve(null);
    modal.showModal();
  });
}

function uploadBox(big = false) {
  return `<label class="drop${big ? ' big' : ''}" id="drop">
    <input type="file" id="up-file" accept="application/json,.json" multiple hidden>
    <b>Upload dynasty backups</b>
    <span class="small muted">Drop the backup files here or click to choose them (Settings → Download backup in each dynasty: volleyball, softball &amp; baseball, soccer, field hockey, or any new sport). Upload again after each season; newer files replace older ones.</span>
  </label>`;
}
export function bindUpload(root = app) {
  const input = $('#up-file', root), drop = $('#drop', root);
  if (!input) return;
  input.onchange = () => { handleFiles([...input.files]); input.value = ''; };
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); handleFiles([...e.dataTransfer.files]); };
}

// ---------- home ----------

export function renderHome() {
  const ds = dynasties();
  if (!ds.length) {
    app.innerHTML = `<div class="section-head"><h1>AAU History</h1></div>
      <div class="card stack"><p style="margin:0">The record book for every AAU dynasty: national and conference champions in every sport, every school's history across sports, and the All-Sports Cup.</p>${uploadBox(true)}</div>`;
    return bindUpload();
  }
  const years = cupYears(ctx.history), last = years[years.length - 1];
  const cup = last ? cupStandings(ctx.history, last) : null;
  const latest = ds.map(d => { const y = Math.max(...Object.keys(d.years).filter(k => d.years[k].champion).map(Number), -Infinity); return { d, y, s: d.years[y] }; });
  const titles = {};
  for (const d of ds) for (const s of Object.values(d.years)) if (s.champion) titles[s.champion] = (titles[s.champion] || 0) + 1;
  const topTitles = Object.entries(titles).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8);
  const seasons = ds.reduce((a, d) => a + Object.keys(d.years).length, 0);
  app.innerHTML = `<div class="section-head"><h1>AAU History</h1><span class="muted">${ds.length} sport${ds.length === 1 ? '' : 's'} · ${seasons} seasons · ${allSchools().length} schools</span></div>
    ${cup?.schools.length ? `<div class="banner" style="background:linear-gradient(120deg, ${esc(schoolLook(cup.schools[0].school).color || '#0b3c5d')}, #15171c)"><span class="trophy">🏆</span><div><div class="small" style="opacity:.8">${last} AAU All-Sports Cup</div><div class="big">${esc(cup.schools[0].school)}</div><div class="small" style="opacity:.8">${cup.schools[0].total} points · ${cup.schools[1] ? `${esc(cup.schools[1].school)} ${cup.schools[1].total}` : ''}</div></div></div><div style="height:16px"></div>` : ''}
    <div class="grid">
      <div class="card"><h2>Latest national champions</h2><div class="table-wrap"><table><tbody>
        ${latest.map(({ d, y, s }) => `<tr><td>${sportTag(d.sport)}</td><td class="num muted">${Number.isFinite(y) ? y : ''}</td><td>${s ? school(s.champion) : '<span class="muted">Not crowned yet</span>'}</td></tr>`).join('')}
      </tbody></table></div><p class="small muted"><a href="#/champions">All champions ›</a></p></div>
      <div class="card"><h2>Most national titles</h2>${topTitles.length ? `<div class="table-wrap"><table><tbody>${topTitles.map(([t, n], i) => `<tr><td class="num muted">${i + 1}</td><td>${school(t)}</td><td class="num"><b>${n}</b></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No champions crowned yet.</p>'}</div>
      ${cup ? `<div class="card"><h2>${last} All-Sports Cup</h2><div class="table-wrap"><table><tbody>${cup.schools.slice(0, 8).map((x, i) => `<tr><td class="num muted">${i + 1}</td><td>${school(x.school)}</td><td class="num"><b>${x.total}</b></td></tr>`).join('')}</tbody></table></div><p class="small muted"><a href="#/cup">Full standings ›</a></p></div>` : ''}
    </div>
    <div class="card" style="margin-top:16px"><h2>Add seasons</h2>${uploadBox()}</div>`;
  bindUpload();
}

// ---------- champions ----------

export function renderChampions() {
  const ds = dynasties();
  if (!ds.length) return renderHome();
  const pick = ds.find(d => d.sport.id === ui.champSport);
  const shown = pick ? [pick] : ds;
  const tabs = `<div class="seg" style="margin-bottom:14px"><button class="btn sm ${pick ? '' : 'primary'}" data-cs="all">All sports</button>${ds.map(d => `<button class="btn sm ${pick === d ? 'primary' : ''}" data-cs="${esc(d.sport.id)}">${esc(d.sport.name)}</button>`).join('')}</div>`;
  let body;
  if (!pick) {
    // Every sport side by side, by year.
    const years = [...new Set(ds.flatMap(d => Object.keys(d.years).map(Number)))].sort((a, b) => b - a);
    body = `<div class="card"><h2>National champions</h2><div class="table-wrap"><table class="champ-grid"><thead><tr><th>Year</th>${ds.map(d => `<th>${esc(d.sport.name)}</th>`).join('')}</tr></thead><tbody>
      ${years.map(y => `<tr><td><b>${y}</b></td>${ds.map(d => { const s = d.years[y]; return `<td>${s?.champion ? `${school(s.champion, 16)}${s.runnerUp ? `<div class="small muted">over ${esc(s.runnerUp)}</div>` : ''}` : `<span class="muted small">${s ? 'In progress' : ''}</span>`}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div></div>`;
  } else {
    const d = pick, years = Object.keys(d.years).map(Number).sort((a, b) => b - a);
    const confs = [...new Set(years.flatMap(y => [...Object.keys(d.years[y].regChamps), ...Object.keys(d.years[y].confTChamps)]))].sort();
    body = `<div class="card"><h2>${esc(d.sport.name)}: national champions</h2><div class="table-wrap"><table><thead><tr><th>Year</th><th>Champion</th><th>Record</th><th>Runner-up</th><th>Finals</th><th>Site</th></tr></thead><tbody>
      ${years.map(y => { const s = d.years[y]; const c = s.champion && s.teams[s.champion]; return `<tr><td><b>${y}</b></td><td>${s.champion ? school(s.champion) : '<span class="muted">In progress</span>'}</td><td class="num">${c ? rec(c) : ''}</td><td>${s.runnerUp ? school(s.runnerUp, 16) : ''}</td><td class="small">${s.finals.filter(t => t !== s.champion && t !== s.runnerUp).map(esc).join(', ')}</td><td class="small muted">${esc(s.finalsName)}${s.venue ? ` · ${esc(s.venue)}` : ''}</td></tr>`; }).join('')}
    </tbody></table></div></div>
    <div class="card"><h2>${esc(d.sport.name)}: conference champions</h2><p class="small muted" style="margin-top:0">Regular season (shared on a tie) · tournament.</p><div class="table-wrap"><table><thead><tr><th>Year</th>${confs.map(c => `<th>${confLogo(d, c)} ${esc(d.conferences?.[c]?.abbr || c)}</th>`).join('')}</tr></thead><tbody>
      ${years.map(y => { const s = d.years[y]; return `<tr><td><b>${y}</b></td>${confs.map(c => `<td class="small">${(s.regChamps[c] || []).map(t => `<a class="team-link" href="#/school/${encodeURIComponent(t)}">${esc(t)}</a>`).join(' &amp; ') || '<span class="muted">—</span>'}${s.confTChamps[c] ? `<div class="muted">🏆 ${esc(s.confTChamps[c])}</div>` : ''}</td>`).join('')}</tr>`; }).join('')}
    </tbody></table></div></div>`;
  }
  app.innerHTML = `<div class="section-head"><h1>Champions</h1></div>${tabs}${body}`;
  $$('[data-cs]').forEach(b => (b.onclick = () => { ui.champSport = b.dataset.cs; renderChampions(); }));
}

// ---------- schools ----------

// Every season of every sport for one school: [{ d, y, s, t }].
function schoolSeasons(name) {
  const out = [];
  for (const d of dynasties()) for (const [y, s] of Object.entries(d.years)) if (s.teams[name]) out.push({ d, y: +y, s, t: s.teams[name] });
  return out;
}
function schoolTotals(name) {
  const rows = schoolSeasons(name);
  const x = { sports: new Set(), titles: 0, finals: 0, bids: 0, reg: 0, tour: 0, w: 0, l: 0, t: 0, cups: 0 };
  for (const { d, t } of rows) {
    x.sports.add(d.sport.id); x.w += t.w; x.l += t.l; x.t += t.t;
    if (t.finish === 'champion') x.titles++;
    if (['champion', 'runner-up', 'finals'].includes(t.finish)) x.finals++;
    if (t.finish) x.bids++;
    if (t.regChamp) x.reg++;
    if (t.tourneyChamp) x.tour++;
  }
  for (const y of cupYears(ctx.history)) if (cupStandings(ctx.history, y).schools[0]?.school === name) x.cups++;
  return x;
}

export function renderSchools() {
  const names = allSchools();
  if (!names.length) return renderHome();
  const totals = Object.fromEntries(names.map(n => [n, schoolTotals(n)]));
  const f = ui.schoolFilter.toLowerCase();
  const list = names.filter(n => !f || n.toLowerCase().includes(f)).sort((a, b) => totals[b].titles - totals[a].titles || totals[b].finals - totals[a].finals || a.localeCompare(b));
  app.innerHTML = `<div class="section-head"><h1>Schools</h1><span class="muted">${names.length} schools in ${dynasties().length} sports</span><span class="spacer"></span><input type="search" id="sc-find" placeholder="Find a school" value="${esc(ui.schoolFilter)}" style="min-width:200px"></div>
    <div class="card"><div class="table-wrap"><table><thead><tr><th>School</th><th class="num">Sports</th><th class="num" title="National titles">Titles</th><th class="num" title="Reached the finals site (Final Four, World Series, College Cup)">Finals</th><th class="num" title="National tournament appearances">Bids</th><th class="num" title="Regular-season conference titles">Conf.</th><th class="num" title="Conference tournament titles">Conf. T</th><th class="num" title="All-Sports Cup wins">Cups</th><th class="num">All-time W-L</th></tr></thead><tbody>
      ${list.map(n => { const x = totals[n]; return `<tr><td>${school(n)}</td><td class="num">${x.sports.size}</td><td class="num"><b>${x.titles || ''}</b></td><td class="num">${x.finals || ''}</td><td class="num">${x.bids || ''}</td><td class="num">${x.reg || ''}</td><td class="num">${x.tour || ''}</td><td class="num">${x.cups || ''}</td><td class="num">${rec(x)}</td></tr>`; }).join('')}
    </tbody></table></div></div>`;
  const find = $('#sc-find');
  find.oninput = () => { ui.schoolFilter = find.value; const pos = find.selectionStart; renderSchools(); const el = $('#sc-find'); el.focus(); el.setSelectionRange(pos, pos); };
}

export function renderSchool(name) {
  const rows = schoolSeasons(name);
  if (!rows.length) { app.innerHTML = `<div class="empty">No history for ${esc(name)} yet. <a href="#/schools">All schools</a></div>`; return; }
  const look = schoolLook(name), x = schoolTotals(name);
  const bySport = {};
  for (const r of rows) (bySport[r.d.sport.id] ||= { d: r.d, rows: [] }).rows.push(r);
  const sportOrder = dynasties().map(d => d.sport.id).filter(id => bySport[id]);
  const cupRows = cupYears(ctx.history).map(y => { const c = cupStandings(ctx.history, y); const i = c.schools.findIndex(s => s.school === name); return i < 0 ? null : { y, rank: i + 1, ...c.schools[i], of: c.schools.length }; }).filter(Boolean).reverse();
  const kpi = (v, l) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  app.innerHTML = `<div class="section-head"><h1 class="school-head">${logoImg(name, 40)} ${esc(name)}</h1><span class="muted">${esc(look.mascot || '')}</span></div>
    <div class="kpis">${kpi(x.titles, 'National titles')}${kpi(x.finals, 'Finals-site trips')}${kpi(x.bids, 'National tournaments')}${kpi(x.reg + x.tour, 'Conference titles')}${kpi(x.cups, 'All-Sports Cups')}${kpi(rec(x), 'All-time, every sport')}</div>
    ${cupRows.length ? `<div class="card"><h2>All-Sports Cup</h2><div class="table-wrap"><table><thead><tr><th>Year</th><th class="num">Rank</th><th class="num">Points</th>${dynasties().map(d => `<th class="num" title="${esc(d.sport.name)}">${esc(d.sport.short)}</th>`).join('')}</tr></thead><tbody>
      ${cupRows.map(c => `<tr><td>${c.y}</td><td class="num"><b>${c.rank}</b> <span class="muted small">of ${c.of}</span></td><td class="num"><b>${c.total}</b></td>${dynasties().map(d => `<td class="num">${c.bySport[d.sport.id] ?? '<span class="muted">—</span>'}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div></div>` : ''}
    ${sportOrder.map(id => { const { d, rows: rs } = bySport[id]; rs.sort((a, b) => b.y - a.y); const tot = rs.reduce((a, r) => ({ w: a.w + r.t.w, l: a.l + r.t.l, t: a.t + r.t.t, ti: a.ti + (r.t.finish === 'champion' ? 1 : 0) }), { w: 0, l: 0, t: 0, ti: 0 });
      return `<div class="card"><div class="row" style="margin-bottom:6px"><h2 style="margin:0">${esc(d.sport.name)}</h2><span class="muted small">${rs.length} season${rs.length === 1 ? '' : 's'} · ${rec(tot)}${tot.ti ? ` · ${tot.ti} national title${tot.ti > 1 ? 's' : ''}` : ''}</span></div>
      <div class="table-wrap"><table><thead><tr><th>Year</th><th>Conference</th><th>Coach</th><th class="num">Record</th><th class="num">Conf.</th><th>Titles</th><th>National tournament</th><th class="num">Final rank</th></tr></thead><tbody>
        ${rs.map(({ y, s, t }) => `<tr><td>${y}${s.complete ? '' : '<span class="muted">*</span>'}</td><td class="small">${t.conf ? `${confLogo(d, t.conf, 16)} ${esc(d.conferences?.[t.conf]?.abbr || t.conf)}` : ''}</td><td class="small">${esc(t.coach || '—')}</td><td class="num">${rec(t)}</td><td class="num">${t.cw + t.cl + t.ct ? confRec(t) : ''}</td>
          <td>${t.regChamp ? '<span class="badge">Reg. season</span> ' : ''}${t.tourneyChamp ? '<span class="badge gold">Tournament</span>' : ''}</td>
          <td>${t.finish ? `${t.finish === 'champion' ? '<b>🏆 National champion</b>' : esc(finishText(d, s, t))}${t.seed ? ` <span class="muted small">(${t.seed} seed${t.natW + t.natL ? `, ${t.natW}-${t.natL}` : ''})</span>` : ''}` : '<span class="muted">—</span>'}</td><td class="num">${t.rank ?? '<span class="muted">NR</span>'}</td></tr>`).join('')}
      </tbody></table></div></div>`; }).join('')}
    <p class="small muted">* season in progress when the backup was uploaded.</p>`;
}

// ---------- the all-sports cup ----------

export function renderCup() {
  const years = cupYears(ctx.history);
  if (!years.length) { app.innerHTML = `<div class="section-head"><h1>All-Sports Cup</h1></div><div class="empty">The cup is scored once a sport crowns a national champion. Upload a finished season.</div>`; return; }
  if (!years.includes(ui.cupYear)) ui.cupYear = years[years.length - 1];
  const c = cupStandings(ctx.history, ui.cupYear, ui.cupGender);
  const winners = years.slice().reverse().map(y => ({ y, all: cupStandings(ctx.history, y).schools[0], w: cupStandings(ctx.history, y, 'women').schools[0], m: cupStandings(ctx.history, y, 'men').schools[0] }));
  const head = (rows, key) => `<table><thead><tr><th></th><th>${key === 'school' ? 'School' : 'Conference'}</th><th class="num">Points</th>${c.sports.map(s => `<th class="num" title="${esc(s.name)}">${esc(s.short)}</th>`).join('')}${key === 'conf' ? '<th class="num">Schools</th>' : ''}</tr></thead><tbody>
    ${rows.map((x, i) => `<tr><td class="num muted">${i + 1}</td><td>${key === 'school' ? school(x.school) : esc(x.conf)}</td><td class="num"><b>${x.total}</b></td>${c.sports.map(s => `<td class="num">${x.bySport[s.id] ? x.bySport[s.id] : '<span class="muted">·</span>'}</td>`).join('')}${key === 'conf' ? `<td class="num">${x.schools}</td>` : ''}</tr>`).join('')}</tbody></table>`;
  app.innerHTML = `<div class="section-head"><h1>AAU All-Sports Cup</h1><span class="muted">Points for every national tournament finish, like the Directors' Cup</span></div>
    <div class="row" style="margin-bottom:14px">
      <label class="field">Year <select id="cup-year">${years.slice().reverse().map(y => `<option ${y === ui.cupYear ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
      <div class="seg">${[['all', 'All sports'], ['women', "Women's"], ['men', "Men's"]].map(([k, l]) => `<button class="btn sm ${ui.cupGender === k ? 'primary' : ''}" data-cg="${k}">${l}</button>`).join('')}</div>
      <div class="seg">${[['schools', 'Schools'], ['conferences', 'Conferences']].map(([k, l]) => `<button class="btn sm ${ui.cupView === k ? 'primary' : ''}" data-cv="${k}">${l}</button>`).join('')}</div>
    </div>
    <div class="card"><h2>${ui.cupYear} ${ui.cupGender === 'women' ? "Women's " : ui.cupGender === 'men' ? "Men's " : ''}standings</h2>
      ${c.sports.length ? `<div class="table-wrap">${ui.cupView === 'schools' ? head(c.schools.filter(x => x.total > 0), 'school') : head(c.conferences, 'conf')}</div><p class="small muted">Sports counted: ${c.sports.map(s => esc(s.name)).join(', ')}. ${ui.cupView === 'schools' ? 'Schools with no points are left out.' : 'A school counts for the conference it played that sport in that year.'}</p>` : '<p class="muted">No finished seasons in these sports this year.</p>'}
    </div>
    <div class="grid" style="margin-top:16px">
      <div class="card"><h2>Cup winners</h2><div class="table-wrap"><table><thead><tr><th>Year</th><th>All sports</th><th>Women's</th><th>Men's</th></tr></thead><tbody>
        ${winners.map(x => `<tr><td><b>${x.y}</b></td><td>${x.all ? `${school(x.all.school, 16)} <span class="muted small">${x.all.total}</span>` : ''}</td><td>${x.w ? school(x.w.school, 16) : ''}</td><td>${x.m ? school(x.m.school, 16) : ''}</td></tr>`).join('')}
      </tbody></table></div></div>
      <div class="card"><h2>Scoring</h2><table><tbody>
        <tr><td>National champion</td><td class="num">${CUP_POINTS.champion}</td></tr><tr><td>Runner-up</td><td class="num">${CUP_POINTS['runner-up']}</td></tr>
        <tr><td>Reached the finals site (Final Four, World Series, College Cup)</td><td class="num">${CUP_POINTS.finals}</td></tr><tr><td>Reached a super regional</td><td class="num">${CUP_POINTS.super}</td></tr>
        <tr><td>In the national tournament</td><td class="num">${CUP_POINTS.field} + ${CUP_POINTS.perWin} a win (max ${CUP_POINTS.fieldMax})</td></tr></tbody></table>
        <p class="small muted">A sport counts toward a year's cup once its national champion is crowned.</p></div>
    </div>`;
  $('#cup-year').onchange = e => { ui.cupYear = +e.target.value; renderCup(); };
  $$('[data-cg]').forEach(b => (b.onclick = () => { ui.cupGender = b.dataset.cg; renderCup(); }));
  $$('[data-cv]').forEach(b => (b.onclick = () => { ui.cupView = b.dataset.cv; renderCup(); }));
}

// ---------- data ----------

export function renderData() {
  const ds = dynasties();
  app.innerHTML = `<div class="section-head"><h1>Data</h1><span class="muted">What's in this browser's history</span></div>
    <div class="card"><h2>Dynasties</h2>${ds.length ? `<div class="table-wrap"><table><thead><tr><th>Sport</th><th>Dynasty</th><th>Seasons</th><th>Last upload</th><th></th></tr></thead><tbody>
      ${ds.map(d => { const ys = Object.keys(d.years).map(Number).sort((a, b) => a - b); const stale = (d.version || 0) < EXTRACT_VERSION; return `<tr><td>${sportTag(d.sport)}${d.sport.custom ? ' <span class="badge">new sport</span>' : ''}</td><td>${esc(d.name)}<div class="small muted">${esc(d.fileName || '')}</div></td><td>${ys.length ? `${ys[0]}${ys.length > 1 ? `–${ys[ys.length - 1]}` : ''} <span class="muted small">(${ys.length})</span>` : ''}${ys.some(y => !d.years[y].complete) ? ' <span class="badge">in progress</span>' : ''}</td><td class="small">${d.uploadedAt ? new Date(d.uploadedAt).toLocaleString() : ''}${stale ? '<div class="warn-text small">Upload again to refresh</div>' : ''}</td><td><button class="btn sm danger" data-rm="${esc(d.sport.id)}">Remove</button></td></tr>`; }).join('')}
    </tbody></table></div>` : '<p class="muted">Nothing uploaded yet.</p>'}
    ${uploadBox()}
    <label class="check" style="margin-top:8px"><input type="checkbox" id="force-ask" ${ctx.forceAsk ? 'checked' : ''}> Ask which sport each file is, even when it's clear</label></div>
    <div class="card"><h2>Backups</h2><p class="small muted" style="margin-top:0">The history is saved in this browser. Download a backup to keep a copy or to move it to another device, and restore it there (or upload it on the home page).</p>
      <div class="row"><button class="btn" id="d-export" ${ds.length ? '' : 'disabled'}>Download history backup</button><label class="btn">Restore history backup <input type="file" id="d-import" accept="application/json,.json" hidden></label><span class="spacer"></span><button class="btn danger" id="d-reset" ${ds.length ? '' : 'disabled'}>Clear all history</button></div></div>`;
  bindUpload();
  $('#force-ask').onchange = e => { ctx.forceAsk = e.target.checked; };
  $$('[data-rm]').forEach(b => (b.onclick = async () => {
    const d = ctx.history.dynasties[b.dataset.rm];
    if (!confirm(`Remove ${d.sport.name} from the history? Upload its backup again to bring it back.`)) return;
    delete ctx.history.dynasties[b.dataset.rm]; await saveHistory(ctx.history); toast(`${d.sport.name} removed.`); renderData();
  }));
  $('#d-export').onclick = () => exportHistory(ctx.history);
  $('#d-import').onchange = e => { handleFiles([...e.target.files]); e.target.value = ''; };
  $('#d-reset').onclick = async () => { if (!confirm('Clear all history in this browser? Download a backup first if you want to keep it.')) return; ctx.history = emptyHistory(); await saveHistory(ctx.history); toast('History cleared.'); renderData(); };
}
