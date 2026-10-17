from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "test-fixtures" / "v2" / "research-figure.png"


image = Image.new("RGB", (800, 420), "#f4efe3")
draw = ImageDraw.Draw(image)
boxes = [
    (70, 150, 250, 250, "Question", "#d7e6dc", "#4f7f64"),
    (310, 150, 490, 250, "Source", "#e9ddc7", "#b59f7c"),
    (550, 150, 730, 250, "Note", "#d7e0ee", "#496b9b"),
]
for left, top, right, bottom, label, fill, outline in boxes:
    draw.rounded_rectangle((left, top, right, bottom), radius=16, fill=fill, outline=outline, width=5)
    bounds = draw.textbbox((0, 0), label)
    draw.text(((left + right - bounds[2]) / 2, (top + bottom - bounds[3]) / 2), label, fill="#222222")
for start, end in [((250, 200), (310, 200)), ((490, 200), (550, 200))]:
    draw.line((start, end), fill="#333333", width=8)
image.save(OUT, "PNG")
print(OUT)
