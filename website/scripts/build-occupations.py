"""Build an auditable catalog and lazy-loaded wage files from OFLC CSVs."""
import argparse
import csv
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def rows(source, name):
    with (source / name).open(encoding='utf-8-sig', newline='') as stream:
        yield from csv.DictReader(stream)

def build(source, output):
    titles = {r['soccode']: r['Title'] for r in rows(source, 'oes_soc_occs.csv')}
    crosswalk = {}
    for row in rows(source, 'xwalk_plus.csv'):
        code = row['OES_SOCCODE']
        crosswalk.setdefault(code, {})[row['OnetCode']] = row['ONetTitle']
        titles.setdefault(code, row['OES_SOCTITLE'])
    groups = {}
    for row in rows(source, 'ALC_Export.csv'):
        code, area, label = row['SocCode'], row['Area'], row['Label'].strip()
        if not re.fullmatch(r'\d{2}-\d{4}', code) or code not in titles:
            raise ValueError(f'Invalid or untitled SOC: {code}')
        if label not in ('', 'Annual Wage', 'High Wage', 'No Leveled Wage'):
            raise ValueError(f'Unrecognized OFLC label: {label}')
        levels = [float(row[f'Level{i}']) if row[f'Level{i}'] else None for i in range(1, 5)]
        if label in ('', 'Annual Wage'):
            if any(v is None or v <= 0 for v in levels) or levels != sorted(levels):
                raise ValueError(f'Invalid four-level rates: {code}/{area}')
        areas = groups.setdefault(code, {})
        if area in areas:
            raise ValueError(f'Duplicate wage row: {code}/{area}')
        areas[area] = {'levels': levels, 'unit': 'year' if label == 'Annual Wage' else 'hour', 'label': label}
    folder = output / 'occupations'
    folder.mkdir(parents=True, exist_ok=True)
    catalog = []
    for code, areas in sorted(groups.items()):
        entry = {'code': code, 'title': titles[code], 'onet': [
            {'code': key, 'title': value} for key, value in sorted(crosswalk.get(code, {}).items())]}
        catalog.append(entry)
        (folder / f'{code}.json').write_text(json.dumps({'code': code, 'title': titles[code], 'areas': areas}, separators=(',', ':')))
    names = ['ALC_Export.csv', 'oes_soc_occs.csv', 'xwalk_plus.csv']
    manifest = {'default': '15-1252', 'industry': 'All industries',
                'sourceUrl': 'https://flag.dol.gov/wage-data/wage-data-downloads',
                'sourceHashes': {name: hashlib.sha256((source/name).read_bytes()).hexdigest() for name in names},
                'occupations': catalog}
    (output/'occupations.json').write_text(json.dumps(manifest, separators=(',', ':')))
    print(f'{len(catalog)} SOC codes, {sum(len(o["onet"]) for o in catalog)} O*NET codes, {sum(len(a) for a in groups.values())} wage rows')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path, help='Directory containing unmodified OFLC wage CSVs')
    parser.add_argument('--output', type=Path, default=ROOT/'dist/data')
    args = parser.parse_args()
    build(args.source, args.output)
