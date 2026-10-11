from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/build_data.py"


class BuilderArgumentTests(unittest.TestCase):
    def test_release_metadata_requires_all_three_arguments(self):
        result = subprocess.run([sys.executable, str(SCRIPT), "missing", "--wage-year", "2027"], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("together", result.stderr)

    def test_invalid_release_arguments_do_not_replace_existing_output(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "dataset.json"
            output.write_text("existing dataset")
            for year, published, url in [
                ("2027", "2027-02-30", "https://flag.dol.gov/data.zip"),
                ("2027", "2027-07-01", "https://evil.test/data.zip"),
                ("1999", "2027-07-01", "https://flag.dol.gov/data.zip"),
            ]:
                result = subprocess.run([sys.executable, str(SCRIPT), "missing", "--wage-year", year, "--published-on", published, "--download-url", url, "--output", str(output)], capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn("Traceback", result.stderr)
                self.assertEqual(output.read_text(), "existing dataset")

    def test_help_exposes_manual_update_flags(self):
        result = subprocess.run([sys.executable, str(SCRIPT), "--help"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        for flag in ["--wage-year", "--published-on", "--download-url"]:
            self.assertIn(flag, result.stdout)
