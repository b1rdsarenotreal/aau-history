"""Browser test: python3 tests/ui_test.py [screenshot-dir]

Uploads every fixture backup through the page (unzipped to a temp folder),
visits every page, checks the champions, a school page and the cup, restores
from a history backup, and checks that nothing errors and phones don't
scroll sideways.
"""
import http.server, socketserver, threading, sys, functools, pathlib, gzip, tempfile, json
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
if OUT: OUT.mkdir(parents=True, exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

srv = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
U = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
errors = []

tmp = pathlib.Path(tempfile.mkdtemp())
files = []
for f in sorted((ROOT / "tests" / "fixtures").glob("*.json.gz")):
    out = tmp / f.name.replace(".gz", "")
    out.write_bytes(gzip.decompress(f.read_bytes()))
    files.append(str(out))
champs = {}
for p in files:
    d = json.loads(pathlib.Path(p).read_text())
    champs[pathlib.Path(p).name] = d["seasons"]["2031"]["post"]["champion"]

def shot(pg, name):
    if OUT: pg.screenshot(path=str(OUT / f"{name}.png"), full_page=True)

def visit(pg, h, name=None):
    pg.goto(U + h); pg.wait_for_timeout(300)
    t = pg.locator("#app").inner_text()
    assert "Something went wrong" not in t, f"{h}: {t[:300]}"
    if name: shot(pg, name)
    return t

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1360, "height": 900})
    pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    pg.on("console", lambda m: m.type == "error" and "ERR_" not in m.text and "fonts.g" not in m.text and errors.append(f"console: {m.text}"))
    pg.on("dialog", lambda d: d.accept())
    t = visit(pg, "#/home", "a-empty")
    assert "Upload dynasty backups" in t

    # Upload all thirteen dynasties at once.
    pg.set_input_files("#up-file", files)
    pg.wait_for_function("document.querySelector('#app').innerText.includes('Latest national champions')", timeout=20000)
    t = visit(pg, "#/home", "b-home")
    assert "13 sports" in t and "All-Sports Cup" in t
    for c in champs.values(): assert c in t, c

    t = visit(pg, "#/champions", "c-champions")
    for name in ["Women's Volleyball", "Men's Volleyball", "Softball", "Baseball", "Women's Soccer", "Men's Soccer", "Field Hockey", "Women's Basketball", "Men's Basketball", "Women's Lacrosse", "Men's Lacrosse", "Women's Ice Hockey", "Men's Ice Hockey"]: assert name in t, name
    pg.click('[data-cs="m-hockey"]'); pg.wait_for_timeout(200)
    t = pg.locator("#app").inner_text()
    assert "Frozen Four" in t
    pg.click('[data-cs="w-soccer"]'); pg.wait_for_timeout(200)
    t = pg.locator("#app").inner_text()
    assert "conference champions" in t and "College Cup" in t
    shot(pg, "c-champions-soccer")

    # Badges show names in capitals, so compare without case.
    t = visit(pg, "#/schools", "d-schools").lower()
    assert "stanford" in t and "caltech" in t
    pg.fill("#sc-find", "stan"); pg.wait_for_timeout(200)
    t = pg.locator("#app").inner_text().lower()
    assert "stanford" in t and "caltech" not in t
    pg.click('[data-ui="schoolSort"][data-v="conf"]'); pg.wait_for_timeout(200)
    assert pg.locator(".conf-group-head").count() >= 1
    pg.click('[data-ui="schoolView"][data-v="table"]'); pg.wait_for_timeout(200)
    assert "stanford" in pg.locator("#app").inner_text().lower()
    pg.click('[data-ui="schoolView"][data-v="badges"]'); pg.fill("#sc-find", ""); pg.wait_for_timeout(200)
    champ = champs["softball-softball.json"]
    t = visit(pg, f"#/school/{champ}", "e-school")
    assert "Softball" in t and "National champion" in t and "All-Sports Cup" in t

    t = visit(pg, "#/cup", "f-cup")
    assert "Scoring" in t and "Cup winners" in t
    pg.click('[data-cg="men"]'); pg.wait_for_timeout(200)
    t = pg.locator("#app").inner_text()
    assert "Men's standings" in t and "Field Hockey" not in t.split("Cup winners")[0]
    pg.click('[data-cv="conferences"]'); pg.wait_for_timeout(200)
    assert "Big Ten" in pg.locator("#app").inner_text()
    shot(pg, "f-cup-conf")

    # The history survives a reload; a history backup restores it elsewhere.
    t = visit(pg, "#/data", "g-data")
    assert t.count("Remove") == 13
    with pg.expect_download() as dl: pg.click("#d-export")
    path = tmp / "history.json"; dl.value.save_as(path)
    pg.click("#d-reset"); pg.wait_for_timeout(300)
    assert "Nothing uploaded yet" in pg.locator("#app").inner_text()
    pg.set_input_files("#d-import", str(path)); pg.wait_for_timeout(800)
    t = visit(pg, "#/data")
    assert t.count("Remove") == 13, "restored from the history backup"

    pg.set_viewport_size({"width": 390, "height": 800})
    for h in ["#/home", "#/champions", "#/schools", "#/cup", f"#/school/{champ}"]:
        visit(pg, h)
        assert not pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"), f"{h} scrolls sideways on a phone"
    shot(pg, "h-mobile")
    b.close()

srv.shutdown()
if errors:
    print("\n".join(errors)); sys.exit(1)
print("ui test passed")
