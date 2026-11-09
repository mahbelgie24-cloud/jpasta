import Image from "next/image";
import { DishArt } from "./dish-art";
import {
  productImageSrc,
  type Product,
  type SauceKind,
  type ToppingKind,
} from "@/lib/menu-data";
import { cn } from "@/lib/utils";

/**
 * DishMedia — the photo/illustration switch.
 *
 * A product with a photo renders optimized photography; otherwise the
 * DishArt system renders a deterministic, dish-specific illustration. The
 * fallback is permanent (never a broken image).
 *
 * Two photo sources share this component:
 *   - `media/...`  curated photos committed under public/ (seeded catalog)
 *   - anything else  owner uploads in R2, served through /api/media
 */
export function DishMedia({
  product,
  variant = "card",
  className,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  preload = false,
  decorative = false,
}: {
  product: Pick<Product, "slug" | "sauce" | "toppings" | "image" | "nameAr">;
  variant?: "card" | "hero" | "tile" | "dark";
  className?: string;
  sizes?: string;
  preload?: boolean;
  decorative?: boolean;
}) {
  if (product.image) {
    return (
      <div
        className={cn("relative overflow-hidden bg-cream-200", className)}
        style={
          product.image.color
            ? { backgroundColor: product.image.color }
            : undefined
        }
      >
        <Image
          src={productImageSrc(product.image)}
          alt={decorative ? "" : product.image.alt || product.nameAr}
          width={product.image.width}
          height={product.image.height}
          sizes={sizes}
          preload={preload}
          placeholder={product.image.blurDataURL ? "blur" : "empty"}
          blurDataURL={product.image.blurDataURL}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <DishArt
      seed={product.slug}
      sauce={product.sauce as SauceKind}
      toppings={product.toppings as ToppingKind[]}
      variant={variant}
      className={className}
      decorative={decorative}
      ariaLabel={product.nameAr}
    />
  );
}
