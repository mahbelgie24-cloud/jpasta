import { expect, test } from "@playwright/test";

/**
 * Reduced-motion pass (DESIGN.md §10 checklist): with the OS preference set,
 * every animation collapses to 0.01 ms (globals.css global rule) and the
 * ambient marquee opts out entirely via motion-reduce:animate-none.
 */

const ANIMATED_SELECTORS = [
  { name: "ambient marquee", selector: ".animate-marquee" },
  { name: "hero entrance", selector: ".animate-fade-up" },
];

test.describe("prefers-reduced-motion: reduce", () => {
  test.use({ reducedMotion: "reduce" });

  for (const { name, selector } of ANIMATED_SELECTORS) {
    test(`collapses ${name}`, async ({ page }) => {
      await page.goto("/");
      const element = page.locator(selector).first();
      await expect(element).toBeVisible();
      const duration = await element.evaluate(
        (el) => getComputedStyle(el).animationDuration,
      );
      // The global collapse sets 0.01ms — effectively zero, never the
      // authored spring/marquee durations.
      expect(parseFloat(duration)).toBeLessThanOrEqual(0.05);
    });
  }

  test("scroll behaviour stops animating", async ({ page }) => {
    await page.goto("/");
    const behaviour = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    );
    expect(behaviour).toBe("auto");
  });
});

test.describe("motion allowed (sanity that the gate can tell)", () => {
  test("marquee animates when the preference is not set", async ({ page }) => {
    await page.goto("/");
    const element = page.locator(".animate-marquee").first();
    await expect(element).toBeVisible();
    const duration = await element.evaluate(
      (el) => getComputedStyle(el).animationDuration,
    );
    expect(parseFloat(duration)).toBeGreaterThan(1);
  });
});
