"""Optional asset regeneration: python -m pip install fonttools==4.60.1.

Run locally, never on ECS. Generated assets are committed; npm builds need no Python.
Keep the original font URL for older open editor tabs and keep its OFL license.
"""
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont, instantiateOTL, NormalizedAxisLimits

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/fonts/NotoSansSC.ttf"
OUTPUT = ROOT / "public/fonts/text-600-v1"


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    font = TTFont(SOURCE, recalcTimestamp=False)
    # OpenType.js previously used the default GPOS kerning, even with wght=600.
    # Freeze that layout first, preserving existing label spacing and fit checks.
    instantiateOTL(font, NormalizedAxisLimits({axis.axisTag: 0 for axis in font["fvar"].axes}))
    font = instantiateVariableFont(font, {"wght": 600}, inplace=True)
    pages = {}
    for codepoint in sorted(font.getBestCmap()):
        pages.setdefault(codepoint >> 8, []).append(codepoint)
    buffer = BytesIO()
    font.save(buffer)
    static_bytes = buffer.getvalue()
    manifest = {"version": 1, "weight": 600, "pages": {}}
    total = 0
    for page, codepoints in pages.items():
        part = TTFont(BytesIO(static_bytes), recalcTimestamp=False)
        options = subset.Options()
        options.hinting = False  # Screen hinting is unnecessary for physical outlines.
        options.recalc_timestamp = False
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(unicodes=codepoints)
        subsetter.subset(part)
        for record in part["name"].names:
            names = {1: "Digital Bricks Text", 2: "SemiBold", 3: "DigitalBricksText-600-v1",
                     4: "Digital Bricks Text SemiBold", 6: "DigitalBricksText-SemiBold"}
            if record.nameID in names:
                record.string = names[record.nameID].encode(record.getEncoding())
        output = BytesIO()
        part.save(output)
        data = output.getvalue()
        filename = f"{page:x}-{sha256(data).hexdigest()[:12]}.ttf"
        (OUTPUT / filename).write_bytes(data)
        manifest["pages"][f"{page:x}"] = filename
        total += len(data)
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Generated {len(pages)} pages, {total:,} bytes total; original {SOURCE.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
