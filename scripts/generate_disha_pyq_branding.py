#!/usr/bin/env python3
"""
Disha PYQ — Comprehensive Brand Identity & Asset Generator
Generates:
1. Master Vector SVGs (logo.svg, icon.svg, favicon.svg, icon-maskable.svg)
2. Production Web & PWA PNG Assets (brand-logo, favicon, apple-touch-icon, pwa-192, pwa-512)
3. Android Launcher & Adaptive Icons (all mipmap densities: mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
4. Android Native Splash Screens (portrait & landscape across densities)
"""

import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT_BOLD = "/system/fonts/DroidSans-Bold.ttf"
FONT_REGULAR = "/system/fonts/DroidSans.ttf"

COLOR_DARK_BG = (23, 19, 41)       # #171329
COLOR_SURFACE = (32, 27, 56)       # #201B38
COLOR_PURPLE = (112, 69, 216)      # #7045D8
COLOR_PURPLE_LIGHT = (167, 139, 250) # #A78BFA
COLOR_LAVENDER = (221, 214, 254)   # #DDD6FE
COLOR_WHITE = (255, 255, 255)      # #FFFFFF
COLOR_ACCENT = (245, 158, 11)      # #F59E0B Warm Amber

def create_master_icon(size=1024, is_maskable=False):
    """
    Creates an ultra-crisp, premium icon for Disha PYQ.
    Icon features:
    - Deep obsidian purple rounded squircle background
    - Dynamic upward directional needle & open book arcs
    - Bold 'D' monogram with integrated arrow
    - Prominent 'PYQ' badge
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    scale = size / 1024.0

    # 1. Background
    if is_maskable:
        # Full bleed background for adaptive/maskable icons
        draw.rectangle([0, 0, size, size], fill=COLOR_DARK_BG)
        # Subtle radial glow in center
        glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        glow_draw.ellipse([size * 0.15, size * 0.15, size * 0.85, size * 0.85], fill=(112, 69, 216, 40))
        img = Image.alpha_composite(img, glow)
        draw = ImageDraw.Draw(img)
    else:
        # Luxury Squircle with subtle gradient feel
        pad = int(48 * scale)
        rad = int(220 * scale)
        draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=rad, fill=COLOR_DARK_BG)
        # Crisp outer border
        draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=rad, outline=COLOR_PURPLE_LIGHT, width=int(8 * scale))

    cx = size / 2.0
    cy = size * 0.44  # Center for symbol

    # 2. Draw Symbol: Academic Book & Directional Compass Needle
    # Book Wings (Symmetrical Curves)
    wing_w = 260 * scale
    wing_h = 130 * scale
    y_base = cy + 40 * scale

    # Left Page Arc
    left_points = [
        (cx - 10 * scale, y_base),
        (cx - wing_w * 0.5, y_base + 35 * scale),
        (cx - wing_w, y_base - 10 * scale),
        (cx - wing_w * 0.85, y_base - 90 * scale),
        (cx - wing_w * 0.4, y_base - 50 * scale),
        (cx - 10 * scale, y_base - 70 * scale),
    ]
    draw.polygon(left_points, fill=COLOR_PURPLE)

    # Right Page Arc
    right_points = [
        (cx + 10 * scale, y_base),
        (cx + wing_w * 0.5, y_base + 35 * scale),
        (cx + wing_w, y_base - 10 * scale),
        (cx + wing_w * 0.85, y_base - 90 * scale),
        (cx + wing_w * 0.4, y_base - 50 * scale),
        (cx + 10 * scale, y_base - 70 * scale),
    ]
    draw.polygon(right_points, fill=COLOR_PURPLE_LIGHT)

    # Central Directional Arrow / Compass Needle (Pointing True North)
    arrow_top = cy - 230 * scale
    arrow_bot = cy + 50 * scale
    arrow_w = 64 * scale

    # Left facet of arrow (Lighter white/lavender)
    arrow_left = [
        (cx, arrow_top),
        (cx - arrow_w, cy - 20 * scale),
        (cx, arrow_bot),
        (cx - 8 * scale, cy - 10 * scale),
    ]
    draw.polygon(arrow_left, fill=COLOR_WHITE)

    # Right facet of arrow (Secondary Purple / Shaded)
    arrow_right = [
        (cx, arrow_top),
        (cx + arrow_w, cy - 20 * scale),
        (cx, arrow_bot),
        (cx + 8 * scale, cy - 10 * scale),
    ]
    draw.polygon(arrow_right, fill=COLOR_LAVENDER)

    # Spark of direction at top
    draw.ellipse([cx - 8 * scale, arrow_top - 16 * scale, cx + 8 * scale, arrow_top], fill=COLOR_WHITE)

    # 3. Typography
    try:
        font_disha = ImageFont.truetype(FONT_BOLD, int(120 * scale))
        font_pyq = ImageFont.truetype(FONT_BOLD, int(86 * scale))
    except Exception:
        font_disha = ImageFont.load_default()
        font_pyq = font_disha

    # "DISHA"
    text_disha = "DISHA"
    bbox_d = draw.textbbox((0, 0), text_disha, font=font_disha)
    w_d = bbox_d[2] - bbox_d[0]
    draw.text((cx - w_d / 2, size * 0.62), text_disha, fill=COLOR_WHITE, font=font_disha)

    # "PYQ" Badge
    text_pyq = "PYQ"
    bbox_p = draw.textbbox((0, 0), text_pyq, font=font_pyq)
    w_p = bbox_p[2] - bbox_p[0]
    h_p = bbox_p[3] - bbox_p[1]

    badge_w = w_p + 110 * scale
    badge_h = h_p + 42 * scale
    badge_x = cx - badge_w / 2
    badge_y = size * 0.77

    # Badge background
    draw.rounded_rectangle(
        [badge_x, badge_y, badge_x + badge_w, badge_y + badge_h],
        radius=int(22 * scale),
        fill=COLOR_PURPLE,
        outline=COLOR_PURPLE_LIGHT,
        width=int(5 * scale),
    )

    # Badge text
    draw.text(
        (cx - w_p / 2, badge_y + (badge_h - h_p) / 2 - 6 * scale),
        text_pyq,
        fill=COLOR_WHITE,
        font=font_pyq,
    )

    return img

def create_horizontal_logo(width=800, height=220):
    """Creates horizontal branding lockup: Emblem + 'DISHA PYQ'"""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Mini square emblem on the left
    emblem_size = 170
    emblem = create_master_icon(size=emblem_size, is_maskable=False)
    img.paste(emblem, (25, 25), emblem)

    # Text
    try:
        font_disha = ImageFont.truetype(FONT_BOLD, 74)
        font_pyq = ImageFont.truetype(FONT_BOLD, 52)
        font_sub = ImageFont.truetype(FONT_REGULAR, 23)
    except Exception:
        font_disha = ImageFont.load_default()
        font_pyq = font_disha
        font_sub = font_disha

    tx = 225
    draw.text((tx, 45), "DISHA", fill=COLOR_DARK_BG, font=font_disha)

    bbox_d = draw.textbbox((tx, 45), "DISHA", font=font_disha)
    pyq_x = bbox_d[2] + 20

    # PYQ Badge
    bbox_p = draw.textbbox((0, 0), "PYQ", font=font_pyq)
    pw = bbox_p[2] - bbox_p[0]
    ph = bbox_p[3] - bbox_p[1]
    bw = pw + 36
    bh = ph + 18
    by = 52
    draw.rounded_rectangle([pyq_x, by, pyq_x + bw, by + bh], radius=12, fill=COLOR_PURPLE)
    draw.text((pyq_x + 18, by + 4), "PYQ", fill=COLOR_WHITE, font=font_pyq)

    # Subtitle
    draw.text((tx, 132), "Previous Year Questions • Precision Prep", fill=(100, 95, 120), font=font_sub)

    return img

def create_splash_screen(width, height):
    """Creates full screen splash image with centered Disha PYQ branding"""
    img = Image.new("RGBA", (width, height), COLOR_DARK_BG)
    emblem_size = min(int(min(width, height) * 0.45), 420)
    emblem = create_master_icon(size=emblem_size, is_maskable=False)

    ex = (width - emblem_size) // 2
    ey = (height - emblem_size) // 2 - int(20 * (height / 1000.0))
    img.paste(emblem, (ex, ey), emblem)

    return img

def generate_svg_icon():
    """Generates modern scalable SVG markup for Disha PYQ"""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#221A3D"/>
      <stop offset="100%" stop-color="#141024"/>
    </linearGradient>
    <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#6D28D9"/>
    </linearGradient>
    <linearGradient id="needleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#DDD6FE"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Squircle Base -->
  <rect x="20" y="20" width="472" height="472" rx="110" fill="url(#bgGrad)" stroke="#A78BFA" stroke-width="4"/>

  <!-- Ambient Glow -->
  <circle cx="256" cy="220" r="140" fill="#7045D8" opacity="0.25" filter="url(#glow)"/>

  <!-- Left Book Wing -->
  <path d="M 250 250 Q 185 270 120 240 Q 145 190 250 210 Z" fill="#7045D8"/>

  <!-- Right Book Wing -->
  <path d="M 262 250 Q 327 270 392 240 Q 367 190 262 210 Z" fill="#A78BFA"/>

  <!-- Directional Compass Needle -->
  <path d="M 256 95 L 224 215 L 256 250 Z" fill="url(#needleGrad)"/>
  <path d="M 256 95 L 288 215 L 256 250 Z" fill="#C4B5FD"/>
  <circle cx="256" cy="95" r="5" fill="#FFFFFF"/>

  <!-- Branding Text -->
  <text x="256" y="345" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif" font-weight="900" font-size="64" fill="#FFFFFF" letter-spacing="4">DISHA</text>

  <!-- PYQ Badge -->
  <rect x="176" y="375" width="160" height="60" rx="16" fill="url(#purpleGrad)" stroke="#A78BFA" stroke-width="2.5"/>
  <text x="256" y="420" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif" font-weight="900" font-size="40" fill="#FFFFFF" letter-spacing="3">PYQ</text>
</svg>
'''

def main():
    base_dir = "/data/user/0/ai.antigem/files/home/projects/Disha-"
    public_dir = os.path.join(base_dir, "public")
    res_dir = os.path.join(base_dir, "android/app/src/main/res")

    print("🎨 [1/5] Generating Master Assets (1024x1024)...")
    master_icon = create_master_icon(1024, is_maskable=False)
    master_maskable = create_master_icon(1024, is_maskable=True)
    horizontal_logo = create_horizontal_logo()

    # Save Public PNGs
    print("📁 [2/5] Writing Web & PWA Assets to public/...")
    master_icon.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "brand-logo.png"), "PNG")
    master_icon.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "pwa-512x512.png"), "PNG")
    master_icon.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "pwa-192x192.png"), "PNG")
    master_maskable.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "pwa-maskable-512x512.png"), "PNG")
    master_maskable.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "pwa-maskable-192x192.png"), "PNG")
    master_icon.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "apple-touch-icon.png"), "PNG")
    master_icon.resize((64, 64), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "favicon.png"), "PNG")
    master_icon.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "favicon-32x32.png"), "PNG")
    master_icon.resize((16, 16), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "favicon-16x16.png"), "PNG")

    # Save ICO
    master_icon.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "favicon.ico"), format="ICO")

    # Save Vector SVGs
    svg_content = generate_svg_icon()
    with open(os.path.join(public_dir, "icon.svg"), "w") as f:
        f.write(svg_content)
    with open(os.path.join(public_dir, "logo.svg"), "w") as f:
        f.write(svg_content)
    with open(os.path.join(public_dir, "favicon.svg"), "w") as f:
        f.write(svg_content)
    with open(os.path.join(public_dir, "icon-maskable.svg"), "w") as f:
        f.write(svg_content)

    print("🤖 [3/5] Generating Android Mipmap Launcher Icons...")
    densities = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }

    for folder, size in densities.items():
        dest_folder = os.path.join(res_dir, folder)
        os.makedirs(dest_folder, exist_ok=True)

        # Standard icon
        icon_img = master_icon.resize((size, size), Image.Resampling.LANCZOS)
        icon_img.save(os.path.join(dest_folder, "ic_launcher.png"), "PNG")

        # Round icon (Circular Mask)
        round_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        mask = Image.new("L", (size, size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.ellipse([0, 0, size, size], fill=255)
        round_img.paste(icon_img, (0, 0), mask)
        round_img.save(os.path.join(dest_folder, "ic_launcher_round.png"), "PNG")

        # Foreground for adaptive icon (scaled to 72% within 108dp canvas)
        fg_canvas_size = int(size * 108.0 / 48.0 if folder == "mipmap-mdpi" else (108 * size / densities["mipmap-mdpi"]))
        fg_img = Image.new("RGBA", (fg_canvas_size, fg_canvas_size), (0, 0, 0, 0))
        emblem_scaled = master_icon.resize((int(fg_canvas_size * 0.72), int(fg_canvas_size * 0.72)), Image.Resampling.LANCZOS)
        fg_x = (fg_canvas_size - emblem_scaled.width) // 2
        fg_y = (fg_canvas_size - emblem_scaled.height) // 2
        fg_img.paste(emblem_scaled, (fg_x, fg_y), emblem_scaled)
        fg_img.save(os.path.join(dest_folder, "ic_launcher_foreground.png"), "PNG")

    print("📱 [4/5] Generating Android Native Splash Screens...")
    splash_resolutions = {
        "drawable": (480, 800),
        "drawable-port-mdpi": (320, 480),
        "drawable-port-hdpi": (480, 800),
        "drawable-port-xhdpi": (720, 1280),
        "drawable-port-xxhdpi": (960, 1600),
        "drawable-port-xxxhdpi": (1280, 1920),
        "drawable-land-mdpi": (480, 320),
        "drawable-land-hdpi": (800, 480),
        "drawable-land-xhdpi": (1280, 720),
        "drawable-land-xxhdpi": (1600, 960),
        "drawable-land-xxxhdpi": (1920, 1280),
    }

    for folder, (w, h) in splash_resolutions.items():
        dest_folder = os.path.join(res_dir, folder)
        os.makedirs(dest_folder, exist_ok=True)
        splash_img = create_splash_screen(w, h)
        splash_img.save(os.path.join(dest_folder, "splash.png"), "PNG")

    print("✨ [5/5] All Disha PYQ visual brand assets generated successfully!")

if __name__ == "__main__":
    main()
