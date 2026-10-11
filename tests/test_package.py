import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("packager", ROOT / "scripts/package.py")
packager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packager)


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copytree(ROOT / "extension", self.root / "extension")
        shutil.copy(ROOT / "package.json", self.root / "package.json")

    def test_deterministic_and_allowlisted(self):
        (self.root / "extension/.env").write_text("SECRET=not-for-distribution")
        (self.root / "extension/debug.log").write_text("private test data")
        first = packager.package(self.root).read_bytes()
        second = packager.package(self.root).read_bytes()
        self.assertEqual(first, second)
        with zipfile.ZipFile(packager.package(self.root)) as archive:
            self.assertEqual(set(archive.namelist()), set(packager.FILES))
            self.assertIsNone(archive.testzip())

    def test_manifest_drives_filename(self):
        for path in [self.root / "package.json", self.root / "extension/manifest.json"]:
            data = json.loads(path.read_text())
            data["version"] = "1.2.3"
            path.write_text(json.dumps(data))
        self.assertEqual(packager.package(self.root).name, "oflc-wage-lens-1.2.3.zip")

    def test_mismatched_versions_fail(self):
        (self.root / "package.json").write_text('{"version":"9.9.9"}')
        with self.assertRaisesRegex(ValueError, "versions must match"):
            packager.package(self.root)

    def test_symlinked_runtime_asset_fails(self):
        target = self.root / "extension/core.js"
        target.unlink()
        target.symlink_to(self.root / "package.json")
        with self.assertRaisesRegex(ValueError, "symlink"):
            packager.package(self.root)

    def test_missing_runtime_asset_fails(self):
        (self.root / "extension/core.js").unlink()
        with self.assertRaises(FileNotFoundError):
            packager.package(self.root)


if __name__ == "__main__":
    unittest.main()
