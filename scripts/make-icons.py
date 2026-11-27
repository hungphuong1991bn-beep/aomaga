#!/usr/bin/env python3
"""Sinh icon/splash cho Windows + Android từ icons/logo-source.png (logo AOMAGA). Chạy lại khi đổi logo:
   python3 scripts/make-icons.py   (cần Pillow). Ghi: build/icon.png, build/icon.ico, icons/*, android/app/src/main/res/*"""
import os
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
logo = Image.open(os.path.join(ROOT, 'icons', 'logo-source.png')).convert('RGBA')
mark = logo.crop((4, 6, 112, 170))            # khối chữ "A" đỏ của logo: dễ nhận ở kích thước nhỏ
RED = (200, 16, 26, 255)

def square(size, pad=0.14, radius=0.22, bg=(255, 255, 255, 255)):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * radius), fill=bg)
    inner = int(size * (1 - 2 * pad))
    m = mark.copy(); m.thumbnail((inner, inner), Image.LANCZOS)
    im.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return im

def circle(size):
    s = square(size, pad=0.16, radius=0.5)
    return s

def foreground(size):                          # lớp nổi của icon thích ứng Android: vùng an toàn 66%
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    inner = int(size * 0.52)
    m = mark.copy(); m.thumbnail((inner, inner), Image.LANCZOS)
    im.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return im

def splash(w, h):
    im = Image.new('RGBA', (w, h), (255, 255, 255, 255))
    lw = int(min(w, h) * 0.6)
    l = logo.copy(); l = l.resize((lw, int(lw * logo.height / logo.width)), Image.LANCZOS)
    im.alpha_composite(l, ((w - l.width) // 2, (h - l.height) // 2))
    return im

def save(im, *parts):
    p = os.path.join(ROOT, *parts); os.makedirs(os.path.dirname(p), exist_ok=True); im.save(p); return p

# Windows + tài nguyên chung
base = square(1024)
save(base, 'icons', 'icon-1024.png')
save(square(512), 'build', 'icon.png')
base.save(os.path.join(ROOT, 'build', 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
save(square(192), 'icons', 'icon-192.png'); save(square(512), 'icons', 'icon-512.png')

# Android
res = os.path.join('android', 'app', 'src', 'main', 'res')
if os.path.isdir(os.path.join(ROOT, 'android')):
    for dens, px, fg in [('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216), ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)]:
        save(square(px, radius=0.18), res, 'mipmap-' + dens, 'ic_launcher.png')
        save(circle(px), res, 'mipmap-' + dens, 'ic_launcher_round.png')
        save(foreground(fg), res, 'mipmap-' + dens, 'ic_launcher_foreground.png')
    for d, (w, h) in {'drawable': (480, 320), 'drawable-port-mdpi': (320, 480), 'drawable-port-hdpi': (480, 800), 'drawable-port-xhdpi': (720, 1280), 'drawable-port-xxhdpi': (960, 1600), 'drawable-port-xxxhdpi': (1280, 1920),
                      'drawable-land-mdpi': (480, 320), 'drawable-land-hdpi': (800, 480), 'drawable-land-xhdpi': (1280, 720), 'drawable-land-xxhdpi': (1600, 960), 'drawable-land-xxxhdpi': (1920, 1280)}.items():
        save(splash(w, h).convert('RGB'), res, d, 'splash.png')
print('icons ok')
