// The AAU All-Sports Cup: points for each school's finish in each sport's
// national tournament, like the Directors' Cup. A finish counts once the
// season's champion is crowned.
//
//   National champion            100
//   Runner-up                     85
//   Reached the finals site       70   (Final Four, Frozen Four, World Series, College Cup)
//   Reached a super regional      55
//   In the national tournament    30, plus 8 for each national tournament win
//                                       (at most 50)
//
// The conference cup adds up its members' points in each sport (a school
// counts for the conference it played that sport in that year).

import { SPORTS } from './sports.js?v=20261104002323';

const sportRank = sp => { const i = Object.keys(SPORTS).indexOf(sp.id); return i < 0 ? 99 : i; };

export const CUP_POINTS = { champion: 100, 'runner-up': 85, finals: 70, super: 55, field: 30, perWin: 8, fieldMax: 50 };

export function finishPoints(t) {
  if (!t?.finish) return 0;
  if (t.finish === 'field') return Math.min(CUP_POINTS.fieldMax, CUP_POINTS.field + CUP_POINTS.perWin * (t.natW || 0));
  return CUP_POINTS[t.finish] || 0;
}

export const FINISH_LABEL = { champion: 'National champion', 'runner-up': 'Runner-up', finals: 'Finals site', super: 'Super regional', field: 'National tournament' };

// Every year any dynasty has a finished season in.
export function cupYears(history) {
  const ys = new Set();
  for (const d of Object.values(history.dynasties)) for (const [y, s] of Object.entries(d.years)) if (s.complete) ys.add(+y);
  return [...ys].sort((a, b) => a - b);
}

// One year's cup: { schools: [{ school, total, bySport }], conferences: [...] },
// best first. `gender` limits it to women's or men's sports ('all' for both).
export function cupStandings(history, year, gender = 'all') {
  const schools = {}, confs = {};
  const sports = [];
  for (const d of Object.values(history.dynasties)) {
    if (gender !== 'all' && d.sport.gender !== gender) continue;
    const s = d.years[year];
    if (!s?.complete) continue;
    sports.push(d.sport);
    for (const [t, row] of Object.entries(s.teams)) {
      const p = finishPoints(row);
      const x = (schools[t] ||= { school: t, total: 0, bySport: {}, titles: 0 });
      x.bySport[d.sport.id] = p;
      x.total += p;
      if (row.finish === 'champion') x.titles++;
      if (row.conf) {
        const c = (confs[row.conf] ||= { conf: row.conf, total: 0, bySport: {}, schools: new Set() });
        c.total += p; c.bySport[d.sport.id] = (c.bySport[d.sport.id] || 0) + p; c.schools.add(t);
      }
    }
  }
  const order = (a, b) => b.total - a.total || b.titles - a.titles || (a.school || a.conf).localeCompare(b.school || b.conf);
  return {
    sports: sports.sort((a, b) => sportRank(a) - sportRank(b) || a.name.localeCompare(b.name)),
    schools: Object.values(schools).sort(order),
    conferences: Object.values(confs).map(c => ({ ...c, titles: 0, schools: c.schools.size })).sort(order),
  };
}
