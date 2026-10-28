const ITEMS = [
  "ألفريدو كلاسيكو",
  "مارينارا",
  "بيستو جينوفيز",
  "بينك صوص",
  "دجاج مشوي",
  "أربياتا",
  "فيتوتشيني",
  "بارميزان",
];

const LATIN = "F R E S H   P A S T A   ·   D A I L Y";

/** Ambient marquee — the single ambient animation (brand.md §4). */
export function Marquee() {
  const list = [...ITEMS, ...ITEMS];
  return (
    <div
      dir="ltr"
      className="overflow-hidden border-y border-wheat-500/30 bg-wheat-300 py-3.5 text-basil-950"
      aria-hidden
    >
      <div className="flex w-max animate-marquee items-center gap-8 motion-reduce:animate-none">
        {list.map((item, i) => (
          <span
            key={i}
            dir="rtl"
            className="flex items-center gap-8 whitespace-nowrap"
          >
            <span className="font-display-ar text-lg font-bold">{item}</span>
            <span className="size-1.5 rounded-full bg-basil-800/50" />
          </span>
        ))}
        <span
          dir="ltr"
          className="px-4 text-xs font-bold tracking-[0.3em] whitespace-nowrap text-basil-800/70"
        >
          {LATIN}
        </span>
      </div>
    </div>
  );
}
