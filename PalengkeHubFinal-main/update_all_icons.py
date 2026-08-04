#!/usr/bin/env python3
"""
Update all app icons and landing page logo from the new logo file.
Generates properly sized icons for:
- Android app (assets/icon.png, android-icon-foreground.png, etc.)
- Landing page website (palengkehublogo.jpg)
- Favicon
"""

from PIL import Image
import os

# Source logo - no text, purely app icon/logo
SOURCE = os.path.join("android", "app", "src", "main", "res", "logowithouttextandoutline.png")

def create_icon(img, canvas_size, content_size, background=(0, 0, 0, 0)):
    """Create an icon with the logo centered on a canvas."""
    # Create canvas with background
    canvas = Image.new('RGBA', (canvas_size, canvas_size), background)
    
    # Scale logo to fit within content_size while maintaining aspect ratio
    img_ratio = img.width / img.height
    if img_ratio > 1:
        # Landscape
        new_width = content_size
        new_height = int(content_size / img_ratio)
    else:
        # Portrait or square
        new_height = content_size
        new_width = int(content_size * img_ratio)
    
    # Resize with LANCZOS for smooth quality
    resized = img.resize((new_width, new_height), Image.LANCZOS)
    
    # Center the logo on the canvas
    x = (canvas_size - new_width) // 2
    y = (canvas_size - new_height) // 2
    canvas.paste(resized, (x, y), resized)
    
    return canvas

def main():
    if not os.path.exists(SOURCE):
        print(f"ERROR: Source logo not found at {SOURCE}")
        return
    
    img = Image.open(SOURCE)
    print(f"Source logo: {img.size[0]}x{img.size[1]} pixels, mode: {img.mode}")
    
    # Convert to RGBA if needed
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    assets_dir = os.path.join(os.path.dirname(__file__), "assets")
    landing_dir = os.path.join(os.path.dirname(__file__), "landingpage-website")
    
    # 1. Main app icon (1024x1024)
    print("\n1. Generating main app icon (assets/icon.png)...")
    icon_img = create_icon(img, 1024, 900)
    icon_img.save(os.path.join(assets_dir, "icon.png"), "PNG")
    print("   ✓ assets/icon.png (1024x1024)")
    
    # 2. Android adaptive icon foreground (432x432 - xxxhdpi base)
    print("\n2. Generating Android adaptive icon foreground...")
    fg_img = create_icon(img, 432, 288)  # 108dp * 4 = 432, safe zone 72dp * 4 = 288
    fg_img.save(os.path.join(assets_dir, "android-icon-foreground.png"), "PNG")
    print("   ✓ assets/android-icon-foreground.png (432x432)")
    
    # 3. Android adaptive icon background (432x432 - transparent)
    print("\n3. Generating Android adaptive icon background...")
    bg_img = Image.new('RGBA', (432, 432), (0, 0, 0, 0))
    bg_img.save(os.path.join(assets_dir, "android-icon-background.png"), "PNG")
    print("   ✓ assets/android-icon-background.png (432x432, transparent)")
    
    # 4. Monochrome icon (432x432)
    print("\n4. Generating monochrome icon...")
    mono_img = create_icon(img, 432, 288)
    # Convert to grayscale for monochrome
    mono_gray = mono_img.convert('L')
    mono_rgba = mono_gray.convert('RGBA')
    mono_rgba.save(os.path.join(assets_dir, "android-icon-monochrome.png"), "PNG")
    print("   ✓ assets/android-icon-monochrome.png (432x432)")
    
    # 5. Favicon (256x256)
    print("\n5. Generating favicon...")
    fav_img = create_icon(img, 256, 220)
    fav_img.save(os.path.join(assets_dir, "favicon.png"), "PNG")
    print("   ✓ assets/favicon.png (256x256)")
    
    # 6. Splash icon (512x512)
    print("\n6. Generating splash icon...")
    splash_img = create_icon(img, 512, 450)
    splash_img.save(os.path.join(assets_dir, "splash-icon.png"), "PNG")
    print("   ✓ assets/splash-icon.png (512x512)")
    
    # 7. Landing page logo (convert to JPG with white background)
    print("\n7. Generating landing page logo...")
    landing_img = create_icon(img, 500, 450, background=(255, 255, 255, 255))
    # Convert to RGB for JPG (remove alpha channel)
    landing_rgb = landing_img.convert('RGB')
    landing_rgb.save(os.path.join(landing_dir, "palengkehublogo.jpg"), "JPEG", quality=95)
    print("   ✓ landingpage-website/palengkehublogo.jpg (500x500)")
    
    # 8. Also copy to www folder
    www_dir = os.path.join(os.path.dirname(__file__), "www")
    if os.path.exists(www_dir):
        print("\n8. Copying logo to www folder...")
        landing_rgb.save(os.path.join(www_dir, "palengkehublogo.jpg"), "JPEG", quality=95)
        print("   ✓ www/palengkehublogo.jpg (500x500)")
    
    print("\n✅ All icons and logos updated successfully!")
    print("\nNext steps:")
    print("1. Rebuild the APK: BUILD_APK.bat")
    print("2. Copy APK to landing page")
    print("3. Test the app icon on device")

if __name__ == "__main__":
    main()