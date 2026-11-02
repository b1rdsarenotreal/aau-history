// Logic tests: run with `node tests/logic.test.mjs`
// The fixtures are real backups from each AAU dynasty app (two simulated
// seasons each, trimmed and gzipped).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { detectSport, isDynastyBackup, SPORTS } from '../js/sports.js';
import { extractDynasty, resultFor, winnerOf } from '../js/extract.js';
import { emptyHistory, mergeDynasty, isHistoryBackup } from '../js/store.js';
import { cupStandings, cupYears, finishPoints } from '../js/cup.js';

const t0 = Date.now();
let n = 0;
const check = (name, fn) => { try { fn(); } catch (e) { console.error(`✗ ${name}`); throw e; } n++; };
const FX = new URL('./fixtures/', import.meta.url);
const load = f => JSON.parse(gunzipSync(readFileSync(new URL(f, FX))).toString());
const files = readdirSync(FX).filter(f => f.endsWith('.json.gz'));
const backups = Object.fromEntries(files.map(f => [f.replace('.json.gz', ''), load(f)]));

check('every dynasty backup is recognized as its sport', () => {
  const want = { 'volleyball-women': 'w-volleyball', 'volleyball-men': 'm-volleyball', 'softball-softball': 'softball', 'softball-baseball': 'baseball', 'soccer-women': 'w-soccer', 'soccer-men': 'm-soccer', 'fhockey-women': 'field-hockey',
    'basketball-women': 'w-basketball', 'basketball-men': 'm-basketball', 'lacrosse-women': 'w-lacrosse', 'lacrosse-men': 'm-lacrosse', 'hockey-women': 'w-hockey', 'hockey-men': 'm-hockey' };
  assert.equal(files.length, 13);
  for (const [k, lg] of Object.entries(backups)) {
    assert.ok(isDynastyBackup(lg));
    const { sport, sure } = detectSport(lg);
    assert.equal(sport.id, want[k], k);
    assert.ok(sure);
  }
  // Renamed dynasties are still found by their results.
  const renamed = { ...backups['soccer-women'], name: 'My League' };
  assert.equal(detectSport(renamed).sport.id, 'w-soccer');
  // A new sport with no results yet: a guess, flagged as unsure.
  const unknown = detectSport({ name: "AAU Men's Water Polo", side: 'men', seasons: { 2030: { teams: {}, games: [] } } });
  assert.ok(!unknown.sure && unknown.sport.custom && unknown.sport.gender === 'men' && /Water Polo/.test(unknown.sport.name));
  // Lacrosse and field hockey both have four low-scoring quarters: the sport tag tells them apart.
  const untagged = { ...backups['lacrosse-women'], sport: undefined, name: 'AAU Women\'s Lacrosse' };
  assert.equal(detectSport(untagged).sport.id, 'field-hockey', 'without the tag a lacrosse file looks like field hockey by its line scores');
  assert.equal(detectSport({ ...backups['basketball-men'], sport: undefined, name: 'My League' }).sport.id, 'm-basketball', 'men\'s basketball by its halves');
  assert.equal(detectSport({ ...backups['hockey-men'], sport: undefined, name: 'My League' }).sport.id, 'm-hockey', 'hockey by its three periods');
  assert.ok(!isDynastyBackup({ schools: {} }));
});

check('results follow each sport\'s rules', () => {
  const pkGame = { home: 'A', away: 'B', homeR: 1, awayR: 1, pk: { home: 4, away: 3 } };
  assert.equal(winnerOf(pkGame), 'A');
  assert.equal(resultFor(pkGame, 'A', SPORTS['w-soccer']), 'T', 'soccer: a shootout is a tie in the record');
  assert.equal(resultFor(pkGame, 'A', SPORTS['field-hockey']), 'W', 'field hockey: the shootout winner gets the win');
  assert.equal(resultFor(pkGame, 'B', SPORTS['field-hockey']), 'L');
});

const H = emptyHistory();
const ext = {};
for (const [k, lg] of Object.entries(backups)) { const sport = detectSport(lg).sport; ext[sport.id] = extractDynasty(lg, sport); mergeDynasty(H, ext[sport.id], { fileName: k }); }

check('each season\'s champions, records and finishes', () => {
  for (const [id, e] of Object.entries(ext)) {
    assert.deepEqual(Object.keys(e.years), ['2030', '2031'], id);
    for (const s of Object.values(e.years)) {
      assert.ok(s.complete && s.champion && s.runnerUp && s.champion !== s.runnerUp, id);
      const c = s.teams[s.champion];
      assert.equal(c.finish, 'champion');
      assert.equal(s.teams[s.runnerUp].finish, 'runner-up');
      assert.ok(c.w > c.l, `${id}: the champion has a winning record`);
      assert.equal(Object.values(s.teams).filter(t => t.finish).length, s.fieldSize, `${id}: every team in the field has a finish`);
      assert.ok(Object.values(s.teams).every(t => t.w + t.l + t.t > 0), `${id}: everyone played`);
      assert.ok(Object.keys(s.regChamps).length > 0, `${id}: regular-season champions`);
    }
  }
  // Soccer and ice hockey have ties; field hockey, basketball and lacrosse never do.
  for (const id of ['w-soccer', 'm-hockey', 'w-hockey']) assert.ok(Object.values(ext[id].years[2031].teams).some(t => t.t > 0), id);
  for (const id of ['field-hockey', 'w-basketball', 'm-basketball', 'w-lacrosse', 'm-lacrosse']) assert.ok(Object.values(ext[id].years[2031].teams).every(t => t.t === 0), id);
  assert.equal(ext['m-basketball'].years[2031].fieldSize, 32);
  assert.equal(ext['w-basketball'].years[2031].finalsName, 'Final Four');
  assert.equal(ext['m-hockey'].years[2031].finalsName, 'Frozen Four');
  // Conference tournament champions where the sport has them.
  assert.ok(Object.keys(ext.softball.years[2031].confTChamps).length > 0);
  assert.equal(Object.keys(ext['field-hockey'].years[2031].confTChamps).length, 4);
  // Coaches and conferences come along.
  const t = ext.baseball.years[2030].teams.Vanderbilt;
  assert.ok(t.coach && t.conf);
  assert.ok(ext.baseball.conferences['Big Ten'].logo.startsWith('img/conf/'));
});

check('the all-sports cup', () => {
  assert.deepEqual(cupYears(H), [2030, 2031]);
  const c = cupStandings(H, 2031);
  assert.equal(c.sports.length, 13);
  assert.deepEqual(c.sports.map(x => x.id), Object.keys(SPORTS), 'in season order');
  const champs = Object.values(H.dynasties).map(d => d.years[2031].champion);
  for (const x of c.schools) assert.equal(x.total, Object.values(x.bySport).reduce((a, b) => a + b, 0));
  assert.ok(c.schools[0].total >= c.schools[1].total);
  assert.ok(champs.every(t => c.schools.find(x => x.school === t).total >= 100));
  const w = cupStandings(H, 2031, 'women'), m = cupStandings(H, 2031, 'men');
  assert.equal(w.sports.length, 7); assert.equal(m.sports.length, 6);
  assert.ok(w.sports.every(s => s.gender === 'women'));
  // Conference totals are their members' points.
  const conf = c.conferences.find(x => x.conf === 'Big Ten');
  assert.ok(conf.total > 0 && conf.schools > 5);
  assert.equal(finishPoints({ finish: 'field', natW: 10 }), 50, 'the field bonus is capped');
  assert.equal(finishPoints({}), 0);
});

check('uploading again replaces seasons and keeps older ones', () => {
  const h = emptyHistory();
  const lg = backups['soccer-men'], sport = detectSport(lg).sport;
  mergeDynasty(h, extractDynasty(lg, sport));
  // A newer file that only has 2031 (2030 dropped) with a changed champion.
  const newer = JSON.parse(JSON.stringify(lg));
  delete newer.seasons[2030];
  newer.seasons[2031].post.champion = 'Stanford';
  const r = mergeDynasty(h, extractDynasty(newer, sport));
  assert.deepEqual(r, { added: 0, updated: 1, kept: 1 });
  assert.equal(h.dynasties['m-soccer'].years[2031].champion, 'Stanford');
  assert.ok(h.dynasties['m-soccer'].years[2030]);
  assert.ok(isHistoryBackup(h) && !isHistoryBackup(lg));
});

check('a season in progress is kept but not scored', () => {
  const lg = JSON.parse(JSON.stringify(backups['fhockey-women']));
  const s = lg.seasons[2031];
  s.phase = 'regular'; delete s.post.champion;
  const e = extractDynasty(lg, SPORTS['field-hockey']);
  assert.ok(!e.years[2031].complete);
  const h = emptyHistory(); mergeDynasty(h, e);
  assert.deepEqual(cupYears(h), [2030]);
});

check('the history stays small', () => {
  assert.ok(JSON.stringify(H).length < 1200000, `${JSON.stringify(H).length} bytes for 26 seasons`);
});

console.log(`${n} checks ok in ${Date.now() - t0} ms`);
