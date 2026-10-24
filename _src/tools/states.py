"""Decode us-atlas states-albers-10m TopoJSON -> simplified SVG paths + point-in-state tests."""
import json, math
from albers import PROJECT

FIPS = {"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY","72":"PR"}

import pathlib
topo = json.load(open(pathlib.Path(__file__).resolve().parent / 'states-albers-10m.json'))
sx, sy = topo['transform']['scale']; tx, ty = topo['transform']['translate']

def decode(arc):
    x = y = 0; out = []
    for dx, dy in arc:
        x += dx; y += dy
        out.append((x * sx + tx, y * sy + ty))
    return out

ARCS = [decode(a) for a in topo['arcs']]

def vw_simplify(pts, min_area):
    """Visvalingam-Whyatt: drop points whose triangle area < min_area (keeps endpoints)."""
    pts = list(pts)
    if len(pts) <= 3: return pts
    def area(i):
        (x1,y1),(x2,y2),(x3,y3) = pts[i-1], pts[i], pts[i+1]
        return abs((x1-x3)*(y2-y1) - (x1-x2)*(y3-y1)) / 2
    changed = True
    while changed and len(pts) > 3:
        changed = False
        areas = [area(i) for i in range(1, len(pts)-1)]
        m = min(areas)
        if m < min_area:
            del pts[1 + areas.index(m)]; changed = True
    return pts

def ring_points(arc_idxs, arcs):
    pts = []
    for i in arc_idxs:
        a = arcs[i] if i >= 0 else list(reversed(arcs[~i]))
        if pts and a and pts[-1] == a[0]: a = a[1:]
        pts.extend(a)
    return pts

def polygons(geom, arcs):
    if geom['type'] == 'Polygon': polys = [geom['arcs']]
    else: polys = geom['arcs']
    return [[ring_points(ring, arcs) for ring in poly] for poly in polys]

def point_in_ring(pt, ring):
    x, y = pt; inside = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]; x2, y2 = ring[(i+1) % n]
        if (y1 > y) != (y2 > y):
            xin = (x2 - x1) * (y - y1) / (y2 - y1 + 1e-18) + x1
            if x < xin: inside = not inside
    return inside

def point_in_state(pt, polys):
    for poly in polys:
        if point_in_ring(pt, poly[0]) and not any(point_in_ring(pt, hole) for hole in poly[1:]):
            return True
    return False

STATES = {}
for g in topo['objects']['states']['geometries']:
    code = FIPS.get(g['id'])
    if not code or code == 'PR': continue
    STATES[code] = {"name": g['properties']['name'], "polys": polygons(g, ARCS), "geom": g}

def fmt(v): return f"{v:.1f}".rstrip('0').rstrip('.') if abs(v - round(v)) > 0.05 else str(int(round(v)))

def svg_path(polys):
    d = []
    for poly in polys:
        for ring in poly:
            if len(ring) < 3: continue
            d.append("M" + " ".join(f"{fmt(x)},{fmt(y)}" for x, y in ring[:-1] if True) + "Z")
    return "".join(d)

def build_paths(min_area):
    sarcs = [vw_simplify(a, min_area) for a in ARCS]
    out = {}
    for code, s in STATES.items():
        out[code] = svg_path(polygons(s['geom'], sarcs))
    return out

def label_point(code):
    """Visual centre: centroid of the largest polygon (area-weighted), nudged for a few odd shapes."""
    best = None
    for poly in STATES[code]['polys']:
        ring = poly[0]; A = cx = cy = 0
        for i in range(len(ring) - 1):
            x1, y1 = ring[i]; x2, y2 = ring[i+1]; cr = x1*y2 - x2*y1
            A += cr; cx += (x1 + x2) * cr; cy += (y1 + y2) * cr
        if A == 0: continue
        A /= 2; cx /= (6*A); cy /= (6*A)
        if best is None or abs(A) > best[0]: best = (abs(A), cx, cy)
    return (round(best[1], 1), round(best[2], 1))

if __name__ == "__main__":
    import sys
    for ma in (0, 0.5, 1, 2, 4):
        p = build_paths(ma); total = sum(len(v) for v in p.values())
        print(f"min_area={ma}: path chars={total}")
    # projection validation
    from geocode import city_ll, zip_ll, ZIP
    import re
    bad = 0; n = 0
    for f in ['alsa', 'mda', 'va', 'neals']:
        for it in json.load(open(f'/home/claude/mapdata/{f}.json'))['items']:
            ll, how = zip_ll(it.get('zip'))
            if not ll or ZIP[re.sub(r"\D","",str(it['zip']))[:5]][3] != it['state']: ll, how = city_ll(it['city'], it['state'])
            pt = PROJECT(ll[1], ll[0]); n += 1
            if not pt or not point_in_state(pt, STATES[it['state']]['polys']):
                bad += 1; print("OUTSIDE:", f, it['name'], it['city'], it['state'], ll, pt)
    print("clinics checked", n, "outside own state", bad)
    tr = json.load(open('/home/claude/merged/data/trials.json'))['items']; n = bad = 0; seen = set()
    for t in tr:
        for L in t.get('locations') or []:
            if L.get('k') != 'United States' or (L['c'], L['s']) in seen: continue
            seen.add((L['c'], L['s']))
            ll, how = city_ll(L['c'], L['s']); pt = PROJECT(ll[1], ll[0]); n += 1
            if not pt or not point_in_state(pt, STATES[L['s']]['polys']):
                bad += 1; print("OUTSIDE:", L['c'], L['s'], ll, pt)
    print("trial cities checked", n, "outside own state", bad)
    print({c: label_point(c) for c in ['CA', 'TX', 'FL', 'MI', 'AK', 'HI', 'NY']})
