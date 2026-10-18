import csv
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('builder', Path(__file__).resolve().parents[1]/'scripts/build-occupations.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

class OccupationBuilderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name)/'source'
        self.source.mkdir()
        self.output = Path(self.temp.name)/'out'
        self.write('oes_soc_occs.csv', ['soccode','Title'], [['15-1252','Software Developers'],['25-1011','Business Teachers']])
        self.write('xwalk_plus.csv', ['OES_SOCCODE','OES_SOCTITLE','OnetCode','ONetTitle'], [
            ['15-1252','Software Developers','15-1252.00','Software Developers'],
            ['25-1011','Business Teachers','25-1011.00','Business Teachers']])

    def write(self, name, headers, rows):
        with (self.source/name).open('w',newline='') as stream:
            writer = csv.writer(stream)
            writer.writerow(headers)
            writer.writerows(rows)

    def wages(self, rows):
        self.write('ALC_Export.csv', ['Area','SocCode','Level1','Level2','Level3','Level4','Label'], rows)

    def test_units_labels_and_crosswalk_are_preserved(self):
        self.wages([['100','15-1252',40,50,60,70,''],['100','25-1011',70000,79073,88147,97220,'Annual Wage'],['101','25-1011','','','','','High Wage']])
        builder.build(self.source,self.output)
        catalog = json.loads((self.output/'occupations.json').read_text())
        self.assertEqual(catalog['default'],'15-1252')
        self.assertEqual(catalog['occupations'][0]['onet'][0]['code'],'15-1252.00')
        self.assertEqual(len(catalog['sourceHashes']['ALC_Export.csv']),64)
        annual = json.loads((self.output/'occupations/25-1011.json').read_text())['areas']
        self.assertEqual(annual['100']['unit'],'year')
        self.assertEqual(annual['100']['levels'],[70000,79073,88147,97220])
        self.assertEqual(annual['101']['levels'],[None]*4)
        self.assertEqual(annual['101']['label'],'High Wage')

    def test_rejects_unknown_flags_and_invalid_levels(self):
        for levels,label in [([1,2,3,4],'Mystery'),([1,3,2,4],''),([1,2,'',4],'')]:
            with self.subTest(label=label,levels=levels):
                self.wages([['100','15-1252',*levels,label]])
                with self.assertRaises(ValueError):builder.build(self.source,self.output)

    def test_rejects_duplicate_rows(self):
        row=['100','15-1252',40,50,60,70,'']
        self.wages([row,row])
        with self.assertRaises(ValueError):builder.build(self.source,self.output)

if __name__=='__main__':unittest.main()
