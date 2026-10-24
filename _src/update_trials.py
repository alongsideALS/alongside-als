"""Refresh data/trials.json from a ClinicalTrials.gov API v2 snapshot (ct-raw.json).

Usage: python3 update_trials.py /path/to/ct-raw.json [--include NCT... NCT...] [--drop NCT...]
- Existing records: status, dates, locations, contacts and registry date are refreshed; curated
  fields (name, type, phase, plain text, hand-checked notes) are kept.
- New records: only the NCT ids passed with --include are added (the broad query also returns
  SMA, FTD, "advanced life support" training studies and other noise).
- Records no longer in the snapshot are dropped (they are completed, withdrawn, terminated or unknown).
"""
import json, sys, re, datetime

TODAY = datetime.date.today().isoformat()
args = sys.argv[1:]
raw_path = args[0]
inc = set(); drop = set(); mode = None
for a in args[1:]:
    if a == "--include": mode = inc; continue
    if a == "--drop": mode = drop; continue
    if mode is not None: mode.add(a)

raw = {s["protocolSection"]["identificationModule"]["nctId"]: s["protocolSection"] for s in json.load(open(raw_path))["studies"]}
data = json.load(open("data/trials.json"))
old = {o["id"]: o for o in data["items"]}

STATES = {"Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE","District of Columbia":"DC","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY","Puerto Rico":"PR"}
ENROLL = {"RECRUITING": "yes", "NOT_YET_RECRUITING": "soon", "ENROLLING_BY_INVITATION": "invite", "ACTIVE_NOT_RECRUITING": "no", "AVAILABLE": "yes"}
STATUS_WORD = {"RECRUITING": "Recruiting", "NOT_YET_RECRUITING": "Not yet recruiting", "ENROLLING_BY_INVITATION": "Enrolling by invitation", "ACTIVE_NOT_RECRUITING": "Active, not recruiting", "AVAILABLE": "Available (expanded access)"}

def month_word(d):
    try: return datetime.date.fromisoformat((d + "-01")[:10]).strftime("%B %Y")
    except Exception: return d or ""

def locations(p):
    out = []
    for l in p.get("contactsLocationsModule", {}).get("locations", []):
        k = l.get("country", ""); s = l.get("state", "")
        out.append({"f": l.get("facility", ""), "c": l.get("city", ""), "s": STATES.get(s, s) if k == "United States" else s, "k": k, "st": l.get("status", "")})
    return out

def contacts(p):
    out = []
    for c in p.get("contactsLocationsModule", {}).get("centralContacts", []):
        out.append({"name": c.get("name", ""), "phone": c.get("phone", ""), "email": c.get("email", "")})
    return out

def refresh(rec, p):
    st = p["statusModule"]; status = st["overallStatus"]
    rec["status"] = status
    rec["enrolling"] = ENROLL.get(status, rec.get("enrolling"))
    rec["start"] = st.get("startDateStruct", {}).get("date", rec.get("start"))
    rec["primary"] = st.get("primaryCompletionDateStruct", {}).get("date", rec.get("primary"))
    rec["end"] = st.get("completionDateStruct", {}).get("date", rec.get("end"))
    rec["updated"] = st.get("lastUpdatePostDateStruct", {}).get("date", rec.get("updated"))
    locs = locations(p)
    if locs or not rec.get("locations"):
        rec["locations"] = locs
        rec["countries"] = sorted({l["k"] for l in locs if l["k"]})
        rec["us"] = "United States" in rec["countries"]
        rec["states"] = sorted({l["s"] for l in locs if l["k"] == "United States" and l["s"]})
        rec["sites"] = len(locs)
    cs = contacts(p)
    if cs: rec["contacts"] = cs
    rec["registryDate"] = TODAY
    return rec

def phase_of(p, typ):
    phases = p.get("designModule", {}).get("phases") or []
    if typ == "Expanded access": return "Expanded access"
    if typ == "Observational": return "Observational"
    if not phases or phases == ["NA"]:
        return "Device study" if typ == "Device" else "Non-drug study"
    m = {"EARLY_PHASE1": "Early Phase 1", "PHASE1": "Phase 1", "PHASE2": "Phase 2", "PHASE3": "Phase 3", "PHASE4": "Phase 4"}
    names = [m.get(x, x) for x in phases]
    if names == ["Phase 1", "Phase 2"]: return "Phase 1/2"
    if names == ["Phase 2", "Phase 3"]: return "Phase 2/3"
    return names[0] if names else "Phase not listed"

def type_of(p):
    d = p.get("designModule", {}); st = d.get("studyType", "")
    if st == "EXPANDED_ACCESS": return "Expanded access"
    if st == "OBSERVATIONAL": return "Observational"
    kinds = {i.get("type") for i in p.get("armsInterventionsModule", {}).get("interventions", [])}
    if "DEVICE" in kinds: return "Device"
    if kinds and kinds <= {"BEHAVIORAL", "OTHER", "PROCEDURE", "DIETARY_SUPPLEMENT", "DIAGNOSTIC_TEST"} and "DIETARY_SUPPLEMENT" not in kinds: return "Care & lifestyle"
    return "Interventional"

APPROACH = {"DRUG": "medication", "BIOLOGICAL": "a biological product", "DEVICE": "a device", "PROCEDURE": "a procedure", "BEHAVIORAL": "a behavioural approach", "DIETARY_SUPPLEMENT": "a dietary supplement", "DIAGNOSTIC_TEST": "a diagnostic test", "GENETIC": "a genetic therapy", "RADIATION": "radiation", "COMBINATION_PRODUCT": "a combination product", "OTHER": "another approach"}

def plain_of(p, typ):
    d = p.get("designModule", {}); e = p.get("eligibilityModule", {}); c = p.get("conditionsModule", {})
    conds = c.get("conditions", [])
    ivs = p.get("armsInterventionsModule", {}).get("interventions", [])
    kinds = []
    for i in ivs:
        a = APPROACH.get(i.get("type"), None)
        if a and a not in kinds: kinds.append(a)
    if typ == "Observational":
        purpose = "An observational study collecting information about the listed research conditions. Researchers do not assign a treatment as part of this study design."
    elif typ == "Expanded access":
        purpose = "An expanded access program that provides an investigational treatment outside a clinical trial to people who qualify. It is not designed to test whether the treatment works."
    else:
        pp = (d.get("designInfo", {}) or {}).get("primaryPurpose", "")
        pm = {"TREATMENT": "whether an approach could help treat a health condition", "SUPPORTIVE_CARE": "an approach to supporting comfort, function, or day-to-day care", "DIAGNOSTIC": "an approach to identifying a health condition", "DEVICE_FEASIBILITY": "whether a device can be used as intended", "BASIC_SCIENCE": "how a biological or health-related process works", "PREVENTION": "whether an approach could help prevent a health problem", "SCREENING": "a way of screening for a health condition", "HEALTH_SERVICES_RESEARCH": "how care is delivered"}
        purpose = f"An interventional study investigating {pm.get(pp, 'a health-related research question')}."
        if kinds: purpose += " Listed approaches include " + (kinds[0] if len(kinds) == 1 else ", ".join(kinds[:-1]) + " and " + kinds[-1]) + "."
    age = ""
    mn, mx = e.get("minimumAge"), e.get("maximumAge")
    if mn and mx: age = f" Age range: {mn} to {mx}."
    elif mn: age = f" Age range: {mn} and older."
    hv = e.get("healthyVolunteers")
    hvt = " Healthy volunteers may be eligible." if hv else " Healthy volunteers are not listed as eligible."
    shown = "; ".join(conds[:3]) + (" (and other listed conditions)" if len(conds) > 3 else "")
    audience = f"Listed research conditions: {shown}.{age}{hvt} Other criteria apply; the study team determines eligibility."
    if typ == "Observational":
        participation = "The structured record does not establish the full visit, testing, travel, or time commitment. Ask the study team what information or samples they collect and what is expected of participants."
    else:
        di = d.get("designInfo", {}) or {}
        bits = []
        if di.get("allocation") == "RANDOMIZED": bits.append("Assignment to a study group is by chance.")
        names = " ".join(i.get("name", "") for i in ivs).lower()
        if "placebo" in names: bits.append("The study includes a placebo comparison group.")
        elif "sham" in names: bits.append("The study includes a simulated-treatment comparison group.")
        elif (di.get("maskingInfo", {}) or {}).get("masking") in (None, "NONE"): bits.append("Treatment assignment is not blinded.")
        bits.append("Visit frequency, travel, procedures, and time commitment are not fully summarized here; confirm them with the study team.")
        participation = " ".join(bits)
    return {"purpose": purpose, "audience": audience, "participation": participation}

def new_record(nct, p):
    idm = p["identificationModule"]; typ = type_of(p)
    ivs = [i.get("name", "") for i in p.get("armsInterventionsModule", {}).get("interventions", [])]
    rec = {
        "id": nct, "name": idm.get("acronym") or None, "title": idm.get("briefTitle", ""),
        "sponsor": p.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}).get("name", ""),
        "type": typ, "phase": phase_of(p, typ),
        "interventions": ivs or (["Not applicable- observational study"] if typ == "Observational" else []),
        "placebo": any("placebo" in n.lower() for n in ivs) if typ != "Observational" else None,
        "conditions": p.get("conditionsModule", {}).get("conditions", []),
        "status": None, "enrolling": None, "start": None, "primary": None, "end": None, "updated": None,
        "countries": [], "us": False, "states": [], "sites": 0, "locations": [], "contacts": [],
        "plain": plain_of(p, typ), "master": False, "registryDate": TODAY,
        "summary": (p.get("descriptionModule", {}).get("briefSummary") or "").strip(),
        "added": TODAY,
    }
    return refresh(rec, p)

kept, dropped, changed, added = [], [], [], []
for nct, rec in old.items():
    if nct in drop or nct not in raw:
        dropped.append(nct); continue
    before = rec["status"]
    refresh(rec, raw[nct])
    if rec["status"] != before:
        changed.append((nct, before, rec["status"]))
        if rec.get("verified"):
            rec["verified"]["statusNote"] = f"{STATUS_WORD.get(rec['status'], rec['status'])} (registry updated {month_word(rec['updated'])})."
    kept.append(rec)
for nct in sorted(inc):
    if nct in old or nct not in raw: continue
    kept.append(new_record(nct, raw[nct])); added.append(nct)

data["items"] = kept
data["updated"] = TODAY
data["registrySnapshot"] = TODAY
data["source"] = f"ClinicalTrials.gov API v2 snapshot ({datetime.date.today().strftime('%b %-d, %Y')}) plus hand-checked notes (Oct 15, 2026)"
json.dump(data, open("data/trials.json", "w"), ensure_ascii=False)
print("kept", len(kept) - len(added), "added", len(added), "dropped", dropped)
print("status changes", changed)
for n in added:
    r = next(x for x in kept if x["id"] == n); print(" +", n, r["type"], "|", r["phase"], "|", r["enrolling"], "|", "US" if r["us"] else "--", "|", (r["name"] or r["title"])[:60])
