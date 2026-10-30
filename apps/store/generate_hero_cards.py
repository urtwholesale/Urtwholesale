import os
from PIL import Image, ImageFilter, ImageEnhance
import numpy as np

CATEGORIES = [
    ("chargers", "offer-gan-65w"),
    ("tempered-glass", "offer-diamond-armor"),
    ("buds-tws", "offer-tws-buds"),
    ("cables", "offer-cables"),
    ("power-banks", "offer-power-bank")
]

CANVAS_W = 900
CANVAS_H = 1200

def generate_hero_card_light(cat_slug, card_id):
    src_path = f"apps/store/public/categories/light/{cat_slug}.jpg"
    img = Image.open(src_path).convert("RGB")
    arr = np.array(img).astype(float)
    
    # Background color samples from the image borders
    top_color = arr[:15, :, :].mean(axis=(0, 1))
    bottom_color = arr[-15:, :, :].mean(axis=(0, 1))
    
    # Target 900x1200 canvas
    canvas = np.zeros((CANVAS_H, CANVAS_W, 3), dtype=float)
    for y in range(CANVAS_H):
        t = y / (CANVAS_H - 1.0)
        canvas[y, :] = top_color * (1 - t) + bottom_color * t

    # Resize source image to fit nicely within the hero card upper/middle area
    # e.g., width 820px, height 820px
    product_w, product_h = 820, 820
    resized_img = img.resize((product_w, product_h), Image.Resampling.LANCZOS)
    res_arr = np.array(resized_img).astype(float)
    
    # Position: centered horizontally, placed between Y=80 and Y=900
    pos_x = (CANVAS_W - product_w) // 2
    pos_y = 60 # Leaves room at the bottom for the frosted glass floating pill
    
    # Feathered blend around the edges of the resized image
    # Weight mask that is 1 in the center and smoothly transitions to 0 near the edges
    mask = np.ones((product_h, product_w), dtype=float)
    border = 60
    for i in range(border):
        alpha = i / float(border)
        mask[i, :] = np.minimum(mask[i, :], alpha)
        mask[product_h - 1 - i, :] = np.minimum(mask[product_h - 1 - i, :], alpha)
        mask[:, i] = np.minimum(mask[:, i], alpha)
        mask[:, product_w - 1 - i] = np.minimum(mask[:, product_w - 1 - i], alpha)
    
    # Smooth the mask
    mask_img = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(15))
    smooth_mask = np.array(mask_img).astype(float) / 255.0
    
    # Composite resized image onto canvas
    canvas_region = canvas[pos_y:pos_y + product_h, pos_x:pos_x + product_w]
    blended_region = canvas_region * (1.0 - smooth_mask[:, :, None]) + res_arr * smooth_mask[:, :, None]
    canvas[pos_y:pos_y + product_h, pos_x:pos_x + product_w] = blended_region
    
    # Subtle studio soft contact shadow at the base of the product
    shadow = np.zeros((CANVAS_H, CANVAS_W), dtype=float)
    y_grid, x_grid = np.ogrid[:CANVAS_H, :CANVAS_W]
    center_y = pos_y + product_h - 90
    center_x = CANVAS_W // 2
    ellipse = ((x_grid - center_x) / 300.0)**2 + ((y_grid - center_y) / 45.0)**2 <= 1.0
    shadow[ellipse] = 0.12
    shadow_img = Image.fromarray((shadow * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(25))
    shadow_mask = np.array(shadow_img).astype(float) / 255.0
    canvas = canvas * (1.0 - shadow_mask[:, :, None] * 0.25)
    
    # Save output
    out = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8))
    out.save(f"apps/store/public/hero/light/{card_id}.jpg", quality=95)
    print(f"Generated light hero card: apps/store/public/hero/light/{card_id}.jpg")


def generate_hero_card_dark(cat_slug, card_id):
    src_path = f"apps/store/public/categories/dark/{cat_slug}.jpg"
    img = Image.open(src_path).convert("RGB")
    arr = np.array(img).astype(float)
    
    # Background color samples
    top_color = arr[:15, :, :].mean(axis=(0, 1))
    bottom_color = arr[-15:, :, :].mean(axis=(0, 1))
    
    # Target 900x1200 canvas
    canvas = np.zeros((CANVAS_H, CANVAS_W, 3), dtype=float)
    for y in range(CANVAS_H):
        t = y / (CANVAS_H - 1.0)
        canvas[y, :] = top_color * (1 - t) + bottom_color * t

    product_w, product_h = 820, 820
    resized_img = img.resize((product_w, product_h), Image.Resampling.LANCZOS)
    res_arr = np.array(resized_img).astype(float)
    
    pos_x = (CANVAS_W - product_w) // 2
    pos_y = 60
    
    # Feathered blend
    mask = np.ones((product_h, product_w), dtype=float)
    border = 60
    for i in range(border):
        alpha = i / float(border)
        mask[i, :] = np.minimum(mask[i, :], alpha)
        mask[product_h - 1 - i, :] = np.minimum(mask[product_h - 1 - i, :], alpha)
        mask[:, i] = np.minimum(mask[:, i], alpha)
        mask[:, product_w - 1 - i] = np.minimum(mask[:, product_w - 1 - i], alpha)
    
    mask_img = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(15))
    smooth_mask = np.array(mask_img).astype(float) / 255.0
    
    canvas_region = canvas[pos_y:pos_y + product_h, pos_x:pos_x + product_w]
    blended_region = canvas_region * (1.0 - smooth_mask[:, :, None]) + res_arr * smooth_mask[:, :, None]
    canvas[pos_y:pos_y + product_h, pos_x:pos_x + product_w] = blended_region
    
    # Save output
    out = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8))
    out.save(f"apps/store/public/hero/dark/{card_id}.jpg", quality=95)
    print(f"Generated dark hero card: apps/store/public/hero/dark/{card_id}.jpg")


for cat_slug, card_id in CATEGORIES:
    generate_hero_card_light(cat_slug, card_id)
    generate_hero_card_dark(cat_slug, card_id)

print("All hero cards generated successfully!")
