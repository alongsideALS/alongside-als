"""Weekly link check for grants and services. Does not change any listing; it writes _src/link-report.json
and prints a Markdown summary (the workflow turns that into a GitHub issue when something needs a look).

A listing is flagged when its page is gone (404/410), its site cannot be reached, it now redirects to a
different domain, or the page text says the program is closed / paused / no longer available.
Sites that block automated requests (403, 429) are listed separately as "could not check".
"""
import json, re, sys, ssl, pathlib, os, datetime, urllib.request, urllib.error, urllib.parse, html

SRC = pathlib.Path(__file__).resolve().parent
os.chdir(SRC.parent)
UA = "Mozilla/5.0 (compatible; alongside-als.org link check; +https://alongside-als.org/about)"
CLOSED_RE = re.compile(r"applications? (are|is) (currently )?(closed|paused|suspended|on hold)|no longer (accepting|available|offer)|program (has )?(ended|been discontinued)|reached (our )?capacity|not accepting (new )?applications", re.I)
ctx = ssl.create_default_context()

def fetch(url):
    req = urllib.request.Request(url, headers={"user-agent": UA, "accept": "text/html,*/*"})
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
            body = r.read(400_000).decode("utf-8", "replace")
            return r.status, r.geturl(), body
    except urllib.error.HTTPError as e:
        return e.code, e.geturl() if hasattr(e, "geturl") else url, ""
    except Exception as e:
        return 0, url, str(e)

def host(u):
    h = urllib.parse.urlsplit(u).netloc.lower()
    return h[4:] if h.startswith("www.") else h

def main():
    today = datetime.date.today().isoformat()
    items = []
    for kind in ("grants", "services"):
        for g in json.load(open(f"data/{kind}.json"))["items"]:
            items.append((kind, g))
    report = {"date": today, "checked": 0, "problems": [], "unreachable": [], "ok": 0}
    for kind, g in items:
        url = g.get("url")
        if not url: continue
        code, final, body = fetch(url); report["checked"] += 1
        text = html.unescape(re.sub(r"<[^>]+>", " ", body)) if body else ""
        row = {"kind": kind, "id": g["id"], "name": g["name"], "url": url, "code": code, "finalUrl": final}
        if code in (403, 429, 503) or (code == 0 and "timed out" in body.lower()):
            report["unreachable"].append(row); continue
        if code == 0 or code >= 400:
            row["why"] = f"HTTP {code}" if code else f"could not connect ({body[:80]})"; report["problems"].append(row); continue
        if host(final) != host(url):
            row["why"] = f"now redirects to {host(final)}"; report["problems"].append(row); continue
        m = CLOSED_RE.search(text)
        if m and g.get("status") in ("open", "rolling", "window"):
            row["why"] = f'page says "{text[max(0, m.start() - 40):m.end() + 40].strip()}"'; report["problems"].append(row); continue
        report["ok"] += 1
    json.dump(report, open(SRC / "link-report.json", "w"), ensure_ascii=False, indent=1)
    # Markdown for the issue
    out = [f"Link check {today}: {report['checked']} listings checked, {report['ok']} fine, {len(report['problems'])} need a look, {len(report['unreachable'])} could not be checked automatically.", ""]
    if report["problems"]:
        out.append("## Needs a look"); out.append("")
        for r in report["problems"]:
            out.append(f"- **{r['name']}** (`{r['kind']}/{r['id']}`): {r['why']} — {r['url']}")
        out.append("")
    if report["unreachable"]:
        out.append("## Could not check (site blocks automated requests)"); out.append("")
        for r in report["unreachable"]:
            out.append(f"- {r['name']} (`{r['kind']}/{r['id']}`): HTTP {r['code']} — {r['url']}")
    md = "\n".join(out)
    (SRC / "link-report.md").write_text(md + "\n")
    print(md)
    # exit code 2 tells the workflow to open an issue
    sys.exit(2 if report["problems"] else 0)

if __name__ == "__main__":
    main()
