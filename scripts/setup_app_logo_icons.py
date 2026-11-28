#!/usr/bin/env python3
"""
Comprehensive App Logo & Icon Generator for Disha PYQ
Generates all Android mipmap launcher icons, adaptive icons, splash screens,
and Web PWA/favicons from the master brand artwork.
"""

import os
from PIL import Image, ImageDraw

PROJECT_DIR = '/data/user/0/ai.antigem/files/home/projects/Disha-'
SOURCE_IMAGE_PATH = '/data/user/0/ai.antigem/files/home/.gemini/antigravity-cli/brain/316abe54-f53f-4cd7-80eb-79897d5f93c0/.user_uploaded/media_1795845688204_a4f403eb.jpg'
BRAND_BG_COLOR = (19, 14, 38) # #130E26

def make_squircle_image(src_img):
    """Applies a smooth antialiased squircle mask to the source image."""
    w, h = src_img.size
    rgba = src_img.convert('RGBA')
    
    scale = 4
    big_w, big_h = w * scale, h * scale
    mask_big = Image.new('L', (big_w, big_h), 0)
    draw = ImageDraw.Draw(mask_big)
    radius_big = int(235 * scale)
    draw.rounded_rectangle([0, 0, big_w - 1, big_h - 1], radius=radius_big, fill=255)
    mask = mask_big.resize((w, h), Image.Resampling.LANCZOS)
    
    rgba.putalpha(mask)
    return rgba

def make_round_image(src_img):
    """Applies a smooth antialiased circular mask to the source image."""
    w, h = src_img.size
    rgba = src_img.convert('RGBA')
    
    scale = 4
    big_w, big_h = w * scale, h * scale
    mask_big = Image.new('L', (big_w, big_h), 0)
    draw = ImageDraw.Draw(mask_big)
    draw.ellipse([0, 0, big_w - 1, big_h - 1], fill=255)
    mask = mask_big.resize((w, h), Image.Resampling.LANCZOS)
    
    rgba.putalpha(mask)
    return rgba

def make_adaptive_foreground(squircle_img, canvas_size):
    """
    Android adaptive icon foreground (108dp canvas with ~70% safe zone).
    Places the squircle icon centered on a transparent canvas.
    """
    canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    # Safe zone scale: ~70% of canvas
    icon_size = int(canvas_size * 0.70)
    resized_icon = squircle_img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    offset = (canvas_size - icon_size) // 2
    canvas.paste(resized_icon, (offset, offset), resized_icon)
    return canvas

def make_splash_screen(squircle_img, width, height):
    """
    Generates an Android splash screen with brand background (#130E26)
    and the brand logo centered with responsive scaling.
    """
    canvas = Image.new('RGBA', (width, height), BRAND_BG_COLOR + (255,))
    
    # Target logo dimension: ~38% of the smaller dimension, capped at 480px
    target_dim = min(int(min(width, height) * 0.42), 480)
    resized_logo = squircle_img.resize((target_dim, target_dim), Image.Resampling.LANCZOS)
    
    offset_x = (width - target_dim) // 2
    offset_y = (height - target_dim) // 2
    canvas.paste(resized_logo, (offset_x, offset_y), resized_logo)
    return canvas

def main():
    print(f"Loading master source image from {SOURCE_IMAGE_PATH}...")
    src_img = Image.open(SOURCE_IMAGE_PATH)
    squircle_img = make_squircle_image(src_img)
    round_img = make_round_image(src_img)
    print("Master masks generated successfully.")

    # 1. Android Mipmap Densities
    mipmap_configs = [
        ('mdpi', 48, 108),
        ('hdpi', 72, 162),
        ('xhdpi', 96, 216),
        ('xxhdpi', 144, 324),
        ('xxxhdpi', 192, 432),
    ]

    res_base = os.path.join(PROJECT_DIR, 'android/app/src/main/res')
    for density, icon_size, fg_size in mipmap_configs:
        folder = os.path.join(res_base, f'mipmap-{density}')
        os.makedirs(folder, exist_ok=True)
        
        # Standard launcher icon
        std_icon = squircle_img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        std_icon.save(os.path.join(folder, 'ic_launcher.png'), 'PNG')
        
        # Round launcher icon
        rnd_icon = round_img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        rnd_icon.save(os.path.join(folder, 'ic_launcher_round.png'), 'PNG')
        
        # Adaptive foreground
        fg_icon = make_adaptive_foreground(squircle_img, fg_size)
        fg_icon.save(os.path.join(folder, 'ic_launcher_foreground.png'), 'PNG')
        
        print(f"  [Android] Generated mipmap-{density} (icon: {icon_size}x{icon_size}, fg: {fg_size}x{fg_size})")

    # 2. Android Splash Screens
    splash_configs = [
        ('drawable/splash.png', 480, 800),
        ('drawable-port-mdpi/splash.png', 320, 480),
        ('drawable-port-hdpi/splash.png', 480, 800),
        ('drawable-port-xhdpi/splash.png', 720, 1280),
        ('drawable-port-xxhdpi/splash.png', 960, 1600),
        ('drawable-port-xxxhdpi/splash.png', 1280, 1920),
        ('drawable-land-mdpi/splash.png', 480, 320),
        ('drawable-land-hdpi/splash.png', 800, 480),
        ('drawable-land-xhdpi/splash.png', 1280, 720),
        ('drawable-land-xxhdpi/splash.png', 1600, 960),
        ('drawable-land-xxxhdpi/splash.png', 1920, 1280),
    ]

    for rel_path, sw, sh in splash_configs:
        target_path = os.path.join(res_base, rel_path)
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        splash_img = make_splash_screen(squircle_img, sw, sh)
        splash_img.save(target_path, 'PNG')
        print(f"  [Splash] Generated {rel_path} ({sw}x{sh})")

    # 3. Web & PWA Assets
    public_dir = os.path.join(PROJECT_DIR, 'public')
    os.makedirs(public_dir, exist_ok=True)

    # brand-logo.png (512x512)
    logo_512 = squircle_img.resize((512, 512), Image.Resampling.LANCZOS)
    logo_512.save(os.path.join(public_dir, 'brand-logo.png'), 'PNG')
    logo_512.save(os.path.join(public_dir, 'pwa-512x512.png'), 'PNG')
    
    # pwa-192x192.png
    logo_192 = squircle_img.resize((192, 192), Image.Resampling.LANCZOS)
    logo_192.save(os.path.join(public_dir, 'pwa-192x192.png'), 'PNG')
    logo_192.save(os.path.join(public_dir, 'favicon.png'), 'PNG')
    
    # Maskable PWA icons (with ~12% safe-zone margin)
    def make_maskable(size):
        canvas = Image.new('RGBA', (size, size), BRAND_BG_COLOR + (255,))
        inner_dim = int(size * 0.78)
        inner_icon = squircle_img.resize((inner_dim, inner_dim), Image.Resampling.LANCZOS)
        offset = (size - inner_dim) // 2
        canvas.paste(inner_icon, (offset, offset), inner_icon)
        return canvas

    maskable_512 = make_maskable(512)
    maskable_512.save(os.path.join(public_dir, 'pwa-maskable-512x512.png'), 'PNG')

    maskable_192 = make_maskable(192)
    maskable_192.save(os.path.join(public_dir, 'pwa-maskable-192x192.png'), 'PNG')

    # Apple touch icon (180x180)
    apple_icon = squircle_img.resize((180, 180), Image.Resampling.LANCZOS)
    apple_icon.save(os.path.join(public_dir, 'apple-touch-icon.png'), 'PNG')

    # Favicons (32x32, 16x16)
    fav_32 = squircle_img.resize((32, 32), Image.Resampling.LANCZOS)
    fav_32.save(os.path.join(public_dir, 'favicon-32x32.png'), 'PNG')

    fav_16 = squircle_img.resize((16, 16), Image.Resampling.LANCZOS)
    fav_16.save(os.path.join(public_dir, 'favicon-16x16.png'), 'PNG')

    # Favicon.ico multi-resolution
    fav_48 = squircle_img.resize((48, 48), Image.Resampling.LANCZOS)
    fav_32.save(
        os.path.join(public_dir, 'favicon.ico'),
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[fav_16, fav_48]
    )

    # 4. Play Store 512x512 High-Res Icon
    playstore_dir = os.path.join(PROJECT_DIR, 'playstore-release')
    os.makedirs(playstore_dir, exist_ok=True)
    playstore_icon = squircle_img.resize((512, 512), Image.Resampling.LANCZOS)
    playstore_icon.save(os.path.join(playstore_dir, 'Disha-PYQ-Icon-512x512.png'), 'PNG')
    playstore_icon.save(os.path.join(PROJECT_DIR, 'Disha-PYQ-Icon-512x512.png'), 'PNG')

    print("All Web & PWA assets generated successfully.")

if __name__ == '__main__':
    main()
