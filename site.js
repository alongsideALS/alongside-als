/* Alongside ALS — shared behaviour: header/footer, saved plan, grants/services/trials explorers, checklists. */
(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl = (u) => /^https?:\/\//i.test(String(u||"")) ? String(u) : "#";
const ls = { get(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const PAGE = document.body.dataset.page || "";
const STATE_NAMES = {AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DC:"Washington, D.C.",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"};
const STATES = Object.keys(STATE_NAMES);
const stateName = (s) => STATE_NAMES[s] || s;

/* ---------- Site-wide "your state" (one setting shared by every page) ---------- */
const getState = () => { const s = ls.get("aa.state", ""); return STATES.includes(s) ? s : ""; };
const setState = (s) => { ls.set("aa.state", STATES.includes(s) ? s : ""); document.dispatchEvent(new CustomEvent("aa:state", { detail: getState() })); };
const stateOpts = (sel, firstLabel = "All states") => `<option value="">${firstLabel}</option>` + STATES.map(s => `<option value="${s}" ${s===sel?"selected":""}>${esc(stateName(s))}</option>`).join("");

/* ---------- Header / footer ---------- */
const RIBBON = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#f8faff"/><path d="M12 30 25 12C30 2 10 2 15 12L28 30" stroke="#193252" stroke-width="6" fill="none"/><path d="M12 30 25 12C30 2 10 2 15 12L28 30" stroke="#7399c6" stroke-width="1.3" fill="none"/><circle cx="33" cy="34" r="3" fill="#c33245"/></svg>';
const NAV = [["understanding-als","Understanding ALS","understand","What a diagnosis means, treatments and your care team"],["road-ahead","Road ahead","road","A stage-by-stage checklist"],["grants","Grants","grants","Money for equipment, travel, respite and more"],["services","Services","services","Benefits, loans and free help"],["trials","Trials","trials","Clinical studies looking for participants"],["get-ready","Get ready","ready","Documents and application trackers"],["resources","Resources","resources","Trusted links by topic"],["my-plan","My plan","plan","Everything you've saved"]];
if (!$("header.banner")) {
  // Fallback for pages built before the header was made part of the HTML.
  document.body.insertAdjacentHTML("afterbegin", `<a class="skip" href="#main">Skip to content</a>
<header class="banner"><div class="wrap banner-in">
  <a class="brand" href="/" aria-label="Alongside ALS home">${RIBBON}<span><span class="brand-name">Alongside ALS</span><span class="brand-sub">Resources &amp; support for people living with ALS</span></span></a>
  <div class="hdr-tools"><a class="plan-link" href="/my-plan">My plan <span class="count" data-saved-count>0</span></a><button class="textsize" id="textSize" type="button" aria-pressed="false" aria-label="Larger text" title="Larger text">A<span>A</span></button><button class="menu-btn" id="menuBtn" type="button" aria-expanded="false" aria-controls="siteNav"><span class="menu-ico" aria-hidden="true"></span>Menu</button></div>
  <nav class="nav" id="siteNav" aria-label="Main">${NAV.map(n => `<a href="/${n[0]}" ${PAGE===n[2]?'aria-current="page"':""}><b>${n[1]}${n[2]==="plan"?' <span class="count" id="savedCount">0</span>':""}</b><small>${n[3]}</small></a>`).join("")}</nav>
</div></header>`);
}
if (!$("footer")) {
  document.body.insertAdjacentHTML("beforeend", `<footer><div class="wrap"><nav aria-label="Footer"><a href="/about">About &amp; contact</a><a href="/about#privacy">Privacy</a><a href="/about#disclaimer">Disclaimer</a><a href="/about#updates">What changed</a><a href="/about#corrections">Report outdated information</a></nav>
  <p><b>Alongside ALS</b> is an independent guide. It does not give medical, legal or financial advice, award grants or decide eligibility.</p><p id="freshness" class="mono small"></p></div></footer><div class="toast" id="toast" role="status" aria-live="polite"></div>`);
}
// Text size
const big = ls.get("aa.big", false);
const tsBtn = $("#textSize");
const setBig = (b) => { document.documentElement.classList.toggle("big", b); if (tsBtn) tsBtn.setAttribute("aria-pressed", String(b)); };
setBig(big);
if (tsBtn) tsBtn.addEventListener("click", () => { const b = !document.documentElement.classList.contains("big"); setBig(b); ls.set("aa.big", b); toast(b ? "Larger text on" : "Larger text off"); });
// Mobile menu
const menuBtn = $("#menuBtn"), siteNav = $("#siteNav");
if (menuBtn && siteNav) {
  const setOpen = (o) => { siteNav.classList.toggle("open", o); menuBtn.setAttribute("aria-expanded", String(o)); menuBtn.lastChild.textContent = o ? "Close" : "Menu"; };
  menuBtn.addEventListener("click", () => setOpen(!siteNav.classList.contains("open")));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && siteNav.classList.contains("open")) { setOpen(false); menuBtn.focus(); } });
}
let tt; function toast(msg){ const t = $("#toast"); if (!t) return; t.textContent = msg; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2400); }

const ICON = {
  heart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 3.8 4 7 4c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.2 0 5.4 3.2 4.2 6.6C19.5 15.4 12 20 12 20z"/></svg>',
  ext: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg><span class="sr"> (opens in a new tab)</span>',
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  x: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
};

/* ---------- Dates & statuses ---------- */
const TODAY = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const parseD = (s) => { if (!s) return null; const [y,m,d] = String(s).split("-").map(Number); if (!y) return null; return new Date(y, (m||1)-1, d||1); };
const daysTo = (s) => { const d = parseD(s); return d ? Math.round((d - TODAY()) / 864e5) : null; };
const fmtD = (s, o = { month: "short", day: "numeric", year: "numeric" }) => { const d = parseD(s); return d ? d.toLocaleDateString(undefined, o) : ""; };
function grantStatus(g){
  const dd = daysTo(g.deadline);
  if (g.deadline && dd != null){
    if (dd < 0) return { key: "closed", label: "Round closed · watch for the next", cls: "s-bad" };
    if (dd <= 30) return { key: "open", label: `Closing soon · ${dd} day${dd===1?"":"s"} left`, cls: "s-warn" };
    return { key: "open", label: `Open · due ${fmtD(g.deadline, {month:"short",day:"numeric"})}`, cls: "s-good" };
  }
  if (g.kind === "service" && (g.status === "open" || g.status === "rolling")) return { key: "open", label: "Available now", cls: "s-good" };
  if (g.status === "open") return { key: "open", label: "Open now", cls: "s-good" };
  if (g.status === "rolling") return { key: "open", label: "Rolling · apply anytime", cls: "s-good" };
  if (g.status === "window") return { key: "check", label: "Opens in cycles", cls: "s-info" };
  if (g.status === "closed") return { key: "closed", label: "Closed for now", cls: "s-bad" };
  return { key: "check", label: "Confirm with the organization", cls: "s-info" };
}

/* ---------- Saved plan (this browser) ---------- */
const plan = Object.assign({ saved: {}, checks: {}, docs: {} }, ls.get("aa.plan", {}));
const keyOf = (kind, id) => kind + ":" + id;
const isSaved = (kind, id) => !!plan.saved[keyOf(kind, id)];
function persist(){ ls.set("aa.plan", plan); updateCount(); }
function updateCount(){ const n = Object.keys(plan.saved).length; $$("#savedCount, [data-saved-count]").forEach(c => { c.textContent = n; c.classList.toggle("zero", n === 0); }); }
updateCount();
function toggleSave(kind, id, name){
  const k = keyOf(kind, id);
  if (plan.saved[k]) { delete plan.saved[k]; toast("Removed from My plan"); }
  else { plan.saved[k] = { kind, id, status: "interested", note: "", added: new Date().toISOString().slice(0,10) }; toast("Saved to My plan"); }
  persist();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-save]");
  if (!b) return;
  toggleSave(b.dataset.save, b.dataset.id, b.dataset.name);
  const on = isSaved(b.dataset.save, b.dataset.id);
  b.setAttribute("aria-pressed", String(on)); b.querySelector("span").textContent = on ? "Saved" : "Save"; b.setAttribute("aria-label", `${on ? "Saved" : "Save"}: ${b.dataset.name || b.dataset.id}`);
});
const saveBtn = (kind, id, name) => { const s = isSaved(kind, id); return `<button class="save" type="button" data-save="${kind}" data-id="${esc(id)}" data-name="${esc(name||"")}" aria-pressed="${s}" aria-label="${s ? "Saved" : "Save"}: ${esc(name||id)}">${ICON.heart}<span>${s?"Saved":"Save"}</span></button>`; };

/* ---------- Data ---------- */
const DATA = { grants: null, services: null, trials: null, summary: null, meta: {} };
async function load(which){
  if (DATA[which]) return DATA[which];
  try {
    const r = await fetch("/data/" + which + ".json", { cache: "no-cache" });
    const d = await r.json();
    if (which === "summary") { DATA.summary = d; return d; }
    DATA[which] = d.items || []; DATA.meta[which] = d;
  } catch { DATA[which] = which === "summary" ? null : []; }
  return DATA[which];
}
function freshness(){
  const f = $("#freshness"); if (!f) return;
  const s = DATA.summary, parts = [];
  const gU = (DATA.meta.grants && DATA.meta.grants.updated) || (s && s.grants.updated);
  const tU = (DATA.meta.trials && (DATA.meta.trials.registrySnapshot || DATA.meta.trials.updated)) || (s && s.trials.registrySnapshot);
  if (gU) parts.push("Grants & services checked " + fmtD(gU));
  if (tU) parts.push("Trial registry snapshot " + fmtD(tU));
  f.textContent = parts.join(" · ");
}
const latestVerified = (items) => items.reduce((m, t) => (t.verified && t.verified.lastVerified > m) ? t.verified.lastVerified : m, "");

/* ---------- Printing: open every details panel so printed cards are complete ---------- */
let printOpened = [];
addEventListener("beforeprint", () => { printOpened = $$("details:not([open])"); printOpened.forEach(d => d.open = true); });
addEventListener("afterprint", () => { printOpened.forEach(d => d.open = false); printOpened = []; });
document.addEventListener("click", (e) => { if (e.target.closest("[data-print]")) window.print(); });

/* ---------- Applied-filter chips (shared by both explorers) ---------- */
function appliedRow(active, onClear, onReset){
  // active: [{label, key}] — chips the visitor can remove one at a time.
  if (!active.length) return "";
  return `<div class="applied" role="group" aria-label="Filters in use"><span class="applied-lab">Showing:</span>${active.map(a => `<button type="button" class="achip" data-unfilter="${esc(a.key)}" aria-label="Remove filter: ${esc(a.label)}">${esc(a.label)} ${ICON.x}</button>`).join("")}<button type="button" class="achip clear" data-unfilter="*">Clear all</button></div>`;
}

/* ---------- Grants & services explorer ---------- */
const CATS = {
  grants: ["All","Medical costs","Prescriptions","Equipment & technology","Home modification","Respite & caregiving","Travel","Family & children","Education & scholarships","Quality of life"],
  services: ["All","Government benefits","Insurance help","Equipment & loans","Home access","Communication","Prescriptions help","Caregiving & education","Family & kids"]
};
function catalog(which){
  const key = which === "grants" ? "aa.gf" : "aa.sf";
  const DEF = { q: "", cat: "All", status: "all", sort: "default" };
  const f = Object.assign({}, DEF, ls.get(key, {}));
  f.state = getState(); if (f.state && f.sort === "default") f.sort = "local";
  const root = $("#explorer");
  const filtered = () => {
    const q = f.q.trim().toLowerCase();
    return DATA[which].filter(g => {
      if (f.cat !== "All" && !(g.categories||[]).includes(f.cat)) return false;
      if (f.state && g.scope === "Regional" && !(g.regions||[]).includes(f.state)) return false;
      const st = grantStatus(g).key;
      if (f.status === "open" && st !== "open") return false;
      if (f.status === "deadline" && !(g.deadline && daysTo(g.deadline) >= 0)) return false;
      if (q && !JSON.stringify([g.name,g.org,g.forWhat,g.categories,g.eligibility,g.regions]).toLowerCase().includes(q)) return false;
      return true;
    }).sort((a,b) => {
      if (f.sort === "name") return a.name.localeCompare(b.name);
      if (f.sort === "org") return a.org.localeCompare(b.org) || a.name.localeCompare(b.name);
      if (f.sort === "local"){ const la = a.scope === "Regional" ? 0 : 1, lb = b.scope === "Regional" ? 0 : 1; if (la !== lb) return la - lb; }
      const da = daysTo(a.deadline), dbb = daysTo(b.deadline);
      const ra = da != null && da >= 0 ? da : 1e5, rb = dbb != null && dbb >= 0 ? dbb : 1e5;
      if (ra !== rb) return ra - rb;
      const order = { open: 0, check: 1, closed: 2 };
      const oa = order[grantStatus(a).key], ob = order[grantStatus(b).key];
      if (oa !== ob) return oa - ob;
      if (f.state){ const la = a.scope === "Regional" ? 0 : 1, lb = b.scope === "Regional" ? 0 : 1; if (la !== lb) return la - lb; }
      return a.org.localeCompare(b.org);
    });
  };
  const card = (g, i) => {
    const kind = g.kind === "service" ? "service" : "grant", st = grantStatus(g);
    return `<article class="card" style="--i:${Math.min(i,12)}">
      <div><div class="org">${esc(g.org)}</div><h2>${esc(g.name)}</h2></div>
      <div class="pills"><span class="pill ${st.cls}">${esc(st.label)}</span><span class="pill">${g.scope === "Regional" ? esc((g.regions||[]).join(", ")) : "Nationwide"}</span>${(g.categories||[]).slice(0,2).map(c=>`<span class="pill">${esc(c)}</span>`).join("")}</div>
      ${g.amount ? `<div class="amount">${esc(g.amount)}</div>` : ""}
      <p>${esc(g.forWhat)}</p>
      <dl class="kv"><dt>When</dt><dd>${esc(g.window)}</dd></dl>
      <details><summary>${kind==="service" ? "Who it's for & how to start" : "Who qualifies & what to have ready"}</summary>
        <div class="sub">Who qualifies</div><ul class="need">${(g.eligibility||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
        <div class="sub">Have these ready</div><ul class="need">${(g.youllNeed||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
        <div class="sub">${kind==="service" ? "How to start" : "How to apply"}</div><p style="margin-top:6px">${esc(g.howToApply)}</p>
        ${g.contact ? `<p style="margin-top:6px" class="mono small">${esc(g.contact)}</p>` : ""}
      </details>
      <div class="card-foot" data-url="${esc(safeUrl(g.url))}"><a class="btn btn-primary btn-sm" href="${safeUrl(g.url)}" target="_blank" rel="noopener">${kind==="service" ? "Go to service" : "Go to program"} ${ICON.ext}</a>${saveBtn(kind, g.id, g.name)}${g.lastVerified ? `<span class="checked">Checked ${esc(fmtD(g.lastVerified, {month:"short", day:"numeric"}))}</span>` : ""}</div>
    </article>`;
  };
  const activeFilters = () => {
    const a = [];
    if (f.state) a.push({ key: "state", label: `${stateName(f.state)} + nationwide` });
    if (f.cat !== "All") a.push({ key: "cat", label: f.cat });
    if (f.status === "open") a.push({ key: "status", label: "Open or rolling now" });
    if (f.status === "deadline") a.push({ key: "status", label: "Has an upcoming deadline" });
    if (f.q.trim()) a.push({ key: "q", label: `Search: “${f.q.trim()}”` });
    return a;
  };
  const list = () => {
    const l = filtered(), all = DATA[which];
    $("#applied").innerHTML = appliedRow(activeFilters());
    $("#count").textContent = `${l.length} of ${all.length} ${which === "grants" ? "grants and scholarships" : "services and benefits"}${f.state ? ` for ${stateName(f.state)} (nationwide + local)` : ""}`;
    $("#list").innerHTML = l.length ? `<div class="grid stagger">${l.map(card).join("")}</div>` : `<div class="empty"><h2>Nothing matches those filters</h2><p>${f.state ? `No ${which === "grants" ? "grants" : "services"} are listed just for ${stateName(f.state)} in this category, and nothing nationwide matched either.` : "Try a different category or clear the search."}</p><button class="btn btn-line btn-sm" type="button" data-unfilter="*">Clear filters</button></div>`;
  };
  const render = () => {
    root.innerHTML = `<div class="filters" role="search" aria-label="Filter ${which}">
      <div class="frow">
        <label class="search">${ICON.search}<span class="sr">Search</span><input id="q" type="search" placeholder="${which === "grants" ? "Search: wheelchair, respite, scholarship…" : "Search: Medicare, ramp, voice…"}" value="${esc(f.q)}" autocomplete="off"></label>
        <label class="sel"><span>Your state</span><select id="state">${stateOpts(f.state)}</select></label>
        <label class="sel"><span>Sort</span><select id="sort">
          <option value="default" ${f.sort==="default"?"selected":""}>Deadlines first</option>
          <option value="local" ${f.sort==="local"?"selected":""}>My state first</option>
          <option value="name" ${f.sort==="name"?"selected":""}>A to Z</option>
          <option value="org" ${f.sort==="org"?"selected":""}>By organization</option></select></label>
        ${which === "grants" ? `<label class="sel"><span>Status</span><select id="status">
          <option value="all" ${f.status==="all"?"selected":""}>Any status</option>
          <option value="open" ${f.status==="open"?"selected":""}>Open or rolling now</option>
          <option value="deadline" ${f.status==="deadline"?"selected":""}>Has an upcoming deadline</option></select></label>` : ""}
      </div>
      <div class="chips-wrap"><div class="chips" role="group" aria-label="Category">${CATS[which].map(c=>`<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${f.cat===c}">${esc(c)}</button>`).join("")}</div></div>
    </div><div id="applied"></div><div class="count-row"><p class="count" id="count" aria-live="polite"></p><button class="btn btn-line btn-sm print-btn" type="button" data-print>Print this list</button></div><div id="list"></div>`;
    const upd = () => { ls.set(key, { q: f.q, cat: f.cat, status: f.status, sort: f.sort }); list(); };
    let qt; $("#q").addEventListener("input", e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; upd(); }, 180); });
    $("#state").addEventListener("change", e => { f.state = e.target.value; setState(f.state); if (f.state && f.sort === "default") { f.sort = "local"; $("#sort").value = "local"; } if (!f.state && f.sort === "local") { f.sort = "default"; $("#sort").value = "default"; } upd(); });
    $("#sort").addEventListener("change", e => { f.sort = e.target.value; upd(); });
    const st = $("#status"); if (st) st.addEventListener("change", e => { f.status = e.target.value; upd(); });
    $$("[data-cat]").forEach(b => b.addEventListener("click", () => { f.cat = b.dataset.cat; $$("[data-cat]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); upd(); }));
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-unfilter]"); if (!b) return;
      const k = b.dataset.unfilter;
      if (k === "*") { Object.assign(f, DEF); f.state = ""; setState(""); }
      else if (k === "state") { f.state = ""; setState(""); if (f.sort === "local") f.sort = "default"; }
      else if (k === "cat") f.cat = "All"; else if (k === "status") f.status = "all"; else if (k === "q") f.q = "";
      ls.set(key, { q: f.q, cat: f.cat, status: f.status, sort: f.sort }); render(); $("#count").focus?.();
    });
    list();
  };
  if (!root.querySelector('.static-list')) root.innerHTML = `<div class="grid">${'<div class="skel"></div>'.repeat(6)}</div>`;
  load(which).then(() => { render(); freshness();
    if (which === "grants"){ const soon = DATA.grants.filter(x => { const d = daysTo(x.deadline); return d != null && d >= 0; }).sort((a,b) => daysTo(a.deadline) - daysTo(b.deadline));
      const dl = $("#deadlines"); if (dl) dl.innerHTML = soon.length ? soon.map((x,i) => deadlineRow(x,i)).join("") : `<p class="muted">No dated deadlines right now. Most programs accept applications year-round.</p>`; }
  });
}
const deadlineRow = (x, i) => { const d = parseD(x.deadline); const where = x.scope === "Regional" && x.regions && x.regions.length ? ` · ${x.regions.map(stateName).join(", ")}` : ""; return `<a class="dl" href="/grants" style="--i:${i}"><div class="date"><small>${d.toLocaleDateString(undefined,{month:"short"})}</small><b>${d.getDate()}</b></div><div><b>${esc(x.name)}</b><div class="org">${esc(x.org)}${esc(where)}</div></div><span class="pill ${grantStatus(x).cls}">${daysTo(x.deadline)} days</span></a>`; };

/* ---------- Trials explorer ---------- */
function trials(){
  const key = "aa.tf";
  const DEF = { q: "", type: "All", status: "open", phase: "Any phase", gene: "Any gene", sort: "status", us: true, remote: false, noPlacebo: false, verified: false };
  const f = Object.assign({}, DEF, ls.get(key, {}));
  f.state = getState(); if (f.state && f.sort === "status") f.sort = "nearby";
  const root = $("#explorer");
  const TYPES = ["All","Interventional","Expanded access","Device","Observational","Care & lifestyle"];
  const TYPE_LABEL = { "All": "All studies", "Interventional": "Treatment trials", "Expanded access": "Expanded access", "Device": "Devices & BCI", "Observational": "Observational (no treatment)", "Care & lifestyle": "Care & lifestyle" };
  const PHASES = ["Any phase","Phase 1","Phase 1/2","Phase 2","Phase 2/3","Phase 3"];
  const GENES = ["Any gene","SOD1","C9orf72","FUS","At-risk family members"];
  const enroll = (t) => ({ yes: { label: "Recruiting", cls: "s-good", r: 0 }, soon: { label: "Not yet recruiting", cls: "s-info", r: 1 }, invite: { label: "By invitation", cls: "s-warn", r: 2 }, no: { label: "Active, not recruiting", cls: "s-bad", r: 3 } })[t.enrolling] || { label: t.enrolling, cls: "", r: 4 };
  const phaseRank = { "Phase 3": 0, "Phase 2/3": 1, "Phase 2": 2, "Phase 1/2": 3, "Phase 1": 4, "Early Phase 1": 5 };
  const geneOf = (t) => (t.genetic || (t.verified && t.verified.genetic) || "Any");
  const filtered = () => {
    const q = f.q.trim().toLowerCase();
    return DATA.trials.filter(t => {
      if (f.us && !t.us) return false;
      if (f.type !== "All" && t.type !== f.type) return false;
      if (f.status === "open" && !(t.enrolling === "yes" || t.enrolling === "soon")) return false;
      if (f.status === "yes" && t.enrolling !== "yes") return false;
      if (f.phase !== "Any phase" && !String(t.phase||"").startsWith(f.phase)) return false;
      if (f.gene !== "Any gene" && !geneOf(t).toLowerCase().includes(f.gene.toLowerCase().split(" ")[0])) return false;
      if (f.remote && !t.remote) return false;
      if (f.noPlacebo && t.placebo) return false;
      if (f.verified && !t.verified) return false;
      if (f.state && !(t.states||[]).includes(f.state)) return false;
      if (q && !JSON.stringify([t.name,t.title,t.sponsor,t.interventions,t.id,t.conditions,t.states,t.verified && t.verified.summary,t.plain && t.plain.purpose,t.locations && t.locations.map(l=>l.c+" "+l.f)]).toLowerCase().includes(q)) return false;
      return true;
    }).sort((a,b) => {
      if (f.sort === "name") return (a.name||a.title).localeCompare(b.name||b.title);
      if (f.sort === "newest") return String(b.updated||"").localeCompare(String(a.updated||""));
      if (f.sort === "nearby" && f.state){ const la = (a.states||[]).includes(f.state) ? 0 : 1, lb = (b.states||[]).includes(f.state) ? 0 : 1; if (la !== lb) return la - lb; }
      const ea = enroll(a).r, eb = enroll(b).r; if (ea !== eb) return ea - eb;
      const va = a.verified ? 0 : 1, vb = b.verified ? 0 : 1; if (va !== vb) return va - vb;
      const ta = TYPES.indexOf(a.type), tb = TYPES.indexOf(b.type); if (ta !== tb) return ta - tb;
      const pa = phaseRank[a.phase] ?? 9, pb = phaseRank[b.phase] ?? 9; if (pa !== pb) return pa - pb;
      return (a.name||a.title).localeCompare(b.name||b.title);
    });
  };
  const timeline = (t) => {
    const s = parseD(t.start), e = parseD(t.end || t.primary); if (!s || !e || e <= s) return "";
    const p = Math.max(0, Math.min(100, Math.round((TODAY() - s) / (e - s) * 100)));
    return `<div class="tl" aria-hidden="true"><i style="width:${p}%"></i></div><div class="tl-lab"><span>Started ${fmtD(t.start,{month:"short",year:"numeric"})}</span><span>Est. end ${fmtD(t.end||t.primary,{month:"short",year:"numeric"})}</span></div>`;
  };
  const card = (t, i) => {
    const en = enroll(t), v = t.verified, gene = geneOf(t);
    const title = t.name && t.name !== t.title ? t.name : (t.title.length > 90 ? t.title.slice(0, 88) + "…" : t.title);
    const summary = v ? v.summary : (t.plain && t.plain.purpose) || t.title;
    const what = v ? v.intervention : (t.interventions||[]).slice(0,3).join(", ");
    const usLocs = (t.locations||[]).filter(l => l.k === "United States");
    const locLine = t.us ? `${usLocs.length || t.sites || "?"} U.S. site${usLocs.length===1?"":"s"}${t.countries && t.countries.length > 1 ? ` · ${t.countries.length} countries` : ""}` : `${(t.countries||[]).join(", ")}`;
    const kindPill = t.type === "Device" ? '<span class="pill">Device / BCI</span>' : t.type === "Observational" ? '<span class="pill">No drug · research only</span>' : t.type === "Care & lifestyle" ? '<span class="pill">Non-drug</span>' : t.type === "Expanded access" ? '<span class="pill">Drug outside a trial</span>' : "";
    return `<article class="card" style="--i:${Math.min(i,12)}">
      <div><div class="nct">${esc(t.id)} · ${esc(t.sponsor)}</div><h2>${esc(title)}</h2>${t.name && t.name !== t.title && title !== t.title ? `<p class="small muted">${esc(t.title)}</p>` : ""}</div>
      <div class="pills"><span class="pill ${en.cls}">${esc(en.label)}</span><span class="pill">${esc(t.phase)}</span>${kindPill}${t.placebo === false ? '<span class="pill">No placebo</span>' : t.placebo ? '<span class="pill">Placebo-controlled</span>' : ""}${t.remote ? '<span class="pill s-good">From home</span>' : ""}${gene && gene !== "Any" ? `<span class="pill">${esc(gene)}</span>` : ""}${v ? '<span class="pill s-info">Hand-checked</span>' : ""}</div>
      ${what ? `<p><b>${esc(what)}</b></p>` : ""}
      <p class="muted">${esc(summary)}</p>
      ${v && v.statusNote ? `<p class="small muted"><b>Status note:</b> ${esc(v.statusNote)}</p>` : ""}
      ${timeline(t)}
      <div class="states" aria-label="States with sites">${(t.states||[]).map(s => `<span class="st ${f.state===s?"hit":""}" title="${esc(stateName(s))}">${esc(s)}</span>`).join("")}${!t.us && t.countries ? t.countries.slice(0,4).map(c=>`<span class="st">${esc(c)}</span>`).join("") : ""}</div>
      <details><summary>Who it's for, what's involved, where</summary>
        ${t.plain ? `<div class="sub">Who it's for</div><p class="small">${esc(t.plain.audience)}</p><div class="sub">What taking part involves</div><p class="small">${esc(t.plain.participation)}</p>` : ""}
        ${v && v.eligibility && v.eligibility.length ? `<div class="sub">Eligibility notes</div><ul class="need">${v.eligibility.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${usLocs.length ? `<div class="sub">U.S. sites (${usLocs.length})</div><ul class="loc-list">${usLocs.slice(0,40).map(l => `<li>${esc(l.f)}${l.c ? ", " + esc(l.c) : ""}${l.s ? ", " + esc(l.s) : ""}</li>`).join("")}${usLocs.length > 40 ? `<li class="muted">…and ${usLocs.length - 40} more</li>` : ""}</ul>` : `<p class="loc">${esc(locLine)}</p>`}
        ${(t.contacts||[]).length ? `<div class="sub">Study contact</div>${t.contacts.slice(0,2).map(c => `<p class="contact">${esc(c.name||"")}${c.phone ? ` · <a class="mono" href="tel:${esc(String(c.phone).replace(/[^+\d]/g,""))}">${esc(c.phone)}</a>` : ""}${c.email ? ` · <a class="mono" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ""}</p>`).join("")}` : ""}
        <p class="cite" style="margin-top:8px">Registry record updated ${esc(fmtD(t.updated))}${v && v.lastVerified ? ` · hand-checked ${esc(fmtD(v.lastVerified))}` : ""}. Full criteria are on ClinicalTrials.gov; the study team decides eligibility.</p>
      </details>
      <div class="card-foot" data-url="https://clinicaltrials.gov/study/${encodeURIComponent(t.id)}"><a class="btn btn-primary btn-sm" href="https://clinicaltrials.gov/study/${encodeURIComponent(t.id)}" target="_blank" rel="noopener">Official record ${ICON.ext}</a>${saveBtn("trial", t.id, t.name || t.title)}</div>
    </article>`;
  };
  const activeFilters = () => {
    const a = [];
    if (f.state) a.push({ key: "state", label: `Sites in ${stateName(f.state)}` });
    if (f.status === "open") a.push({ key: "status", label: "Recruiting or opening soon" });
    if (f.status === "yes") a.push({ key: "status", label: "Recruiting now" });
    if (f.type !== "All") a.push({ key: "type", label: TYPE_LABEL[f.type] || f.type });
    if (f.phase !== "Any phase") a.push({ key: "phase", label: f.phase });
    if (f.gene !== "Any gene") a.push({ key: "gene", label: f.gene });
    if (f.us) a.push({ key: "us", label: "U.S. sites only" });
    if (f.remote) a.push({ key: "remote", label: "From home" });
    if (f.noPlacebo) a.push({ key: "noPlacebo", label: "No placebo" });
    if (f.verified) a.push({ key: "verified", label: "Hand-checked only" });
    if (f.q.trim()) a.push({ key: "q", label: `Search: “${f.q.trim()}”` });
    return a;
  };
  const save = () => { const o = Object.assign({}, f); delete o.state; ls.set(key, o); };
  const list = () => {
    const l = filtered(), all = DATA.trials;
    const rec = all.filter(t => t.enrolling === "yes" && t.us).length, soon = all.filter(t => t.enrolling === "soon" && t.us).length;
    $("#applied").innerHTML = appliedRow(activeFilters());
    $("#count").textContent = `${l.length} of ${all.length} studies${f.us ? ` with U.S. sites` : ""} · ${rec} recruiting in the U.S. · ${soon} opening soon`;
    $("#list").innerHTML = l.length ? `<div class="grid stagger">${l.map(card).join("")}</div>` : `<div class="empty"><h2>No studies match those filters</h2><p>${f.state ? `No active study lists a site in ${stateName(f.state)} with these filters. Try widening to nearby states, or look at studies that run from home.` : "Try removing a filter, or use the registry tools below."}</p><button class="btn btn-line btn-sm" type="button" data-unfilter="*">Clear filters</button></div>`;
  };
  const render = () => {
    root.innerHTML = `<div class="filters" role="search" aria-label="Filter studies">
      <div class="frow">
        <label class="search">${ICON.search}<span class="sr">Search studies</span><input id="q" type="search" placeholder="Drug, gene (SOD1, C9orf72), sponsor, city or NCT number" value="${esc(f.q)}" autocomplete="off"></label>
        <label class="sel"><span>Your state</span><select id="state">${stateOpts(f.state)}</select></label>
        <label class="sel"><span>Recruitment</span><select id="status">
          <option value="open" ${f.status==="open"?"selected":""}>Recruiting or opening soon</option>
          <option value="yes" ${f.status==="yes"?"selected":""}>Recruiting now only</option>
          <option value="all" ${f.status==="all"?"selected":""}>All active studies</option></select></label>
      </div>
      <div class="chips-wrap"><div class="chips" role="group" aria-label="Study type">${TYPES.map(c=>`<button type="button" class="chip" data-type="${esc(c)}" aria-pressed="${f.type===c}">${esc(TYPE_LABEL[c])}</button>`).join("")}</div></div>
      <details class="more"><summary>More filters: phase, gene, placebo, sorting</summary>
        <div class="frow" style="margin-top:10px">
          <label class="sel"><span>Phase</span><select id="phase">${PHASES.map(p=>`<option ${f.phase===p?"selected":""}>${p}</option>`).join("")}</select></label>
          <label class="sel"><span>Gene</span><select id="gene">${GENES.map(p=>`<option ${f.gene===p?"selected":""}>${p}</option>`).join("")}</select></label>
          <label class="sel"><span>Sort</span><select id="sort">
            <option value="status" ${f.sort==="status"?"selected":""}>Recruiting first</option>
            <option value="nearby" ${f.sort==="nearby"?"selected":""}>Closest to my state</option>
            <option value="name" ${f.sort==="name"?"selected":""}>A to Z</option>
            <option value="newest" ${f.sort==="newest"?"selected":""}>Recently updated</option></select></label>
          <label class="toggle"><input type="checkbox" id="us" ${f.us?"checked":""}> U.S. sites only</label>
          <label class="toggle"><input type="checkbox" id="remote" ${f.remote?"checked":""}> From home</label>
          <label class="toggle"><input type="checkbox" id="np" ${f.noPlacebo?"checked":""}> No placebo</label>
          <label class="toggle"><input type="checkbox" id="ver" ${f.verified?"checked":""}> Hand-checked only</label>
        </div></details>
    </div><div id="applied"></div><div class="count-row"><p class="count" id="count" aria-live="polite"></p><button class="btn btn-line btn-sm print-btn" type="button" data-print>Print this list</button></div><div id="list"></div>`;
    const upd = () => { save(); list(); };
    let qt; $("#q").addEventListener("input", e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; upd(); }, 180); });
    $("#state").addEventListener("change", e => { f.state = e.target.value; setState(f.state); if (f.state && f.sort === "status") { f.sort = "nearby"; $("#sort").value = "nearby"; } if (!f.state && f.sort === "nearby") { f.sort = "status"; $("#sort").value = "status"; } upd(); });
    ["status","phase","gene","sort"].forEach(id => $("#" + id).addEventListener("change", e => { f[id] = e.target.value; upd(); }));
    [["us","us"],["remote","remote"],["np","noPlacebo"],["ver","verified"]].forEach(([id,k]) => $("#" + id).addEventListener("change", e => { f[k] = e.target.checked; upd(); }));
    $$("[data-type]").forEach(b => b.addEventListener("click", () => { f.type = b.dataset.type; $$("[data-type]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); upd(); }));
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-unfilter]"); if (!b) return;
      const k = b.dataset.unfilter;
      if (k === "*") { Object.assign(f, DEF); f.state = ""; setState(""); }
      else if (k === "state") { f.state = ""; setState(""); if (f.sort === "nearby") f.sort = "status"; }
      else if (k === "status") f.status = "all"; else if (k === "type") f.type = "All"; else if (k === "phase") f.phase = "Any phase"; else if (k === "gene") f.gene = "Any gene";
      else if (k === "q") f.q = ""; else if (k in f) f[k] = false;
      save(); render();
    });
    list();
  };
  if (!root.querySelector('.static-list')) root.innerHTML = `<div class="grid">${'<div class="skel"></div>'.repeat(6)}</div>`;
  load("trials").then(() => { render(); freshness();
    const m = DATA.meta.trials; const s = $("#snapshot"); if (s && m) { const lv = latestVerified(DATA.trials); s.textContent = `Registry snapshot ${fmtD(m.registrySnapshot)} · ${DATA.trials.length} active studies${lv ? ` · hand-checked notes ${fmtD(lv)}` : ""}`; } });
}

/* ---------- Checklists (Road ahead, Get ready) ---------- */
function checklist(store){
  $$("[data-check]").forEach(cb => {
    cb.checked = !!plan[store][cb.dataset.check];
    cb.addEventListener("change", () => {
      if (cb.checked) plan[store][cb.dataset.check] = true; else delete plan[store][cb.dataset.check];
      persist(); rings(store);
      const g = cb.closest("[data-group]"); if (g && $$("[data-check]", g).every(x => x.checked)) toast("Section complete");
    });
  });
  rings(store);
}
function rings(store){
  $$("[data-group]").forEach(g => {
    const all = $$("[data-check]", g), done = all.filter(x => plan[store][x.dataset.check]).length;
    const ring = $(".ring", g); if (ring){ ring.style.setProperty("--p", Math.round(done / all.length * 100)); $("i", ring).textContent = `${done}/${all.length}`; }
  });
  const tot = $("#checkTotal"); if (tot){ const all = $$("[data-check]"); tot.textContent = `${all.filter(x => plan[store][x.dataset.check]).length}/${all.length}`; }
}

/* ---------- My plan ---------- */
const PSTAT = [["interested","Interested"],["preparing","Gathering documents"],["applied","Applied / contacted"],["approved","Approved / enrolled"],["notfit","Not a fit"]];
const KLABEL = { grant: "Grant", service: "Service", trial: "Study" };
function myPlan(){
  let tab = "all";
  const src = (v) => ((v.kind === "grant" ? DATA.grants : v.kind === "service" ? DATA.services : DATA.trials) || []).find(x => x.id === v.id) || null;
  const text = () => {
    const lines = ["My ALS plan (from Alongside ALS, alongside-als.org)", ""];
    Object.values(plan.saved).forEach(v => { const s = src(v); const nm = s ? (s.name || s.title) + (v.kind !== "trial" ? " (" + s.org + ")" : " (" + s.id + ")") : v.id;
      const url = v.kind === "trial" ? "https://clinicaltrials.gov/study/" + v.id : (s && s.url) || "";
      lines.push(`[${KLABEL[v.kind]}] ${nm}`, `  Status: ${(PSTAT.find(p=>p[0]===v.status)||[0,v.status])[1]}`, url ? `  Link: ${url}` : "", v.note ? `  Notes: ${v.note}` : "", ""); });
    return lines.filter(l => l !== "").join("\n");
  };
  const list = () => {
    const items = Object.entries(plan.saved).map(([k,v]) => ({ k, v, s: src(v) })).filter(x => tab === "all" || x.v.kind === tab).sort((a,b) => PSTAT.findIndex(p=>p[0]===a.v.status) - PSTAT.findIndex(p=>p[0]===b.v.status));
    const el = $("#plist");
    if (!Object.keys(plan.saved).length) { el.innerHTML = `<div class="empty"><h2>Nothing saved yet</h2><p>Use <b>Save</b> on any grant, service or study to keep it here, track where you are, and add notes.</p><div class="cta"><a class="btn btn-primary btn-sm" href="/grants">Browse grants</a><a class="btn btn-line btn-sm" href="/trials">Browse studies</a></div></div>`; return; }
    if (!items.length) { el.innerHTML = `<div class="empty"><p>No saved ${({grant:"grants",service:"services",trial:"studies"})[tab]} yet.</p></div>`; return; }
    el.innerHTML = `<div class="plan stagger">${items.map(({k,v,s},i) => {
      const name = s ? (s.name || s.title) : v.id, sub = s ? (v.kind !== "trial" ? s.org : `${s.id} · ${s.phase}`) : "No longer listed";
      const link = v.kind === "trial" ? `https://clinicaltrials.gov/study/${encodeURIComponent(v.id)}` : safeUrl(s && s.url);
      const st = v.kind !== "trial" && s ? grantStatus(s) : null;
      const kid = k.replace(/[^a-z0-9]/gi,"-");
      return `<div class="pitem" style="--i:${Math.min(i,12)}"><div><div class="org">${KLABEL[v.kind]} · ${esc(sub)}</div><h2>${esc(name)}</h2><div class="pills" style="margin-top:8px">${st ? `<span class="pill ${st.cls}">${esc(st.label)}</span>` : ""}<span class="pill">Saved ${esc(fmtD(v.added))}</span></div></div>
        <div class="row"><label><span class="sr">Progress for ${esc(name)}</span><select id="ps-${kid}" data-pstatus="${esc(k)}">${PSTAT.map(p=>`<option value="${p[0]}" ${v.status===p[0]?"selected":""}>${p[1]}</option>`).join("")}</select></label>${link !== "#" ? `<a class="btn btn-line btn-sm" href="${link}" target="_blank" rel="noopener">Open ${ICON.ext}</a>` : ""}<button class="save" type="button" data-unsave="${esc(k)}" aria-pressed="true" aria-label="Remove ${esc(name)} from My plan">${ICON.heart}<span>Remove</span></button></div>
        <label class="sr" for="pn-${kid}">Notes for ${esc(name)}</label><textarea id="pn-${kid}" data-pnote="${esc(k)}" rows="2" placeholder="Notes: who you talked to, documents sent, next step…">${esc(v.note)}</textarea></div>`; }).join("")}</div>`;
    $$("[data-pstatus]").forEach(s => s.addEventListener("change", () => { const it = plan.saved[s.dataset.pstatus]; if (it){ it.status = s.value; persist(); toast("Progress updated"); } }));
    $$("[data-pnote]").forEach(t => { let nt; t.addEventListener("input", () => { clearTimeout(nt); nt = setTimeout(() => { const it = plan.saved[t.dataset.pnote]; if (it){ it.note = t.value.slice(0, 2000); persist(); } }, 500); }); });
    $$("[data-unsave]").forEach(b => b.addEventListener("click", () => { delete plan.saved[b.dataset.unsave]; persist(); list(); toast("Removed"); }));
  };
  // Only fetch the directories that hold something saved.
  const kinds = new Set(Object.values(plan.saved).map(v => v.kind));
  const loads = [load("summary")];
  if (kinds.has("grant")) loads.push(load("grants")); if (kinds.has("service")) loads.push(load("services")); if (kinds.has("trial")) loads.push(load("trials"));
  Promise.all(loads).then(() => {
    const n = (k) => Object.values(plan.saved).filter(v => v.kind === k).length;
    $("#planStats").innerHTML = `<div class="stat"><b>${n("grant")}</b><span>grants saved</span></div><div class="stat"><b>${n("service")}</b><span>services saved</span></div><div class="stat"><b>${n("trial")}</b><span>studies saved</span></div><a class="stat" href="/road-ahead"><b>${Object.keys(plan.checks).length}</b><span>road-ahead steps done</span></a><a class="stat" href="/get-ready"><b>${Object.keys(plan.docs).length}</b><span>documents collected</span></a>`;
    list(); freshness();
    $$("[data-ptab]").forEach(b => b.addEventListener("click", () => { tab = b.dataset.ptab; $$("[data-ptab]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); list(); }));
    $("#copyPlan").addEventListener("click", async () => { try { await navigator.clipboard.writeText(text()); toast("Copied. Paste it into an email or note."); } catch { toast("Copy isn't available here"); } });
    $("#dlPlan").addEventListener("click", () => { const blob = new Blob([text()], { type: "text/plain" }); const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = "my-als-plan.txt"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); });
    $("#clearPlan").addEventListener("click", () => { if ($("#clearPlan").dataset.armed){ plan.saved = {}; persist(); list(); toast("Saved list cleared"); $("#clearPlan").textContent = "Clear saved list"; delete $("#clearPlan").dataset.armed; } else { $("#clearPlan").dataset.armed = "1"; $("#clearPlan").textContent = "Click again to confirm"; } });
  });
}

/* ---------- Home ---------- */
function home(){
  const st = getState();
  const sel = $("#homeState"); if (sel) { sel.innerHTML = stateOpts(st, "Choose your state"); sel.addEventListener("change", e => { setState(e.target.value); paint(); toast(e.target.value ? `Showing ${stateName(e.target.value)} first on Grants, Services and Trials` : "State cleared"); }); }
  const paint = () => {
    const s = DATA.summary; if (!s) return;
    const st = getState();
    const local = st ? (s.localByState[st] || 0) : 0, trialsHere = st ? (s.trials.byState[st] || 0) : 0;
    $("#stats").innerHTML = `<a class="stat" href="/grants"><b>${s.grants.open}</b><span>grants open or rolling now</span></a><a class="stat" href="/trials"><b>${s.trials.recruitingUS}</b><span>studies recruiting in the U.S.</span></a>${st ? `<a class="stat" href="/grants"><b>${local}</b><span>local programs for ${esc(stateName(st))}</span></a><a class="stat" href="/trials"><b>${trialsHere}</b><span>studies with sites in ${esc(stateName(st))}</span></a>` : `<a class="stat" href="/grants"><b>${s.deadlines.length}</b><span>dated deadlines coming up</span></a><a class="stat" href="/my-plan"><b>${Object.keys(plan.saved).length}</b><span>items in your plan</span></a>`}`;
    const soon = s.deadlines.filter(x => !st || x.scope !== "Regional" || (x.regions||[]).includes(st)).slice(0, 4);
    $("#deadlines").innerHTML = soon.length ? soon.map((x,i) => deadlineRow(Object.assign({ kind: "grant" }, x), i)).join("") : `<p class="muted">No dated deadlines ${st ? "for " + esc(stateName(st)) + " or nationwide " : ""}right now. Most programs accept applications year-round.</p>`;
    const lbl = $("#localLabel"); if (lbl) lbl.textContent = st ? `Local programs for ${stateName(st)} will appear first on the Grants, Services and Trials pages.` : "Pick your state and local programs will appear first across the site.";
  };
  load("summary").then(() => { paint(); freshness(); });
  // soft threads in the hero
  const c = $("#threads"); if (!c) return;
  const ctx = c.getContext("2d"); const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w, h; const size = () => { const dpr = Math.min(2, devicePixelRatio || 1); w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr,0,0,dpr,0,0); };
  size(); addEventListener("resize", size, { passive: true });
  const th = Array.from({ length: 11 }, (_, i) => ({ off: i / 11, amp: 14 + (i % 4) * 8, sp: .00010 + (i % 3) * .00004, ph: i * 1.9, warm: i === 5 }));
  const t0 = performance.now();
  const draw = (now) => { const t = now - t0; ctx.clearRect(0,0,w,h);
    th.forEach((x, i) => { ctx.beginPath(); const base = h * (.25 + x.off * .65);
      for (let s = 0; s <= 60; s++){ const px = s / 60 * w; const conv = Math.sin(px / w * Math.PI) * .5; const py = base + (h * .55 - base) * conv + Math.sin(px * .006 + x.ph + t * x.sp * 6) * x.amp; s ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.strokeStyle = x.warm ? "rgba(242,194,122,.8)" : `rgba(160,200,235,${.07 + (i % 3) * .04})`; ctx.lineWidth = x.warm ? 2 : 1.1; ctx.stroke(); });
    if (!reduce && !document.hidden) requestAnimationFrame(draw); };
  requestAnimationFrame(draw);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !reduce) requestAnimationFrame(draw); });
}

/* ---------- PDF downloads (embedded) ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-pdf]"); if (!b) return;
  const go = () => { const s = (window.PDFS||{})[b.dataset.pdf]; if (!s) { toast("Couldn't load the PDF. Try again in a moment."); return; }
    const bin = atob(s); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const u = URL.createObjectURL(new Blob([u8], { type: "application/pdf" })); const a = document.createElement("a"); a.href = u; a.download = b.dataset.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); toast("Downloading " + b.dataset.name); };
  if (window.PDFS) return go();
  b.disabled = true; const sc = document.createElement("script"); sc.src = "/tracker-pdf.js"; sc.onload = () => { b.disabled = false; go(); }; sc.onerror = () => { b.disabled = false; toast("Couldn't load the PDF."); }; document.body.appendChild(sc);
});

/* ---------- Boot ---------- */
({ grants: () => catalog("grants"), services: () => catalog("services"), trials, plan: myPlan, home, road: () => checklist("checks"), ready: () => checklist("docs") }[PAGE] || (() => { load("summary").then(freshness); }))();
})();
