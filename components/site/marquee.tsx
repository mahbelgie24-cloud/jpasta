const ITEMS = [
  "باستا طازة يومياً",
  "صلصات بيتية",
  "دجاج طازج متبّل",
  "توصيل داخل قلقيلية",
  "Fresh Pasta Daily",
  "مخبوزة بالفرن",
];

/** Ambient marquee — the single ambient animation (brand.md §4). */
export function Marquee() {
  const list = [...ITEMS, ...ITEMS];
  return (
    <div
      className="overflow-hidden border-y border-basil-800 bg-basil-800 py-3.5"
      aria-hidden
    >
      <div
        dir="ltr"
        className="flex w-max animate-marquee items-center gap-8 motion-reduce:animate-none"
      >
        {list.map((item, i) => (
          <span
            key={i}
            dir="rtl"
            className="flex items-center gap-8 whitespace-nowrap"
          >
            <span className="text-sm font-bold text-cream-100">{item}</span>
            <span className="size-1.5 rounded-full bg-wheat-400" />
          </span>
        ))}
      </div>
    </div>
  );
}
