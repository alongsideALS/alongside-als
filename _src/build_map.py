"""Build data/map.json (clinics + study sites + local programs by state) and data/zips/<d>.json.

Inputs:  _src/tools/clinic-sources/{alsa,mda,va,neals}.json  (clinic lists gathered 2026-10-19)
         _src/tools/zips.json                                (ZIP -> lat/lng/city/state, from the `zipcodes` npm package)
         data/trials.json, data/grants.json, data/services.json
Run:     python3 build_map.py   (then python3 build.py)
"""
import json, re, sys, collections, pathlib, datetime, os
SRC = pathlib.Path(__file__).resolve().parent
os.chdir(SRC.parent)
sys.path.insert(0, str(SRC / 'tools'))
from geocode import city_ll, zip_ll, ZIP, norm
from albers import PROJECT

MAPDATA = SRC / 'tools/clinic-sources'
STATES50 = set("AL AK AZ AR CA CO CT DC DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split())
TODAY = datetime.date.today().isoformat()

EXCLUDE_NOTE = ('consider excluding', 'not a patient clinic', 'not a community clinic', 'not a clinic', 'sparse')
EXCLUDE_NAMES = ('roseman university',)

def load(name):
    d = json.load(open(MAPDATA / f'{name}.json'))
    out = []
    for it in d['items']:
        n = (it.get('notes') or '').lower()
        if any(k in n for k in EXCLUDE_NOTE) or any(k in it['name'].lower() for k in EXCLUDE_NAMES): continue
        if it['state'] not in STATES50: continue
        out.append(it)
    return out

def digits(s): return re.sub(r"\D", "", s or "")
STOP = set("the of and at for in medical center hospital university health system clinic clinics als team program institute school medicine care sciences neurology neurological regional".split())
def tokens(*parts):
    t = set()
    for p in parts:
        for w in re.findall(r"[a-z0-9]+", (p or "").lower()):
            if w not in STOP and len(w) > 2: t.add(w)
    return t

# Institution aliases: (regex over "name | institution", canonical key). First match wins; "<city>" is replaced by the city.
ALIASES = [
    (r"penn state|hershey", "pennstate"), (r"university of pennsylvania|penn medicine|penn comprehensive", "upenn"),
    (r"\bucsf\b|university of california,? san francisco", "ucsf"), (r"\bucla\b|university of california,? los angeles", "ucla"),
    (r"uc san diego|\bucsd\b|university of california,? san diego", "ucsd"), (r"uc davis|university of california,? davis", "ucdavis"),
    (r"uc irvine|university of california,? irvine", "uci"), (r"california pacific|forbes norris|\bcpmc\b", "cpmc"),
    (r"kaiser|permanente", "kaiser-<city>"), (r"washington university", "washu"), (r"saint louis university|st\.? louis university|slucare", "slu"),
    (r"massachusetts general|\bmgh\b|healey", "mgh"), (r"houston methodist", "methodist-houston"), (r"semmes.murphey|midsouth", "semmes"),
    (r"ut health san antonio|university of texas health science(s)? center,? san antonio|south texas als clinic", "uthsa"),
    (r"university of washington|uw medicine", "uw"), (r"university of colorado|uchealth|anschutz", "ucolorado"),
    (r"hennepin|twin cities als research", "hennepin"), (r"university of minnesota|fairview", "umn"), (r"indiana university|iu health", "iu"),
    (r"\blsu\b|louisiana state", "lsu"), (r"george washington|\bgwu?\b", "gwu"), (r"university of alabama|\buab\b", "uab"),
    (r"cedars.sinai", "cedars"), (r"keck|university of southern california|\busc\b", "usc"), (r"temple university", "temple"),
    (r"jefferson", "jefferson"), (r"baylor college", "bcm"), (r"emory(?! bellard)", "emory"), (r"ohiohealth|ohio health", "ohiohealth"), (r"ohio ?state|wexner", "osu"),
    (r"university of pittsburgh|\bupmc\b", "upmc"), (r"university of rochester", "urochester"), (r"texas neurology", "texasneurology"),
    (r"ut ?southwestern|university of texas southwestern", "utsw"), (r"vanderbilt", "vanderbilt"), (r"west virginia university|\bwvu\b", "wvu"),
    (r"\bcamc\b|vandalia", "camc"), (r"university of massachusetts|umass", "umass"), (r"university of arkansas|\buams\b", "uams"),
    (r"mayo", "mayo-<city>"), (r"johns hopkins", "jhu"), (r"university of maryland", "umd"), (r"beth israel deaconess|\bbidmc\b", "bidmc"),
    (r"lahey|lhmc", "lahey"), (r"corewell|spectrum health", "corewell"), (r"henry ford|hoenselaar", "henryford"), (r"university of michigan|michigan medicine", "umich"),
    (r"trinity health|mercy health saint mary", "trinity-gr"), (r"bronson", "bronson"), (r"cox ?health|cox medical", "cox"), (r"university of missouri", "mizzou"),
    (r"university of nebraska", "unmc"), (r"dartmouth", "dartmouth"), (r"jersey shore|hackensack meridian", "jsumc"),
    (r"rutgers|robert wood johnson|als center of new jersey", "rutgers"), (r"university of new mexico|\bunm\b", "unm"), (r"suny upstate|upstate medical", "upstate"),
    (r"hospital for special surgery|\bhss\b|cornell", "hss"), (r"columbia university", "columbia"), (r"mount sinai", "sinai"),
    (r"wake forest", "wakeforest"), (r"carolinas|atrium health", "atrium-<city>"), (r"\bduke\b", "duke"), (r"catfish|ecu health", "ecu"),
    (r"\bunc\b|university of north carolina", "unc"), (r"cleveland clinic", "ccf"), (r"oregon health|\bohsu\b", "ohsu"), (r"st\.? luke", "stlukes-<city>"), (r"providence", "providence-<city>"),
    (r"essentia", "essentia"), (r"scott (&|and) white|emory bellard", "bswh"),
    (r"lehigh valley", "lvhn"), (r"university of utah", "uutah"), (r"university of vermont", "uvm"), (r"university of virginia|\buva\b", "uva"),
    (r"virginia mason", "vmason"), (r"swedish", "swedish"), (r"froedtert|medical college of wisconsin", "mcw"),
    (r"university of wisconsin|uw health", "uwisc"), (r"university of iowa", "uiowa"), (r"university of kansas", "kumc"), (r"university of kentucky|\buk als\b", "uky"),
    (r"university of louisville", "uofl"), (r"university of chicago", "uchicago"), (r"northwestern|les turner", "northwestern"), (r"\brush\b", "rush"), (r"loyola", "loyola"),
    (r"university of miami", "umiami"), (r"university of south florida|\busf\b", "usf"), (r"holy cross|phil smith", "holycross"), (r"orlando health", "orlandohealth"),
    (r"uf health|university of florida", "uf-<city>"), (r"augusta university|wellstar mcg|medical college of georgia", "mcg"), (r"barrow|fulton", "barrow"),
    (r"university of arizona", "uarizona"), (r"loma linda", "lomalinda"), (r"stanford", "stanford"), (r"hospital for special care", "hsc"), (r"yale", "yale"),
    (r"university of tennessee", "uthsc"), (r"ochsner", "ochsner"), (r"nerve and muscle center", "nmct"), (r"tufts", "tufts"), (r"brigham", "brigham"),
    (r"georgetown", "georgetown"), (r"university of texas medical branch|\butmb\b", "utmb"), (r"uthealth|university of texas health science center at houston|mcgovern", "uthouston"),
    (r"university of michigan", "umich"), (r"university of cincinnati", "ucinci"), (r"university of kentucky", "uky"), (r"university of alabama", "uab"),
]
VA_RE = re.compile(r"\bva\b|veteran|\bvamc\b|veterans? (affairs|administration|hospital|health)", re.I)

def is_va(r):
    return r['network'] == 'va' or bool(VA_RE.search(f"{r['name']} | {r.get('institution') or ''}"))

def canon(r):
    """Institution key, always scoped to the city (the same university in two cities is two clinics)."""
    low = f"{r['name']} | {r.get('institution') or ''}".lower()
    for rx, key in ALIASES:
        if re.search(rx, low):
            return key.replace("-<city>", "") + "@" + norm(r['city'])
    return None

def addr_match(a, b):
    ad, bd = digits(a.get('address')), digits(b.get('address'))
    streetA = re.sub(r"[^a-z0-9 ]", "", (a.get('address') or '').lower()).split(); streetB = re.sub(r"[^a-z0-9 ]", "", (b.get('address') or '').lower()).split()
    return bool(ad and bd and streetA[:1] == streetB[:1] and streetA[:1][0].isdigit() and streetA[:2] == streetB[:2])

def same_place(a, b):
    if a['state'] != b['state']: return False
    va_a, va_b = is_va(a), is_va(b)
    if va_a != va_b: return False            # a VA clinic never merges with a civilian one
    if va_a: return norm(a['city']) == norm(b['city']) or addr_match(a, b)
    ca, cb = canon(a), canon(b)
    if ca and cb: return ca == cb            # both known institutions: the alias decides
    if addr_match(a, b): return True         # same street address
    if ca or cb: return False                # one known institution, the other unknown and elsewhere
    za, zb = digits(a.get('zip'))[:5], digits(b.get('zip'))[:5]
    city_toks = tokens(a['city']) | tokens(b['city'])
    tok = (tokens(a['name'], a.get('institution')) & tokens(b['name'], b.get('institution'))) - city_toks
    if za and za == zb and norm(a['city']) == norm(b['city']) and len(tok) >= 1: return True
    if norm(a['city']) == norm(b['city']) and len(tok) >= 2: return True
    return False

def merge_clinics():
    recs = []
    for net in ('alsa', 'mda', 'va', 'neals'):
        for it in load(net): recs.append(dict(it))
    groups = []
    for r in recs:
        for g in groups:
            if any(same_place(r, m) for m in g): g.append(r); break
        else: groups.append([r])
    PRIORITY = {'alsa-coe': 0, 'alsa-rtc': 1, 'mda': 2, 'va': 3, 'neals': 4}
    clinics = []
    for g in groups:
        g.sort(key=lambda r: PRIORITY[r['network']])
        head = g[0]
        nets = []
        for r in g:
            if r['network'] not in nets: nets.append(r['network'])
        zipc = next((digits(r['zip'])[:5] for r in g if digits(r.get('zip'))[:5] in ZIP and ZIP[digits(r['zip'])[:5]][3] == r['state']), '')
        if zipc: lat, lng = ZIP[zipc][0], ZIP[zipc][1]; how = 'zip'
        else:
            (lat, lng), how = city_ll(head['city'], head['state'])
        # manual fixes for ZIP centroids that fall in the water
        if zipc == '44195': lat, lng = 41.5034, -81.6208
        inst = head.get('institution') or ''
        named = next((r for r in g if re.search(r"\bALS\b|MND|motor neuron", r['name'], re.I)), head)
        name = named['name']
        if named is not head and named.get('institution'): inst = named['institution']
        url = next((r['url'] for r in g if r.get('url') and not re.search(r"als\.org|mda\.org", r['url'])), '') or next((r['url'] for r in g if r.get('url')), '')
        phone = next((re.sub(r"\s+", " ", r['phone']).strip() for r in g if r.get('phone')), '')
        addr = next((r['address'] for r in g if r.get('address')), '')
        slug = re.sub(r"[^a-z0-9]+", "-", (name + " " + head['city']).lower()).strip('-')[:60]
        clinics.append({"id": slug, "name": name, "inst": inst if norm(inst) != norm(name) else "", "addr": addr, "city": head['city'].strip(),
                        "state": head['state'], "zip": zipc, "phone": phone, "url": url, "nets": nets,
                        "lat": round(lat, 4), "lng": round(lng, 4), "src": sorted({r['source'] for r in g})[:3]})
    # uniqueness of ids
    seen = collections.Counter(c['id'] for c in clinics)
    for c in clinics:
        if seen[c['id']] > 1: c['id'] += '-' + c['state'].lower()
    clinics.sort(key=lambda c: (c['state'], c['city'], c['name']))
    return clinics, groups

def study_sites():
    tr = json.load(open('data/trials.json'))['items']
    cities = {}
    for t in tr:
        if t.get('enrolling') == 'no': continue
        for L in t.get('locations') or []:
            if L.get('k') != 'United States' or L['s'] not in STATES50: continue
            key = (norm(L['c']), L['s'])
            if key not in cities:
                (lat, lng), how = city_ll(L['c'], L['s'])
                cities[key] = {"city": L['c'].strip(), "state": L['s'], "lat": round(lat, 4), "lng": round(lng, 4), "studies": {}}
            s = cities[key]['studies'].setdefault(t['id'], {"id": t['id'], "name": t.get('name') or t.get('title', '')[:70], "enrolling": t['enrolling'], "type": t['type'], "phase": t.get('phase', ''), "fac": []})
            if L.get('f') and L['f'] not in s['fac'] and len(s['fac']) < 4: s['fac'].append(L['f'])
    out = []
    for c in cities.values():
        c['studies'] = sorted(c['studies'].values(), key=lambda s: ({"yes": 0, "soon": 1, "invite": 2}.get(s['enrolling'], 3), s['name']))
        c['n'] = len(c['studies']); out.append(c)
    # fix city-name spelling variants for display
    FIX = {"Washington D.C.": "Washington", "Bethseda": "Bethesda", "Colombus": "Columbus", "Philadelphi": "Philadelphia", "The Bronx": "Bronx", "St Louis": "St. Louis"}
    for c in out: c['city'] = FIX.get(c['city'], c['city'])
    out.sort(key=lambda c: (c['state'], -c['n'], c['city']))
    return out

def local_programs():
    g = json.load(open('data/grants.json'))['items']; s = json.load(open('data/services.json'))['items']
    by_state = collections.defaultdict(list)
    for kind, items in (('grant', g), ('service', s)):
        for it in items:
            if it.get('scope') == 'National' or not it.get('regions'): continue
            for r in it['regions']:
                if r in STATES50:
                    by_state[r].append({"id": it['id'], "kind": kind, "name": it['name'], "org": it.get('org', ''), "status": it.get('status', ''), "forWhat": (it.get('forWhat') or '')[:140]})
    for r in by_state: by_state[r].sort(key=lambda x: (x['kind'], x['name']))
    return by_state

def build():
    clinics, groups = merge_clinics()
    sites = study_sites()
    programs = local_programs()
    counts = {}
    for s in STATES50:
        cl = [c for c in clinics if c['state'] == s]; st = [c for c in sites if c['state'] == s]
        counts[s] = {"clinics": len(cl), "siteCities": len(st), "studies": len({x['id'] for c in st for x in c['studies']}), "programs": len(programs.get(s, []))}
    data = {"updated": TODAY, "sources": {
                "alsa": "https://www.als.org/local-support/certified-centers-clinics", "mda": "https://www.mda.org/care/care-center-list",
                "va": "https://www.va.gov/health/als.asp", "neals": "https://neals.org/about/neals-member-sites/", "trials": "ClinicalTrials.gov snapshot " + json.load(open('data/trials.json'))['registrySnapshot']},
            "clinics": clinics, "sites": sites, "programs": programs, "counts": counts}
    pathlib.Path('data').mkdir(exist_ok=True)
    json.dump(data, open('data/map.json', 'w'), separators=(',', ':'), ensure_ascii=False)
    # ZIP tables, split by first digit
    zips = json.load(open(SRC / 'tools/zips.json'))
    pathlib.Path('data/zips').mkdir(exist_ok=True)
    byd = collections.defaultdict(list)
    for z, lat, lng, city, st in zips:
        if st in STATES50: byd[z[0]].append((z, lat, lng, city, st))
    for d, rows in byd.items():
        places = []; idx = {}; out = []
        for z, lat, lng, city, st in sorted(rows):
            p = f"{city}, {st}"
            if p not in idx: idx[p] = len(places); places.append(p)
            out.append([int(z), round(lat, 3), round(lng, 3), idx[p]])
        json.dump({"p": places, "z": out}, open(f'data/zips/{d}.json', 'w'), separators=(',', ':'), ensure_ascii=False)
    return data, groups

if __name__ == "__main__":
    import os
    data, groups = build()
    print("clinics", len(data['clinics']), "merged groups >1:", sum(1 for g in groups if len(g) > 1))
    nets = collections.Counter(n for c in data['clinics'] for n in c['nets']); print(nets)
    print("site cities", len(data['sites']), "studies", len({s['id'] for c in data['sites'] for s in c['studies']}))
    print("states with programs", len(data['programs']))
    print("map.json", os.path.getsize('data/map.json'), "bytes; zips:", {d: os.path.getsize(f'data/zips/{d}') for d in sorted(os.listdir('data/zips'))})
    if '--groups' in sys.argv:
        for g in groups:
            if len(g) > 1: print(" + ".join(f"[{r['network']}] {r['name']} ({r['city']}, {r['state']} {r.get('zip','')})" for r in g))
