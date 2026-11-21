#!/usr/bin/env python3
import os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from collections import deque

SRC_PATH = '/data/user/0/ai.antigem/files/home/.gemini/antigravity-cli/brain/2894181c-9537-4f99-84dd-fd5e05462642/.user_uploaded/media_1795272044664_eba7f67f.png'

print("Loading uploaded logo image from:", SRC_PATH)
src_im = Image.open(SRC_PATH).convert('RGBA')
w, h = src_im.size

# 1. Flood-fill corners outside squircle to transparent
arr = np.array(src_im)
visited = np.zeros((h, w), dtype=bool)
queue = deque()

# Add outer border pixels that are dark (black)
for x in [0, w - 1]:
    for y in range(h):
        if np.max(arr[y, x, :3]) < 25 and not visited[y, x]:
            visited[y, x] = True
            queue.append((x, y))

for y in [0, h - 1]:
    for x in range(w):
        if np.max(arr[y, x, :3]) < 25 and not visited[y, x]:
            visited[y, x] = True
            queue.append((x, y))

while queue:
    cx, cy = queue.popleft()
    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        nx, ny = cx + dx, cy + dy
        if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx]:
            if np.max(arr[ny, nx, :3]) < 25:
                visited[ny, nx] = True
                queue.append((nx, ny))

alpha = np.ones((h, w), dtype=np.uint8) * 255
alpha[visited] = 0

mask_img = Image.fromarray(alpha, mode='L')
mask_img = mask_img.filter(ImageFilter.GaussianBlur(radius=1.2))
master = src_im.copy()
master.putalpha(mask_img)

print("Master transparent squircle icon ready:", master.size)

# Helper function to generate circle-masked icon
def make_round(img, size):
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    circle_mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(circle_mask)
    draw.ellipse((0, 0, size, size), fill=255)
    rounded = resized.copy()
    current_alpha = rounded.getchannel('A')
    combined_mask = Image.fromarray(np.minimum(np.array(current_alpha), np.array(circle_mask)))
    rounded.putalpha(combined_mask)
    return rounded

# Helper for adaptive foreground: place logo scaled down inside total canvas
def make_adaptive_fg(img, total_size, icon_size):
    canvas = Image.new('RGBA', (total_size, total_size), (0, 0, 0, 0))
    resized = img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    offset = (total_size - icon_size) // 2
    canvas.paste(resized, (offset, offset), resized)
    return canvas

# Helper for maskable PWA icons (with safe-zone margin)
def make_maskable_pwa(img, size):
    bg_color = (255, 249, 239, 255) # #FFF9EF
    canvas = Image.new('RGBA', (size, size), bg_color)
    content_size = int(size * 0.76)
    offset = (size - content_size) // 2
    resized = img.resize((content_size, content_size), Image.Resampling.LANCZOS)
    canvas.paste(resized, (offset, offset), resized)
    return canvas

# 2. Save public web assets
os.makedirs('public', exist_ok=True)

# brand-logo.png (512x512)
master.resize((512, 512), Image.Resampling.LANCZOS).save('public/brand-logo.png', format='PNG')
print("Saved public/brand-logo.png")

# Favicons & Apple touch icon
master.resize((16, 16), Image.Resampling.LANCZOS).save('public/favicon-16x16.png', format='PNG')
master.resize((32, 32), Image.Resampling.LANCZOS).save('public/favicon-32x32.png', format='PNG')
master.resize((64, 64), Image.Resampling.LANCZOS).save('public/favicon.png', format='PNG')
master.resize((180, 180), Image.Resampling.LANCZOS).save('public/apple-touch-icon.png', format='PNG')

# Multi-resolution favicon.ico
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
ico_imgs = [master.resize(s, Image.Resampling.LANCZOS) for s in ico_sizes]
ico_imgs[0].save('public/favicon.ico', format='ICO', sizes=ico_sizes, append_images=ico_imgs[1:])
print("Saved public/favicon.ico")

# PWA icons
master.resize((192, 192), Image.Resampling.LANCZOS).save('public/pwa-192x192.png', format='PNG')
master.resize((512, 512), Image.Resampling.LANCZOS).save('public/pwa-512x512.png', format='PNG')
make_maskable_pwa(master, 192).save('public/pwa-maskable-192x192.png', format='PNG')
make_maskable_pwa(master, 512).save('public/pwa-maskable-512x512.png', format='PNG')
print("Saved all public PWA icons")

# 3. Android Mipmap Icons
densities = {
    'mdpi': (48, 108, 72),      # (launcher_size, fg_total_size, fg_icon_size)
    'hdpi': (72, 162, 108),
    'xhdpi': (96, 216, 144),
    'xxhdpi': (144, 324, 216),
    'xxxhdpi': (192, 432, 288),
}

for d, (launch_sz, fg_total, fg_icon) in densities.items():
    dir_path = f'android/app/src/main/res/mipmap-{d}'
    os.makedirs(dir_path, exist_ok=True)
    
    # 1. Standard launcher icon
    master.resize((launch_sz, launch_sz), Image.Resampling.LANCZOS).save(f'{dir_path}/ic_launcher.png', format='PNG')
    
    # 2. Round launcher icon
    make_round(master, launch_sz).save(f'{dir_path}/ic_launcher_round.png', format='PNG')
    
    # 3. Adaptive foreground icon
    make_adaptive_fg(master, fg_total, fg_icon).save(f'{dir_path}/ic_launcher_foreground.png', format='PNG')
    
    print(f"Generated Android {d} icons (launcher: {launch_sz}px, round: {launch_sz}px, fg: {fg_total}px)")

# 4. Android Splash Screen (480x800 portrait)
splash_bg = Image.new('RGBA', (480, 800), (255, 249, 239, 255)) # #FFF9EF
splash_logo_sz = 220
splash_logo = master.resize((splash_logo_sz, splash_logo_sz), Image.Resampling.LANCZOS)
splash_offset = ((480 - splash_logo_sz) // 2, (800 - splash_logo_sz) // 2 - 30)
splash_bg.paste(splash_logo, splash_offset, splash_logo)
os.makedirs('android/app/src/main/res/drawable', exist_ok=True)
splash_bg.save('android/app/src/main/res/drawable/splash.png', format='PNG')
print("Generated android/app/src/main/res/drawable/splash.png")

print("All app icons and brand logos successfully generated!")
