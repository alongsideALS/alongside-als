"""Build the static pages for Alongside ALS.

pages/*.html  ->  ./*.html   (wrapped with _head.txt / _foot.txt, plus a static header and footer)
Also:
- data/summary.json      small file the home page and footer use instead of the full directories
- functions/assets/*.js  images served as separate, cacheable files (GitHub's web editor can't take binaries)
- sitemap.xml
- pre-renders the grants / services / trials directories into their pages for search engines
Run:  python3 build.py
"""
import re, json, html, pathlib, datetime, hashlib, base64, io, os, sys
SRC = pathlib.Path(__file__).resolve().parent   # _src/
os.chdir(SRC.parent)                            # site root: built files land here
sys.path.insert(0, str(SRC)); sys.path.insert(0, str(SRC / 'tools'))

SITE = "https://alongside-als.org"
TODAY = datetime.date.today().isoformat()
head = (SRC/'_head.txt').read_text()
foot = (SRC/'_foot.txt').read_text()
esc = html.escape

def page_url(name):
    return SITE + "/" if name == "index.html" else SITE + "/" + name[:-5]

# ---------- asset versions (content hash, so caches can be long-lived) ----------
def h8(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()[:8]
CSS_V = h8('site.css'); JS_V = h8('site.js')

# ---------- images -> functions/assets/<name>.js ----------
# Each image is recompressed to two widths and served by a tiny Pages Function with long cache headers.
# Pages refer to /assets/<name>-1200.webp and /assets/<name>-720.webp.
IMAGES = {"together": SRC/"assets/together.webp", "community": SRC/"assets/community.webp"}
def build_images():
    try:
        from PIL import Image
    except ImportError:
        if all(pathlib.Path(f'functions/assets/{n}-{w}.webp.js').exists() for n in IMAGES for w in (1200, 720)):
            print('Pillow not installed; keeping existing image functions'); return
        raise
    pathlib.Path('functions/assets').mkdir(parents=True, exist_ok=True)
    for name, src in IMAGES.items():
        im = Image.open(src).convert("RGB")
        variants = {}
        for w, q in ((1200, 55), (720, 60)):
            im2 = im if im.width == w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
            b = io.BytesIO(); im2.save(b, "WEBP", quality=q, method=6)
            variants[f"{name}-{w}.webp"] = base64.b64encode(b.getvalue()).decode()
        for fname, b64 in variants.items():
            js = f'''// {fname}: served from embedded data (binary files can't go through GitHub's web editor). Long-lived cache; change the file name to bust it.
const B64 = "{b64}";
let bytes;
export async function onRequestGet({{ request }}) {{
  const cache = caches.default; const hit = await cache.match(request); if (hit) return hit;
  if (!bytes) {{ const s = atob(B64); bytes = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i); }}
  const res = new Response(bytes, {{ headers: {{ "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable", "content-length": String(bytes.length) }} }});
  try {{ await cache.put(request, res.clone()); }} catch {{}}
  return res;
}}
'''
            pathlib.Path(f'functions/assets/{fname}.js').write_text(js)
    print('built image functions:', ', '.join(f'{k}-1200/720' for k in IMAGES))

# ---------- pre-rendered directories ----------
def grant_list(kind):
    data = json.load(open(f'data/{kind}.json'))["items"]
    data = sorted(data, key=lambda g: (g.get("scope") != "National", g["name"].lower()))
    out = ['<ul class="static-list">']
    for g in data:
        where = "Nationwide" if g.get("scope") == "National" else ", ".join(g.get("regions") or []) or "Regional"
        bits = [esc(g.get("forWhat", ""))]
        if g.get("amount"): bits.append(esc(g["amount"]) + ".")
        out.append(
            f'<li><div class="org">{esc(g.get("org",""))} · {esc(where)}</div>'
            f'<b><a href="/{"grant" if kind == "grants" else "service"}/{esc(g["id"])}">{esc(g["name"])}</a></b>'
            f'<p>{" ".join(bits)} <a href="{esc(g["url"])}" rel="noopener">Program website</a></p></li>')
    out.append('</ul>')
    return "\n".join(out), data

def trial_list():
    data = json.load(open('data/trials.json'))["items"]
    label = {"yes": "Recruiting", "soon": "Not yet recruiting", "invite": "Enrolling by invitation", "no": "Active, not recruiting"}
    rank = {"yes": 0, "soon": 1, "invite": 2, "no": 3}
    data = sorted(data, key=lambda t: (rank.get(t.get("enrolling"), 9), not t.get("us"), (t.get("name") or t.get("title") or "").lower()))
    out = ['<ul class="static-list">']
    for t in data:
        where = ", ".join(t.get("states") or []) if t.get("us") else ", ".join(t.get("countries") or [])
        plain = (t.get("plain") or {}).get("purpose") or ""
        out.append(
            f'<li><div class="org">{esc(t.get("sponsor",""))} · {esc(t.get("phase",""))} · {esc(label.get(t.get("enrolling"), t.get("enrolling","")))}'
            f'{" · " + esc(where) if where else ""}</div>'
            f'<b><a href="/study/{esc(t["id"])}">{esc(t.get("name") or t.get("title") or t["id"])}</a></b> '
            f'<span class="mono">{esc(t["id"])}</span>'
            f'<p>{esc(t.get("title",""))}{(" " + esc(plain)) if plain else ""} <a href="https://clinicaltrials.gov/study/{esc(t["id"])}" rel="noopener">Official record</a></p></li>')
    out.append('</ul>')
    return "\n".join(out), data

def item_list_ld(name, url, items, url_of):
    return {
        "@context": "https://schema.org", "@type": "ItemList", "name": name, "url": url,
        "numberOfItems": len(items),
        "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": it.get("name") or it.get("title") or it["id"], "url": url_of(it)} for i, it in enumerate(items)],
    }

ORG = {
    "@context": "https://schema.org", "@type": "Organization", "name": "Alongside ALS", "url": SITE + "/",
    "logo": SITE + "/favicon.svg", "email": "alsalongside@gmail.com",
    "description": "An independent, volunteer-maintained guide to grants, benefits, clinical studies and practical help for people living with ALS and their families.",
}
WEBSITE = {"@context": "https://schema.org", "@type": "WebSite", "name": "Alongside ALS", "url": SITE + "/"}

def ld(objs):
    return "".join(f'<script type="application/ld+json">{json.dumps(o, ensure_ascii=False)}</script>\n' for o in objs)

# ---------- app icons -> functions/icons/[icon].js (PNG served from base64; GitHub's editor can't take binaries) ----------
def build_icons():
    icons = {}
    for f in sorted((SRC/'assets/icons').glob('*.png')):
        icons[f.name] = base64.b64encode(f.read_bytes()).decode()
    pathlib.Path('functions/icons').mkdir(parents=True, exist_ok=True)
    js = ("// App icons served from embedded data (binary files can't go through GitHub's web editor). Generated by build.py.\n"
          "const ICONS = " + json.dumps(icons) + ";\n"
          "export async function onRequestGet({ request, params }) {\n"
          "  const name = params.icon; const b64 = ICONS[name];\n"
          "  if (!b64) return new Response('Not found', { status: 404 });\n"
          "  const cache = caches.default; const hit = await cache.match(request); if (hit) return hit;\n"
          "  const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);\n"
          "  const res = new Response(bytes, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=604800' } });\n"
          "  await cache.put(request, res.clone()); return res;\n}\n")
    open('functions/icons/[icon].js', 'w').write(js)
    print('built functions/icons/[icon].js for', ", ".join(icons))

# ---------- service worker: _sw.js template + versioned precache list ----------
MAP_V = h8('map.js')
def build_sw(page_urls):
    page_urls = [u for u in page_urls if u not in ("/map", "/trials")]   # heavy pages are cached when first visited
    pre = sorted(set(page_urls + ["/offline", "/my-plan", f"/site.css?v={CSS_V}", f"/site.js?v={JS_V}", f"/map.js?v={MAP_V}",
                 "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png", "/icons/apple-touch-icon.png", "/data/summary.json"]))
    h = hashlib.sha256()
    for name in sorted(pathlib.Path('.').glob('*.html')): h.update(name.read_bytes())
    h.update((SRC/'_sw.js').read_bytes()); h.update(json.dumps(pre).encode())
    ver = h.hexdigest()[:8]
    sw = (SRC/'_sw.js').read_text().replace('{{SW_VERSION}}', ver).replace('{{SW_PRECACHE}}', json.dumps(pre))
    open('sw.js', 'w').write(sw)
    print('built sw.js version', ver, 'with', len(pre), 'precached URLs')

# ---------- summary.json (what the home page, footer and plan need without the full files) ----------
def build_summary():
    g = json.load(open('data/grants.json')); s = json.load(open('data/services.json')); t = json.load(open('data/trials.json'))
    def gstatus(x):
        # mirror site.js grantStatus().key for the counts
        dl = x.get("deadline")
        if dl:
            d = (datetime.date.fromisoformat(dl) - datetime.date.today()).days
            return "closed" if d < 0 else "open"
        return {"open": "open", "rolling": "open", "closed": "closed"}.get(x.get("status"), "check")
    deadlines = sorted([x for x in g["items"] if x.get("deadline") and x["deadline"] >= TODAY], key=lambda x: x["deadline"])
    # per-state counts of regional grants, so the home page can say "N programs for Ohio"
    by_state = {}
    for x in g["items"] + s["items"]:
        for r in x.get("regions") or []:
            by_state[r] = by_state.get(r, 0) + 1
    summary = {
        "built": TODAY,
        "grants": {"total": len(g["items"]), "open": sum(1 for x in g["items"] if gstatus(x) == "open"), "updated": g.get("updated"),
                    "national": sum(1 for x in g["items"] if x.get("scope") == "National")},
        "services": {"total": len(s["items"]), "updated": s.get("updated")},
        "trials": {"total": len(t["items"]), "recruitingUS": sum(1 for x in t["items"] if x.get("enrolling") == "yes" and x.get("us")),
                   "soonUS": sum(1 for x in t["items"] if x.get("enrolling") == "soon" and x.get("us")),
                   "registrySnapshot": t.get("registrySnapshot"), "updated": t.get("updated"),
                   "byState": {}},
        "deadlines": [{"id": x["id"], "name": x["name"], "org": x["org"], "deadline": x["deadline"], "status": x.get("status"), "regions": x.get("regions") or [], "scope": x.get("scope")} for x in deadlines[:8]],
        "localByState": by_state,
    }
    bs = summary["trials"]["byState"]
    for x in t["items"]:
        if x.get("enrolling") in ("yes", "soon"):
            for st in x.get("states") or []:
                bs[st] = bs.get(st, 0) + 1
    json.dump(summary, open('data/summary.json', 'w'), ensure_ascii=False)
    print('built data/summary.json')

# ---------- map page: state outlines (Albers USA, us-atlas 10m simplified) + clinic directory ----------
NET_LABEL = {"alsa-coe": "ALS Association Center of Excellence", "alsa-rtc": "ALS Association Recognized Center",
             "mda": "MDA ALS Care Center", "va": "VA ALS clinic", "neals": "NEALS research site"}
def map_assets():
    import sys; sys.path.insert(0, 'tools')
    from states import build_paths, STATES, label_point
    paths = build_paths(2)
    names = {c: STATES[c]['name'] for c in paths}
    svg = []
    for code in sorted(paths, key=lambda c: names[c]):
        lx, ly = label_point(code)
        svg.append(f'<path d="{paths[code]}" data-state="{code}" data-name="{esc(names[code])}" data-lx="{lx}" data-ly="{ly}"><title>{esc(names[code])}</title></path>')
    m = json.load(open('data/map.json'))
    by = {}
    for c in m['clinics']: by.setdefault(c['state'], []).append(c)
    out = []
    for code in sorted(by, key=lambda c: names.get(c, c)):
        items = []
        for c in by[code]:
            nets = " · ".join(NET_LABEL[n] for n in c['nets'])
            inst = f'<span class="org">{esc(c["inst"])}</span>' if c['inst'] else ''
            where = ", ".join(x for x in [c['addr'], c['city'], c['state'] + (" " + c['zip'] if c['zip'] else "")] if x)
            links = []
            if c['phone']: links.append(f'<a href="tel:{re.sub(r"[^0-9+]", "", c["phone"].split(",")[0].split("ext")[0])}">{esc(c["phone"])}</a>')
            if c['url']: links.append(f'<a href="{esc(c["url"])}" target="_blank" rel="noopener">Website</a>')
            items.append(f'<li><b>{esc(c["name"])}</b>{inst}<p>{esc(where)}</p><p class="small">{esc(nets)}</p>{"<p>" + " · ".join(links) + "</p>" if links else ""}</li>')
        out.append(f'<details class="dir-state" id="dir-{code}"><summary><span>{esc(names.get(code, code))}</span><span class="muted small">{len(items)} clinic{"s" if len(items) != 1 else ""}</span></summary><ul class="static-list dir-list">{"".join(items)}</ul></details>')
    mapld = {"@context": "https://schema.org", "@type": "Dataset", "name": "ALS clinics, study sites and local programs in the United States", "url": SITE + "/map",
             "description": f"{len(m['clinics'])} multidisciplinary ALS clinics (ALS Association certified and recognized centers, MDA ALS Care Centers, VA ALS clinics, NEALS research sites), recruiting clinical-study sites and state-specific grants and services, with locations.",
             "dateModified": m['updated'], "creator": {"@type": "Organization", "name": "Alongside ALS", "url": SITE},
             "license": "https://creativecommons.org/licenses/by/4.0/", "isAccessibleForFree": True,
             "distribution": {"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": SITE + "/data/map.json"}}
    from build_detail import STATE_NAMES
    out.append('<p class="state-links"><b>Help by state:</b> ' + " · ".join(f'<a href="/state/{c.lower()}">{esc(n)}</a>' for c, n in sorted(STATE_NAMES.items(), key=lambda kv: kv[1])) + '</p>')
    return "".join(svg), "".join(out), mapld

# ---------- static header / footer (also injected by site.js when missing, e.g. old pages) ----------
NAV = [("understanding-als.html", "Understanding ALS", "understand", "What a diagnosis means, treatments and your care team"),
       ("road-ahead.html", "Road ahead", "road", "A stage-by-stage checklist"),
       ("grants.html", "Grants", "grants", "Money for equipment, travel, respite and more"),
       ("services.html", "Services", "services", "Benefits, loans and free help"),
       ("trials.html", "Trials", "trials", "Clinical studies looking for participants"),
       ("map.html", "Map", "map", "Clinics, study sites and local help near you"),
       ("get-ready.html", "Get ready", "ready", "Documents and application trackers"),
       ("resources.html", "Resources", "resources", "Trusted links by topic"),
       ("my-plan.html", "My plan", "plan", "Everything you've saved")]
RIBBON = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#f8faff"/><path d="M12 30 25 12C30 2 10 2 15 12L28 30" stroke="#193252" stroke-width="6" fill="none"/><path d="M12 30 25 12C30 2 10 2 15 12L28 30" stroke="#7399c6" stroke-width="1.3" fill="none"/><circle cx="33" cy="34" r="3" fill="#c33245"/></svg>'

def header(page):
    links = "".join(
        f'<a href="/{href[:-5] if href != "index.html" else ""}"{" aria-current=\"page\"" if page == key else ""}>'
        f'<b>{esc(label)}{" <span class=\"count\" id=\"savedCount\">0</span>" if key == "plan" else ""}</b><small>{esc(desc)}</small></a>'
        for href, label, key, desc in NAV)
    return f'''<a class="skip" href="#main">Skip to content</a>
<header class="banner"><div class="wrap banner-in">
  <a class="brand" href="/" aria-label="Alongside ALS home">{RIBBON}<span><span class="brand-name">Alongside ALS</span><span class="brand-sub">Resources &amp; support for people living with ALS</span></span></a>
  <div class="hdr-tools">
    <a class="plan-link" href="/my-plan"{" aria-current=\"page\"" if page == "plan" else ""}>My plan <span class="count" data-saved-count>0</span></a>
    <button class="textsize" id="textSize" type="button" aria-pressed="false" aria-label="Larger text" title="Larger text">A<span>A</span></button>
    <button class="menu-btn" id="menuBtn" type="button" aria-expanded="false" aria-controls="siteNav"><span class="menu-ico" aria-hidden="true"></span>Menu</button>
  </div>
  <nav class="nav" id="siteNav" aria-label="Main">{links}</nav>
</div></header>
'''

FOOTER = '''<div class="install-hint" id="installHint" hidden role="region" aria-label="Add to home screen"><div class="wrap">
  <img class="ih-icon" src="/icons/icon-192.png" width="40" height="40" alt="" loading="lazy">
  <p><b>Add Alongside ALS to your home screen.</b> One tap to open, and your saved plan and the lists you've viewed work without a signal.</p>
  <div class="ih-actions"><button class="btn btn-primary btn-sm" type="button" id="installHintBtn" hidden>Install</button><a class="btn btn-primary btn-sm" id="installHintHow" href="/app">How to add it</a><button class="btn btn-line btn-sm" type="button" id="installHintNo">Not now</button></div>
</div></div>
<footer><div class="wrap">
  <div class="foot-grid">
    <div>
      <p class="foot-brand"><b>Alongside ALS</b></p>
      <p>An independent, volunteer-maintained guide. It does not give medical, legal or financial advice, award grants or decide eligibility. Confirm every program's rules with the organization, and talk with your care team before joining a study.</p>
      <p id="freshness" class="mono small"></p>
    </div>
    <nav aria-label="Site sections"><b>Find</b><a href="/grants">Grants</a><a href="/services">Services &amp; benefits</a><a href="/trials">Clinical studies</a><a href="/map">Map: help near you</a><a href="/my-plan">My plan</a></nav>
    <nav aria-label="Guides"><b>Learn</b><a href="/understanding-als">Understanding ALS</a><a href="/road-ahead">The road ahead</a><a href="/get-ready">Get ready to apply</a><a href="/resources">Resources</a></nav>
    <nav aria-label="About this site"><b>About</b><a href="/about">About &amp; contact</a><a href="/about#corrections">Report outdated information</a><a href="/about#privacy">Privacy</a><a href="/about#disclaimer">Disclaimer</a><a href="/about#updates">What changed</a><a class="app-link" href="/app">Use as an app</a></nav>
  </div>
  <p class="small">Talk to a person: ALS Association information and referral line <a href="tel:18007824747">800-782-4747</a>. If you are in crisis, call or text <a href="tel:988">988</a> (U.S.).</p>
</div></footer>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
'''

urls = []
build_images()
build_icons()
build_summary()
for f in sorted((SRC/'pages').glob('*.html')):
    s = f.read_text()
    m = re.match(r'<!--\s*title:(.*?)\|\s*desc:(.*?)\|\s*page:(.*?)\s*-->\n?', s, re.S)
    t, d, p = [x.strip() for x in m.groups()]
    body = s[m.end():]
    url = page_url(f.name)
    full = t if "Alongside ALS" in t else f"{t} · Alongside ALS"
    robots = "noindex, follow" if f.name in ("my-plan.html", "404.html", "offline.html") else "index, follow, max-image-preview:large, max-snippet:-1"
    jsonld = []
    if f.name == "index.html":
        jsonld = [ORG, WEBSITE]
    elif f.name == "grants.html":
        static, items = grant_list("grants")
        body = body.replace('<div id="explorer"></div>', f'<div id="explorer">\n{static}\n</div>', 1)
        jsonld = [item_list_ld("ALS grants and scholarships", url, items, lambda g: g["url"])]
    elif f.name == "services.html":
        static, items = grant_list("services")
        body = body.replace('<div id="explorer"></div>', f'<div id="explorer">\n{static}\n</div>', 1)
        jsonld = [item_list_ld("ALS services and benefits", url, items, lambda g: g["url"])]
    elif f.name == "trials.html":
        static, items = trial_list()
        body = body.replace('<div id="explorer"></div>', f'<div id="explorer">\n{static}\n</div>', 1)
        jsonld = [item_list_ld("Active ALS clinical studies", url, items, lambda t: f"https://clinicaltrials.gov/study/{t['id']}")]
    elif f.name == "understanding-als.html":
        qa = re.findall(r'<details><summary>(.*?)</summary><p>(.*?)</p></details>', body, re.S)
        jsonld = [{"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": html.unescape(re.sub(r"<[^>]+>", "", q)), "acceptedAnswer": {"@type": "Answer", "text": html.unescape(re.sub(r"<[^>]+>", "", a))}} for q, a in qa]}]
    elif f.name == "map.html":
        svg, directory, mapld = map_assets()
        ctx = json.load(open(SRC/'tools/context.json'))
        body = (body.replace('{{MAP_STATES}}', svg).replace('{{MAP_DIRECTORY}}', directory).replace('{{MAP_V}}', MAP_V)
                .replace('{{MAP_CONTEXT}}', ctx['d']).replace('{{MAP_LAKES}}', ctx['lakes']))
        jsonld = [mapld]
    out = (head.replace('{{FULLTITLE}}', esc(full)).replace('{{TITLE}}', esc(t)).replace('{{DESC}}', esc(d))
           .replace('{{URL}}', url).replace('{{ROBOTS}}', robots).replace('{{JSONLD}}', ld(jsonld)).replace('{{PAGE}}', p)
           .replace('{{CSS_V}}', CSS_V).replace('{{HEADER}}', header(p))
           + body + foot.replace('{{FOOTER}}', FOOTER).replace('{{JS_V}}', JS_V))
    (pathlib.Path('.') / f.name).write_text(out)
    if robots.startswith("index"):
        urls.append(url)
    print('built', f.name, len(out), 'bytes')

# ---------- per-listing and per-state pages ----------
import build_detail
def _wrap_detail(name, t, d, body, jsonld, nav_key):
    url = SITE + "/" + name
    full = f"{t} · Alongside ALS"
    out = (head.replace('{{FULLTITLE}}', esc(full)).replace('{{TITLE}}', esc(t)).replace('{{DESC}}', esc(d))
           .replace('{{URL}}', url).replace('{{ROBOTS}}', "index, follow, max-image-preview:large, max-snippet:-1").replace('{{JSONLD}}', ld(jsonld)).replace('{{PAGE}}', "detail")
           .replace('{{CSS_V}}', CSS_V).replace('{{HEADER}}', header(nav_key))
           + body + foot.replace('{{FOOTER}}', FOOTER).replace('{{JS_V}}', JS_V))
    pathlib.Path(name + ".html").write_text(out)
    return url
detail_urls = build_detail.build(SITE, _wrap_detail)
print('built', len(detail_urls), 'detail pages')

# ---------- sitemap ----------
# lastmod only moves when a page's content changes (asset hashes and the snapshot line are ignored), so Google can trust it.
LM = SRC / 'lastmod.json'
lastmod = json.loads(LM.read_text()) if LM.exists() else {}
def page_sig(u):
    name = u[len(SITE) + 1:] or 'index'
    try: txt = pathlib.Path(name + '.html').read_text()
    except FileNotFoundError: return None
    txt = re.sub(r'\?v=[0-9a-f]{8}', '', txt)
    txt = re.sub(r'snapshot taken [^.<]*', '', txt)
    return hashlib.sha256(txt.encode()).hexdigest()[:16]
def lm(u):
    sig = page_sig(u)
    prev = lastmod.get(u)
    if sig and (not prev or prev[0] != sig): lastmod[u] = [sig, TODAY]
    return lastmod.get(u, [None, TODAY])[1]
pri = {SITE + "/": "1.0", SITE + "/grants": "0.9", SITE + "/trials": "0.9", SITE + "/services": "0.9", SITE + "/map": "0.9", SITE + "/app": "0.5"}
sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for u in urls:
    sm.append(f'  <url><loc>{u}</loc><lastmod>{lm(u)}</lastmod><changefreq>weekly</changefreq><priority>{pri.get(u, "0.7")}</priority></url>')
for u in detail_urls:
    sm.append(f'  <url><loc>{u}</loc><lastmod>{lm(u)}</lastmod><changefreq>weekly</changefreq><priority>{"0.6" if "/state/" in u else "0.5"}</priority></url>')
sm.append('</urlset>')
open('sitemap.xml', 'w').write("\n".join(sm) + "\n")
LM.write_text(json.dumps({u: v for u, v in lastmod.items() if u in set(urls) | set(detail_urls)}, separators=(',', ':')))
print('built sitemap.xml with', len(urls) + len(detail_urls), 'urls; css', CSS_V, 'js', JS_V)
build_sw([u.replace(SITE, "") or "/" for u in urls])
