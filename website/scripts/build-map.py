"""Join current Census county polygons to exact OFLC county/state names.

Never fuzzy-match counties or invent a wage for a missing/ambiguous geography.
"""
import argparse
import hashlib
import json
import unicodedata
from pathlib import Path
import shapefile

ROOT = Path(__file__).resolve().parents[1]

def normalize(name):
    return ''.join(c for c in unicodedata.normalize('NFKD', name).lower()
                   if c.isalnum() or c == ' ').strip()

def build(wages_path, boundaries_path, output, boundary_year=2025, snapshot='October 2026'):
    wages = json.loads(wages_path.read_text())
    index = {}
    for area in wages['areas'].values():
        for county in area['counties']:
            key = (county['state'], normalize(county['name']))
            index.setdefault(key, set()).add(area['id'])
    features, missing, states = [], [], {}
    for record in shapefile.Reader(str(boundaries_path)).iterShapeRecords():
        row = record.record.as_dict()
        state, name = row['STUSPS'], row['NAMELSAD']
        # The map uses the standard 50-state/DC Albers projection. Territories
        # are not silently counted as missing or projected to the wrong place.
        if state in ('PR', 'VI', 'GU', 'MP', 'AS'):
            continue
        states[state] = row['STATE_NAME']
        matches = index.get((state, normalize(name)), set())
        area_id = next(iter(matches)) if len(matches) == 1 else None
        if not area_id:
            missing.append({'fips': row['GEOID'], 'name': name, 'state': state,
                            'reason': 'ambiguous' if matches else 'unmatched'})
        geometry = record.shape.__geo_interface__
        features.append({'type': 'Feature', 'id': row['GEOID'],
                         'properties': {'name': name, 'state': state, 'area': area_id},
                         'geometry': geometry})
    meta = dict(wages['meta'], snapshot=snapshot, boundaryYear=boundary_year,
                boundarySource=f'https://www2.census.gov/geo/tiger/GENZ{boundary_year}/shp/{boundaries_path.name}',
                boundarySha256=hashlib.sha256(boundaries_path.read_bytes()).hexdigest(),
                coverage='50 states & District of Columbia; county equivalents included',
                unmatched=missing)
    state_features = []
    for record in shapefile.Reader(str(boundaries_path.with_name(boundaries_path.name.replace('_county_', '_state_')))).iterShapeRecords():
        row = record.record.as_dict()
        if row['STUSPS'] in states:
            state_features.append({'type': 'Feature', 'id': row['STUSPS'],
                                   'geometry': record.shape.__geo_interface__,
                                   'properties': {'name': row['NAME']}})
    result = {'meta': meta, 'states': states, 'areas': wages['areas'],
              'stateShapes': {'type': 'FeatureCollection', 'features': state_features},
              'counties': {'type': 'FeatureCollection', 'features': features}}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, separators=(',', ':')))
    print(f'{len(features)} counties; {len(features)-len(missing)} exact joins; {len(missing)} unmatched/ambiguous')
    print(json.dumps(missing))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--wages', type=Path, default=ROOT/'source-data/software-developers.json')
    parser.add_argument('--boundaries', type=Path, default=ROOT/'source-data/cb_2025_us_county_5m.zip')
    parser.add_argument('--output', type=Path, default=ROOT/'dist/data/counties.json')
    parser.add_argument('--boundary-year', type=int, default=2025)
    parser.add_argument('--snapshot', default='October 2026')
    args = parser.parse_args()
    build(args.wages, args.boundaries, args.output, args.boundary_year, args.snapshot)
