/**
 * Catalog source of truth — seeded into the database and used as the
 * DB-degraded placeholder. Prices are integer minor units (agorot).
 *
 * Modifier model (spec §10): groups are defined per product, never global.
 * The current menu uses:
 *   - sauce : mandatory single choice on chicken nuggets
 *   - pasta : optional single choice on crunchy cheese pasta (default fettuccine)
 *   - extras: optional paid chicken add-on on pasta dishes
 */
import { DISH_PHOTOS } from "./dish-photos.generated";
import { toMinorUnits } from "./pricing";

export type SauceKind =
  "alfredo" | "marinara" | "pesto" | "pink" | "baked" | "golden";
export type ToppingKind =
  "basil" | "tomato" | "chicken" | "mushroom" | "cheese" | "chili";

export type Badge = "bestseller" | "new" | "spicy" | "fresh";

export interface Category {
  slug: string;
  nameAr: string;
  nameEn: string;
  blurbAr: string;
}

export interface ModifierOption {
  id: string;
  nameAr: string;
  priceMinor: number;
}

export interface ModifierGroup {
  id: string;
  nameAr: string;
  type: "single" | "multi";
  required: boolean;
  maxSelections?: number;
  options: ModifierOption[];
}

export interface ProductImage {
  /**
   * Media key. `media/...` is a bundled photo served from public/; anything
   * else is an owner upload in R2, served through /api/media.
   */
  key: string;
  alt: string;
  width: number;
  height: number;
  color?: string;
  /** Inline LQIP for bundled photos; owner uploads fall back to `color`. */
  blurDataURL?: string;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

/**
 * Resolve a media key to a public URL (bundled asset vs R2 route).
 *
 * R2 keys use an absolute same-origin URL: OpenNext's image optimizer
 * forwards relative URLs to the static-assets binding, which 404s for
 * `/api/media/*`. An absolute URL goes through the remote-image path (the
 * host is allowed in next.config's remotePatterns) and still hits our own
 * media route.
 */
export function productImageSrc(image: ProductImage): string {
  if (image.key.startsWith("media/")) return `/${image.key}`;
  const path = `/api/media/${image.key}`;
  return SITE_URL ? `${SITE_URL}${path}` : path;
}

export interface Product {
  id: string;
  slug: string;
  categorySlug: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  basePriceMinor: number;
  sauce: SauceKind;
  toppings: ToppingKind[];
  heat: 0 | 1 | 2 | 3;
  badges: Badge[];
  /** Curated homepage feature — independent of the bestseller badge. */
  featured?: boolean;
  groups: ModifierGroup[];
  /** Curated photo (bundled or R2). Absent → DishArt renders the illustration. */
  image?: ProductImage;
}

export const CATEGORIES: Category[] = [
  {
    slug: "pasta",
    nameAr: "الباستا",
    nameEn: "Pasta",
    blurbAr: "باستا طازة بصلصات بيتية",
  },
  {
    slug: "salads",
    nameAr: "السلطات",
    nameEn: "Salads",
    blurbAr: "طازجة ومنعشة",
  },
  {
    slug: "sides",
    nameAr: "الأطباق الجانبية",
    nameEn: "Sides",
    blurbAr: "كمّل وجبتك",
  },
];

/** Optional paid chicken add-on — pasta dishes only. */
const CHICKEN_ADDON: ModifierGroup = {
  id: "extras",
  nameAr: "إضافات",
  type: "multi",
  required: false,
  maxSelections: 1,
  options: [
    {
      id: "chicken",
      nameAr: "إضافة دجاج",
      priceMinor: toMinorUnits("10"),
    },
  ],
};

/** Mandatory sauce choice for chicken nuggets. */
const NUGGET_SAUCE: ModifierGroup = {
  id: "sauce",
  nameAr: "الصوص",
  type: "single",
  required: true,
  options: [
    { id: "bbq", nameAr: "باربيكيو", priceMinor: 0 },
    { id: "sweet-chili", nameAr: "سويت تشيلي", priceMinor: 0 },
    { id: "buffalo", nameAr: "بافلو", priceMinor: 0 },
    { id: "teriyaki", nameAr: "صوص تيرياكي", priceMinor: 0 },
  ],
};

/**
 * Optional pasta-type choice. Not required: the first option (fettuccine) is
 * preselected by the item sheet, so the customer can simply keep it.
 */
const PASTA_TYPE: ModifierGroup = {
  id: "pasta",
  nameAr: "نوع الباستا",
  type: "single",
  required: false,
  options: [
    { id: "fettuccine", nameAr: "فيتوتشيني", priceMinor: 0 },
    { id: "penne", nameAr: "بيني", priceMinor: 0 },
  ],
};

const BASE_PRODUCTS: Product[] = [
  // ── الباستا ──────────────────────────────────────────────────────────
  {
    id: "fettuccine-mushroom",
    slug: "fettuccine-mushroom",
    categorySlug: "pasta",
    nameAr: "فيتوتشيني مع فطر",
    nameEn: "Fettuccine Mushroom",
    descAr: "فيتوتشيني باستا مع فطر وصوص ألفريدو كريمي",
    basePriceMinor: toMinorUnits("20"),
    sauce: "alfredo",
    toppings: ["mushroom", "cheese", "basil"],
    heat: 0,
    badges: ["bestseller", "fresh"],
    featured: true,
    groups: [CHICKEN_ADDON],
  },
  {
    id: "penne-pesto",
    slug: "penne-pesto",
    categorySlug: "pasta",
    nameAr: "بيني بيستو",
    nameEn: "Penne Pesto",
    descAr: "بيني باستا مع صوص الريحان",
    basePriceMinor: toMinorUnits("25"),
    sauce: "pesto",
    toppings: ["basil", "cheese"],
    heat: 0,
    badges: ["fresh"],
    featured: true,
    groups: [CHICKEN_ADDON],
  },
  {
    id: "fettuccine-alfredo",
    slug: "fettuccine-alfredo",
    categorySlug: "pasta",
    nameAr: "فيتوتشيني ألفريدو",
    nameEn: "Fettuccine Alfredo",
    descAr: "فيتوتشيني باستا مع صوص ألفريدو",
    basePriceMinor: toMinorUnits("20"),
    sauce: "alfredo",
    toppings: ["cheese", "basil"],
    heat: 0,
    badges: ["fresh"],
    featured: true,
    groups: [CHICKEN_ADDON],
  },
  {
    id: "smoked-pasta",
    slug: "smoked-pasta",
    categorySlug: "pasta",
    nameAr: "سموكد باستا",
    nameEn: "Smoked Pasta",
    descAr: "بيني باستا مدخنة مع صوص ألفريدو وجبنة الشيدر",
    basePriceMinor: toMinorUnits("25"),
    sauce: "alfredo",
    toppings: ["cheese"],
    heat: 0,
    badges: ["new"],
    groups: [CHICKEN_ADDON],
  },
  {
    id: "stroganoff-pasta",
    slug: "stroganoff-pasta",
    categorySlug: "pasta",
    nameAr: "ستروجانوف باستا",
    nameEn: "Stroganoff Pasta",
    descAr: "فيتوتشيني باستا مع قطع دجاج وفلفل أحمر وبصل وفطر",
    basePriceMinor: toMinorUnits("30"),
    sauce: "pink",
    toppings: ["chicken", "tomato", "mushroom"],
    heat: 0,
    badges: ["fresh"],
    featured: true,
    groups: [CHICKEN_ADDON],
  },
  {
    id: "lemon-pasta",
    slug: "lemon-pasta",
    categorySlug: "pasta",
    nameAr: "باستا ليمون",
    nameEn: "Lemon Pasta",
    descAr: "فيتوتشيني باستا مع صوص الليمون وجبنة البارميزان",
    basePriceMinor: toMinorUnits("20"),
    sauce: "golden",
    toppings: ["cheese", "basil"],
    heat: 0,
    badges: ["fresh"],
    groups: [CHICKEN_ADDON],
  },
  {
    id: "crunchy-cheese-pasta",
    slug: "crunchy-cheese-pasta",
    categorySlug: "pasta",
    nameAr: "كرانشي تشيز باستا",
    nameEn: "Crunchy Cheese Pasta",
    descAr: "فيتوتشيني أو بيني باستا مع شيتوس",
    basePriceMinor: toMinorUnits("20"),
    sauce: "baked",
    toppings: ["cheese"],
    heat: 0,
    badges: ["new"],
    groups: [PASTA_TYPE, CHICKEN_ADDON],
  },
  {
    id: "fettuccine-pesto",
    slug: "fettuccine-pesto",
    categorySlug: "pasta",
    nameAr: "فيتوتشيني بيستو",
    nameEn: "Fettuccine Pesto",
    descAr: "فيتوتشيني باستا مع صوص الريحان",
    basePriceMinor: toMinorUnits("25"),
    sauce: "pesto",
    toppings: ["basil", "cheese"],
    heat: 0,
    badges: [],
    groups: [CHICKEN_ADDON],
  },
  {
    id: "mozzarella-pasta",
    slug: "mozzarella-pasta",
    categorySlug: "pasta",
    nameAr: "موزاريلا باستا",
    nameEn: "Mozzarella Pasta",
    descAr: "بيني باستا مع صوص الفطر وجبنة الموزاريلا",
    basePriceMinor: toMinorUnits("25"),
    sauce: "alfredo",
    toppings: ["mushroom", "cheese"],
    heat: 0,
    badges: [],
    groups: [CHICKEN_ADDON],
  },
  {
    id: "penne-alfredo",
    slug: "penne-alfredo",
    categorySlug: "pasta",
    nameAr: "بيني ألفريدو",
    nameEn: "Penne Alfredo",
    descAr: "بيني باستا مع صوص ألفريدو",
    basePriceMinor: toMinorUnits("20"),
    sauce: "alfredo",
    toppings: ["cheese"],
    heat: 0,
    badges: [],
    groups: [CHICKEN_ADDON],
  },
  // ── السلطات ──────────────────────────────────────────────────────────
  {
    id: "tabbouleh",
    slug: "tabbouleh",
    categorySlug: "salads",
    nameAr: "تبولة",
    nameEn: "Tabbouleh",
    descAr: "طبق شعبي منعش، طازج ومحضّر بعناية",
    basePriceMinor: toMinorUnits("15"),
    sauce: "golden",
    toppings: ["tomato", "basil"],
    heat: 0,
    badges: ["fresh"],
    groups: [],
  },
  // ── الأطباق الجانبية ─────────────────────────────────────────────────
  {
    id: "chicken-nuggets",
    slug: "chicken-nuggets",
    categorySlug: "sides",
    nameAr: "ناجتس الدجاج",
    nameEn: "Chicken Nuggets",
    descAr: "قطع دجاج مقلية مغلفة بصوص من اختيارك",
    basePriceMinor: toMinorUnits("15"),
    sauce: "golden",
    toppings: ["chicken"],
    heat: 0,
    badges: [],
    groups: [NUGGET_SAUCE],
  },
];

/**
 * The catalog with bundled photography attached by slug. `npm run photos`
 * owns the manifest, so replacing a source image never requires editing a
 * product by hand. Products without an entry keep the DishArt fallback.
 */
export const PRODUCTS: Product[] = BASE_PRODUCTS.map((product) => {
  const photo = DISH_PHOTOS[product.slug];
  return photo
    ? { ...product, image: { ...photo, alt: product.nameAr } }
    : product;
});

/** Flat delivery fee placeholder — replaced by delivery_zones in Phase 2 (spec §16.2). */
export const PLACEHOLDER_DELIVERY_FEE_MINOR = toMinorUnits("5");

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function featuredProducts(): Product[] {
  const featured = PRODUCTS.filter((p) => p.featured);
  return (
    featured.length > 0
      ? featured
      : PRODUCTS.filter((p) => p.badges.includes("bestseller"))
  ).slice(0, 4);
}
