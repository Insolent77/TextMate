from pathlib import Path
import json, shutil, zipfile

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
VERSION = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version"]
EXCLUDE = {".git", "dist", "__pycache__", "manifest.firefox.json", "build.py"}

def copy_source(target):
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    for item in ROOT.iterdir():
        if item.name in EXCLUDE or item.name.startswith(".git"):
            continue
        if item.is_dir():
            shutil.copytree(item, target / item.name)
        else:
            shutil.copy2(item, target / item.name)

def make_zip(folder, target):
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
        for p in folder.rglob("*"):
            if p.is_file():
                z.write(p, p.relative_to(folder))

DIST.mkdir(exist_ok=True)

chromium = DIST / "chromium"
copy_source(chromium)
make_zip(chromium, DIST / f"TextMate-v{VERSION}-Chromium.zip")

firefox = DIST / "firefox"
copy_source(firefox)
ff = json.loads((ROOT / "manifest.firefox.json").read_text(encoding="utf-8"))
(firefox / "manifest.json").write_text(json.dumps(ff, ensure_ascii=False, indent=2), encoding="utf-8")
make_zip(firefox, DIST / f"TextMate-v{VERSION}-Firefox.zip")

print("Build complete.")
