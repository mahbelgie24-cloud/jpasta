# JPasta — Menu Photo Prompt Pack

Use this with Midjourney, Flux, DALL·E, Ideogram, Firefly, or any realistic
food-photography model. Generate a **style reference** once (Fettuccine
Mushroom is a good first dish), then use that image as a style/reference image
for the rest so the whole menu feels like one shoot.

## The menu (12 items)

| #   | Arabic            | English              | Category         | Price |
| --- | ----------------- | -------------------- | ---------------- | ----- |
| 1   | فيتوتشيني مع فطر  | Fettuccine Mushroom  | الباستا          | ₪20   |
| 2   | بيني بيستو        | Penne Pesto          | الباستا          | ₪25   |
| 3   | فيتوتشيني ألفريدو | Fettuccine Alfredo   | الباستا          | ₪20   |
| 4   | سموكد باستا       | Smoked Pasta         | الباستا          | ₪25   |
| 5   | ستروجانوف باستا   | Stroganoff Pasta     | الباستا          | ₪30   |
| 6   | باستا ليمون       | Lemon Pasta          | الباستا          | ₪20   |
| 7   | كرانشي تشيز باستا | Crunchy Cheese Pasta | الباستا          | ₪20   |
| 8   | فيتوتشيني بيستو   | Fettuccine Pesto     | الباستا          | ₪25   |
| 9   | موزاريلا باستا    | Mozzarella Pasta     | الباستا          | ₪25   |
| 10  | بيني ألفريدو      | Penne Alfredo        | الباستا          | ₪20   |
| 11  | تبولة             | Tabbouleh            | السلطات          | ₪15   |
| 12  | ناجتس الدجاج      | Chicken Nuggets      | الأطباق الجانبية | ₪15   |

The paid chicken add-on (+₪10, pasta dishes only) and the four nugget sauces
(BBQ, sweet chili, buffalo, teriyaki) are modifiers — they do **not** need
separate hero photos. One nugget photo with a small sauce bowl is enough.

## Master style (append to every dish)

```text
Editorial food photography for a premium fresh-pasta restaurant in warm
Mediterranean daylight; soft directional window light from the left, gentle
natural shadows; cream linen tablecloth; hand-thrown cream ceramic plate;
subtle basil-green ceramic and wheat-gold props; brushed copper cutlery; 85mm
lens at f/2.2; 45-degree eye-level angle; shallow depth of field; natural
textures, glossy sauce, visible steam, fresh garnish; realistic, high-end
restaurant menu, rich but natural color grade of cream, basil green, wheat
gold and ripe tomato; no text, no logo, no watermark, no hands, no people;
4:3 landscape; 1600x1200.
```

**Negative prompt (all images):**

```text
illustration, cartoon, 3D render, CGI, plastic, wax, artificial, oversaturated,
neon, HDR, harsh flash, text, watermark, logo, packaging, hands, people,
cluttered cutlery, dirty plate, blurry, low resolution, deformed food,
duplicate utensils, floating ingredients.
```

## Per-dish prompts

Append the master style to each subject, or paste the complete prompt below.
The subject is what changes; the set, light, lens and grade stay identical.

1. **Fettuccine Mushroom** — A generous nest of fresh fettuccine in a silky ivory Alfredo sauce with golden sautéed mushrooms, shaved parmesan, cracked black pepper and one basil leaf; cream plate, copper fork.
2. **Penne Pesto** — Penne coated in vivid basil pesto, toasted pine nuts, shaved parmesan and fresh basil; cream plate, basil-green linen.
3. **Fettuccine Alfredo** — Fettuccine twirled in a glossy ivory parmesan Alfredo, shaved parmesan, cracked black pepper, a small basil leaf; cream plate, copper fork.
4. **Smoked Pasta** — Smoked penne in creamy Alfredo with melted golden cheddar, a glossy cheese pull, cracked pepper and a little parsley; cream plate, warm window light.
5. **Stroganoff Pasta** — Fettuccine with seared chicken strips, red pepper, onion and mushrooms in a creamy sauce, fresh parsley, cream plate, copper cutlery.
6. **Lemon Pasta** — Fettuccine in a bright lemon-butter sauce, shaved parmesan, lemon zest, cracked pepper, fresh basil, a charred lemon half beside the plate; bright airy light.
7. **Crunchy Cheese Pasta** — Fettuccine or penne in a creamy cheese sauce topped with a generous layer of crunchy orange cheese snack crumbs, extra crumbs scattered beside; cream plate, playful but premium.
8. **Fettuccine Pesto** — Fettuccine coated in vivid basil pesto, parmesan, toasted pine nuts, fresh basil; cream plate, basil-green linen.
9. **Mozzarella Pasta** — Penne in a creamy mushroom sauce with melted mozzarella stretching from the fork, fresh basil, cream plate, copper spoon.
10. **Penne Alfredo** — Penne in a silky ivory Alfredo sauce, shaved parmesan, cracked black pepper, small basil leaf; cream plate, copper fork.
11. **Tabbouleh** — A fresh, generous tabbouleh of parsley, fine bulgur, tomato, mint, lemon and olive oil in a shallow cream ceramic bowl, lemon wedge, fresh mint; bright Mediterranean light, cream linen.
12. **Chicken Nuggets** — Golden crispy fried chicken nuggets in a cream ceramic basket lined with parchment, a small bowl of glossy BBQ sauce beside, fresh parsley; cream plate, warm light.

## Consistency checklist

- Generate **one reference image** first; reuse it as `--sref` (Midjourney),
  image reference (Flux), or style reference (Firefly) for the rest.
- Keep the same **surface, plate, linen, cutlery, light direction, lens and
  grade** across all 12; only the dish changes.
- Export **JPEG/WebP, 4:3, 1600×1200**, under **8 MB** (the upload limit).
- No text, logos, brands, hands or people; realistic food only.
- Upload from `/console/menu` → «رفع صورة الطبق»; the owner console stores it
  in R2. Dishes without a photo keep the DishArt illustration (never broken).
- Write the alt text as the dish name (e.g., «فيتوتشيني مع فطر»).

## Bundled catalog pipeline (the 12 launch photos)

The launch photos ship **inside the repo**, not as console uploads:

1. Put the high-resolution originals in `menu/` using the Arabic dish names
   below. The folder is git-ignored (≈100 MB); only the derivatives are
   committed.
2. Run `npm run photos`. It writes
   `public/media/products/<slug>.webp` (1600×1200, 4:3, WebP, metadata
   stripped, under 500 KB), samples the edge tone, generates a 24 px inline
   LQIP, and refreshes `lib/dish-photos.generated.ts`.
3. Run `npm run db:menu` (or `npm run db:seed` on first provision) to attach
   `image_key`, `image_alt`, `image_width`, `image_height` and `image_color`
   to every product. Re-running `--catalog` re-attaches them automatically.
4. `DishMedia` serves bundled keys from `/media/...` and owner uploads from
   `/api/media/...`; the seed/test suite fails if a manifest entry has no
   matching file.

Mapping used by `scripts/import-dish-photos.mjs` (the source filenames are
not always identical to the seeded Arabic name):

| Source in `menu/`     | Slug / output               |
| --------------------- | --------------------------- |
| فيتوتشيني مع فطر.png  | `fettuccine-mushroom.webp`  |
| بيني بيستو.png        | `penne-pesto.webp`          |
| فيتوتشيني الفريدو.png | `fettuccine-alfredo.webp`   |
| سموكد باستا.png       | `smoked-pasta.webp`         |
| سترجنانوف باستا.png   | `stroganoff-pasta.webp`     |
| باستا ليمون.png       | `lemon-pasta.webp`          |
| كرانشي تشيز باستا.png | `crunchy-cheese-pasta.webp` |
| فيتوتشيني بيستو.png   | `fettuccine-pesto.webp`     |
| موزاريلا باستا.png    | `mozzarella-pasta.webp`     |
| بيني الفريدو.png      | `penne-alfredo.webp`        |
| سلطة تبولة.png        | `tabbouleh.webp`            |
| ناجتس الدجاج.png      | `chicken-nuggets.webp`      |

## Logo — official asset only

The identity is the supplied **JPasta roundel** (green field, double cream
ring, outlined `JPASTA` wordmark, `Fresh Pasta & Chicken`). It is a finished
asset, not a prompt target: do not generate alternative marks, do not redraw
it, and do not typeset the wordmark in another font.

- Full rules, clear space and minimum sizes: `docs/brand/brand.md` §5.
- Sources: `public/brand/logo.svg` (roundel), `logo-mark.svg` (compact),
  `logo-mono.svg` (print), `logo-horizontal.svg` (header plaque only).
- Icons: `npm run icons` regenerates `app/favicon.ico`, `app/icon.svg`,
  Apple/PWA/maskable/monochrome icons and `public/brand/logo-512.png` from
  the roundel sources, not the header plaque.
