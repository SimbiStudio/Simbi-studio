"""Transparent 1080x1920 text overlays for the Sin testigos reel.

Brand rules: Instrument Sans 600 in paper (#F6F2EC), centered in the top third;
numbers in Archivo width 125; everything inside the Instagram safe zone
(nothing in the bottom 20 %, nothing glued to the top).
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
PAPER = (0xF6, 0xF2, 0xEC, 255)
FONTS = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("fonts")
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("overlays")
OUT.mkdir(parents=True, exist_ok=True)

SAFE_TOP = 250          # clear of the reel header / progress bar
SAFE_BOTTOM = int(H * 0.80)  # nothing below this line
MARGIN_X = 90


def instrument(size, weight=600):
    f = ImageFont.truetype(str(FONTS / "InstrumentSans-VF.ttf"), size)
    f.set_variation_by_axes([100, weight])  # wdth, wght
    return f


def archivo(size, weight=800, width=125):
    f = ImageFont.truetype(str(FONTS / "Archivo-VF.ttf"), size)
    f.set_variation_by_axes([weight, width])  # wght, wdth
    return f


def wrap(text, font, max_w):
    """Greedy wrap, then rebalance two-line blocks so no line is left with a lone word."""
    lines = _greedy(text, font, max_w)
    if len(lines) == 2:
        words = text.split()
        best = min(
            (max(font.getlength(" ".join(words[:i])), font.getlength(" ".join(words[i:]))), i)
            for i in range(1, len(words))
        )
        lines = [" ".join(words[:best[1]]), " ".join(words[best[1]:])]
    return lines


def _greedy(text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if font.getlength(test) <= max_w or not cur:
            cur = test
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def shadowed(layer):
    """Soft dark shadow under the text so it reads on any frame."""
    alpha = layer.split()[3]
    shadow = Image.new("RGBA", layer.size, (20, 18, 23, 0))
    shadow.putalpha(alpha.filter(ImageFilter.GaussianBlur(14)).point(lambda a: int(a * 0.75)))
    out = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    out.alpha_composite(shadow)
    out.alpha_composite(layer)
    return out


def headline(name, text, size=84, center_y=None):
    """Centered block of text, vertically centered in the top third by default."""
    font = instrument(size)
    lines = wrap(text, font, W - 2 * MARGIN_X)
    lh = int(size * 1.15)
    block_h = lh * len(lines)
    cy = center_y if center_y is not None else (SAFE_TOP + H // 3) // 2 + 60
    y = max(SAFE_TOP, cy - block_h // 2)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for ln in lines:
        d.text((W // 2, y), ln, font=font, fill=PAPER, anchor="ma")
        y += lh
    shadowed(layer).save(OUT / f"{name}.png")


def number(n):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.text((MARGIN_X, SAFE_TOP + 20), str(n), font=archivo(300), fill=PAPER, anchor="la")
    shadowed(layer).save(OUT / f"num{n}.png")


def credit():
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.text((W // 2, SAFE_BOTTOM - 30), "Sin testigos, corto de la UNLP",
           font=instrument(40, 500), fill=PAPER, anchor="md")
    shadowed(layer).save(OUT / "credit.png")


# Hook over the burning report
headline("t_hook1", "Esta escena no se filmó.")
headline("t_hook2", "Hay tres más. ¿Cuáles?")
# Avatar parts: subtitles at chest height so they never cover the face
SUB_Y = int(H * 0.62)
headline("t_proof", "Una IA analizó el corto y no encontró ninguna.", size=72, center_y=SUB_Y)
# Avatar part 3, subtitles in three beats
headline("t_close1", "Comentá los tres números", size=80, center_y=SUB_Y)
headline("t_close2", "y mañana te mostramos cuáles eran.", size=72, center_y=SUB_Y)
headline("t_close3", "Ah, y yo tampoco soy real.", size=72, center_y=SUB_Y)
# Scene numbers + credit
for i in range(1, 7):
    number(i)
credit()
# Cover text, centered on the frame
headline("t_cover", "¿Cuáles son IA?", size=110, center_y=H // 2)
print("overlays ->", OUT)
