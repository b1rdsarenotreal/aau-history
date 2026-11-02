# AAU History

The record book for every AAU dynasty. Upload the backups from the AAU sport
dynasties (volleyball, softball and baseball, soccer, field hockey,
basketball, lacrosse, ice hockey, and any sport added later) and AAU History keeps the combined history:

- **Champions:** national champions for every sport side by side, and for one
  sport its champions, runners-up, finals teams and site, plus every
  conference's regular-season and tournament champions by year.
- **Schools:** every school across every sport, with national titles, finals
  trips, national tournament bids, conference titles, All-Sports Cups and the
  all-time record. A school's page has each sport season by season:
  conference, coach, record, conference record, titles, national tournament
  finish (seed and record) and final poll rank.
- **All-Sports Cup:** a Directors' Cup for the AAU. Points for each national
  tournament finish (champion 100, runner-up 85, the finals site 70, a super
  regional 55, the national tournament 30 plus 8 a win, at most 50), for all
  sports, women's or men's, and a conference version.

It is a static site with no build step, like the dynasty apps.

## Using it

1. In each dynasty, **Settings → Download backup**.
2. In AAU History, **Home** or **Data → Upload dynasty backups**, and pick or
   drop the files (several at once is fine).
3. After each season, upload the new backups. A sport's newer upload replaces
   its seasons and keeps any older seasons the new file no longer has.

AAU History works out which sport each file is from the sport the newer
apps write into their backups (basketball, lacrosse, ice hockey) or from its
results (sets, innings, halves, periods or quarters), so a renamed dynasty is
still recognized.
A backup it doesn't know (a sport added later) asks for the sport's name,
women's or men's, and whether ties stand; after that it works like the rest.
Records follow each sport's rules: a soccer match decided on penalty kicks is
a tie, a field hockey shootout is a win, and a regular-season ice hockey game
tied after overtime is a tie.

Seasons still in progress show on school pages (marked with \*) and count in
the cup once their national champion is crowned.

## Where the history lives

In this browser (IndexedDB), like the dynasties. Only a summary of each
season is kept (records, titles, finishes, coaches), about 15–35 KB a sport
per season. **Data → Download history backup** saves it; **Restore history
backup** (or uploading that file anywhere) brings it back on another device.

## Run it on GitHub Pages

Settings → Pages → Deploy from a branch → `main`, `/ (root)`. To run it
locally, serve the folder with any static server (`python3 -m http.server`).

## Project layout

```
index.html          app shell
css/styles.css      styles (shared with the dynasty apps)
js/app.js           loading, top bar, routing
js/views.js         pages: home, champions, schools, a school, the cup, data
js/ui.js            shared pieces: school labels, logos
js/sports.js        the sports and how a backup's sport is detected
js/extract.js       turns a dynasty backup into history
js/cup.js           All-Sports Cup scoring
js/store.js         saving, merging uploads, backups
js/logos.js         logo list loading and lookup
img/conf/           the commissioner's conference logos
tests/              logic test (Node) and UI test (Playwright), with fixtures
                    from each dynasty app
```

Before committing, run `python3 tools/stamp.py`, `sh tools/check.sh`,
`node tests/logic.test.mjs` and `python3 tests/ui_test.py`.
