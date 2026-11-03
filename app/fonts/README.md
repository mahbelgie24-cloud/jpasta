# Self-hosted font subsets

`amiri-700-ar.woff2` and `fraunces-latin.woff2` are subsets of the open-source
families used by the Basil Atelier identity. They live in the repository so
the worker bundle does not depend on Google Fonts at build time, and so the
page does not download the full upstream files (a ~220 KB critical path).

- **Amiri** — Copyright 2010–2022 The Amiri Project Authors.
  SIL Open Font License 1.1 — https://scripts.sil.org/OFL
  Subset: Arabic (U+060C–0652, U+0670–06D3, U+06F0–06F9), basic Latin,
  punctuation, and the required Arabic shaping features
  (`ccmp, init, medi, fina, rlig, locl`). Weight 700 only (the display
  ladder never uses Amiri 400).
- **Fraunces** — Copyright 2018–2023 The Fraunces Project Authors.
  SIL Open Font License 1.1 — https://scripts.sil.org/OFL
  Subset: basic Latin + punctuation, variable weight axis retained.

Generated with `fonttools pyftsubset` from the official Google Fonts woff2
files. If the subsets are regenerated, keep the shaping features and re-run
the Arabic visual + a11y gates (`npm run test:e2e`).

`fraunces-og.ttf` is the same Fraunces subset decompressed to TTF: Satori
(`next/og`, the share card) does not accept WOFF2, so the OG image reads the
TTF at build time. It is not served to browsers.
