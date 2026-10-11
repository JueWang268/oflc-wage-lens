"""Package only reviewed runtime assets, with stable ZIP metadata."""
import argparse
import json
from pathlib import Path
import re
import zipfile

FILES = (
    "manifest.json", "background.js", "monitor.js", "core.js", "content.js", "icons.js",
    "panel.css", "data/software-developers.json", "icons/icon-48.png",
    "icons/icon-96.png", "LUCIDE-LICENSE.txt",
)


def package(root, output=None):
    root = Path(root)
    source = root / "extension"
    manifest = json.loads((source / "manifest.json").read_text())
    version = manifest["version"]
    if not re.fullmatch(r"\d+(?:\.\d+){0,3}", version):
        raise ValueError("Unsupported manifest version")
    if json.loads((root / "package.json").read_text())["version"] != version:
        raise ValueError("package.json and manifest.json versions must match")
    files = list(FILES)
    for name in ("LICENSE", "PRIVACY.md", "THIRD_PARTY_NOTICES.md", "UPDATING_DATA.md"):
        if (root / name).is_file():
            files.append(name)
    contents = {}
    for name in files:
        path = source / name if name in FILES else root / name
        if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
            raise ValueError(f"Refusing symlink/outside asset: {name}")
        contents[name] = path.read_bytes()
    destination = Path(output) if output else root / f"dist/oflc-wage-lens-{version}.zip"
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in sorted(contents.items()):
            entry = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, content)
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    print(package(Path(__file__).resolve().parents[1], args.output))
