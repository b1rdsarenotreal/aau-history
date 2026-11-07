// Turns a dynasty backup into history: for every season, every team's
// record, conference, coach, conference titles and national tournament
// finish, the season's champions, and every game's result in a compact form
// (for the school pages' schedules). Only this summary is kept (a full
// backup can be megabytes per season); re-upload the backup to refresh it.

// Bump when the summary's shape or meaning changes; the Data page then asks
// for a fresh upload of older entries.
export const EXTRACT_VERSION = 4; // 2: games for the schools' schedules; 3: national tournament brackets; 4: conference tournament brackets

const NATIONAL = new Set(['regional', 'super', 'mcws']);
const isFinal = g => g && g.final && g.homeR != null && g.awayR != null;

// Who won a game: more goals/runs/sets, or the shootout. Null when level.
export function winnerOf(g) {
  if (g.homeR > g.awayR) return g.home;
  if (g.awayR > g.homeR) return g.away;
  if (g.pk && g.pk.home !== g.pk.away) return g.pk.home > g.pk.away ? g.home : g.away;
  return null;
}
// 'W', 'L' or 'T' for team t under the sport's rules: a shootout decides the
// record only when the sport says so (field hockey); otherwise a level match
// is a tie (soccer).
export function resultFor(g, t, sport) {
  const level = g.homeR === g.awayR;
  if (level && !(sport.pkWins && g.pk)) return 'T';
  return winnerOf(g) === t ? 'W' : 'L';
}

const blank = () => ({ w: 0, l: 0, t: 0, cw: 0, cl: 0, ct: 0, gf: 0, ga: 0 });
export const pct = r => (r.w + r.l + r.t ? (r.w + r.t / 2) / (r.w + r.l + r.t) : 0);

// Teams that reached the finals site, in either finals format.
function finalsTeams(post) {
  return post.mcws?.seeds || (post.mcwsBrackets || []).flatMap(ev => ev.seeds || []);
}

// Regular-season conference champions: the best conference record (points
// when the sport has ties, winning percentage otherwise), shared on a tie,
// unless the commissioner named one champion in the dynasty.
function regChamps(season, recs, sport) {
  const out = {};
  const byConf = {};
  for (const [t, team] of Object.entries(season.teams)) if (team.conference && team.conference !== 'Independent') (byConf[team.conference] ||= []).push(t);
  const done = season.games.some(g => g.type === 'regular') && season.games.filter(g => g.type === 'regular').every(isFinal);
  for (const [c, list] of Object.entries(byConf)) {
    const o = season.overrides?.regChamps?.[c];
    if (o) { out[c] = [o]; continue; }
    const played = list.filter(t => recs[t].cw + recs[t].cl + recs[t].ct > 0);
    if (!played.length || !done) continue;
    const score = t => (sport.ties ? (3 * recs[t].cw + recs[t].ct) / (recs[t].cw + recs[t].cl + recs[t].ct) : (recs[t].cw + recs[t].ct / 2) / (recs[t].cw + recs[t].cl + recs[t].ct));
    const best = Math.max(...played.map(score));
    out[c] = played.filter(t => Math.abs(score(t) - best) < 1e-9).sort();
  }
  return out;
}

// Every game in a compact form for the school pages' schedules:
//   w week, d day, o order within the week (7 or more: after the weekend),
//   h home, a away, hr/ar the score (final games only), x periods played,
//   t type (left out for the regular season), c a conference game,
//   n a neutral site, v the venue (arena and city), hs the host school, lb the event's label (a
//   tournament or a round), e the event (postseason), pk the shootout.
function compactGames(season) {
  const out = [];
  for (const g of season.games || []) {
    if (!g.home || !g.away || !season.teams[g.home] || !season.teams[g.away]) continue;
    const c = { w: g.week, d: g.day, h: g.home, a: g.away };
    if (g.order != null) c.o = Math.round(g.order * 100) / 100;
    if (isFinal(g)) { c.hr = g.homeR; c.ar = g.awayR; if (Array.isArray(g.homeLine)) c.x = g.homeLine.length; }
    if (g.type && g.type !== 'regular') c.t = g.type;
    if (g.confGame) c.c = 1;
    if (g.neutral) c.n = 1;
    // Where a neutral-site game was: an arena (basketball's { stadium, city })
    // or the school whose field it was played at.
    if (g.venue && typeof g.venue === 'object') c.v = [g.venue.stadium, g.venue.city].filter(Boolean).join(', ');
    else if (typeof g.venue === 'string') c.v = g.venue;
    if (g.site) c.hs = g.site;
    if (g.label) c.lb = g.label;
    if (g.event) c.e = g.event;
    if (g.pk && isFinal(g)) c.pk = [g.pk.home, g.pk.away];
    out.push(c);
  }
  return out;
}

// The national tournament, enough to draw its bracket: the field (team,
// national seed, automatic bid) and every event (regions or regionals,
// super regionals, the finals) with its bracket nodes and each node's game.
// Node sides are a seed index into the event's seeds (a number) or another
// node's winner or loser ('w:KEY', 'l:KEY').
const STAGE = { regionals: 'reg', supers: 'sup', mcws: 'fin', mcwsBrackets: 'finb', mcwsFinals: 'fins' };
// One bracket event (a regional, a finals bracket, a conference tournament)
// in a compact form: its seeds, champion, site and nodes with their games.
function compactEvent(season, ev, st, games) {
  const side = x => (x == null ? null : 'seed' in x ? x.seed : x.w != null ? `w:${x.w}` : x.l != null ? `l:${x.l}` : null);
  const site = () => {
    if (ev.venue && typeof ev.venue === 'object') return [ev.venue.stadium, ev.venue.city].filter(Boolean).join(', ');
    const h = ev.host && season.teams[ev.host];
    return h ? [h.stadium, h.city].filter(Boolean).join(', ') : '';
  };
  return {
        id: ev.id, st, k: ev.kind, n: ev.name || null, p: ev.path ?? null, b: ev.bracket || null,
        h: ev.host || null, v: site() || null, home: ev.homeSites ? 1 : undefined,
        s: ev.seeds || [], c: ev.champion || null,
        nodes: ev.nodes.map(n => {
          const g = n.gameId != null ? games.get(n.gameId) : null;
          const o = { k: n.key, lb: n.label || n.code || '', a: side(n.a), b: side(n.b), sec: n.sec, col: n.col, dp: n.depth, w: n.winner || null, l: n.loser || null };
          if (n.cond) o.cond = n.cond;
          if (g) {
            o.g = { h: g.home, a: g.away, d: g.day || n.day || null };
            if (isFinal(g)) {
              Object.assign(o.g, { hr: g.homeR, ar: g.awayR });
              if (Array.isArray(g.homeLine)) o.g.x = g.homeLine.length;
              if (g.pk) o.g.pk = [g.pk.home, g.pk.away];
            }
          }
          return o;
        }),
  };
}
const gameMap = season => new Map((season.games || []).map(g => [g.id, g]));
function compactTournament(season) {
  const post = season.post || {};
  if (!post.field?.length) return null;
  const games = gameMap(season);
  const events = [];
  for (const [key, st] of Object.entries(STAGE)) {
    const list = Array.isArray(post[key]) ? post[key] : post[key] ? [post[key]] : [];
    for (const ev of list) if (ev?.nodes) events.push(compactEvent(season, ev, st, games));
  }
  return {
    field: post.field.map(f => [f.team, f.seed, f.bid === 'auto' ? 1 : 0]),
    cfg: post.cfg || season.settings?.ncaa || null,
    events,
  };
}

// Each conference tournament's bracket, by conference.
function compactConfTournaments(season) {
  const out = {}, games = gameMap(season);
  for (const [c, ev] of Object.entries(season.post?.confT || {})) if (ev?.nodes?.length) out[c] = compactEvent(season, ev, 'ct', games);
  return Object.keys(out).length ? out : undefined;
}

// One season's summary.
export function seasonSummary(season, league, sport) {
  const post = season.post || {};
  const recs = {};
  for (const t of Object.keys(season.teams)) recs[t] = blank();
  const nat = {}; // national tournament wins/losses
  for (const g of season.games || []) {
    if (!isFinal(g) || !recs[g.home] || !recs[g.away]) continue;
    for (const t of [g.home, g.away]) {
      const r = recs[t], res = resultFor(g, t, sport);
      r[res.toLowerCase()]++;
      r.gf += t === g.home ? g.homeR : g.awayR; r.ga += t === g.home ? g.awayR : g.homeR;
      if (g.type === 'regular' && g.confGame) r['c' + res.toLowerCase()]++;
      if (NATIONAL.has(g.type)) { const n = (nat[t] ||= { w: 0, l: 0 }); winnerOf(g) === t ? n.w++ : n.l++; }
    }
  }
  const champs = regChamps(season, recs, sport);
  const confT = {};
  for (const [c, ev] of Object.entries(post.confT || {})) if (ev?.champion) confT[c] = ev.champion;
  const field = Object.fromEntries((post.field || []).map(f => [f.team, f.seed]));
  const finals = finalsTeams(post);
  const supers = new Set((post.supers || []).flatMap(ev => ev.seeds || []));
  const finalPoll = (season.polls?.final?.ranks || []).map(r => r.team);
  const complete = season.phase === 'complete' && !!post.champion;
  const teams = {};
  for (const [t, team] of Object.entries(season.teams)) {
    const r = recs[t];
    let finish = null;
    if (post.champion === t) finish = 'champion';
    else if (post.runnerUp === t) finish = 'runner-up';
    // The finals site counts as its own round only when the field is bigger
    // than it (men's volleyball plays its whole field there).
    else if (finals.includes(t) && finals.length < (post.field || []).length) finish = 'finals';
    else if (supers.has(t)) finish = 'super';
    else if (field[t] != null) finish = 'field';
    teams[t] = {
      conf: team.conference || null,
      coach: league.coaches?.[team.coachId]?.name || '',
      ...r,
      regChamp: (champs[team.conference] || []).includes(t) || undefined,
      tourneyChamp: confT[team.conference] === t || undefined,
      seed: field[t] ?? undefined,
      natW: nat[t]?.w || 0, natL: nat[t]?.l || 0,
      finish: finish || undefined,
      rank: finalPoll.includes(t) ? finalPoll.indexOf(t) + 1 : undefined,
    };
  }
  return {
    complete,
    games: compactGames(season),
    nt: compactTournament(season),
    ct: compactConfTournaments(season),
    reg: season.settings?.periods ?? season.settings?.innings ?? null, // regulation periods, when the app sets them
    finalsName: season.settings?.mcwsName || sport.finals,
    venue: [season.settings?.mcwsVenue, season.settings?.mcwsCity].filter(Boolean).join(', '),
    champion: post.champion || null, runnerUp: post.runnerUp || null,
    finals: finals.slice(), fieldSize: (post.field || []).length,
    regChamps: champs, confTChamps: confT,
    teams,
  };
}

// The whole backup: { sport, name, years: { y: summary }, schools: { school: look } }.
export function extractDynasty(league, sport) {
  const years = {};
  const schools = {};
  const ys = Object.keys(league.seasons || {}).map(Number).sort((a, b) => a - b);
  for (const y of ys) {
    const season = league.seasons[y];
    if (!season?.teams || !Array.isArray(season.games)) continue;
    // Seasons not started yet add nothing.
    if (!season.games.some(isFinal)) continue;
    years[y] = seasonSummary(season, league, sport);
    for (const [t, team] of Object.entries(season.teams)) {
      // Keep the latest look of each school (colors, abbreviation, mascot,
      // its own logo when it's a link; uploaded images are left out to keep
      // the history small).
      const logo = team.logoOverride && !/^data:/.test(team.logoOverride) ? team.logoOverride : null;
      schools[t] = { school: t, abbr: team.abbr, mascot: team.mascot, color: team.color, altColor: team.altColor, logo: logo || schools[t]?.logo || null };
    }
  }
  const conferences = {};
  for (const [c, info] of Object.entries(league.conferences || {})) {
    if (c === 'Independent') continue;
    conferences[c] = { abbr: info.abbr, color: info.color, logo: info.logo && !/^data:/.test(info.logo) ? info.logo : null };
  }
  return { version: EXTRACT_VERSION, sport, name: league.name || sport.name, years, schools, conferences };
}
