"""Per-listing and per-state pages for search engines (and for sharing one program by link).
Imported by build.py, which passes its wrappers. Output: grant/<id>.html, service/<id>.html, study/<nct>.html, state/<st>.html.
These pages are plain HTML (no explorer); the Save button works through site.js's delegated handler."""
import json, pathlib, datetime, html

STATE_NAMES = {"AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut","DC":"Washington, D.C.","DE":"Delaware","FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming"}
NET = {"alsa-coe": "ALS Association Certified Center of Excellence", "alsa-rtc": "ALS Association Recognized Treatment Center", "mda": "MDA ALS Care Center", "va": "VA ALS clinic", "neals": "NEALS research site"}
ENROLL = {"yes": "Recruiting", "soon": "Not yet recruiting", "invite": "Enrolling by invitation", "no": "Active, not recruiting"}
HEART = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 3.8 4 7 4c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.2 0 5.4 3.2 4.2 6.6C19.5 15.4 12 20 12 20z"/></svg>'
esc = lambda s: html.escape(str(s if s is not None else ""), quote=True)

def fmt_date(d):
    try: return datetime.date.fromisoformat(d).strftime("%B %-d, %Y")
    except Exception: return d or ""

def clip(text, n=160, sentence=True):
    """Cut text to about n characters at a sentence end if there is one, otherwise at a word boundary."""
    text = " ".join(text.split())
    if len(text) <= n: return text
    cut = text[:n]
    for mark in ((". ", "; ") if sentence else ()):
        i = cut.rfind(mark)
        if i > n * 0.55: return cut[:i + 1].strip()
    i = cut.rfind(" ")
    return (cut[:i] if i > n * 0.6 else cut).rstrip(",;:") + "…"

def status_pill(g, today):
    st = g.get("status"); dl = g.get("deadline")
    if dl:
        try:
            days = (datetime.date.fromisoformat(dl) - today).days
            if days < 0: return ("s-bad", "Round closed · watch for the next")
            if days <= 30: return ("s-warn", f"Closing soon · {days} day{'' if days == 1 else 's'} left")
            return ("s-good", "Open · due " + datetime.date.fromisoformat(dl).strftime("%b %-d"))
        except Exception: pass
    if g.get("kind") == "service" and st in ("open", "rolling"): return ("s-good", "Available now")
    return {"open": ("s-good", "Open now"), "rolling": ("s-good", "Rolling · apply anytime"), "window": ("s-info", "Opens in cycles"), "closed": ("s-bad", "Closed for now")}.get(st, ("s-info", "Confirm with the organization"))

def logo_tag(g):
    from urllib.parse import urlparse
    try: d = urlparse(g.get("url") or "").hostname or ""
    except Exception: d = ""
    d = d.lower().removeprefix("www.")
    init = esc((g.get("org") or g.get("name") or "?").strip().removeprefix("The ").removeprefix("the ")[:1].upper())
    img = f'<img src="/logo/{esc(d)}" alt="" width="56" height="56" loading="lazy" decoding="async" onerror="this.remove()">' if "." in d else ""
    return f'<span class="logo" data-init="{init}">{img}</span>'

def save_btn(kind, id_, name):
    return f'<button class="save" type="button" data-save="{kind}" data-id="{esc(id_)}" data-name="{esc(name)}" aria-pressed="false" aria-label="Save: {esc(name)}">{HEART}<span>Save</span></button>'

def ul(items): return "<ul>" + "".join(f"<li>{esc(x)}</li>" for x in items) + "</ul>" if items else ""

def where(g):
    if g.get("scope") == "National": return "Nationwide"
    return ", ".join(STATE_NAMES.get(s, s) for s in (g.get("regions") or [])) or "Regional"

def crumbs(parts):
    return '<nav class="crumbs" aria-label="Breadcrumb">' + " › ".join(f'<a href="{esc(h)}">{esc(t)}</a>' if h else f"<span>{esc(t)}</span>" for t, h in parts) + "</nav>"

def breadcrumb_ld(site, parts):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": t, **({"item": site + h} if h else {})} for i, (t, h) in enumerate(parts)]}

def program_page(g, kind, site, today, by_state):
    plural = "grants" if kind == "grant" else "services"
    label = "Grant" if kind == "grant" else "Service"
    cls, lab = status_pill(g, today)
    regions = g.get("regions") or []
    related = []
    for st in regions[:3]:
        for o in by_state.get(st, []):
            if o["id"] != g["id"] and o not in related: related.append(o)
    related = related[:6]
    parts = [("Home", "/"), ("Grants" if kind == "grant" else "Services", f"/{plural}"), (g["name"], "")]
    body = f'''<div class="wrap page">
  {crumbs(parts)}
  <div class="page-head">
    <span class="eyebrow">{label} · {esc(where(g))}</span>
    <div class="head-row">{logo_tag(g)}<h1>{esc(g["name"])}</h1></div>
    <p class="org-line">{esc(g.get("org", ""))}</p>
    <div class="pills"><span class="pill {cls}">{esc(lab)}</span>{"".join(f'<span class="pill">{esc(c)}</span>' for c in g.get("categories") or [])}</div>
    <p class="intro">{esc(g.get("forWhat", ""))}</p>
  </div>
  <div class="detail-grid">
    <article class="card detail">
      <dl class="facts">
        {"<dt>Amount</dt><dd>" + esc(g["amount"]) + "</dd>" if g.get("amount") else ""}
        {"<dt>When to apply</dt><dd>" + esc(g["window"]) + "</dd>" if g.get("window") else ""}
        {"<dt>Next deadline</dt><dd>" + esc(fmt_date(g["deadline"])) + "</dd>" if g.get("deadline") else ""}
        {"<dt>Who qualifies</dt><dd>" + ul(g.get("eligibility")) + "</dd>" if g.get("eligibility") else ""}
        {"<dt>What you'll need</dt><dd>" + ul(g.get("youllNeed")) + "</dd>" if g.get("youllNeed") else ""}
        {"<dt>How to apply</dt><dd>" + esc(g["howToApply"]) + "</dd>" if g.get("howToApply") else ""}
        {"<dt>Contact</dt><dd>" + esc(g["contact"]) + "</dd>" if g.get("contact") else ""}
        <dt>Checked</dt><dd>{esc(fmt_date(g.get("lastVerified")))} against the organization's own page. Funding is never guaranteed; confirm details with the program before applying.</dd>
      </dl>
      <div class="card-foot"><a class="btn btn-primary" href="{esc(g["url"])}" target="_blank" rel="noopener">Go to the program's page</a>{save_btn(kind, g["id"], g["name"])}</div>
    </article>
    <aside class="detail-side" aria-label="Related">
      <div class="side-box"><h2>More for {esc(STATE_NAMES.get(regions[0], regions[0])) if regions else "you"}</h2>
        {'<ul class="plain-list">' + "".join(f'<li><a href="/{"grant" if o["kind"] == "grant" else "service"}/{esc(o["id"])}">{esc(o["name"])}</a> <span class="muted small">{esc(o["org"])}</span></li>' for o in related) + "</ul>" if related else '<p class="small muted">Nationwide programs apply in every state.</p>'}
        <p class="small">{"".join(f'<a href="/state/{st.lower()}">All ALS help in {esc(STATE_NAMES.get(st, st))}</a> · ' for st in regions[:3])}<a href="/{plural}">Browse all {plural}</a></p>
      </div>
      <div class="help-box"><div><b>Before applying:</b> "up to" amounts are maximums, not promised payments. Ask the program what documents they want first; <a href="/get-ready">Get ready</a> lists the usual ones.</div></div>
    </aside>
  </div>
</div>
'''
    ld = [{"@context": "https://schema.org", "@type": "WebPage", "name": g["name"], "url": f"{site}/{kind}/{g['id']}", "description": g.get("forWhat", ""),
           "dateModified": g.get("lastVerified"), "isPartOf": {"@type": "WebSite", "name": "Alongside ALS", "url": site + "/"},
           "about": {"@type": "Organization", "name": g.get("org", ""), "url": g.get("url")}}, breadcrumb_ld(site, parts)]
    title = f'{g["name"]} ({g.get("org", "")})' if len(g["name"]) + len(g.get("org", "")) < 56 else g["name"]
    where_s = ", ".join(STATE_NAMES.get(r, r) for r in (g.get("regions") or [])[:3])
    lead = ("ALS grant" if kind == "grant" else "ALS service") + (f" in {where_s}" if where_s and g.get("scope") != "National" else " (nationwide)") + (f": {g['amount']}. " if g.get("amount") and len(g["amount"]) < 45 and g["amount"].lower() != "free" else ". ")
    desc = clip(lead + g.get("forWhat", ""), 160)
    return title, desc, body, ld

LD_STATUS = {"RECRUITING": "Recruiting", "NOT_YET_RECRUITING": "NotYetRecruiting", "ENROLLING_BY_INVITATION": "EnrollingByInvitation", "ACTIVE_NOT_RECRUITING": "ActiveNotRecruiting"}

def clean_summary(text, n=700):
    """Registry briefSummary -> one readable paragraph (drops markdown escapes, joins lines, clips at a sentence)."""
    import re
    text = re.sub(r"\\([-*_#>])", r"\1", text or "")
    text = re.sub(r"(?m)^\s*[-*]\s+", "", text)
    return clip(text, n) if text.strip() else ""

def norm_iv(name):
    import re
    n = re.sub(r"\(.*?\)|®|™", "", (name or "").lower())
    n = re.sub(r"^(drug|biological|device|other|behavioral|procedure|dietary supplement|genetic|combination product)\s*:\s*", "", n)
    n = re.sub(r"\b(oral|iv|intravenous|intrathecal|injection|tablets?|capsules?|solution|suspension|high|low|dose|mg|kg|\d+)\b", " ", n)
    n = " ".join(n.split())
    return "" if (not n or "placebo" in n or "sham" in n or n.startswith("not applicable") or n in ("standard of care", "standard care", "usual care", "control")) else n

def related_studies(t, trials, n=5):
    """Other listed studies of the same treatment first, then same phase with a site in the same US state."""
    mine = {norm_iv(i) for i in t.get("interventions") or []} - {""}
    st = set(t.get("states") or [])
    scored = []
    for o in trials:
        if o["id"] == t["id"]: continue
        theirs = {norm_iv(i) for i in o.get("interventions") or []} - {""}
        score = 3 * len(mine & theirs) + (1 if o.get("phase") == t.get("phase") and st & set(o.get("states") or []) else 0) + (1 if o.get("enrolling") == "yes" else 0) * 0.5
        if score >= 1: scored.append((-score, o.get("name") or o.get("title") or o["id"], o))
    return [o for _, _, o in sorted(scored, key=lambda x: (x[0], x[1]))[:n]]

def study_page(t, site, today, trials=()):
    name = t.get("name") or t.get("title") or t["id"]
    plain = t.get("plain") or {}
    locs = [l for l in (t.get("locations") or []) if l.get("k") == "United States"]
    by = {}
    for l in locs: by.setdefault(l.get("s") or "?", []).append(l)
    others = sorted({l.get("k") for l in (t.get("locations") or []) if l.get("k") and l.get("k") != "United States"})
    parts = [("Home", "/"), ("Trials", "/trials"), (name, "")]
    ver = t.get("verified") or {}
    summary = ver.get("summary") or clean_summary(t.get("summary"))
    gene = ver.get("genetic") or t.get("genetic") or ""
    if gene in ("Any", "any"): gene = ""
    remote = ver.get("remote") or t.get("remote")
    def mw(d):
        try: return datetime.date.fromisoformat((d + "-01")[:10]).strftime("%B %Y")
        except Exception: return ""
    tl = [x for x in [("started " if (t.get("start") or "") <= today.isoformat() else "starts ") + mw(t.get("start")) if mw(t.get("start")) else "",
                      "main results expected around " + mw(t.get("primary")) if mw(t.get("primary")) else "",
                      "study end expected " + mw(t.get("end")) if mw(t.get("end")) and t.get("end") != t.get("primary") else ""] if x]
    timeline = (tl[0][0].upper() + "; ".join(tl)[1:] + ". Registry estimates; dates often move.") if tl else ""
    rel = related_studies(t, trials)
    body = f'''<div class="wrap page">
  {crumbs(parts)}
  <div class="page-head">
    <span class="eyebrow">Clinical study · {esc(ENROLL.get(t.get("enrolling"), t.get("status", "")))}</span>
    <h1>{esc(name)}</h1>
    <p class="org-line">{esc(t.get("sponsor", ""))} · {esc(t.get("phase", ""))} · <span class="mono">{esc(t["id"])}</span></p>
    <p class="intro">{esc(t.get("title", ""))}</p>
  </div>
  <div class="detail-grid">
    <article class="card detail">
      <dl class="facts">
        {"<dt>In plain words</dt><dd>" + esc(summary) + (" <span class=\"muted small\">(Summary of the registry description.)</span>" if not ver.get("summary") else "") + "</dd>" if summary else ""}
        {"<dt>What it studies</dt><dd>" + esc(plain.get("purpose", "")) + "</dd>" if plain.get("purpose") else ""}
        {"<dt>Treatment being tested</dt><dd>" + esc(ver["intervention"]) + "</dd>" if ver.get("intervention") else ("<dt>Treatments being tested</dt><dd>" + esc(", ".join(t.get("interventions") or [])) + "</dd>" if t.get("interventions") else "")}
        {"<dt>Key eligibility</dt><dd>" + ul(ver.get("eligibility")) + "<p class=\"small muted\">Highlights only; the full criteria are on ClinicalTrials.gov.</p></dd>" if ver.get("eligibility") else ""}
        {"<dt>Who it is for</dt><dd>" + esc(plain.get("audience", "")) + "</dd>" if plain.get("audience") else ""}
        {"<dt>Genetic ALS</dt><dd>" + esc(gene) + "</dd>" if gene else ""}
        {"<dt>From home</dt><dd>Some or all of this study can be done remotely; ask the study team what that covers.</dd>" if remote else ""}
        {"<dt>Taking part</dt><dd>" + esc(plain.get("participation", "")) + (f" The registry lists a target of about {t['enrollment']:,} participants." if t.get("enrollment") else "") + "</dd>" if plain.get("participation") else ""}
        {"<dt>Timeline</dt><dd>" + esc(timeline) + "</dd>" if timeline else ""}
        {"<dt>US study sites</dt><dd>" + "".join(f'<p><b><a href="/state/{st.lower()}">{esc(STATE_NAMES.get(st, st))}</a>:</b> ' + esc("; ".join(sorted({(l.get("f") or "").strip() + " (" + (l.get("c") or "") + ")" for l in ls}))) + "</p>" for st, ls in sorted(by.items())) + "</dd>" if by else ""}
        {"<dt>Other countries</dt><dd>" + esc(", ".join(others)) + "</dd>" if others else ""}
        {"<dt>Study contact</dt><dd>" + "; ".join(esc(" · ".join(x for x in [c.get("name"), c.get("phone"), c.get("email")] if x)) for c in (t.get("contacts") or [])[:2]) + "</dd>" if t.get("contacts") else ""}
        <dt>Registry record</dt><dd>Updated {esc(fmt_date(t.get("updated")))}; snapshot taken {esc(fmt_date(t.get("registryDate")))}. The study team decides eligibility; full criteria are on ClinicalTrials.gov.</dd>
      </dl>
      <div class="card-foot"><a class="btn btn-primary" href="https://clinicaltrials.gov/study/{esc(t["id"])}" target="_blank" rel="noopener">Official record on ClinicalTrials.gov</a>{save_btn("trial", t["id"], name)}</div>
    </article>
    <aside class="detail-side" aria-label="Related">
      {'<div class="side-box"><h2>Related studies</h2><ul class="plain-list">' + "".join(f'<li><a href="/study/{esc(o["id"])}">{esc(o.get("name") or o.get("title") or o["id"])}</a> <span class="muted small">{esc(o.get("phase", ""))} · {esc(ENROLL.get(o.get("enrolling"), ""))}</span></li>' for o in rel) + "</ul></div>" if rel else ""}
      <div class="side-box"><h2>Nearby</h2><p class="small">{"".join(f'<a href="/state/{st.lower()}">ALS help in {esc(STATE_NAMES.get(st, st))}</a> · ' for st in sorted(by)[:4] if st in STATE_NAMES)}<a href="/map">Map</a> · <a href="/trials">All studies</a></p></div>
      <div class="help-box"><div><b>Thinking about a study?</b> Ask your ALS clinic whether you fit, and what travel and visits it would mean. <a href="/trials">The Trials page</a> explains the study types in plain words.</div></div>
    </aside>
  </div>
</div>
'''
    ld = [{"@context": "https://schema.org", "@type": "MedicalStudy", "name": t.get("title") or name, "url": f"{site}/study/{t['id']}", "identifier": t["id"],
           "status": "https://schema.org/" + LD_STATUS[t.get("status")] if t.get("status") in LD_STATUS else t.get("status", ""),
           "sponsor": {"@type": "Organization", "name": t.get("sponsor", "")}, "healthCondition": {"@type": "MedicalCondition", "name": "Amyotrophic lateral sclerosis", "alternateName": ["ALS", "Lou Gehrig's disease", "motor neuron disease"]},
           **({"description": summary} if summary else {}),
           **({"studyLocation": [{"@type": "Place", "name": l.get("f") or l.get("c"), "address": {"@type": "PostalAddress", "addressLocality": l.get("c", ""), "addressRegion": l.get("s", ""), "addressCountry": "US"}} for l in locs[:20]]} if locs else {}),
           "sameAs": f"https://clinicaltrials.gov/study/{t['id']}"}, breadcrumb_ld(site, parts)]
    ivs = [i for i in (t.get("interventions") or []) if not i.lower().startswith("not applicable")][:2]
    sts = [STATE_NAMES.get(x, x) for x in sorted(by)[:3]] + ([f"{len(by) - 3} more state" + ("s" if len(by) - 3 > 1 else "")] if len(by) > 3 else [])
    ph = t.get("phase", "")
    kind_words = f"{ph} for ALS" if ph.lower().endswith("study") or ph.lower() in ("observational", "expanded access") else f"{ph} ALS study"
    desc = clip(f'{ENROLL.get(t.get("enrolling"), t.get("status", ""))} {kind_words}' + (f' of {", ".join(ivs)}' if ivs else "") + f' by {t.get("sponsor", "")}' + (f'; US sites in {", ".join(sts)}' if sts else (f'; sites in {", ".join(others[:3])}' if others else "")) + ". " + t.get("title", ""), 160, sentence=False)
    if len(desc) < 120: desc = clip(desc + " " + (summary or plain.get("purpose", "")), 160)
    return f'{name} ALS study ({t["id"]})', desc, body, ld

def state_page(st, grants, services, m, site):
    name = STATE_NAMES[st]
    clinics = sorted([c for c in m["clinics"] if c["state"] == st], key=lambda c: (c["city"], c["name"]))
    sites = sorted([c for c in m["sites"] if c["state"] == st], key=lambda c: -len(c["studies"]))
    studies = {}
    for c in sites:
        for s in c["studies"]: studies.setdefault(s["id"], s)
    lg = [g for g in grants if st in (g.get("regions") or [])]; lsv = [g for g in services if st in (g.get("regions") or [])]
    parts = [("Home", "/"), ("Map", "/map"), (name, "")]
    def prog_li(o, kind):
        cls, lab = status_pill(o, datetime.date.today())
        return f'<li><a href="/{kind}/{esc(o["id"])}"><b>{esc(o["name"])}</b></a> <span class="muted">· {esc(o["org"])}</span> <span class="pill {cls}">{esc(lab)}</span><p class="small">{esc(o.get("forWhat", "")[:220])}{"…" if len(o.get("forWhat", "")) > 220 else ""}</p></li>'
    body = f'''<div class="wrap page">
  {crumbs(parts)}
  <div class="page-head">
    <span class="eyebrow">ALS help by state</span>
    <h1>ALS help in {esc(name)}</h1>
    <p class="intro">{len(clinics)} multidisciplinary ALS clinic{"" if len(clinics) == 1 else "s"}, {len(studies)} clinical stud{"y" if len(studies) == 1 else "ies"} with sites in {len(sites)} {"city" if len(sites) == 1 else "cities"}, and {len(lg) + len(lsv)} grant{"" if len(lg) + len(lsv) == 1 else "s"} and services that serve {esc(name)} in particular. Every nationwide program on this site applies too.</p>
    <p><a class="btn btn-primary btn-sm" href="/map?state={st}">Open the {esc(name)} map</a> <a class="btn btn-line btn-sm" href="/grants?state={st}">Grants, {esc(name)} first</a> <a class="btn btn-line btn-sm" href="/trials?state={st}">Studies with {st} sites</a></p>
  </div>
  <section class="section"><div class="sec-head"><h2>Grants and services just for {esc(name)}</h2></div>
    {'<ul class="static-list">' + "".join(prog_li(o, "grant") for o in lg) + "".join(prog_li(o, "service") for o in lsv) + "</ul>" if lg or lsv else f'<p>Nothing is listed only for {esc(name)} yet, but every nationwide program applies: see <a href="/grants">Grants</a> and <a href="/services">Services</a>. Know of a local program? <a href="/about#corrections">Tell us</a>.</p>'}
  </section>
  <section class="section"><div class="sec-head"><h2>ALS clinics and specialists in {esc(name)}</h2></div>
    {'<ul class="static-list dir-list">' + "".join(f'<li><b>{esc(c["name"])}</b>' + (f'<span class="org">{esc(c["inst"])}</span>' if c.get("inst") else "") + f'<p>{esc(", ".join(x for x in [c.get("addr"), c["city"], c["state"] + (" " + c["zip"] if c.get("zip") else "")] if x))}</p><p class="small">{esc(" · ".join(NET.get(n, n) for n in c.get("nets", [])))}</p>' + ("<p>" + " · ".join([f'<a href="tel:{esc("".join(ch for ch in c["phone"].split(",")[0] if ch.isdigit() or ch == "+"))}">{esc(c["phone"])}</a>' if c.get("phone") else "", f'<a href="{esc(c["url"])}" target="_blank" rel="noopener">Website</a>' if c.get("url") else ""]).strip(" ·") + "</p>") + "</li>" for c in clinics) + "</ul>" if clinics else f'<p>No multidisciplinary ALS clinic is listed in {esc(name)}. Try the <a href="/map">map</a> with a 200-mile search from your ZIP code, and ask your ALS Association chapter about telehealth.</p>'}
  </section>
  <section class="section"><div class="sec-head"><h2>Clinical studies with sites in {esc(name)}</h2></div>
    {'<ul class="static-list">' + "".join(f'<li><a href="/study/{esc(s["id"])}"><b>{esc(s["name"])}</b></a> <span class="muted">· {esc(ENROLL.get(s.get("enrolling"), ""))} · {esc(s.get("phase") or s.get("type") or "")}</span><p class="small">{esc("; ".join(sorted({c["city"] for c in sites if any(x["id"] == s["id"] for x in c["studies"])})))}</p></li>' for s in sorted(studies.values(), key=lambda s: s["name"])) + "</ul>" if studies else f'<p>No recruiting study lists a site in {esc(name)} right now. Some studies run from home: see <a href="/trials">Trials</a>.</p>'}
  </section>
  <p class="small muted">Clinic lists compiled {esc(fmt_date(m.get("updated")))}; grants and studies as of the dates on each listing. <a href="/about#corrections">Report a change</a>.</p>
</div>
'''
    ld = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": f"ALS help in {name}", "url": f"{site}/state/{st.lower()}",
           "description": f"ALS clinics, clinical study sites and local grants and services in {name}.", "isPartOf": {"@type": "WebSite", "name": "Alongside ALS", "url": site + "/"}}, breadcrumb_ld(site, parts)]
    desc = f"ALS clinics, study sites and {len(lg) + len(lsv)} local grants and services in {name}, plus the nationwide programs that apply everywhere. Checked against official sources."
    return f"ALS help in {name}: clinics, studies, grants and services", desc, body, ld

def build(site, wrap):
    """wrap(name_for_url, title, desc, body, jsonld, nav_key) -> writes the file; returns url. Returns list of urls."""
    today = datetime.date.today()
    grants = json.load(open("data/grants.json"))["items"]; services = json.load(open("data/services.json"))["items"]
    trials = json.load(open("data/trials.json"))["items"]; m = json.load(open("data/map.json"))
    by_state = {}
    for o in grants + services:
        for st in o.get("regions") or []: by_state.setdefault(st, []).append(o)
    for d in ("grant", "service", "study", "state"): pathlib.Path(d).mkdir(exist_ok=True)
    urls = []
    for g in grants: urls.append(wrap(f"grant/{g['id']}", *program_page(g, "grant", site, today, by_state), "grants"))
    for g in services: urls.append(wrap(f"service/{g['id']}", *program_page(g, "service", site, today, by_state), "services"))
    for t in trials: urls.append(wrap(f"study/{t['id']}", *study_page(t, site, today, trials), "trials"))
    for st in STATE_NAMES: urls.append(wrap(f"state/{st.lower()}", *state_page(st, grants, services, m, site), "map"))
    # remove detail pages whose record no longer exists (a dropped grant, an ended study)
    keep = {u[len(site) + 1:] + ".html" for u in urls}
    for d in ("grant", "service", "study", "state"):
        for f in pathlib.Path(d).glob("*.html"):
            if f.as_posix() not in keep:
                f.unlink(); print("removed stale page", f)
    return urls
