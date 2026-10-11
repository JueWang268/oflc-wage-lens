"""Build a small, auditable offline dataset from the user's unmodified OFLC CSVs."""
import argparse
import csv
import hashlib
import json
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "extension/data/software-developers.json")
parser.add_argument("--wage-year", type=int, help="Starting year, e.g. 2026 for July 2026-June 2027")
parser.add_argument("--published-on", help="Official listing revision date, YYYY-MM-DD")
parser.add_argument("--download-url", help="Exact official HTTPS ZIP link from the DOL listing")
args = parser.parse_args()
year = args.wage_year or 2026
release = None
if any(value is not None for value in (args.wage_year, args.published_on, args.download_url)):
    if not all(value is not None for value in (args.wage_year, args.published_on, args.download_url)):
        parser.error("Provide --wage-year, --published-on and --download-url together")
    if not 2000 <= year <= 2099:
        parser.error("Unsupported wage year")
    try:
        published = date.fromisoformat(args.published_on).isoformat()
    except ValueError:
        parser.error("--published-on must be a valid ISO date")
    url = urlparse(args.download_url)
    if url.scheme != "https" or url.netloc != "flag.dol.gov" or not url.path.endswith(".zip") or url.fragment:
        parser.error("Use an official https://flag.dol.gov/ ZIP link without a fragment")
    release = {"start": f"{year}-07-01", "end": f"{year+1}-06-30", "updated": published, "url": args.download_url}

def rows(name):
    with (args.source / name).open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))

crosswalk = [r for r in rows("xwalk_plus.csv") if r["OnetCode"] == "15-1252.00"]
assert len(crosswalk) == 1 and crosswalk[0]["OES_SOCCODE"] == "15-1252"
areas = {}
for r in rows("ALC_Export.csv"):
    if r["SocCode"] != "15-1252":
        continue
    levels = [float(r[f"Level{i}"]) if r[f"Level{i}"] else None for i in range(1, 5)]
    assert r["Area"] not in areas
    assert all(v is None or v > 0 for v in levels)
    if all(v is not None for v in levels):
        assert levels == sorted(levels)
    areas[r["Area"]] = {"id": r["Area"], "levels": levels, "geoLevel": r["GeoLvl"], "label": r["Label"], "states": [], "counties": []}

states, locations, keys = {}, [], set()
def add(name, state, area, kind, label=None):
    key = (name.lower(), state, area, kind)
    if key in keys:
        return
    keys.add(key)
    locations.append({"name": name, "state": state, "area": area, "kind": kind,
                      "label": label or f"{name}, {state}"})

for r in rows("Geography.csv"):
    a = areas.get(r["Area"])
    if not a:
        continue
    a["name"] = r["AreaName"]
    state = r["StateAb"]
    states[state] = r["State"]
    if state not in a["states"]:
        a["states"].append(state)
    a["counties"].append({"name": r["CountyTownName"], "state": state})
    add(r["CountyTownName"], state, a["id"], "county")

for a in areas.values():
    assert a.get("name"), f"Missing geography for {a['id']}"
    add(a["name"], a["states"][0], a["id"], "area", a["name"])
    # Principal-city aliases resolve only to wage areas, never to an inferred county.
    if "nonmetropolitan" not in a["name"].lower() and "," in a["name"]:
        cities = a["name"].rsplit(",", 1)[0]
        for protected in ("Winston-Salem", "Wilkes-Barre"):
            cities = cities.replace(protected, protected.replace("-", "\ue000"))
        for city in cities.split("-"):
            city = city.replace("\ue000", "-").strip()
            if len(city) < 3:
                continue
            for state in a["states"]:
                add(city, state, a["id"], "city")

# Curated worksite aliases. County lists are explicit, not a fuzzy geocoder.
# A multi-county city may yield multiple candidates; the UI never invents a county.
aliases = [
    ("NYC", "NY", ["New York County"]), ("New York City", "NY", ["New York County"]),
    ("Manhattan", "NY", ["New York County"]), ("Brooklyn", "NY", ["Kings County"]),
    ("Queens", "NY", ["Queens County"]), ("Bronx", "NY", ["Bronx County"]),
    ("Staten Island", "NY", ["Richmond County"]),
    ("Redmond", "WA", ["King County"]), ("Kirkland", "WA", ["King County"]),
    ("Mountain View", "CA", ["Santa Clara County"]), ("Palo Alto", "CA", ["Santa Clara County"]),
    ("Cupertino", "CA", ["Santa Clara County"]), ("Menlo Park", "CA", ["San Mateo County"]),
    ("Redwood City", "CA", ["San Mateo County"]), ("Foster City", "CA", ["San Mateo County"]),
    ("South San Francisco", "CA", ["San Mateo County"]), ("Santa Monica", "CA", ["Los Angeles County"]),
    ("Culver City", "CA", ["Los Angeles County"]), ("Irvine", "CA", ["Orange County"]),
    ("Irving", "TX", ["Dallas County"]), ("Plano", "TX", ["Collin County", "Denton County"]),
    ("Frisco", "TX", ["Collin County", "Denton County"]),
    ("Reston", "VA", ["Fairfax County"]), ("McLean", "VA", ["Fairfax County"]),
    ("Herndon", "VA", ["Fairfax County"]), ("Tysons", "VA", ["Fairfax County"]),
    ("Hoboken", "NJ", ["Hudson County"]), ("Weehawken", "NJ", ["Hudson County"]),
    ("Jersey City", "NJ", ["Hudson County"]), ("Durham", "NC", ["Durham County"]),
    ("Cary", "NC", ["Wake County", "Chatham County"]), ("Alpharetta", "GA", ["Fulton County"]),
    ("Bentonville", "AR", ["Benton County"]), ("Broomfield", "CO", ["Broomfield County"]),
]
for city, state, counties in aliases:
    for county in counties:
        matches = [a for a in areas.values() if {"name": county, "state": state} in a["counties"]]
        assert matches, (city, state, county)
        for a in matches:
            add(city, state, a["id"], "city")

sources = ["ALC_Export.csv", "Geography.csv", "xwalk_plus.csv"]
data = {
    "meta": {"occupation": "Software Developers", "onet": "15-1252.00", "soc": "15-1252",
             "wageYear": f"{year}-{str(year+1)[-2:]}", "validFrom": f"{year}-07-01", "validThrough": f"{year+1}-06-30",
             "industry": "All industries", "annualHours": 2080,
             "sourceUrl": "https://flag.dol.gov/wage-data/wage-data-downloads",
             "sourceHashes": {name: hashlib.sha256((args.source / name).read_bytes()).hexdigest() for name in sources}},
    "states": states, "areas": areas, "locations": sorted(locations, key=lambda r: (r["state"], r["name"], r["area"]))
}
if release:
    data["meta"]["sourceRelease"] = release
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
print(f"Built {len(areas)} wage areas and {len(locations)} location aliases: {args.output}")
