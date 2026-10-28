import Image from "next/image";
import { DishArt } from "./dish-art";
import type { Product, SauceKind, ToppingKind } from "@/lib/menu-data";
import { cn } from "@/lib/utils";

/**
 * DishMedia — the photo/illustration switch.
 *
 * A product with an R2 image renders optimized photography; otherwise the
 * DishArt system renders a deterministic, dish-specific illustration. The
 * fallback is permanent (never a broken image), and the owner can replace
 * any dish with a photo from /console/menu.
 */
export function DishMedia({
  product,
  variant = "card",
  className,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  priority = false,
}: {
  product: Pick<Product, "slug" | "sauce" | "toppings" | "image" | "nameAr">;
  variant?: "card" | "hero" | "tile" | "dark";
  className?: string;
  sizes?: string;
  priority?: boolean;
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
          src={`/api/media/${product.image.key}`}
          alt={product.image.alt || product.nameAr}
          width={product.image.width}
          height={product.image.height}
          sizes={sizes}
          priority={priority}
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
    />
  );
}
