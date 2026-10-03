#!/usr/bin/env python3
"""Generate every Agenthost app icon from the favicon artwork.

Kensink fork: the Agenthost mark ships as the PNG favicon set under
apps/web/public/favicon. This script derives the desktop app icons, the web
app manifest icons and the inline UI mark from its largest file, so a brand
change is: replace the favicon set, rerun this script, commit the output.

Usage (from the repo root; macOS, needs Pillow and iconutil):
    python3 scripts/kensink-icons.py
"""

import base64
import io
import os
import shutil
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "apps/web/public/favicon/ms-icon-310x310.png")
DESKTOP_BUILD = os.path.join(ROOT, "apps/desktop/build")
DESKTOP_RESOURCES = os.path.join(ROOT, "apps/desktop/resources")
WEB_ICONS = os.path.join(ROOT, "apps/web/public/icons")
UI_MARK = os.path.join(ROOT, "packages/ui/components/common/agenthost-mark.ts")

# Tile colours: a dark vertical gradient, like the upstream desktop icon.
TILE_TOP = (21, 25, 34)
TILE_BOTTOM = (39, 44, 56)
SUPERSAMPLE = 4


def fill_enclosed_holes(img: Image.Image) -> Image.Image:
    """Composite enclosed transparent pixels over white.

    The favicon was drawn for a white page: one server bar paints its dots and
    line white, the other cuts them out as transparent holes. On a dark tile the
    holes would show through, so render every enclosed hole the way the favicon
    looks on white. Gaps in the ring connect to the border and stay transparent.
    """
    w, h = img.size
    px = img.load()
    passable = lambda x, y: px[x, y][3] < 250
    outside = [[False] * h for _ in range(w)]
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        if not (0 <= x < w and 0 <= y < h) or outside[x][y] or not passable(x, y):
            continue
        outside[x][y] = True
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    for x in range(w):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a < 255 and not outside[x][y]:
                k = a / 255
                px[x, y] = tuple(round(c * k + 255 * (1 - k)) for c in (r, g, b)) + (255,)
    return img


def load_mark() -> Image.Image:
    """The mark cropped to its opaque pixels, centred on a square canvas."""
    src = fill_enclosed_holes(Image.open(SOURCE).convert("RGBA"))
    bbox = src.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    mark = src.crop(bbox)
    side = max(mark.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(mark, ((side - mark.width) // 2, (side - mark.height) // 2))
    return square


def scaled(mark: Image.Image, size: int) -> Image.Image:
    out = mark.resize((size, size), Image.LANCZOS)
    if size > mark.width:
        # Upscaling the 310px source softens edges; restore some crispness.
        out = out.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    return out


def gradient(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(size - 1, 1)
        color = tuple(round(a + (b - a) * t) for a, b in zip(TILE_TOP, TILE_BOTTOM))
        draw.line([(0, y), (size, y)], fill=color + (255,))
    return img


def desktop_icon(mark: Image.Image) -> Image.Image:
    """1024px macOS-grid tile: 824px rounded square, drop shadow, centred mark."""
    s = 1024 * SUPERSAMPLE
    inset, radius = 100 * SUPERSAMPLE, 185 * SUPERSAMPLE
    box = (inset, inset, s - inset, s - inset)

    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)

    shadow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    shadow_mask = Image.new("L", (s, s), 0)
    offset = 12 * SUPERSAMPLE
    ImageDraw.Draw(shadow_mask).rounded_rectangle(
        (box[0], box[1] + offset, box[2], box[3] + offset), radius=radius, fill=90
    )
    shadow.putalpha(shadow_mask.filter(ImageFilter.GaussianBlur(20 * SUPERSAMPLE)))

    tile = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    tile.paste(gradient(s), (0, 0), mask)
    rim = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(rim).rounded_rectangle(
        box, radius=radius, outline=(255, 255, 255, 22), width=3 * SUPERSAMPLE
    )

    icon = Image.alpha_composite(shadow, tile)
    icon = Image.alpha_composite(icon, rim)
    icon = icon.resize((1024, 1024), Image.LANCZOS)

    mark_size = 600
    m = scaled(mark, mark_size)
    icon.alpha_composite(m, ((1024 - mark_size) // 2, (1024 - mark_size) // 2))
    return icon


def full_bleed(mark: Image.Image, size: int, mark_ratio: float) -> Image.Image:
    """Opaque square for surfaces that mask the icon themselves (iOS, Android)."""
    icon = gradient(size)
    mark_size = round(size * mark_ratio)
    icon.alpha_composite(scaled(mark, mark_size), ((size - mark_size) // 2, (size - mark_size) // 2))
    return icon.convert("RGB")


def write_icns(icon: Image.Image, dest: str) -> None:
    if shutil.which("iconutil") is None:
        print("skip icon.icns: iconutil not found (run on macOS)")
        return
    with tempfile.TemporaryDirectory() as tmp:
        iconset = os.path.join(tmp, "icon.iconset")
        os.mkdir(iconset)
        for base in (16, 32, 128, 256, 512):
            icon.resize((base, base), Image.LANCZOS).save(os.path.join(iconset, f"icon_{base}x{base}.png"))
            icon.resize((base * 2, base * 2), Image.LANCZOS).save(
                os.path.join(iconset, f"icon_{base}x{base}@2x.png")
            )
        subprocess.run(["iconutil", "-c", "icns", iconset, "-o", dest], check=True)


def write_ui_mark(mark: Image.Image) -> None:
    buf = io.BytesIO()
    mark.resize((64, 64), Image.LANCZOS).save(buf, format="PNG", optimize=True)
    data = base64.b64encode(buf.getvalue()).decode("ascii")
    with open(UI_MARK, "w", encoding="utf-8") as f:
        f.write(
            "// Generated by scripts/kensink-icons.py from the Agenthost favicon. Do not edit.\n"
            "// Inlined so the mark renders identically on web and desktop without an asset route.\n"
            f'export const AGENTHOST_MARK_DATA_URI =\n  "data:image/png;base64,{data}";\n'
        )


def main() -> None:
    mark = load_mark()
    icon = desktop_icon(mark)

    icon.save(os.path.join(DESKTOP_BUILD, "icon.png"))
    icon.save(os.path.join(DESKTOP_RESOURCES, "icon.png"))
    icon.save(
        os.path.join(DESKTOP_BUILD, "icon.ico"),
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    write_icns(icon, os.path.join(DESKTOP_BUILD, "icon.icns"))
    for size in (16, 24, 32, 48, 64, 128, 256, 512):
        icon.resize((size, size), Image.LANCZOS).save(os.path.join(DESKTOP_BUILD, "icons", f"{size}x{size}.png"))

    # Web app manifest: the `any` icons reuse the desktop artwork; the maskable
    # one keeps the mark inside Android's 80% safe zone.
    icon.resize((192, 192), Image.LANCZOS).save(os.path.join(WEB_ICONS, "icon-192.png"))
    icon.resize((512, 512), Image.LANCZOS).save(os.path.join(WEB_ICONS, "icon-512.png"))
    full_bleed(mark, 512, 0.56).save(os.path.join(WEB_ICONS, "icon-maskable-512.png"))
    full_bleed(mark, 180, 0.62).save(os.path.join(WEB_ICONS, "apple-touch-icon.png"))

    write_ui_mark(mark)
    print("icons written")


if __name__ == "__main__":
    main()
