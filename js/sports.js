// The sports AAU History knows, and how to tell which one a backup is.
//
// Every AAU dynasty app (volleyball, softball and baseball, soccer, field
// hockey, basketball, lacrosse, ice hockey, and any later one built on the
// same engine) saves its backup as
// the league itself: { name, side, seasons: { year: { teams, games, post,
// polls, ... } }, conferences, coaches }. AAU History reads any of them.
//
// A sport profile:
//   id      key the history is stored under (one per dynasty)
//   name    shown on the page ("Women's Soccer")
//   short   for narrow columns ("W Soc")
//   gender  'women' | 'men' (the all-sports cup can show either or both)
//   finals  the national finals' name when the backup doesn't give one
//   ties    whether level games can stand as ties (soccer, ice hockey)
//   pkWins  whether a shootout decides the result in the record (field
//           hockey: yes; soccer: no, the match is a tie in the record)
//   reg     regulation periods, when the backup doesn't say (halves,
//           quarters, periods or innings; volleyball plays sets)
//   unit    'match' or 'game', as the sport's app says it
//   start   the Monday of week 1 for a season year, as the sport's app
//           counts its calendar (seasons are academic years: the 2030
//           season's spring sports are played in 2031)

// In season order: fall, winter, spring.
// Week-1 Mondays, from each app's calendar.
const utc = (y, m, d) => new Date(Date.UTC(y, m, d));
const lastWeekday = (y, m, last, dow) => last - ((utc(y, m, last).getUTCDay() - dow + 7) % 7); // the last <dow> on or before day `last`
const firstMonday = (y, m) => 1 + ((8 - utc(y, m, 1).getUTCDay()) % 7);
const START = {
  fallFri: y => utc(y, 7, lastWeekday(y, 7, 31, 5) - 4), // the week of the last Friday in August
  fallThu: y => utc(y, 7, lastWeekday(y, 7, 31, 4) - 3), // the week of the last Thursday in August (soccer)
  janFri2: y => { const f = 1 + ((5 - utc(y + 1, 0, 1).getUTCDay() + 7) % 7) + 7; return utc(y + 1, 0, f - 4); }, // second Friday of January
  febFri2: y => { const f = 1 + ((5 - utc(y + 1, 1, 1).getUTCDay() + 7) % 7) + 7; return utc(y + 1, 1, f - 4); }, // second Friday of February
  octMon: y => utc(y, 9, firstMonday(y, 9)), // the first Monday in October
  novMon: y => utc(y, 10, firstMonday(y, 10)), // the first Monday in November
  janMon: y => { const d = utc(y + 1, 0, 26); return utc(y + 1, 0, 26 + ((8 - d.getUTCDay()) % 7)); }, // the last Monday in January
};

// In season order: fall, winter, spring.
export const SPORTS = {
  'w-volleyball': { name: "Women's Volleyball", short: 'W VB', gender: 'women', finals: 'Final Four', unit: 'match', start: START.fallFri },
  'm-volleyball': { name: "Men's Volleyball", short: 'M VB', gender: 'men', finals: 'National Tournament', unit: 'match', start: START.janFri2 },
  'w-soccer': { name: "Women's Soccer", short: 'W Soc', gender: 'women', finals: 'College Cup', ties: true, reg: 2, unit: 'match', start: START.fallThu },
  'm-soccer': { name: "Men's Soccer", short: 'M Soc', gender: 'men', finals: 'College Cup', ties: true, reg: 2, unit: 'match', start: START.fallThu },
  'field-hockey': { name: 'Field Hockey', short: 'FH', gender: 'women', finals: 'Final Four', pkWins: true, reg: 4, unit: 'match', start: START.fallFri },
  'w-basketball': { name: "Women's Basketball", short: 'W BB', gender: 'women', finals: 'Final Four', reg: 4, unit: 'game', start: START.novMon },
  'm-basketball': { name: "Men's Basketball", short: 'M BB', gender: 'men', finals: 'Final Four', reg: 2, unit: 'game', start: START.novMon },
  'w-hockey': { name: "Women's Ice Hockey", short: 'W IH', gender: 'women', finals: 'Frozen Four', ties: true, reg: 3, unit: 'game', start: START.octMon },
  'm-hockey': { name: "Men's Ice Hockey", short: 'M IH', gender: 'men', finals: 'Frozen Four', ties: true, reg: 3, unit: 'game', start: START.octMon },
  softball: { name: 'Softball', short: 'SB', gender: 'women', finals: "Women's College World Series", reg: 7, unit: 'game', innings: true, start: START.febFri2 },
  baseball: { name: 'Baseball', short: 'BSB', gender: 'men', finals: 'College World Series', reg: 9, unit: 'game', innings: true, start: START.febFri2 },
  'w-lacrosse': { name: "Women's Lacrosse", short: 'W Lax', gender: 'women', finals: 'Final Four', reg: 4, unit: 'game', start: START.janMon },
  'm-lacrosse': { name: "Men's Lacrosse", short: 'M Lax', gender: 'men', finals: 'Final Four', reg: 4, unit: 'game', start: START.janMon },
};
for (const [id, p] of Object.entries(SPORTS)) p.id = id;

// A sport the history hasn't seen before: named by the commissioner on upload.
export function customSport(name, gender) {
  const id = `x-${gender}-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  return { id, name, short: name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 4), gender, finals: 'National Championship', custom: true };
}

// What the regular-season line scores look like: the usual number of periods,
// the largest score in a period, how often R is the sum of the line (every
// sport but volleyball, whose R is sets won) and the average score per team.
// Volleyball has 3–5 sets of up to 25+ points; softball 7 innings, baseball
// 9; soccer 2 halves; ice hockey 3 periods; basketball 2 halves or 4
// quarters of many points; field hockey and lacrosse 4 quarters (lacrosse
// about 11 goals a team, field hockey about 2–3).
function lineShape(league) {
  const lens = [], tops = [];
  let summed = 0, points = 0;
  for (const s of Object.values(league.seasons || {})) {
    for (const g of s.games || []) {
      if (g.type !== 'regular' || !g.final || !Array.isArray(g.homeLine) || !g.homeLine.length) continue;
      const line = g.homeLine.map(Number).filter(Number.isFinite);
      lens.push(g.homeLine.length);
      tops.push(Math.max(...line, ...(g.awayLine || []).map(Number).filter(Number.isFinite)));
      const sum = line.reduce((a, b) => a + b, 0);
      if (Number(g.homeR) === sum) summed++;
      points += (Number(g.homeR) || 0) + (Number(g.awayR) || 0);
      if (lens.length > 400) break;
    }
  }
  if (!lens.length) return null;
  const mode = arr => { const c = {}; for (const x of arr) c[x] = (c[x] || 0) + 1; return +Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; };
  const sums = summed / lens.length > 0.5;
  return { len: mode(lens), top: Math.max(...tops), sums, avg: sums ? points / lens.length / 2 : 0 };
}

// The one sport a name or file name mentions ('basketball', 'field-hockey',
// …), or null when it names none or several ("softball-baseball").
export function sportWord(text) {
  const t = String(text || '').toLowerCase().replace(/[^a-z]+/g, ' ');
  const found = [
    ['volleyball', /volleyball/], ['basketball', /basketball/], ['lacrosse', /lacrosse/],
    ['field-hockey', /field hockey|fhockey/], ['hockey', /(^|[^d] )hockey|^hockey/], ['soccer', /soccer/],
    ['softball', /softball/], ['baseball', /baseball/],
  ].filter(([, re]) => re.test(t)).map(([w]) => w);
  return found.length === 1 ? found[0] : null;
}
export const sportFamily = sport => sport.custom ? null : sport.id.replace(/^[wm]-/, '');

// Which sport a backup is: { sport, sure }. `sure` is false when it had to
// guess; the upload screen lets the commissioner pick another.
export function detectSport(league) {
  const name = String(league?.name || '').toLowerCase();
  const side = league?.side;
  const men = side === 'men' || /\bmen'?s\b/.test(name) && !/women/.test(name);
  if (side === 'softball') return { sport: SPORTS.softball, sure: true };
  if (side === 'baseball') return { sport: SPORTS.baseball, sure: true };
  // Newer apps say which sport they are.
  const tagged = { basketball: 'basketball', lacrosse: 'lacrosse', hockey: 'hockey' }[league?.sport];
  if (tagged) return { sport: SPORTS[`${men ? 'm' : 'w'}-${tagged}`], sure: true };
  const shape = lineShape(league);
  const pick = fam => SPORTS[fam] || SPORTS[`${men ? 'm' : 'w'}-${fam}`];
  if (shape) {
    if (!shape.sums && shape.top >= 15 && shape.len >= 3 && shape.len <= 5) return { sport: pick('volleyball'), sure: true };
    if (shape.sums && shape.avg >= 35 && (shape.len === 2 || shape.len === 4)) return { sport: pick('basketball'), sure: true };
    if (shape.len === 7) return { sport: SPORTS.softball, sure: true };
    if (shape.len === 9) return { sport: SPORTS.baseball, sure: true };
    if (shape.len === 3 && shape.top < 10) return { sport: pick('hockey'), sure: true };
    if (shape.len === 2 && shape.top < 10) return { sport: pick('soccer'), sure: true };
    if (shape.len === 4 && shape.avg >= 7) return { sport: pick('lacrosse'), sure: true };
    if (shape.len === 4 && shape.top < 10) return { sport: SPORTS['field-hockey'], sure: true };
  }
  // No results yet (or a new sport): go by the name.
  if (/volleyball/.test(name)) return { sport: SPORTS[men ? 'm-volleyball' : 'w-volleyball'], sure: true };
  if (/soccer/.test(name)) return { sport: SPORTS[men ? 'm-soccer' : 'w-soccer'], sure: true };
  if (/field hockey|fhockey/.test(name)) return { sport: SPORTS['field-hockey'], sure: true };
  if (/basketball/.test(name)) return { sport: SPORTS[men ? 'm-basketball' : 'w-basketball'], sure: true };
  if (/lacrosse/.test(name)) return { sport: SPORTS[men ? 'm-lacrosse' : 'w-lacrosse'], sure: true };
  if (/hockey/.test(name)) return { sport: SPORTS[men ? 'm-hockey' : 'w-hockey'], sure: true };
  if (/softball/.test(name)) return { sport: SPORTS.softball, sure: true };
  if (/baseball/.test(name)) return { sport: SPORTS.baseball, sure: true };
  const guess = String(league?.name || 'New sport').replace(/^AAU\s+/i, '').replace(/^(wo)?men'?s\s+/i, '').trim() || 'New sport';
  return { sport: customSport(guess, men ? 'men' : 'women'), sure: false };
}

// Is this file a dynasty backup at all?
export function isDynastyBackup(data) {
  return !!(data && typeof data === 'object' && data.seasons && typeof data.seasons === 'object' && Object.values(data.seasons).some(s => s && s.teams && Array.isArray(s.games)));
}
