import os
from PIL import Image, ImageFilter
import numpy as np

def process_image(src_path, dst_path, is_dark=False):
    img = Image.open(src_path).convert('RGB')
    w, h = img.size
    arr = np.array(img, dtype=np.float32)
    
    # Border sampling for background color
    border_pixels = np.concatenate([
        arr[:20, :, :].reshape(-1, 3),
        arr[-20:, :, :].reshape(-1, 3),
        arr[:, :20, :].reshape(-1, 3),
        arr[:, -20:, :].reshape(-1, 3)
    ], axis=0)
    bg_color = np.median(border_pixels, axis=0)
    
    diff = np.sqrt(np.sum((arr - bg_color) ** 2, axis=2))
    max_c = np.max(arr, axis=2)
    min_c = np.min(arr, axis=2)
    sat = (max_c - min_c) / (max_c + 1e-5)
    
    if is_dark:
        thresh_low = 15.0
        thresh_high = 30.0
        alpha_raw = np.clip((diff - thresh_low) / (thresh_high - thresh_low), 0.0, 1.0)
        is_pure_bg = (diff < thresh_low) & (arr.mean(axis=2) < 28)
        alpha_raw[is_pure_bg] = 0.0
    else:
        thresh_low = 18.0
        thresh_high = 36.0
        alpha_raw = np.clip((diff - thresh_low) / (thresh_high - thresh_low), 0.0, 1.0)
        is_pure_bg = (diff < thresh_low) & (sat < 0.12)
        alpha_raw[is_pure_bg] = 0.0
    
    alpha_img = Image.fromarray((alpha_raw * 255).astype(np.uint8), mode='L')
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=1.2))
    alpha_arr = np.array(alpha_img)
    
    rgba_arr = np.dstack([arr.astype(np.uint8), alpha_arr])
    rgba_img = Image.fromarray(rgba_arr, mode='RGBA')
    
    # Tight crop to product
    mask = alpha_arr > 30
    if np.any(mask):
        rows = np.any(mask, axis=1)
        cols = np.any(mask, axis=0)
        ymin, ymax = np.where(rows)[0][[0, -1]]
        xmin, xmax = np.where(cols)[0][[0, -1]]
        
        pad = int(max(xmax - xmin, ymax - ymin) * 0.04)
        xmin = max(0, xmin - pad)
        ymin = max(0, ymin - pad)
        xmax = min(w, xmax + pad)
        ymax = min(h, ymax + pad)
        
        cropped = rgba_img.crop((xmin, ymin, xmax, ymax))
        max_dim = max(cropped.width, cropped.height)
        square = Image.new('RGBA', (max_dim, max_dim), (0, 0, 0, 0))
        square.paste(cropped, ((max_dim - cropped.width) // 2, (max_dim - cropped.height) // 2))
        
        final_img = square.resize((512, 512), Image.Resampling.LANCZOS)
    else:
        final_img = rgba_img.resize((512, 512), Image.Resampling.LANCZOS)
        
    os.makedirs(os.path.dirname(dst_path), exist_ok=True)
    final_img.save(dst_path, 'PNG')
    print(f"Processed {os.path.basename(src_path)} -> {os.path.basename(dst_path)}")

if __name__ == '__main__':
    for folder, is_dark in [('apps/store/public/categories/light', False),
                            ('apps/store/public/categories/dark', True),
                            ('apps/store/public/categories', False)]:
        if os.path.exists(folder):
            for f in os.listdir(folder):
                if f.endswith('.jpg'):
                    src = os.path.join(folder, f)
                    dst = os.path.join(folder, f.replace('.jpg', '.png'))
                    process_image(src, dst, is_dark)
