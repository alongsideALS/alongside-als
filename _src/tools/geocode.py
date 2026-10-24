"""Geocode clinics and trial sites using the ZIP table (city centroid = mean of that city's ZIPs)."""
import json, re, collections, statistics, sys

STATES50 = set("AL AK AZ AR CA CO CT DC DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split())
import pathlib
zips = json.load(open(pathlib.Path(__file__).resolve().parent / 'zips.json'))
ZIP = {z[0]: (z[1], z[2], z[3], z[4]) for z in zips}

def norm(city):
    c = city.lower().strip()
    c = re.sub(r"[.'’]", "", c)
    c = re.sub(r"\s+", " ", c)
    c = re.sub(r"^saint ", "st ", c); c = re.sub(r"^mount ", "mt ", c); c = re.sub(r"^fort ", "ft ", c)
    c = re.sub(r"^ste ", "st ", c)
    return c

# city centroids: (norm city, state) -> list of (lat,lng)
pts = collections.defaultdict(list)
for z, lat, lng, city, st in zips:
    if st in STATES50 and lat:
        pts[(norm(city), st)].append((lat, lng))
CITY = {k: (round(statistics.median(p[0] for p in v), 4), round(statistics.median(p[1] for p in v), 4), len(v)) for k, v in pts.items()}

ALIASES = {  # registry spellings -> ZIP-table spellings (or fixed coordinates)
    ("washington dc", "DC"): ("washington", "DC"), ("georgetown", "DC"): ("washington", "DC"),
    ("bethseda", "MD"): ("bethesda", "MD"), ("colombus", "OH"): ("columbus", "OH"),
    ("north worcester", "MA"): ("worcester", "MA"), ("the bronx", "NY"): ("bronx", "NY"),
    ("philadelphi", "PA"): ("philadelphia", "PA"),
}
FIXED = {  # places the ZIP table folds into a neighbour; coordinates of the town centre
    ("davie", "FL"): (26.0765, -80.2521), ("fairway", "KS"): (39.0222, -94.6319),
    ("amherst", "NY"): (42.9784, -78.7998), ("miami lakes", "FL"): (25.9087, -80.3087),
}

def city_ll(city, state):
    k = (norm(city), state)
    if k in ALIASES: k = ALIASES[k]
    if k in FIXED: return FIXED[k], "fixed"
    if k in CITY: return CITY[k][:2], "city"
    # try removing common suffixes/variants
    variants = [norm(city).replace("st ", "saint "), norm(city).replace("mt ", "mount "), norm(city).replace("ft ", "fort "),
                re.sub(r" (heights|hts|township|twp|city|village)$", "", norm(city)), norm(city).replace("-", " "), norm(city).replace(" ", "-")]
    for v in variants:
        if (v, state) in CITY: return CITY[(v, state)][:2], "city~" + v
    return None, None

def zip_ll(z):
    z = re.sub(r"\D", "", str(z or ""))[:5]
    if len(z) == 5 and z in ZIP:
        return (ZIP[z][0], ZIP[z][1]), "zip"
    return None, None

if __name__ == "__main__":
    # --- trial sites ---
    tr = json.load(open('/home/claude/merged/data/trials.json'))['items']
    missing = collections.Counter(); ok = 0
    for t in tr:
        for L in t.get('locations') or []:
            if L.get('k') != 'United States': continue
            ll, how = city_ll(L['c'], L['s'])
            if ll: ok += 1
            else: missing[(L['c'], L['s'])] += 1
    print("trial locations geocoded:", ok, "missing:", sum(missing.values()), missing.most_common(40))
    # --- clinics ---
    for f in ['alsa', 'mda', 'va', 'neals']:
        d = json.load(open(f'/home/claude/mapdata/{f}.json'))
        nz = nc = nm = 0; miss = []
        for it in d['items']:
            ll, how = zip_ll(it.get('zip'))
            if ll and ZIP[re.sub(r"\D","",str(it['zip']))[:5]][3] != it['state']:
                ll = None  # zip/state mismatch -> fall back to city
            if ll: nz += 1; continue
            ll, how = city_ll(it['city'], it['state'])
            if ll: nc += 1
            else: nm += 1; miss.append((it['name'], it['city'], it['state'], it.get('zip')))
        print(f, "by zip:", nz, "by city:", nc, "missing:", nm, miss)
