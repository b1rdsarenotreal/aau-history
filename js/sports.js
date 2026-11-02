// The sports AAU History knows, and how to tell which one a backup is.
//
// Every AAU dynasty app (volleyball, softball and baseball, soccer, field
// hockey, and any later one built on the same engine) saves its backup as
// the league itself: { name, side, seasons: { year: { teams, games, post,
// polls, ... } }, conferences, coaches }. AAU History reads any of them.
//
// A sport profile:
//   id      key the history is stored under (one per dynasty)
//   name    shown on the page ("Women's Soccer")
//   short   for narrow columns ("W Soc")
//   gender  'women' | 'men' (the all-sports cup can show either or both)
//   finals  the national finals' name when the backup doesn't give one
//   ties    whether level matches can stand as ties (soccer)
//   pkWins  whether a shootout decides the result in the record (field
//           hockey: yes; soccer: no, the match is a tie in the record)

export const SPORTS = {
  'w-volleyball': { name: "Women's Volleyball", short: 'W VB', gender: 'women', finals: 'Final Four' },
  'm-volleyball': { name: "Men's Volleyball", short: 'M VB', gender: 'men', finals: 'National Tournament' },
  softball: { name: 'Softball', short: 'SB', gender: 'women', finals: "Women's College World Series" },
  baseball: { name: 'Baseball', short: 'BSB', gender: 'men', finals: 'College World Series' },
  'w-soccer': { name: "Women's Soccer", short: 'W Soc', gender: 'women', finals: 'College Cup', ties: true },
  'm-soccer': { name: "Men's Soccer", short: 'M Soc', gender: 'men', finals: 'College Cup', ties: true },
  'field-hockey': { name: 'Field Hockey', short: 'FH', gender: 'women', finals: 'Final Four', pkWins: true },
};
for (const [id, p] of Object.entries(SPORTS)) p.id = id;

// A sport the history hasn't seen before: named by the commissioner on upload.
export function customSport(name, gender) {
  const id = `x-${gender}-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  return { id, name, short: name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 4), gender, finals: 'National Championship', custom: true };
}

// Typical periods in a regular-season line score, and the largest score in
// a period: volleyball has 3–5 sets of up to 25+ points; softball 7 innings,
// baseball 9; soccer 2 halves; field hockey 4 quarters.
function lineShape(league) {
  const lens = [], tops = [];
  for (const s of Object.values(league.seasons || {})) {
    for (const g of s.games || []) {
      if (g.type !== 'regular' || !g.final || !Array.isArray(g.homeLine) || !g.homeLine.length) continue;
      lens.push(g.homeLine.length);
      tops.push(Math.max(...g.homeLine.map(Number).filter(Number.isFinite), ...(g.awayLine || []).map(Number).filter(Number.isFinite)));
      if (lens.length > 400) break;
    }
  }
  if (!lens.length) return null;
  const mode = arr => { const c = {}; for (const x of arr) c[x] = (c[x] || 0) + 1; return +Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; };
  return { len: mode(lens), top: Math.max(...tops) };
}

// Which sport a backup is: { sport, sure }. `sure` is false when it had to
// guess; the upload screen lets the commissioner pick another.
export function detectSport(league) {
  const name = String(league?.name || '').toLowerCase();
  const side = league?.side;
  const men = side === 'men' || /\bmen'?s\b/.test(name) && !/women/.test(name);
  if (side === 'softball') return { sport: SPORTS.softball, sure: true };
  if (side === 'baseball') return { sport: SPORTS.baseball, sure: true };
  const shape = lineShape(league);
  if (shape) {
    if (shape.top >= 15 && shape.len >= 3 && shape.len <= 5) return { sport: SPORTS[men ? 'm-volleyball' : 'w-volleyball'], sure: true };
    if (shape.len === 2) return { sport: SPORTS[men ? 'm-soccer' : 'w-soccer'], sure: true };
    if (shape.len === 4 && shape.top < 15) return { sport: SPORTS['field-hockey'], sure: true };
    if (shape.len === 7) return { sport: SPORTS.softball, sure: true };
    if (shape.len === 9) return { sport: SPORTS.baseball, sure: true };
  }
  // No results yet (or a new sport): go by the name.
  if (/volleyball/.test(name)) return { sport: SPORTS[men ? 'm-volleyball' : 'w-volleyball'], sure: true };
  if (/soccer/.test(name)) return { sport: SPORTS[men ? 'm-soccer' : 'w-soccer'], sure: true };
  if (/field hockey|fhockey/.test(name)) return { sport: SPORTS['field-hockey'], sure: true };
  if (/softball/.test(name)) return { sport: SPORTS.softball, sure: true };
  if (/baseball/.test(name)) return { sport: SPORTS.baseball, sure: true };
  const guess = String(league?.name || 'New sport').replace(/^AAU\s+/i, '').replace(/^(wo)?men'?s\s+/i, '').trim() || 'New sport';
  return { sport: customSport(guess, men ? 'men' : 'women'), sure: false };
}

// Is this file a dynasty backup at all?
export function isDynastyBackup(data) {
  return !!(data && typeof data === 'object' && data.seasons && typeof data.seasons === 'object' && Object.values(data.seasons).some(s => s && s.teams && Array.isArray(s.games)));
}
