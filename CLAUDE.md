# AAU History

A static record book that reads backups from the owner's AAU dynasty apps
(AAU Volleyball, AAU Softball & Baseball, AAU Soccer, AAU Field Hockey, and
any later sport built on the same MCS engine) and keeps their combined
history in the browser: champions, school pages across sports and the
All-Sports Cup.

It reads those apps' backups but is not synced with them; changes to the
dynasty apps aren't made from here unless the owner asks.

## How it works

- A dynasty backup is the league JSON (`{ name, side, seasons: { year: {
  teams, games, post, polls, settings, overrides } }, conferences, coaches }`).
  `js/sports.js` detects the sport from `side` (softball/baseball) and the
  shape of regular-season line scores (volleyball sets, 2 soccer halves, 4
  field hockey quarters, 7/9 innings), then the name; unknown sports are
  named on upload (`customSport`).
- `js/extract.js` keeps only a summary per season (records, conference and
  coach, conference titles, national tournament finish and wins, final poll
  rank, champions). Sport rules live in the profile: `ties` (soccer) and
  `pkWins` (field hockey). Bump `EXTRACT_VERSION` when the summary changes.
- Uploads merge per sport: new seasons replace, older seasons are kept
  (`mergeDynasty` in `js/store.js`). History is in IndexedDB under
  `aau-history`.
- Cup scoring is `CUP_POINTS` in `js/cup.js`; only seasons with a crowned
  champion count.
- When a new dynasty app ships, add its sport to `SPORTS` (and detection if
  needed) and a fixture from it to `tests/fixtures/` (trimmed, gzipped).

## Before every commit

- `python3 tools/stamp.py`
- `sh tools/check.sh`
- `node tests/logic.test.mjs`
- `python3 tests/ui_test.py` (Playwright; Chromium is preinstalled)
