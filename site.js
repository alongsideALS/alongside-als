/* Alongside ALS — shared behaviour: header/footer, saved plan, grants/services/trials explorers, checklists. */
(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl = (u) => /^https?:\/\//i.test(String(u||"")) ? String(u) : "#";
const ls = { get(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const PAGE = document.body.dataset.page || "";

/* ---------- Header / footer ---------- */
const RIBBON = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#f8faff"/><path d="M12 30 25 12C30 2 10 2 15 12L28 30" stroke="#193252" stroke-width="6" fill="none"/><path d="M12 30 25 12C30 2 10 2 15 12L28 30" stroke="#7399c6" stroke-width="1.3" fill="none"/><circle cx="33" cy="34" r="3" fill="#c33245"/></svg>';
const NAV = [["understanding-als.html","Understanding ALS","understand"],["road-ahead.html","Road ahead","road"],["grants.html","Grants","grants"],["services.html","Services","services"],["trials.html","Trials","trials"],["get-ready.html","Get ready","ready"],["resources.html","Resources","resources"],["my-plan.html","My plan","plan"]];
document.body.insertAdjacentHTML("afterbegin", `<a class="skip" href="#main">Skip to content</a>
<header class="banner"><div class="wrap banner-in">
  <a class="brand" href="index.html" aria-label="Alongside ALS home">${RIBBON}<span><span class="brand-name">Alongside ALS</span><span class="brand-sub" style="display:block">Resources &amp; support for people living with ALS</span></span></a>
  <nav class="nav" aria-label="Main">${NAV.map(n => `<a href="${n[0]}" ${PAGE===n[2]?'aria-current="page"':""}>${n[1]}${n[2]==="plan"?' <span class="count" id="savedCount">0</span>':""}</a>`).join("")}<button class="textsize" id="textSize" type="button" title="Larger text" aria-pressed="false">A<span style="font-size:1.25em">A</span></button></nav>
</div></header>`);
document.body.insertAdjacentHTML("beforeend", `<footer><div class="wrap">
  <nav aria-label="Footer"><a href="about.html">About &amp; contact</a><a href="about.html#privacy">Privacy</a><a href="about.html#disclaimer">Disclaimer</a><a href="about.html#updates">What changed</a><a href="about.html#corrections">Report outdated information</a></nav>
  <p><b>Alongside ALS</b> is an independent guide. It does not give medical, legal or financial advice, award grants or decide eligibility. Confirm every program's rules with the organization, and talk with your care team before joining a study.</p>
  <p id="freshness" class="mono small"></p>
</div></footer><div class="toast" id="toast" role="status" aria-live="polite"></div>`);
const big = ls.get("aa.big", false);
const tsBtn = $("#textSize");
const setBig = (b) => { document.documentElement.classList.toggle("big", b); tsBtn.setAttribute("aria-pressed", String(b)); };
setBig(big);
tsBtn.addEventListener("click", () => { const b = !document.documentElement.classList.contains("big"); setBig(b); ls.set("aa.big", b); });
let tt; function toast(msg){ const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2400); }

const ICON = {
  heart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 3.8 4 7 4c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.2 0 5.4 3.2 4.2 6.6C19.5 15.4 12 20 12 20z"/></svg>',
  ext: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>'
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
function updateCount(){ const c = $("#savedCount"); if (c) c.textContent = Object.keys(plan.saved).length; }
updateCount();
function toggleSave(kind, id){
  const k = keyOf(kind, id);
  if (plan.saved[k]) { delete plan.saved[k]; toast("Removed from My plan"); }
  else { plan.saved[k] = { kind, id, status: "interested", note: "", added: new Date().toISOString().slice(0,10) }; toast("Saved to My plan"); }
  persist();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-save]");
  if (!b) return;
  toggleSave(b.dataset.save, b.dataset.id);
  const on = isSaved(b.dataset.save, b.dataset.id);
  b.setAttribute("aria-pressed", String(on)); b.querySelector("span").textContent = on ? "Saved" : "Save";
});
const saveBtn = (kind, id) => { const s = isSaved(kind, id); return `<button class="save" type="button" data-save="${kind}" data-id="${esc(id)}" aria-pressed="${s}">${ICON.heart}<span>${s?"Saved":"Save"}</span></button>`; };

/* ---------- Data ---------- */
const DATA = { grants: null, services: null, trials: null, meta: {} };
async function load(which){
  if (DATA[which]) return DATA[which];
  try {
    const r = await fetch("data/" + which + ".json", { cache: "no-cache" });
    const d = await r.json();
    DATA[which] = d.items || []; DATA.meta[which] = d;
  } catch { DATA[which] = []; }
  return DATA[which];
}
function freshness(){
  const f = $("#freshness"); if (!f) return;
  const parts = [];
  if (DATA.meta.grants) parts.push("Grants & services checked " + fmtD(DATA.meta.grants.updated));
  if (DATA.meta.trials) parts.push("Trial registry snapshot " + fmtD(DATA.meta.trials.registrySnapshot || DATA.meta.trials.updated));
  f.textContent = parts.join(" · ");
}

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const stateOpts = (sel) => `<option value="">All states</option>` + STATES.map(s => `<option value="${s}" ${s===sel?"selected":""}>${s}</option>`).join("");

/* ---------- Grants & services explorer ---------- */
const CATS = {
  grants: ["All","Medical costs","Prescriptions","Equipment & technology","Home modification","Respite & caregiving","Travel","Family & children","Education & scholarships","Quality of life"],
  services: ["All","Government benefits","Insurance help","Equipment & loans","Home access","Communication","Prescriptions help","Caregiving & education","Family & kids"]
};
function catalog(which){
  const key = which === "grants" ? "aa.gf" : "aa.sf";
  const f = Object.assign({ q: "", cat: "All", state: "", status: "all", sort: "default" }, ls.get(key, {}));
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
      <div><div class="org">${esc(g.org)}</div><h3>${esc(g.name)}</h3></div>
      <div class="pills"><span class="pill ${st.cls}">${esc(st.label)}</span><span class="pill">${g.scope === "Regional" ? esc((g.regions||[]).join(", ")) : "Nationwide"}</span>${(g.categories||[]).slice(0,2).map(c=>`<span class="pill">${esc(c)}</span>`).join("")}</div>
      ${g.amount ? `<div class="amount">${esc(g.amount)}</div>` : ""}
      <p>${esc(g.forWhat)}</p>
      <dl class="kv"><dt>When</dt><dd>${esc(g.window)}</dd></dl>
      <details><summary>${kind==="service" ? "Who it's for & how to start" : "Who qualifies & what to have ready"}</summary>
        <div class="sub">Who qualifies</div><ul class="need">${(g.eligibility||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
        <div class="sub">Have these ready</div><ul class="need">${(g.youllNeed||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
        <div class="sub">${kind==="service" ? "How to start" : "How to apply"}</div><p style="margin-top:6px">${esc(g.howToApply)}</p>
        ${g.contact ? `<p style="margin-top:6px" class="mono small">${esc(g.contact)}</p>` : ""}
        ${g.lastVerified ? `<p class="cite" style="margin-top:8px">Checked ${esc(fmtD(g.lastVerified))}</p>` : ""}
      </details>
      <div class="card-foot"><a class="btn btn-primary btn-sm" href="${safeUrl(g.url)}" target="_blank" rel="noopener">${kind==="service" ? "Go to service" : "Go to program"} ${ICON.ext}</a>${saveBtn(kind, g.id)}</div>
    </article>`;
  };
  const list = () => {
    const l = filtered(), all = DATA[which];
    $("#count").innerHTML = `${l.length} of ${all.length} ${which === "grants" ? "grants and scholarships" : "services and benefits"}${f.state ? ` for <b>${f.state}</b> (nationwide + local)` : ""}`;
    $("#list").innerHTML = l.length ? `<div class="grid stagger">${l.map(card).join("")}</div>` : `<div class="empty"><h3>Nothing matches those filters</h3><p>Try a different category or clear the search.</p><button class="btn btn-line btn-sm" type="button" id="clearF">Clear filters</button></div>`;
    const c = $("#clearF"); if (c) c.addEventListener("click", () => { Object.assign(f, { q: "", cat: "All", state: "", status: "all", sort: "default" }); ls.set(key, f); render(); });
  };
  const render = () => {
    root.innerHTML = `<div class="filters" role="search">
      <div class="frow">
        <label class="search">${ICON.search}<span class="sr">Search</span><input id="q" type="search" placeholder="${which === "grants" ? "Search: wheelchair, respite, scholarship…" : "Search: Medicare, ramp, voice…"}" value="${esc(f.q)}"></label>
        <label><span class="sr">State</span><select id="state">${stateOpts(f.state)}</select></label>
        <label><span class="sr">Sort</span><select id="sort">
          <option value="default" ${f.sort==="default"?"selected":""}>Sort: deadlines first</option>
          <option value="local" ${f.sort==="local"?"selected":""}>Sort: my state first</option>
          <option value="name" ${f.sort==="name"?"selected":""}>Sort: A to Z</option>
          <option value="org" ${f.sort==="org"?"selected":""}>Sort: by organization</option></select></label>
        ${which === "grants" ? `<label><span class="sr">Status</span><select id="status">
          <option value="all" ${f.status==="all"?"selected":""}>Any status</option>
          <option value="open" ${f.status==="open"?"selected":""}>Open or rolling now</option>
          <option value="deadline" ${f.status==="deadline"?"selected":""}>Has an upcoming deadline</option></select></label>` : ""}
      </div>
      <div class="chips" role="group" aria-label="Category">${CATS[which].map(c=>`<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${f.cat===c}">${esc(c)}</button>`).join("")}</div>
    </div><p class="count" id="count" style="margin-bottom:12px"></p><div id="list"></div>`;
    const upd = () => { ls.set(key, f); list(); };
    let qt; $("#q").addEventListener("input", e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; upd(); }, 180); });
    $("#state").addEventListener("change", e => { f.state = e.target.value; if (f.state && f.sort === "default") { f.sort = "local"; $("#sort").value = "local"; } upd(); });
    $("#sort").addEventListener("change", e => { f.sort = e.target.value; upd(); });
    const st = $("#status"); if (st) st.addEventListener("change", e => { f.status = e.target.value; upd(); });
    $$("[data-cat]").forEach(b => b.addEventListener("click", () => { f.cat = b.dataset.cat; $$("[data-cat]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); upd(); }));
    list();
  };
  root.innerHTML = `<div class="grid">${'<div class="skel"></div>'.repeat(6)}</div>`;
  load(which).then(() => { render(); freshness();
    if (which === "grants"){ const soon = DATA.grants.filter(x => { const d = daysTo(x.deadline); return d != null && d >= 0; }).sort((a,b) => daysTo(a.deadline) - daysTo(b.deadline));
      const dl = $("#deadlines"); if (dl) dl.innerHTML = soon.length ? soon.map((x,i) => deadlineRow(x,i)).join("") : `<p class="muted">No dated deadlines right now. Most programs accept applications year-round.</p>`; }
  });
}
const deadlineRow = (x, i) => { const d = parseD(x.deadline); return `<div class="dl" style="--i:${i}"><div class="date"><small>${d.toLocaleDateString(undefined,{month:"short"})}</small><b>${d.getDate()}</b></div><div><b>${esc(x.name)}</b><div class="org">${esc(x.org)}</div></div><span class="pill ${grantStatus(x).cls}">${daysTo(x.deadline)} days</span></div>`; };

/* ---------- Trials explorer ---------- */
function trials(){
  const key = "aa.tf";
  const f = Object.assign({ q: "", type: "All", state: "", status: "open", phase: "Any phase", gene: "Any gene", sort: "status", us: true, remote: false, noPlacebo: false, verified: false }, ls.get(key, {}));
  const root = $("#explorer");
  const TYPES = ["All","Interventional","Expanded access","Device","Observational","Care & lifestyle"];
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
    return `<article class="card" style="--i:${Math.min(i,12)}">
      <div><div class="nct">${esc(t.id)} · ${esc(t.sponsor)}</div><h3>${esc(title)}</h3>${t.name && t.name !== t.title && title !== t.title ? `<p class="small muted">${esc(t.title)}</p>` : ""}</div>
      <div class="pills"><span class="pill ${en.cls}">${esc(en.label)}</span><span class="pill">${esc(t.phase)}</span>${t.type === "Device" ? '<span class="pill">Device / BCI</span>' : t.type === "Observational" ? '<span class="pill">No drug · research only</span>' : t.type === "Care & lifestyle" ? '<span class="pill">Non-drug</span>' : ""}${t.placebo === false ? '<span class="pill">No placebo</span>' : t.placebo ? '<span class="pill">Placebo-controlled</span>' : ""}${t.remote ? '<span class="pill s-good">From home</span>' : ""}${gene && gene !== "Any" ? `<span class="pill">${esc(gene)}</span>` : ""}${v ? '<span class="pill s-info">Hand-checked</span>' : ""}</div>
      ${what ? `<p><b>${esc(what)}</b></p>` : ""}
      <p class="muted">${esc(summary)}</p>
      ${v && v.statusNote ? `<p class="small muted"><b>Status note:</b> ${esc(v.statusNote)}</p>` : ""}
      ${timeline(t)}
      <div class="states" aria-label="States with sites">${(t.states||[]).map(s => `<span class="st ${f.state===s?"hit":""}">${esc(s)}</span>`).join("")}${!t.us && t.countries ? t.countries.slice(0,4).map(c=>`<span class="st">${esc(c)}</span>`).join("") : ""}</div>
      <details><summary>Who it's for, what's involved, where</summary>
        ${t.plain ? `<div class="sub">Who it's for</div><p class="small">${esc(t.plain.audience)}</p><div class="sub">What taking part involves</div><p class="small">${esc(t.plain.participation)}</p>` : ""}
        ${v && v.eligibility && v.eligibility.length ? `<div class="sub">Eligibility notes</div><ul class="need">${v.eligibility.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${usLocs.length ? `<div class="sub">U.S. sites (${usLocs.length})</div><ul class="loc-list">${usLocs.slice(0,40).map(l => `<li>${esc(l.f)}${l.c ? ", " + esc(l.c) : ""}${l.s ? ", " + esc(l.s) : ""}</li>`).join("")}${usLocs.length > 40 ? `<li class="muted">…and ${usLocs.length - 40} more</li>` : ""}</ul>` : `<p class="loc">${esc(locLine)}</p>`}
        ${(t.contacts||[]).length ? `<div class="sub">Study contact</div>${t.contacts.slice(0,2).map(c => `<p class="contact">${esc(c.name||"")}${c.phone ? ` · <span class="mono">${esc(c.phone)}</span>` : ""}${c.email ? ` · <span class="mono">${esc(c.email)}</span>` : ""}</p>`).join("")}` : ""}
        <p class="cite" style="margin-top:8px">Registry record updated ${esc(fmtD(t.updated))}${v && v.lastVerified ? ` · hand-checked ${esc(fmtD(v.lastVerified))}` : ""}. Full criteria are on ClinicalTrials.gov; the study team decides eligibility.</p>
      </details>
      <div class="card-foot"><a class="btn btn-primary btn-sm" href="https://clinicaltrials.gov/study/${encodeURIComponent(t.id)}" target="_blank" rel="noopener">Official record ${ICON.ext}</a>${saveBtn("trial", t.id)}</div>
    </article>`;
  };
  const list = () => {
    const l = filtered(), all = DATA.trials;
    const rec = all.filter(t => t.enrolling === "yes" && t.us).length, soon = all.filter(t => t.enrolling === "soon" && t.us).length;
    $("#count").innerHTML = `${l.length} of ${all.length} studies${f.us ? ` with U.S. sites` : ""} · ${rec} recruiting in the U.S. · ${soon} opening soon`;
    $("#list").innerHTML = l.length ? `<div class="grid stagger">${l.map(card).join("")}</div>` : `<div class="empty"><h3>No studies match those filters</h3><p>Try removing a filter, or use the registry tools below.</p><button class="btn btn-line btn-sm" type="button" id="clearF">Clear filters</button></div>`;
    const c = $("#clearF"); if (c) c.addEventListener("click", () => { Object.assign(f, { q: "", type: "All", state: "", status: "open", phase: "Any phase", gene: "Any gene", sort: "status", us: true, remote: false, noPlacebo: false, verified: false }); ls.set(key, f); render(); });
  };
  const render = () => {
    root.innerHTML = `<div class="filters" role="search">
      <div class="frow">
        <label class="search">${ICON.search}<span class="sr">Search studies</span><input id="q" type="search" placeholder="Drug, gene (SOD1, C9orf72), sponsor, city or NCT number" value="${esc(f.q)}"></label>
        <label><span class="sr">State</span><select id="state">${stateOpts(f.state)}</select></label>
        <label><span class="sr">Recruitment</span><select id="status">
          <option value="open" ${f.status==="open"?"selected":""}>Recruiting or opening soon</option>
          <option value="yes" ${f.status==="yes"?"selected":""}>Recruiting now only</option>
          <option value="all" ${f.status==="all"?"selected":""}>All active studies</option></select></label>
      </div>
      <div class="chips" role="group" aria-label="Study type">${TYPES.map(c=>`<button type="button" class="chip" data-type="${esc(c)}" aria-pressed="${f.type===c}">${esc(c)}</button>`).join("")}</div>
      <details class="more"><summary>More filters: phase, gene, placebo, sorting</summary>
        <div class="frow" style="margin-top:10px">
          <label><span class="sr">Phase</span><select id="phase">${PHASES.map(p=>`<option ${f.phase===p?"selected":""}>${p}</option>`).join("")}</select></label>
          <label><span class="sr">Gene</span><select id="gene">${GENES.map(p=>`<option ${f.gene===p?"selected":""}>${p}</option>`).join("")}</select></label>
          <label><span class="sr">Sort</span><select id="sort">
            <option value="status" ${f.sort==="status"?"selected":""}>Sort: recruiting first</option>
            <option value="nearby" ${f.sort==="nearby"?"selected":""}>Sort: closest to my state</option>
            <option value="name" ${f.sort==="name"?"selected":""}>Sort: A to Z</option>
            <option value="newest" ${f.sort==="newest"?"selected":""}>Sort: recently updated</option></select></label>
          <label class="toggle"><input type="checkbox" id="us" ${f.us?"checked":""}> U.S. sites only</label>
          <label class="toggle"><input type="checkbox" id="remote" ${f.remote?"checked":""}> From home</label>
          <label class="toggle"><input type="checkbox" id="np" ${f.noPlacebo?"checked":""}> No placebo</label>
          <label class="toggle"><input type="checkbox" id="ver" ${f.verified?"checked":""}> Hand-checked only</label>
        </div></details>
    </div><p class="count" id="count" style="margin-bottom:12px"></p><div id="list"></div>`;
    const upd = () => { ls.set(key, f); list(); };
    let qt; $("#q").addEventListener("input", e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; upd(); }, 180); });
    $("#state").addEventListener("change", e => { f.state = e.target.value; if (f.state && f.sort === "status") { f.sort = "nearby"; $("#sort").value = "nearby"; } upd(); });
    ["status","phase","gene","sort"].forEach(id => $("#" + id).addEventListener("change", e => { f[id] = e.target.value; upd(); }));
    [["us","us"],["remote","remote"],["np","noPlacebo"],["ver","verified"]].forEach(([id,k]) => $("#" + id).addEventListener("change", e => { f[k] = e.target.checked; upd(); }));
    $$("[data-type]").forEach(b => b.addEventListener("click", () => { f.type = b.dataset.type; $$("[data-type]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); upd(); }));
    list();
  };
  root.innerHTML = `<div class="grid">${'<div class="skel"></div>'.repeat(6)}</div>`;
  load("trials").then(() => { render(); freshness();
    const m = DATA.meta.trials; const s = $("#snapshot"); if (s && m) s.textContent = `Registry snapshot ${fmtD(m.registrySnapshot)} · ${DATA.trials.length} active studies · hand-checked notes ${fmtD("2026-10-15")}`; });
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
  const src = (v) => (v.kind === "grant" ? DATA.grants : v.kind === "service" ? DATA.services : DATA.trials || []).find(x => x.id === v.id) || null;
  const text = () => {
    const lines = ["My ALS plan (from Alongside ALS)", ""];
    Object.values(plan.saved).forEach(v => { const s = src(v); const nm = s ? (s.name || s.title) + (v.kind !== "trial" ? " (" + s.org + ")" : " (" + s.id + ")") : v.id;
      const url = v.kind === "trial" ? "https://clinicaltrials.gov/study/" + v.id : (s && s.url) || "";
      lines.push(`[${KLABEL[v.kind]}] ${nm}`, `  Status: ${(PSTAT.find(p=>p[0]===v.status)||[0,v.status])[1]}`, url ? `  Link: ${url}` : "", v.note ? `  Notes: ${v.note}` : "", ""); });
    return lines.filter(l => l !== "").join("\n");
  };
  const list = () => {
    const items = Object.entries(plan.saved).map(([k,v]) => ({ k, v, s: src(v) })).filter(x => tab === "all" || x.v.kind === tab).sort((a,b) => PSTAT.findIndex(p=>p[0]===a.v.status) - PSTAT.findIndex(p=>p[0]===b.v.status));
    const el = $("#plist");
    if (!Object.keys(plan.saved).length) { el.innerHTML = `<div class="empty"><h3>Nothing saved yet</h3><p>Use <b>Save</b> on any grant, service or study to keep it here, track where you are, and add notes.</p><div class="cta"><a class="btn btn-primary btn-sm" href="grants.html">Browse grants</a><a class="btn btn-line btn-sm" href="trials.html">Browse studies</a></div></div>`; return; }
    if (!items.length) { el.innerHTML = `<div class="empty"><p>No saved ${({grant:"grants",service:"services",trial:"studies"})[tab]} yet.</p></div>`; return; }
    el.innerHTML = `<div class="plan stagger">${items.map(({k,v,s},i) => {
      const name = s ? (s.name || s.title) : v.id, sub = s ? (v.kind !== "trial" ? s.org : `${s.id} · ${s.phase}`) : "No longer listed";
      const link = v.kind === "trial" ? `https://clinicaltrials.gov/study/${encodeURIComponent(v.id)}` : safeUrl(s && s.url);
      const st = v.kind !== "trial" && s ? grantStatus(s) : null;
      const kid = k.replace(/[^a-z0-9]/gi,"-");
      return `<div class="pitem" style="--i:${Math.min(i,12)}"><div><div class="org">${KLABEL[v.kind]} · ${esc(sub)}</div><h3>${esc(name)}</h3><div class="pills" style="margin-top:8px">${st ? `<span class="pill ${st.cls}">${esc(st.label)}</span>` : ""}<span class="pill">Saved ${esc(fmtD(v.added))}</span></div></div>
        <div class="row"><label><span class="sr">Progress</span><select id="ps-${kid}" data-pstatus="${esc(k)}">${PSTAT.map(p=>`<option value="${p[0]}" ${v.status===p[0]?"selected":""}>${p[1]}</option>`).join("")}</select></label>${link !== "#" ? `<a class="btn btn-line btn-sm" href="${link}" target="_blank" rel="noopener">Open ${ICON.ext}</a>` : ""}<button class="save" type="button" data-unsave="${esc(k)}" aria-pressed="true">${ICON.heart}<span>Remove</span></button></div>
        <label class="sr" for="pn-${kid}">Notes</label><textarea id="pn-${kid}" data-pnote="${esc(k)}" rows="2" placeholder="Notes: who you talked to, documents sent, next step…">${esc(v.note)}</textarea></div>`; }).join("")}</div>`;
    $$("[data-pstatus]").forEach(s => s.addEventListener("change", () => { const it = plan.saved[s.dataset.pstatus]; if (it){ it.status = s.value; persist(); toast("Progress updated"); } }));
    $$("[data-pnote]").forEach(t => { let nt; t.addEventListener("input", () => { clearTimeout(nt); nt = setTimeout(() => { const it = plan.saved[t.dataset.pnote]; if (it){ it.note = t.value.slice(0, 2000); persist(); } }, 500); }); });
    $$("[data-unsave]").forEach(b => b.addEventListener("click", () => { delete plan.saved[b.dataset.unsave]; persist(); list(); toast("Removed"); }));
  };
  Promise.all([load("grants"), load("services"), load("trials")]).then(() => {
    const n = (k) => Object.values(plan.saved).filter(v => v.kind === k).length;
    $("#planStats").innerHTML = `<div class="stat"><b>${n("grant")}</b><span>grants saved</span></div><div class="stat"><b>${n("service")}</b><span>services saved</span></div><div class="stat"><b>${n("trial")}</b><span>studies saved</span></div><a class="stat" href="road-ahead.html"><b>${Object.keys(plan.checks).length}</b><span>road-ahead steps done</span></a><a class="stat" href="get-ready.html"><b>${Object.keys(plan.docs).length}</b><span>documents collected</span></a>`;
    list();
    $$("[data-ptab]").forEach(b => b.addEventListener("click", () => { tab = b.dataset.ptab; $$("[data-ptab]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); list(); }));
    $("#copyPlan").addEventListener("click", async () => { try { await navigator.clipboard.writeText(text()); toast("Copied. Paste it into an email or note."); } catch { toast("Copy isn't available here"); } });
    $("#dlPlan").addEventListener("click", () => { const blob = new Blob([text()], { type: "text/plain" }); const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = "my-als-plan.txt"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); });
    $("#clearPlan").addEventListener("click", () => { if ($("#clearPlan").dataset.armed){ plan.saved = {}; persist(); list(); toast("Saved list cleared"); $("#clearPlan").textContent = "Clear saved list"; delete $("#clearPlan").dataset.armed; } else { $("#clearPlan").dataset.armed = "1"; $("#clearPlan").textContent = "Click again to confirm"; } });
  });
}

/* ---------- Home ---------- */
function home(){
  Promise.all([load("grants"), load("trials")]).then(() => {
    const g = DATA.grants, t = DATA.trials;
    const openG = g.filter(x => grantStatus(x).key === "open").length;
    const soon = g.filter(x => { const d = daysTo(x.deadline); return d != null && d >= 0; }).sort((a,b) => daysTo(a.deadline) - daysTo(b.deadline)).slice(0,4);
    $("#stats").innerHTML = `<a class="stat" href="grants.html"><b>${openG}</b><span>grants open or rolling now</span></a><a class="stat" href="trials.html"><b>${t.filter(x => x.enrolling === "yes" && x.us).length}</b><span>studies recruiting in the U.S.</span></a><a class="stat" href="grants.html"><b>${soon.length}</b><span>dated deadlines coming up</span></a><a class="stat" href="my-plan.html"><b>${Object.keys(plan.saved).length}</b><span>items in your plan</span></a>`;
    $("#deadlines").innerHTML = soon.length ? soon.map(deadlineRow).join("") : `<p class="muted">No dated deadlines right now. Most programs accept applications year-round.</p>`;
    freshness();
  });
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
    if (!reduce) requestAnimationFrame(draw); };
  requestAnimationFrame(draw);
}

/* ---------- PDF downloads (embedded) ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-pdf]"); if (!b) return;
  const go = () => { const s = (window.PDFS||{})[b.dataset.pdf]; if (!s) { toast("Couldn't load the PDF. Try again in a moment."); return; }
    const bin = atob(s); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const u = URL.createObjectURL(new Blob([u8], { type: "application/pdf" })); const a = document.createElement("a"); a.href = u; a.download = b.dataset.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); toast("Downloading " + b.dataset.name); };
  if (window.PDFS) return go();
  b.disabled = true; const sc = document.createElement("script"); sc.src = "tracker-pdf.js"; sc.onload = () => { b.disabled = false; go(); }; sc.onerror = () => { b.disabled = false; toast("Couldn't load the PDF."); }; document.body.appendChild(sc);
});

/* ---------- Boot ---------- */
({ grants: () => catalog("grants"), services: () => catalog("services"), trials, plan: myPlan, home, road: () => checklist("checks"), ready: () => checklist("docs") }[PAGE] || (() => { load("grants").then(freshness); }))();
})();
