/**
 * Placeholder catalog (Phase 0) — beautiful, realistic content for the
 * owner review. Replaced by the real menu via the admin UI or the JSON
 * ingest (spec §8.4). Prices are integer minor units (agorot).
 *
 * The modifier model is pasta-accurate (spec §10): size, optional heat,
 * optional doneness, and priced extras — per product, never global.
 */
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
  key: string;
  alt: string;
  width: number;
  height: number;
  color?: string;
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
  groups: ModifierGroup[];
  /** Real photography (R2). Absent → DishArt renders the illustration. */
  image?: ProductImage;
}

export const CATEGORIES: Category[] = [
  {
    slug: "classics",
    nameAr: "الكلاسيك الإيطالي",
    nameEn: "Italian Classics",
    blurbAr: "وصفات إيطالية أصلية على باستا طازة",
  },
  {
    slug: "chicken",
    nameAr: "سبشل الدجاج",
    nameEn: "Chicken Specials",
    blurbAr: "دجاج طازج متبل يومياً مع صلصاتنا البيتية",
  },
  {
    slug: "baked",
    nameAr: "من الفرن",
    nameEn: "Baked al Forno",
    blurbAr: "مخبوزة بالفرن بجبنة ذهبية ذائبة",
  },
  {
    slug: "extras",
    nameAr: "إضافات ومقبلات",
    nameEn: "Sides & Extras",
    blurbAr: "كمّل وجبتك",
  },
  {
    slug: "drinks",
    nameAr: "مشروبات",
    nameEn: "Drinks",
    blurbAr: "منعش مع كل لقمة",
  },
];

/** Shared modifier options (referenced by id from products). */
const SIZES: ModifierGroup = {
  id: "size",
  nameAr: "الحجم",
  type: "single",
  required: true,
  options: [
    { id: "regular", nameAr: "فردي", priceMinor: 0 },
    { id: "large", nameAr: "كبير", priceMinor: toMinorUnits("6") },
  ],
};

const HEAT: ModifierGroup = {
  id: "heat",
  nameAr: "مستوى الحرارة",
  type: "single",
  required: false,
  options: [
    { id: "mild", nameAr: "بدون حار", priceMinor: 0 },
    { id: "medium", nameAr: "وسط", priceMinor: 0 },
    { id: "hot", nameAr: "حار 🌶", priceMinor: 0 },
  ],
};

const DONENESS: ModifierGroup = {
  id: "doneness",
  nameAr: "درجة الاستواء",
  type: "single",
  required: false,
  options: [
    { id: "al-dente", nameAr: "Al Dente (موصى به)", priceMinor: 0 },
    { id: "soft", nameAr: "مطبوخ أكثر", priceMinor: 0 },
  ],
};

const extra = (id: string, nameAr: string, major: string): ModifierOption => ({
  id,
  nameAr,
  priceMinor: toMinorUnits(major),
});

function extras(...options: ModifierOption[]): ModifierGroup {
  return {
    id: "extras",
    nameAr: "إضافات",
    type: "multi",
    required: false,
    maxSelections: 6,
    options,
  };
}

const X_GRILL_CHICKEN = extra("grill-chicken", "دجاج مشوي إضافي", "6");
const X_MUSHROOM = extra("mushroom", "فطر طازج", "3");
const X_PARMESAN = extra("parmesan", "بارميزان إضافي", "2.5");
const X_GARLIC_BREAD = extra("garlic-bread", "خبز ثوم", "4");
const X_EXTRA_SAUCE = extra("extra-sauce", "صلصة إضافية", "3");
const X_SHRIMP = extra("shrimp", "روبيان", "9");
const X_CHILI = extra("chili", "فلفل حار", "1.5");

/** Pasta dishes share size + doneness; heat only where it makes sense. */
function pastaGroups(opts?: {
  heat?: boolean;
  extras?: ModifierOption[];
}): ModifierGroup[] {
  const groups: ModifierGroup[] = [SIZES, DONENESS];
  if (opts?.heat) groups.push(HEAT);
  groups.push(
    extras(
      ...(opts?.extras ?? [
        X_GRILL_CHICKEN,
        X_MUSHROOM,
        X_PARMESAN,
        X_GARLIC_BREAD,
        X_EXTRA_SAUCE,
      ]),
    ),
  );
  return groups;
}

export const PRODUCTS: Product[] = [
  // ── الكلاسيك الإيطالي ────────────────────────────────────────────────
  {
    id: "alfredo-classico",
    slug: "alfredo-classico",
    categorySlug: "classics",
    nameAr: "ألفريدو الكلاسيك",
    nameEn: "Alfredo Classico",
    descAr: "فيتوتشيني طازة بصوص ألفريدو كريمي بالبارميزان الحقيقي وزبدة طازة",
    basePriceMinor: toMinorUnits("24"),
    sauce: "alfredo",
    toppings: ["cheese", "basil"],
    heat: 0,
    badges: ["bestseller", "fresh"],
    groups: pastaGroups(),
  },
  {
    id: "marinara",
    slug: "marinara",
    categorySlug: "classics",
    nameAr: "مارينارا",
    nameEn: "Marinara",
    descAr: "صلصة طماطم إيطالية مطبوخة ببطء مع ثوم وأوريغانو وزيت زيتون بكر",
    basePriceMinor: toMinorUnits("19"),
    sauce: "marinara",
    toppings: ["tomato", "basil"],
    heat: 0,
    badges: ["fresh"],
    groups: pastaGroups(),
  },
  {
    id: "arrabbiata",
    slug: "arrabbiata",
    categorySlug: "classics",
    nameAr: "أرابياتا",
    nameEn: "Arrabbiata",
    descAr: "الغاضبة الإيطالية — صلصة طماطم حارة بثوم مشوي وفلفل تشيلي",
    basePriceMinor: toMinorUnits("21"),
    sauce: "marinara",
    toppings: ["tomato", "chili", "basil"],
    heat: 2,
    badges: ["spicy"],
    groups: pastaGroups({ heat: true }),
  },
  {
    id: "aglio-olio",
    slug: "aglio-olio",
    categorySlug: "classics",
    nameAr: "أغليو إي أوليو",
    nameEn: "Aglio e Olio",
    descAr:
      "بساطة إيطاليا الحقيقية — ثوم ذهبي، زيت زيتون، بقدونس، ورشة فلفل حار",
    basePriceMinor: toMinorUnits("18"),
    sauce: "golden",
    toppings: ["chili"],
    heat: 1,
    badges: [],
    groups: pastaGroups(),
  },
  {
    id: "pesto-genovese",
    slug: "pesto-genovese",
    categorySlug: "classics",
    nameAr: "بيستو جينوفيزي",
    nameEn: "Pesto Genovese",
    descAr:
      "ريحان طازج، صنوبر محمص، بارميزان، وزيت زيتون — مصفوفة طازة كل صباح",
    basePriceMinor: toMinorUnits("24"),
    sauce: "pesto",
    toppings: ["basil", "cheese"],
    heat: 0,
    badges: ["new"],
    groups: pastaGroups({
      extras: [X_MUSHROOM, X_PARMESAN, X_GARLIC_BREAD, X_EXTRA_SAUCE],
    }),
  },
  {
    id: "chicken-carbonara",
    slug: "chicken-carbonara",
    categorySlug: "classics",
    nameAr: "كاربونارا بالدجاج المدخن",
    nameEn: "Chicken Carbonara",
    descAr: "صلصة كريمية بالبارميزان مع دجاج مدخن وصفار طازج وفلفل أسود مطحون",
    basePriceMinor: toMinorUnits("26"),
    sauce: "alfredo",
    toppings: ["chicken", "cheese"],
    heat: 0,
    badges: ["bestseller"],
    groups: pastaGroups(),
  },
  // ── سبشل الدجاج ──────────────────────────────────────────────────────
  {
    id: "chicken-alfredo",
    slug: "chicken-alfredo",
    categorySlug: "chicken",
    nameAr: "تشيكن ألفريدو",
    nameEn: "Chicken Alfredo",
    descAr:
      "شرائح دجاج مشوي متبلة على ألفريدو الكريمي — الطبق اللي بيطلبه الكل",
    basePriceMinor: toMinorUnits("28"),
    sauce: "alfredo",
    toppings: ["chicken", "cheese", "basil"],
    heat: 0,
    badges: ["bestseller"],
    groups: pastaGroups(),
  },
  {
    id: "spicy-chicken",
    slug: "spicy-chicken",
    categorySlug: "chicken",
    nameAr: "باستا الدجاج الحارة",
    nameEn: "Spicy Chicken Pasta",
    descAr: "دجاج مشوي بصوص طماطم حار بلمسة كريمة وفلفل تشيلي طازج",
    basePriceMinor: toMinorUnits("27"),
    sauce: "pink",
    toppings: ["chicken", "chili"],
    heat: 3,
    badges: ["spicy"],
    groups: pastaGroups({
      heat: true,
      extras: [
        X_GRILL_CHICKEN,
        X_MUSHROOM,
        X_CHILI,
        X_PARMESAN,
        X_GARLIC_BREAD,
      ],
    }),
  },
  {
    id: "lemon-chicken",
    slug: "lemon-chicken",
    categorySlug: "chicken",
    nameAr: "ليموني بالدجاج",
    nameEn: "Lemon Chicken Pasta",
    descAr: "صوص الزبدة والليمون الطازج مع دجاج مشوي وحبة البركة الإيطالية",
    basePriceMinor: toMinorUnits("26"),
    sauce: "golden",
    toppings: ["chicken", "basil"],
    heat: 0,
    badges: ["new"],
    groups: pastaGroups({ extras: [X_MUSHROOM, X_PARMESAN, X_EXTRA_SAUCE] }),
  },
  {
    id: "chicken-pesto-shrimp",
    slug: "chicken-pesto-shrimp",
    categorySlug: "chicken",
    nameAr: "بيستو بالدجاج والروبيان",
    nameEn: "Chicken & Shrimp Pesto",
    descAr: "الطبق الفخم — دجاج مشوي وروبيان على بيستو الكريمي",
    basePriceMinor: toMinorUnits("38"),
    sauce: "pesto",
    toppings: ["chicken", "basil"],
    heat: 0,
    badges: ["fresh"],
    groups: pastaGroups({ extras: [X_SHRIMP, X_PARMESAN, X_GARLIC_BREAD] }),
  },
  // ── من الفرن ─────────────────────────────────────────────────────────
  {
    id: "chicken-lasagna",
    slug: "chicken-lasagna",
    categorySlug: "baked",
    nameAr: "لازانيا الدجاج",
    nameEn: "Chicken Lasagna",
    descAr:
      "طبقات باستا طازة، دجاج، بشاميل، وصلصة طماطم — مخبوزة بالجبنة الذهبية",
    basePriceMinor: toMinorUnits("32"),
    sauce: "baked",
    toppings: ["chicken", "cheese", "tomato"],
    heat: 0,
    badges: ["bestseller"],
    groups: [extras(X_GARLIC_BREAD, X_EXTRA_SAUCE)],
  },
  {
    id: "mac-cheese",
    slug: "mac-cheese",
    categorySlug: "baked",
    nameAr: "ماك أند تشيز",
    nameEn: "Mac & Cheese",
    descAr: "مكرونة مخصوصة بصوص الجبنة الثلاثي المخبوزة بالخبز المقرمش",
    basePriceMinor: toMinorUnits("20"),
    sauce: "baked",
    toppings: ["cheese"],
    heat: 0,
    badges: [],
    groups: [extras(X_GRILL_CHICKEN, X_MUSHROOM, X_EXTRA_SAUCE)],
  },
  {
    id: "pasta-al-forno",
    slug: "pasta-al-forno",
    categorySlug: "baked",
    nameAr: "باستا آل فورنو",
    nameEn: "Pasta al Forno",
    descAr: "بيني مخبوزة بصوص الطماطم والدجاج والموزاريلا الذائبة",
    basePriceMinor: toMinorUnits("29"),
    sauce: "baked",
    toppings: ["chicken", "cheese", "basil"],
    heat: 0,
    badges: [],
    groups: pastaGroups({ extras: [X_GARLIC_BREAD, X_EXTRA_SAUCE] }),
  },
  // ── إضافات ومقبلات ───────────────────────────────────────────────────
  {
    id: "garlic-bread",
    slug: "garlic-bread",
    categorySlug: "extras",
    nameAr: "خبز الثوم",
    nameEn: "Garlic Bread",
    descAr: "خبز طازة بالزبدة والثوم والبقدونس — محمص بالفرن",
    basePriceMinor: toMinorUnits("8"),
    sauce: "golden",
    toppings: [],
    heat: 0,
    badges: [],
    groups: [extras(X_PARMESAN, X_EXTRA_SAUCE)],
  },
  {
    id: "chicken-wings",
    slug: "chicken-wings",
    categorySlug: "extras",
    nameAr: "أجنحة دجاج مشوية",
    nameEn: "Grilled Chicken Wings",
    descAr: "أجنحة متبلة بتتبيلتنا السرية — مشوية على نار هادئة",
    basePriceMinor: toMinorUnits("15"),
    sauce: "golden",
    toppings: ["chicken", "chili"],
    heat: 1,
    badges: [],
    groups: [HEAT, extras(X_EXTRA_SAUCE)],
  },
  // ── مشروبات ──────────────────────────────────────────────────────────
  {
    id: "lemonade",
    slug: "lemonade",
    categorySlug: "drinks",
    nameAr: "ليموناضة طازة",
    nameEn: "Fresh Lemonade",
    descAr: "ليمون طازج بالنعناع — تُحضّر عند الطلب",
    basePriceMinor: toMinorUnits("7"),
    sauce: "golden",
    toppings: [],
    heat: 0,
    badges: ["fresh"],
    groups: [],
  },
  {
    id: "peach-iced-tea",
    slug: "peach-iced-tea",
    categorySlug: "drinks",
    nameAr: "آيس تي الخوخ",
    nameEn: "Peach Iced Tea",
    descAr: "شاي مثلج بالخوخ الطازج — منعش وغير محلي بزيادة",
    basePriceMinor: toMinorUnits("8"),
    sauce: "golden",
    toppings: [],
    heat: 0,
    badges: [],
    groups: [],
  },
  {
    id: "soft-drink",
    slug: "soft-drink",
    categorySlug: "drinks",
    nameAr: "مشروب غازي",
    nameEn: "Soft Drink",
    descAr: "علبة مبردة — اختر نوعك في الملاحظات",
    basePriceMinor: toMinorUnits("5"),
    sauce: "golden",
    toppings: [],
    heat: 0,
    badges: [],
    groups: [],
  },
];

/** Flat delivery fee placeholder — replaced by delivery_zones in Phase 2 (spec §16.2). */
export const PLACEHOLDER_DELIVERY_FEE_MINOR = toMinorUnits("5");

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function featuredProducts(): Product[] {
  return PRODUCTS.filter((p) => p.badges.includes("bestseller")).slice(0, 4);
}
