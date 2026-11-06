# AAU History

A static record book that reads backups from the owner's AAU dynasty apps
(AAU Volleyball, AAU Softball & Baseball, AAU Soccer, AAU Field Hockey, AAU
Basketball, AAU Lacrosse, AAU Hockey, and any later sport built on the same
MCS engine) and keeps their combined
history in the browser: champions, school pages across sports and the
All-Sports Cup.

It reads those apps' backups but is not synced with them; changes to the
dynasty apps aren't made from here unless the owner asks.

## How it works

- A dynasty backup is the league JSON (`{ name, side, seasons: { year: {
  teams, games, post, polls, settings, overrides } }, conferences, coaches }`).
  `js/sports.js` detects the sport from `side` (softball/baseball), then
  `league.sport` (basketball, lacrosse, hockey: the newer apps set it), then
  the shape of regular-season line scores (volleyball sets, 2 soccer halves
  or high-scoring basketball halves, 3 hockey periods, 4 field hockey
  quarters, 7/9 innings), then the name; unknown sports are named on upload
  (`customSport`). `SPORTS` is in season order (fall, winter, spring).
- `js/extract.js` keeps only a summary per season (records, conference and
  coach, conference titles, national tournament finish and wins, final poll
  rank, champions). Sport rules live in the profile: `ties` (soccer, ice
  hockey) and `pkWins` (field hockey). Bump `EXTRACT_VERSION` when the summary changes.
- The Schools page shows a badge per school in its colors (A–Z or by home
  conference: the one it plays most sports in, `homeConference`), or the
  stats table.
- School pages (`js/school.js`) are like a team site: a header in the
  school's colors, a tab per sport, banners (national titles in gold;
  regular-season and tournament conference titles with the conference's
  logo), and per sport a season picker, snapshot, schedule with results,
  program write-up, season by season and coaches. Schedules come from each
  season's compact `games` (EXTRACT_VERSION 2); dates from each sport's
  calendar (`start` in `js/sports.js`, the same rule as its app).
- National tournaments (`js/tournament.js`, `#/tournament/<sport>/<year>`):
  each season keeps its bracket in `nt` (EXTRACT_VERSION 3: the field, and
  every regional, super regional and finals event with its nodes and
  games). Drawn like a TV bracket: four regions in the corners (the right
  two mirrored), the finals in the middle; single-elimination events as a
  bracket, double-elimination regionals and series as cards. A field of
  `ONE_BRACKET_MAX` (12) or fewer, all single elimination, is one bracket
  with national seeds (the owner's call). Games against a bye aren't drawn.
  Boxes are sized to fill the window (`fitSizes`) and never cut a school's
  name (a name still cut off after drawing widens them; the page then
  scrolls sideways). National-title
  banners, the Champions page and school seasons link to it.
- Uploads merge per sport: new seasons replace, older seasons are kept
  (`mergeDynasty` in `js/store.js`). History is in IndexedDB under
  `aau-history`.
- Cup scoring is `CUP_POINTS` in `js/cup.js`; only seasons with a crowned
  champion count.
- When a new dynasty app ships, have it set `league.sport`, add its sport to
  `SPORTS` (and detection) and a fixture from it to `tests/fixtures/`
  (trimmed, gzipped).

## Before every commit

- `python3 tools/stamp.py`
- `sh tools/check.sh`
- `node tests/logic.test.mjs`
- `python3 tests/ui_test.py` (Playwright; Chromium is preinstalled)
