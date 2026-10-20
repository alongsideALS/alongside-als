/* Alongside ALS — "Help near you" map (/map).
   Self-hosted SVG outline map (Albers USA, same frame as us-atlas *-albers-10m: 975×610).
   Uses window.AA from site.js for saving, the shared state picker, toasts and escaping. */
(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const AA = window.AA || {};
const esc = AA.esc || ((v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])));
const stateName = AA.stateName || ((s) => s);
const toast = AA.toast || (() => {});
const saveBtn = AA.saveBtn || (() => "");
const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

const svg = $("#usmap"); if (!svg) return;
svg.setAttribute("role", "group");
const gStates = $("#states"), gLabels = $("#stateLabels"), gRing = $("#zipRing"), gPins = $("#pins"), gCity = $("#cityLabels");
const side = $("#mapSide"), tip = $("#mapTip"), wrap = $("#mapWrap"), back = $("#mapBack"), sel = $("#mapState"), form = $("#zipForm"), zipIn = $("#zip"), radiusSel = $("#radius"), legend = $("#legend"), smallBox = $("#smallStates");
const W = 975, H = 610;
const SMALL = ["CT","DC","DE","MA","MD","NH","NJ","RI","VT"];
const NET = {
  "alsa-coe": ["ALS Association Center of Excellence", "Certified Treatment Center of Excellence (ALS Association)"],
  "alsa-rtc": ["ALS Association Recognized Center", "Recognized Treatment Center (ALS Association)"],
  "mda": ["MDA ALS Care Center", "MDA ALS Care Center (Muscular Dystrophy Association)"],
  "va": ["VA ALS clinic", "Department of Veterans Affairs ALS clinic (for veterans)"],
  "neals": ["NEALS research site", "Member of the Northeast ALS Consortium (runs clinical research)"]
};
const ENROLL = { yes: ["Recruiting", "s-good"], soon: ["Not yet recruiting", "s-info"], invite: ["By invitation", "s-warn"] };
const LAYER_LABEL = { clinics: "ALS clinics", sites: "cities with study sites", programs: "local grants & services" };

/* ---------- Albers USA projection (port of d3-geo geoAlbersUsa; scale 1300, translate [487.5, 305]) ---------- */
const RAD = Math.PI / 180;
function conic(p0, p1, rotate, center, k, tx, ty, clip){
  const sy0 = Math.sin(p0 * RAD), n = (sy0 + Math.sin(p1 * RAD)) / 2, c = 1 + sy0 * (2 * n - sy0), r0 = Math.sqrt(c) / n;
  const raw = (x, y) => { const r = Math.sqrt(Math.max(c - 2 * n * Math.sin(y), 0)) / n; return [r * Math.sin(x * n), r0 - r * Math.cos(x * n)]; };
  const [cx, cy] = raw(center[0] * RAD, center[1] * RAD);
  const dx = tx - cx * k, dy = ty + cy * k;
  return (lon, lat) => {
    let lam = lon * RAD + rotate * RAD; lam = ((lam + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const [x, y] = raw(lam, lat * RAD); const px = dx + x * k, py = dy - y * k;
    if (px < clip[0] || px > clip[2] || py < clip[1] || py > clip[3]) return null;
    return [px, py];
  };
}
const K = 1300, TX = 487.5, TY = 305, E = 1e-6;
const lower48 = conic(29.5, 45.5, 96, [-0.6, 38.7], K, TX, TY, [TX - .455 * K, TY - .238 * K, TX + .455 * K, TY + .238 * K]);
const alaska = conic(55, 65, 154, [-2, 58.5], K * .35, TX - .307 * K, TY + .201 * K, [TX - .425 * K + E, TY + .120 * K + E, TX - .214 * K - E, TY + .234 * K - E]);
const hawaii = conic(8, 18, 157, [-3, 19.9], K, TX - .205 * K, TY + .212 * K, [TX - .214 * K + E, TY + .166 * K + E, TX - .115 * K - E, TY + .234 * K - E]);
const project = (lon, lat) => lower48(lon, lat) || alaska(lon, lat) || hawaii(lon, lat);
const MI_PER_PX = 3958.8 / K;   // projected units are Earth radii × K
const haversine = (a, b, c, d) => { const p = RAD, dl = (c - a) * p, dn = (d - b) * p; const h = Math.sin(dl/2)**2 + Math.cos(a*p) * Math.cos(c*p) * Math.sin(dn/2)**2; return 2 * 3958.8 * Math.asin(Math.sqrt(h)); };

/* ---------- state ---------- */
let DATA = null, layer = "clinics", mode = { kind: "us" }, ZIPS = {}, bboxes = {};
const paths = {}; $$("path[data-state]", gStates).forEach(p => { paths[p.dataset.state] = p; });
const CODES = Object.keys(paths).sort((a, b) => stateName(a).localeCompare(stateName(b)));

/* ---------- helpers ---------- */
const bbox = (code) => { if (!bboxes[code]) { const b = paths[code].getBBox(); bboxes[code] = { x: b.x, y: b.y, w: b.width, h: b.height }; } return bboxes[code]; };
const counts = (code) => (DATA && DATA.counts[code]) || { clinics: 0, siteCities: 0, studies: 0, programs: 0 };
const plural = (n, w, ws) => `${n} ${n === 1 ? w : (ws || w + "s")}`;
const summaryLine = (c) => `${plural(c.clinics, "clinic")} · ${plural(c.studies, "study", "studies")} at sites in ${plural(c.siteCities, "city", "cities")} · ${plural(c.programs, "local program")}`;
const byCity = (items) => { const m = new Map(); items.forEach(it => { const k = it.city + "|" + it.state; if (!m.has(k)) m.set(k, { city: it.city, state: it.state, lat: it.lat, lng: it.lng, items: [] }); m.get(k).items.push(it); }); return [...m.values()]; };
const telHref = (p) => "tel:" + String(p).split(/,|ext/i)[0].replace(/[^0-9+]/g, "");
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");
const fmtMi = (m) => m < 10 ? m.toFixed(1).replace(/\.0$/, "") + " mi" : Math.round(m) + " mi";
const setUrl = () => { const q = mode.kind === "state" ? `?state=${mode.state}` : mode.kind === "zip" ? `?zip=${mode.zip}&mi=${mode.radius}` : ""; history.replaceState(null, "", "/map" + q); };

/* ---------- viewBox animation ---------- */
let vb = [0, 0, W, H], anim = null;
const setVB = (v) => { vb = v; svg.setAttribute("viewBox", v.map(n => Math.round(n * 100) / 100).join(" ")); };
function zoomTo(target, done){
  if (anim) cancelAnimationFrame(anim);
  if (REDUCED) { setVB(target); done && done(); return; }
  const from = vb.slice(), t0 = performance.now(), dur = 420;
  const step = (t) => { const p = Math.min(1, (t - t0) / dur), e = p < .5 ? 2*p*p : -1 + (4 - 2*p) * p; setVB(from.map((f, i) => f + (target[i] - f) * e)); if (p < 1) anim = requestAnimationFrame(step); else { anim = null; done && done(); } };
  anim = requestAnimationFrame(step);
}
const zoomFactor = () => W / vb[2];
const fitBox = (x, y, w, h, pad = .18) => { const px = w * pad, py = h * pad; let bw = w + 2 * px, bh = h + 2 * py; const ratio = W / H; if (bw / bh > ratio) bh = bw / ratio; else bw = bh * ratio; const cx = x + w / 2, cy = y + h / 2; return [cx - bw / 2, cy - bh / 2, bw, bh]; };

/* ---------- choropleth ---------- */
const bucket = (n) => n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4;
const layerCount = (code) => { const c = counts(code); return layer === "clinics" ? c.clinics : layer === "sites" ? c.siteCities : c.programs; };
function paint(){
  CODES.forEach(code => { const p = paths[code], c = counts(code), n = layerCount(code);
    const active = (mode.kind === "state" && mode.state === code) || (mode.kind === "zip" && mode.state === code);
    p.setAttribute("class", `st q${bucket(n)}` + (active ? " active" : "") + (mode.kind !== "us" && !active ? " dim" : ""));
    p.setAttribute("aria-label", `${stateName(code)}: ${summaryLine(c)}`);
  });
  gLabels.innerHTML = mode.kind === "us" ? CODES.filter(c => !SMALL.includes(c)).map(code => { const p = paths[code]; const n = layerCount(code); return `<text x="${p.dataset.lx}" y="${p.dataset.ly}" class="${bucket(n) >= 3 ? "light" : ""}"><tspan>${code}</tspan>${n ? `<tspan class="n" x="${p.dataset.lx}" dy="11">${n}</tspan>` : ""}</text>`; }).join("") : "";
  legend.innerHTML = mode.kind === "us"
    ? `<span class="lg-title">${esc(LAYER_LABEL[layer])}</span>` + [["q0","0"],["q1","1–2"],["q2","3–5"],["q3","6–9"],["q4","10+"]].map(([q,l]) => `<span class="lg"><i class="${q}"></i>${l}</span>`).join("")
    : `<span class="lg"><i class="pin-c"></i>Clinic</span><span class="lg"><i class="pin-s"></i>Study site</span>${mode.kind === "zip" ? `<span class="lg"><i class="pin-z"></i>Your ZIP</span>` : ""}`;
  $$("[data-layer]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.layer === layer)));
}

/* ---------- pins ---------- */
const pxPerUnit = () => (svg.getBoundingClientRect().width || 600) / vb[2];
function drawPins(clinics, cities, zipPt){
  const s = pxPerUnit(), r = 9 / s, fs = 12.5 / s, sw = 1.8 / s;
  const groups = new Map();
  byCity(clinics).forEach(g => groups.set(g.city + "|" + g.state, { city: g.city, state: g.state, lat: g.lat, lng: g.lng, clinics: g.items, studies: [] }));
  cities.forEach(c => { const k = c.city + "|" + c.state; if (!groups.has(k)) groups.set(k, { city: c.city, state: c.state, lat: c.lat, lng: c.lng, clinics: [], studies: c.studies }); else groups.get(k).studies = c.studies; });
  const list = [...groups.values()].map(g => { const pt = project(g.lng, g.lat); return pt ? Object.assign(g, { x: pt[0], y: pt[1] }) : null; }).filter(Boolean)
    .sort((a, b) => (b.clinics.length + b.studies.length) - (a.clinics.length + a.studies.length));
  const out = [], labels = [], placed = [];
  list.forEach(g => {
    const hasC = g.clinics.length > 0, hasS = g.studies.length > 0;
    const cx = hasC && hasS ? g.x - r * .55 : g.x, sx = hasC && hasS ? g.x + r * .55 : g.x;
    const title = `${g.city}, ${g.state}: ${hasC ? plural(g.clinics.length, "clinic") : ""}${hasC && hasS ? " · " : ""}${hasS ? plural(g.studies.length, "study", "studies") : ""}`;
    const id = `city-${slug(g.city + "-" + g.state)}`;
    out.push(`<g class="pin" data-target="${id}" data-title="${esc(title)}" style="cursor:pointer">
      ${hasC ? `<circle cx="${cx}" cy="${g.y}" r="${r}" class="pin-c" stroke-width="${sw}"/>${g.clinics.length > 1 ? `<text x="${cx}" y="${g.y}" font-size="${fs * .95}" class="pin-n">${g.clinics.length}</text>` : ""}` : ""}
      ${hasS ? `<path d="M${sx} ${g.y - r * 1.15} l${r * 1.15} ${r * 1.15} l-${r * 1.15} ${r * 1.15} l-${r * 1.15} -${r * 1.15}Z" class="pin-s" stroke-width="${sw}"/>${g.studies.length > 1 ? `<text x="${sx}" y="${g.y}" font-size="${fs * .9}" class="pin-n">${g.studies.length}</text>` : ""}` : ""}
      <circle cx="${g.x}" cy="${g.y}" r="${r * 2.2}" fill="transparent"/></g>`);
    // label: try right, left, below, above; skip if every spot collides with a label already placed
    const lw = g.city.length * fs * .6, lh = fs * 1.25, off = r * (hasC && hasS ? 2.1 : 1.5);
    const spots = [[g.x + off, g.y + fs * .35, "start"], [g.x - off, g.y + fs * .35, "end"], [g.x, g.y + off + fs * .9, "middle"], [g.x, g.y - off - fs * .3, "middle"]];
    for (const [lx, ly, anchor] of spots) {
      const x0 = anchor === "start" ? lx : anchor === "end" ? lx - lw : lx - lw / 2;
      const box = { x0, y0: ly - lh, x1: x0 + lw, y1: ly };
      const hit = placed.some(b => !(box.x1 < b.x0 || box.x0 > b.x1 || box.y1 < b.y0 || box.y0 > b.y1)) || list.some(o => o !== g && Math.abs(o.x - (x0 + lw / 2)) < lw / 2 + r && Math.abs(o.y - (ly - lh / 2)) < lh / 2 + r);
      if (!hit) { placed.push(box); labels.push(`<text x="${lx}" y="${ly}" font-size="${fs}" text-anchor="${anchor}" class="city-lab" stroke-width="${3.5 / s}">${esc(g.city)}</text>`); break; }
    }
  });
  gPins.innerHTML = out.join("");
  gCity.innerHTML = labels.join("");
  if (zipPt) gCity.innerHTML += `<g class="zip-mark"><circle cx="${zipPt[0]}" cy="${zipPt[1]}" r="${r * .9}" class="pin-z" stroke-width="${sw}"/><circle cx="${zipPt[0]}" cy="${zipPt[1]}" r="${r * .3}" fill="#fff"/></g>`;
}
const clearPins = () => { gPins.innerHTML = ""; gCity.innerHTML = ""; gRing.innerHTML = ""; };
const layersBox = $(".map-layers");
const scrollToMap = () => { const top = $(".map-layout").getBoundingClientRect().top; if (top < 0 || top > innerHeight * .5) $(".map-layout").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); };

/* ---------- side panel renderers ---------- */
const netPills = (nets) => `<div class="pills">${nets.map(n => `<span class="pill ${n}" title="${esc(NET[n][1])}">${esc(NET[n][0])}</span>`).join("")}</div>`;
function clinicItem(c, extra = ""){
  const where = [c.addr, `${c.city}, ${c.state}${c.zip ? " " + c.zip : ""}`].filter(Boolean).join(", ");
  return `<li class="place" id="p-${esc(c.id)}">
    <div class="place-head"><h4>${esc(c.name)}</h4>${extra}</div>
    ${c.inst ? `<div class="org">${esc(c.inst)}</div>` : ""}
    <p class="small">${esc(where)}</p>
    ${netPills(c.nets)}
    <div class="place-foot">${c.phone ? `<a class="btn btn-line btn-sm" href="${telHref(c.phone)}">Call ${esc(c.phone)}</a>` : ""}${c.url ? `<a class="btn btn-line btn-sm" href="${esc(c.url)}" target="_blank" rel="noopener">Website<span class="sr"> (opens in a new tab)</span></a>` : ""}<a class="btn btn-sm linkish" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}" target="_blank" rel="noopener">Directions<span class="sr"> (opens in a new tab)</span></a></div>
  </li>`;
}
function studyItem(s){
  const en = ENROLL[s.enrolling] || [s.enrolling, ""];
  return `<li class="study">
    <div class="study-head"><span class="pill ${en[1]}">${esc(en[0])}</span><span class="pill">${esc(s.phase || s.type)}</span></div>
    <b>${esc(s.name)}</b>
    ${s.fac && s.fac.length ? `<p class="small muted">${esc(s.fac.join(" · "))}</p>` : ""}
    <div class="place-foot"><a class="btn btn-line btn-sm" href="https://clinicaltrials.gov/study/${encodeURIComponent(s.id)}" target="_blank" rel="noopener">Official record<span class="sr"> (opens in a new tab)</span></a>${saveBtn("trial", s.id, s.name)}</div>
  </li>`;
}
function programItem(p){
  const st = { open: ["Open", "s-good"], rolling: ["Rolling", "s-good"], window: ["Dated window", "s-warn"], closed: ["Closed", "s-bad"], check: ["Check status", "s-info"] }[p.status] || [p.status, ""];
  return `<li class="prog"><div class="study-head"><span class="pill">${p.kind === "grant" ? "Grant" : "Service"}</span><span class="pill ${st[1]}">${esc(st[0])}</span></div><b>${esc(p.name)}</b><div class="org">${esc(p.org)}</div>${p.forWhat ? `<p class="small">${esc(p.forWhat)}</p>` : ""}<div class="place-foot"><a class="btn btn-line btn-sm" href="/${p.kind === "grant" ? "grants" : "services"}#item-${encodeURIComponent(p.id)}">Details &amp; how to apply</a></div></li>`;
}
const cityHeading = (g, extra = "") => `<h3 class="city-h" id="city-${slug(g.city + "-" + g.state)}">${esc(g.city)}, ${esc(g.state)}${extra}</h3>`;

function renderUS(){
  const tot = { clinics: DATA.clinics.length, cities: DATA.sites.length, studies: new Set(DATA.sites.flatMap(c => c.studies.map(s => s.id))).size, programs: new Set(Object.values(DATA.programs).flatMap(l => l.map(p => p.kind + p.id))).size, states: Object.keys(DATA.programs).length };
  const mine = AA.getState ? AA.getState() : "";
  side.innerHTML = `<div class="side-head"><span class="eyebrow">Across the country</span><h2>Where the help is</h2>
    <p>${tot.clinics} multidisciplinary ALS clinics · ${tot.studies} recruiting studies with sites in ${tot.cities} cities · ${tot.programs} grants and services that serve particular states.</p>
    ${mine ? `<p><button class="btn btn-primary btn-sm" type="button" data-state="${mine}">Show ${esc(stateName(mine))}</button> <span class="small muted">your state on this site</span></p>` : `<p class="small muted">Pick a state on the map or in the table, or enter a ZIP code above.</p>`}</div>
    <div class="table-wrap"><table class="st-table"><caption class="sr">Clinics, study sites and local programs by state</caption>
      <thead><tr><th scope="col">State</th><th scope="col">Clinics</th><th scope="col">Study cities</th><th scope="col">Local programs</th></tr></thead>
      <tbody>${CODES.map(code => { const c = counts(code); return `<tr><th scope="row"><button class="linkish" type="button" data-state="${code}">${esc(stateName(code))}</button></th><td>${c.clinics || "–"}</td><td>${c.siteCities || "–"}</td><td>${c.programs || "–"}</td></tr>`; }).join("")}</tbody></table></div>`;
}

function renderState(code){
  const c = counts(code), name = stateName(code);
  const clinics = DATA.clinics.filter(x => x.state === code), cities = DATA.sites.filter(x => x.state === code), progs = DATA.programs[code] || [];
  const mine = AA.getState ? AA.getState() : "";
  const cg = byCity(clinics).sort((a, b) => a.city.localeCompare(b.city));
  side.innerHTML = `<div class="side-head"><span class="eyebrow">State</span><h2>${esc(name)}</h2><p>${esc(summaryLine(c))}.</p>
    <div class="side-actions">${mine === code ? `<span class="pill s-good">Your state on this site</span>` : `<button class="btn btn-line btn-sm" type="button" data-usestate="${code}">Use ${esc(name)} on the whole site</button>`}<button class="btn btn-line btn-sm print-btn" type="button" data-print>Print this list</button></div>
    <p class="small"><a href="/grants" data-setstate="${code}">Grants for ${esc(name)}</a> · <a href="/services" data-setstate="${code}">Services</a> · <a href="/trials" data-setstate="${code}">Studies with ${esc(code)} sites</a></p></div>
    <section class="side-sec"><h3 class="sec-h">Clinics <span class="muted">(${clinics.length})</span></h3>
      ${clinics.length ? cg.map(g => `${cityHeading(g, g.items.length > 1 ? ` <span class="muted small">${g.items.length} clinics</span>` : "")}<ul class="places">${g.items.map(x => clinicItem(x)).join("")}</ul>`).join("")
        : `<p class="empty-line">No multidisciplinary ALS clinic is listed in ${esc(name)}. Nearby states may have one — try the ZIP search with a 200-mile range, and ask your <a href="https://www.als.org/support/states" target="_blank" rel="noopener">ALS Association chapter</a> about telehealth.</p>`}</section>
    <section class="side-sec"><h3 class="sec-h">Study sites <span class="muted">(${c.studies} studies in ${cities.length} ${cities.length === 1 ? "city" : "cities"})</span></h3>
      ${cities.length ? cities.map(g => `<details class="city-d" id="city-${slug(g.city + "-" + g.state)}"><summary><span>${esc(g.city)}</span><span class="muted small">${plural(g.studies.length, "study", "studies")}</span></summary><ul class="places">${g.studies.map(studyItem).join("")}</ul></details>`).join("")
        : `<p class="empty-line">No recruiting study lists a site in ${esc(name)} right now. Some studies run from home: see <a href="/trials">Trials</a> and tick "From home".</p>`}</section>
    <section class="side-sec"><h3 class="sec-h">Grants &amp; services just for ${esc(name)} <span class="muted">(${progs.length})</span></h3>
      ${progs.length ? `<ul class="places">${progs.map(programItem).join("")}</ul>` : `<p class="empty-line">Nothing is listed only for ${esc(name)}, but every nationwide program applies. See <a href="/grants" data-setstate="${code}">Grants</a> and <a href="/services" data-setstate="${code}">Services</a>.</p>`}
      <p class="small muted">Nationwide programs are not repeated here — they are open to every state.</p></section>`;
}

function renderZip(zip, place, lat, lng, radius, found){
  const { clinics, cities, states } = found;
  const progs = states.flatMap(s => (DATA.programs[s] || []).map(p => Object.assign({ state: s }, p)));
  side.innerHTML = `<div class="side-head"><span class="eyebrow">Near you</span><h2>Within ${radius} miles of ${esc(zip)}</h2><p>${esc(place)} · ${plural(clinics.length, "clinic")} · ${plural(new Set(cities.flatMap(c => c.studies.map(s => s.id))).size, "study", "studies")} at sites in ${plural(cities.length, "city", "cities")}</p>
    <div class="side-actions">${[50,100,200].map(m => `<button class="chip" type="button" data-radius="${m}" aria-pressed="${m === radius}">${m} mi</button>`).join("")}<button class="btn btn-line btn-sm print-btn" type="button" data-print>Print this list</button></div></div>
    <section class="side-sec"><h3 class="sec-h">Clinics, closest first</h3>
      ${clinics.length ? `<ul class="places">${clinics.map(x => clinicItem(x, `<span class="mi">${fmtMi(x.mi)}</span>`)).join("")}</ul>` : `<p class="empty-line">No multidisciplinary ALS clinic within ${radius} miles. ${radius < 200 ? `Try <button class="linkish" type="button" data-radius="200">200 miles</button>, or ask` : "Ask"} your <a href="https://www.als.org/support/states" target="_blank" rel="noopener">ALS Association chapter</a> about telehealth clinics.</p>`}</section>
    <section class="side-sec"><h3 class="sec-h">Study sites, closest first</h3>
      ${cities.length ? cities.map(g => `<details class="city-d" id="city-${slug(g.city + "-" + g.state)}"><summary><span>${esc(g.city)}, ${esc(g.state)} <span class="mi">${fmtMi(g.mi)}</span></span><span class="muted small">${plural(g.studies.length, "study", "studies")}</span></summary><ul class="places">${g.studies.map(studyItem).join("")}</ul></details>`).join("")
        : `<p class="empty-line">No recruiting study has a site within ${radius} miles. Some run from home: see <a href="/trials">Trials</a> and tick "From home".</p>`}</section>
    <section class="side-sec"><h3 class="sec-h">Grants &amp; services for ${states.map(stateName).map(esc).join(", ")}</h3>
      ${progs.length ? `<ul class="places">${progs.map(programItem).join("")}</ul>` : `<p class="empty-line">Nothing is listed only for ${states.map(stateName).map(esc).join(" or ")}; every nationwide program still applies. See <a href="/grants">Grants</a> and <a href="/services">Services</a>.</p>`}
      <p class="small muted">Shows programs for ${states.length > 1 ? "the states inside your search range" : "your state"}. Nationwide programs are on the Grants and Services pages.</p></section>`;
}

/* ---------- modes ---------- */
function showUS(push = true){
  mode = { kind: "us" }; back.hidden = true; layersBox.hidden = false; sel.value = ""; clearPins(); paint(); renderUS();
  zoomTo([0, 0, W, H]); if (push) setUrl();
}
function showState(code, push = true){
  if (!paths[code]) return;
  mode = { kind: "state", state: code }; back.hidden = false; layersBox.hidden = true; sel.value = code; clearPins(); paint(); renderState(code);
  if (push) scrollToMap();
  const b = bbox(code);
  zoomTo(fitBox(b.x, b.y, b.w, b.h, code === "AK" ? .05 : .15), () => drawPins(DATA.clinics.filter(x => x.state === code), DATA.sites.filter(x => x.state === code)));
  if (push) setUrl();
  side.querySelector("h2") && side.querySelector("h2").setAttribute("tabindex", "-1");
}
async function lookupZip(zip){
  const d = zip[0];
  if (!ZIPS[d]) { try { ZIPS[d] = await (await fetch(`/data/zips/${d}.json`, { cache: "force-cache" })).json(); } catch { return null; } }
  const t = ZIPS[d], n = +zip; let lo = 0, hi = t.z.length - 1;
  while (lo <= hi) { const mid = (lo + hi) >> 1, v = t.z[mid][0]; if (v === n) return { lat: t.z[mid][1], lng: t.z[mid][2], place: t.p[t.z[mid][3]] }; if (v < n) lo = mid + 1; else hi = mid - 1; }
  return null;
}
async function showZip(zip, radius, push = true){
  zip = String(zip).replace(/\D/g, ""); radius = [50,100,200].includes(+radius) ? +radius : 100;
  if (zip.length !== 5) { zipIn.setAttribute("aria-invalid", "true"); toast("Enter a five-digit ZIP code."); zipIn.focus(); return; }
  side.innerHTML = `<div class="skel" style="height:120px"></div>`;
  const hit = await lookupZip(zip);
  if (!hit) { zipIn.setAttribute("aria-invalid", "true"); side.innerHTML = `<div class="side-head"><h2>We don't recognize ${esc(zip)}</h2><p>Check the five digits, or choose a state instead.</p></div>`; return; }
  zipIn.removeAttribute("aria-invalid"); zipIn.value = zip; radiusSel.value = String(radius);
  const pt = project(hit.lng, hit.lat); if (!pt) { side.innerHTML = `<div class="side-head"><h2>That ZIP code is outside the map</h2><p>The map covers the 50 states and Washington, D.C.</p></div>`; return; }
  mode = { kind: "zip", zip, radius, state: hit.place.slice(-2) }; back.hidden = false; layersBox.hidden = true; sel.value = ""; clearPins(); paint();
  if (push) scrollToMap();
  const within = (x) => { const mi = haversine(hit.lat, hit.lng, x.lat, x.lng); return mi <= radius ? mi : null; };
  const clinics = DATA.clinics.map(x => { const mi = within(x); return mi == null ? null : Object.assign({}, x, { mi }); }).filter(Boolean).sort((a, b) => a.mi - b.mi);
  const cities = DATA.sites.map(x => { const mi = within(x); return mi == null ? null : Object.assign({}, x, { mi }); }).filter(Boolean).sort((a, b) => a.mi - b.mi);
  const zipState = hit.place.slice(-2);
  const states = [...new Set([zipState, ...clinics.map(x => x.state), ...cities.map(x => x.state)])].filter(s => paths[s]);
  renderZip(zip, hit.place, hit.lat, hit.lng, radius, { clinics, cities, states });
  const rpx = radius / MI_PER_PX;
  gRing.innerHTML = `<circle cx="${pt[0]}" cy="${pt[1]}" r="${rpx}" class="ring"/>`;
  zoomTo(fitBox(pt[0] - rpx, pt[1] - rpx, rpx * 2, rpx * 2, .12), () => drawPins(clinics, cities, pt));
  if (push) setUrl();
}

/* ---------- tooltip ---------- */
function showTip(html, x, y){ tip.innerHTML = html; tip.hidden = false; const r = wrap.getBoundingClientRect(); let left = x - r.left + 14, top = y - r.top + 14; if (left + tip.offsetWidth > r.width - 8) left = x - r.left - tip.offsetWidth - 14; if (top + tip.offsetHeight > r.height - 8) top = y - r.top - tip.offsetHeight - 14; tip.style.left = Math.max(4, left) + "px"; tip.style.top = Math.max(4, top) + "px"; }
const hideTip = () => { tip.hidden = true; };
svg.addEventListener("mousemove", (e) => {
  const pin = e.target.closest(".pin"); if (pin) { showTip(`<b>${esc(pin.dataset.title)}</b><br><span class="small">Click to jump to the list</span>`, e.clientX, e.clientY); return; }
  const p = e.target.closest("path[data-state]");
  if (p && mode.kind === "us") { const c = counts(p.dataset.state); showTip(`<b>${esc(p.dataset.name)}</b><br>${esc(summaryLine(c))}<br><span class="small">Click to zoom in</span>`, e.clientX, e.clientY); }
  else if (p && mode.kind !== "us" && p.dataset.state !== mode.state) showTip(`<b>${esc(p.dataset.name)}</b><br><span class="small">Click to switch</span>`, e.clientX, e.clientY);
  else hideTip();
});
svg.addEventListener("mouseleave", hideTip);

/* ---------- events ---------- */
svg.addEventListener("click", (e) => {
  const pin = e.target.closest(".pin");
  if (pin) { const t = document.getElementById(pin.dataset.target); if (t) { if (t.tagName === "DETAILS") t.open = true; t.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" }); t.classList.add("flash"); setTimeout(() => t.classList.remove("flash"), 1600); } return; }
  const p = e.target.closest("path[data-state]"); if (p) showState(p.dataset.state);
});
// roving tabindex over the states (arrows move alphabetically, Enter/Space opens)
gStates.setAttribute("role", "group"); gStates.setAttribute("aria-label", "States (use arrow keys, then Enter)");
CODES.forEach((code, i) => { const p = paths[code]; p.setAttribute("role", "button"); p.setAttribute("tabindex", i === 0 ? "0" : "-1"); });
gStates.addEventListener("keydown", (e) => {
  const p = e.target.closest("path[data-state]"); if (!p) return;
  const i = CODES.indexOf(p.dataset.state); let j = null;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % CODES.length; else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + CODES.length) % CODES.length; else if (e.key === "Home") j = 0; else if (e.key === "End") j = CODES.length - 1;
  else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showState(p.dataset.state); side.querySelector("h2") && side.querySelector("h2").focus(); return; }
  if (j != null) { e.preventDefault(); p.setAttribute("tabindex", "-1"); const q = paths[CODES[j]]; q.setAttribute("tabindex", "0"); q.focus(); const c = counts(CODES[j]); const r = q.getBoundingClientRect(); showTip(`<b>${esc(stateName(CODES[j]))}</b><br>${esc(summaryLine(c))}`, r.left + r.width / 2, r.top + r.height / 2); }
});
gStates.addEventListener("focusout", hideTip);
back.addEventListener("click", () => showUS());
sel.addEventListener("change", () => sel.value ? showState(sel.value) : showUS());
form.addEventListener("submit", (e) => { e.preventDefault(); showZip(zipIn.value, radiusSel.value); });
$$("[data-layer]").forEach(b => b.addEventListener("click", () => { layer = b.dataset.layer; paint(); }));
document.addEventListener("click", (e) => {
  const s = e.target.closest("[data-state]:not(path)"); if (s) { showState(s.dataset.state); if (!s.closest(".small-states")) side.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); return; }
  const u = e.target.closest("[data-usestate]"); if (u) { AA.setState && AA.setState(u.dataset.usestate); toast(`${stateName(u.dataset.usestate)} will show first on Grants, Services and Trials.`); renderState(u.dataset.usestate); return; }
  const r = e.target.closest("[data-radius]"); if (r && mode.kind === "zip") { showZip(mode.zip, r.dataset.radius); return; }
  const a = e.target.closest("a[data-setstate]"); if (a && AA.setState) AA.setState(a.dataset.setstate);
});

let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (mode.kind === "state") drawPins(DATA.clinics.filter(x => x.state === mode.state), DATA.sites.filter(x => x.state === mode.state)); else if (mode.kind === "zip") showZip(mode.zip, mode.radius, false); }, 200); });

/* ---------- boot ---------- */
sel.innerHTML = `<option value="">All states</option>` + CODES.map(c => `<option value="${c}">${esc(stateName(c))}</option>`).join("");
smallBox.innerHTML = SMALL.map(c => `<button type="button" class="chip chip-sm" data-state="${c}" aria-label="${esc(stateName(c))}">${c}</button>`).join("");
fetch("/data/map.json", { cache: "no-cache" }).then(r => r.json()).then(d => {
  DATA = d;
  const q = new URLSearchParams(location.search);
  const st = (q.get("state") || "").toUpperCase(), zip = q.get("zip");
  if (zip) { paint(); showZip(zip, q.get("mi") || 100, false); }
  else if (st && paths[st]) showState(st, false);
  else { const mine = AA.getState ? AA.getState() : ""; if (mine && paths[mine]) showState(mine, false); else showUS(false); }
  const note = $("#mapNote"); if (note && d.updated) note.textContent += ` Clinic lists compiled ${new Date(d.updated + "T12:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.`;
}).catch(() => { side.innerHTML = `<div class="side-head"><h2>The map data didn't load</h2><p>Please refresh the page. The full clinic directory is still listed below.</p></div>`; });
})();
