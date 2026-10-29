"""Refresh data/trials.json straight from ClinicalTrials.gov (API v2). Runs in GitHub Actions weekly.

What it does
1. Re-pulls every study already listed (status, dates, sites, contacts, registry date).
   Studies that are no longer active (completed, terminated, withdrawn, suspended, unknown) are dropped.
2. Searches the registry for active ALS / motor neuron disease studies that we do not list yet.
   A study is added automatically only when one of its listed conditions is unmistakably ALS/MND
   (e.g. "Amyotrophic Lateral Sclerosis", "Motor Neuron Disease", "Lou Gehrig"); everything else that
   the broad search returns (SMA, Kennedy's disease, FTD-only, "advanced life support" training, the
   German word "als"...) is written to _src/ct-candidates.json for a person to look at.
3. Hand-written fields (name, plain-language text, verified notes) are never touched.

Usage: python3 _src/refresh_trials.py            (writes data/trials.json, _src/ct-candidates.json)
       python3 _src/refresh_trials.py --dry-run  (fetch and report, write nothing)
"""
import json, sys, re, datetime, pathlib, os, time, urllib.request, urllib.parse, urllib.error

SRC = pathlib.Path(__file__).resolve().parent
os.chdir(SRC.parent)
sys.path.insert(0, str(SRC))
DRY = "--dry-run" in sys.argv
API = "https://clinicaltrials.gov/api/v2/studies"
ACTIVE = ["RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION", "ACTIVE_NOT_RECRUITING", "AVAILABLE"]
ALS_RE = re.compile(r"amyotrophic lateral sclerosis|motor neuron(e)? disease|lou gehrig|\bALS\b|\bMND\b|primary lateral sclerosis|progressive muscular atrophy", re.I)
NOISE_RE = re.compile(r"spinal muscular atrophy|kennedy|bulbar and spinal|SBMA|advanced life support|prostate|\bSMA\b", re.I)
TODAY = datetime.date.today().isoformat()

def get(params, tries=4):
    url = API + "?" + urllib.parse.urlencode(params, doseq=False, quote_via=urllib.parse.quote)
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"user-agent": "alongside-als.org refresh (alsalongside@gmail.com)", "accept": "application/json"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            print("  retry", i + 1, "after", e, file=sys.stderr); time.sleep(5 * (i + 1))
    raise SystemExit("ClinicalTrials.gov not reachable; leaving data untouched")

def fetch_by_ids(ids):
    """Full protocol sections for the given NCT ids (chunks of 50 keep the URL short)."""
    out = {}
    for i in range(0, len(ids), 50):
        chunk = ids[i:i + 50]
        res = get({"filter.ids": ",".join(chunk), "pageSize": 100, "format": "json"})
        for s in res.get("studies", []):
            p = s["protocolSection"]; out[p["identificationModule"]["nctId"]] = p
    return out

def search_active():
    """Every active study the registry returns for ALS-ish terms (ids + a little context)."""
    found = {}
    params = {"query.cond": '"Amyotrophic Lateral Sclerosis" OR "motor neuron disease" OR "motor neurone disease" OR ALS OR "Lou Gehrig"',
              "filter.overallStatus": ",".join(ACTIVE), "fields": "NCTId,BriefTitle,OverallStatus,Condition,StartDate,LeadSponsorName,LocationCountry",
              "pageSize": 1000, "format": "json"}
    while True:
        res = get(params)
        for s in res.get("studies", []):
            p = s["protocolSection"]; nct = p["identificationModule"]["nctId"]
            found[nct] = {"id": nct, "title": p["identificationModule"].get("briefTitle", ""), "status": p["statusModule"]["overallStatus"],
                          "conditions": p.get("conditionsModule", {}).get("conditions", []),
                          "start": p["statusModule"].get("startDateStruct", {}).get("date"),
                          "sponsor": p.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}).get("name", ""),
                          "countries": sorted({l.get("country", "") for l in p.get("contactsLocationsModule", {}).get("locations", [])})}
        tok = res.get("nextPageToken")
        if not tok: break
        params["pageToken"] = tok
    return found

def clearly_als(c):
    """True only when ALS/MND is the study's main subject: the first listed condition is ALS/MND, or the title
    names ALS and ALS is among the conditions. Studies that merely include MND in a long list of conditions
    (registries, rehab platforms, genetics panels) go to the review file instead."""
    conds = c["conditions"] or []; primary = conds[0] if conds else ""
    als = r"amyotrophic lateral sclerosis|motor neuron(e)? disease|lou gehrig|primary lateral sclerosis|\bALS\b|\bMND\b"
    if NOISE_RE.search(primary): return False
    if re.search(als, primary, re.I): return True
    if re.search(r"amyotrophic lateral sclerosis|\bALS\b", c["title"]) and any(re.search(als, x, re.I) for x in conds) and len(conds) <= 4: return True
    return False

def main():
    data = json.load(open("data/trials.json"))
    current = [t["id"] for t in data["items"]]
    reviewed_path = SRC / "ct-reviewed.json"      # ids a person has already looked at and rejected
    reviewed = set(json.load(open(reviewed_path))) if reviewed_path.exists() else set()

    print("searching registry..."); active = search_active()
    print(" ", len(active), "active studies match the broad search")
    new_ids = [n for n in active if n not in current and n not in reviewed]
    auto = sorted(n for n in new_ids if clearly_als(active[n]))
    review = sorted(n for n in new_ids if n not in auto)
    print(" ", len(auto), "clearly ALS -> added automatically;", len(review), "left for review")

    print("re-pulling", len(current), "listed studies + new ones...")
    raw = fetch_by_ids(current + auto)
    ended = [n for n in current if n not in raw or raw[n]["statusModule"]["overallStatus"] not in ACTIVE]
    for n in ended: raw.pop(n, None)
    print(" ", len(ended), "ended / no longer active:", ended)

    snap = {"studies": [{"protocolSection": p} for p in raw.values()]}
    if DRY:
        print("dry run: would add", auto, "drop", ended); return
    tmp = SRC / "ct-raw.json"; json.dump(snap, open(tmp, "w"))
    import subprocess
    cmd = [sys.executable, str(SRC / "update_trials.py"), str(tmp)]
    if auto: cmd += ["--include"] + auto
    subprocess.run(cmd, check=True); tmp.unlink()
    # short display names for auto-added studies (hand-written; keeps the long registry title out of cards and page titles)
    names_path = SRC / "trial-names.json"
    if names_path.exists():
        names = json.load(open(names_path)); d = json.load(open("data/trials.json")); n = 0
        for rec in d["items"]:
            if rec["id"] in names and rec.get("name") != names[rec["id"]]: rec["name"] = names[rec["id"]]; n += 1
        if n: json.dump(d, open("data/trials.json", "w"), ensure_ascii=False); print(" ", n, "display names applied")

    cands = [active[n] for n in review]
    json.dump({"generated": TODAY, "note": "Active registry entries the weekly refresh did not add because the ALS link is unclear. Add an id to data/trials.json (python3 _src/update_trials.py ... --include NCT...) or to _src/ct-reviewed.json to stop it reappearing.",
               "candidates": cands}, open(SRC / "ct-candidates.json", "w"), ensure_ascii=False, indent=1)
    # README freshness line
    rp = pathlib.Path("README.md")
    if rp.exists():
        g = len(json.load(open("data/grants.json"))["items"]); s = len(json.load(open("data/services.json"))["items"]); t = len(json.load(open("data/trials.json"))["items"])
        txt = re.sub(r"Data last refreshed: .*", f"Data last refreshed: {datetime.date.today().strftime('%B %-d, %Y')} ({g} grants, {s} services, {t} studies).", rp.read_text())
        rp.write_text(txt)
    print("done")

if __name__ == "__main__":
    main()
