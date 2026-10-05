from PIL import Image, ImageDraw, ImageFont

def generate_icon(output_path="app.ico"):
    size = 256
    # Create RGBA image with smooth gradient
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw rounded rectangle background (Indigo to Royal Blue gradient)
    padding = 16
    radius = 54
    for y in range(padding, size - padding):
        ratio = (y - padding) / (size - 2 * padding)
        r = int(37 * (1 - ratio) + 79 * ratio)
        g = int(99 * (1 - ratio) + 70 * ratio)
        b = int(235 * (1 - ratio) + 229 * ratio)
        draw.line(
            [(padding, y), (size - padding, y)],
            fill=(r, g, b, 255)
        )

    # Apply rounded corner mask
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(
        [(padding, padding), (size - padding, size - padding)],
        radius=radius,
        fill=255
    )
    img.putalpha(mask)

    # Draw white bold "N" icon inside
    overlay = ImageDraw.Draw(img)
    # Stylized "N" geometric polygon
    poly1 = [(65, 195), (65, 65), (98, 65), (98, 195)]
    poly2 = [(158, 195), (158, 65), (191, 65), (191, 195)]
    poly_diag = [(98, 65), (158, 165), (158, 195), (98, 95)]
    
    # White with slight glow
    for p in [poly1, poly2, poly_diag]:
        overlay.polygon(p, fill=(255, 255, 255, 250))

    # Add a glowing spark on top-right
    spark_center = (185, 75)
    overlay.ellipse(
        [(spark_center[0] - 12, spark_center[1] - 12), (spark_center[0] + 12, spark_center[1] + 12)],
        fill=(56, 189, 248, 240)
    )

    # Save as multi-resolution Windows ICO
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(output_path, format="ICO", sizes=sizes)
    print(f"Generated {output_path} successfully!")

if __name__ == "__main__":
    generate_icon("app.ico")
