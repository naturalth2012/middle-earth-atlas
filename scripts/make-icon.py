"""Generate a 180x180 market icon matching the three-body plugin's convention.

Style: dark navy rounded square, a golden ring with an inner eye, echoing the
plugin's existing icon.svg so the two representations stay visually consistent.
"""
from PIL import Image, ImageDraw
import math

SIZE = 180
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Rounded dark background with a subtle vertical gradient.
bg_top = (24, 26, 38)
bg_bottom = (12, 13, 22)
for y in range(SIZE):
    t = y / (SIZE - 1)
    c = tuple(int(bg_top[i] * (1 - t) + bg_bottom[i] * t) for i in range(3))
    d.line([(0, y), (SIZE, y)], fill=c + (255,))

# Mask to a rounded rectangle.
mask = Image.new('L', (SIZE, SIZE), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=34, fill=255)
img.putalpha(mask)

# Golden ring: thick outer stroke with a warm gradient simulation.
cx = cy = SIZE // 2
r = 58
width = 18
# Draw concentric arcs from dark gold to bright gold for a gradient feel.
for i in range(width):
    rr = r - width // 2 + i
    t = i / max(1, width - 1)
    # brighter toward the middle
    light = 1 - abs(t - 0.45) * 1.5
    light = max(0.25, min(1.0, light))
    col = (
        int(120 + 110 * light),
        int(82 + 105 * light),
        int(20 + 60 * light),
        255,
    )
    d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=col, width=1)

# Inner dark disc to create the ring hole.
inner = r - width // 2 - 2
d.ellipse([cx - inner, cy - inner, cx + inner, cy + inner], fill=(18, 18, 28, 255))

# The Eye: an almond shape with a golden iris.
eye_w, eye_h = 52, 26
d.ellipse(
    [cx - eye_w, cy - eye_h, cx + eye_w, cy + eye_h],
    outline=(226, 193, 96, 255), width=3,
)
d.ellipse([cx - 15, cy - 15, cx + 15, cy + 15], fill=(226, 193, 96, 255))
d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(18, 18, 28, 255))

# Tiny glint.
d.ellipse([cx + 5, cy - 11, cx + 9, cy - 7], fill=(255, 236, 170, 255))

out = 'assets/icon-180.png'
img.save(out, 'PNG', optimize=True)
print(f'wrote {out}: {img.size}')
