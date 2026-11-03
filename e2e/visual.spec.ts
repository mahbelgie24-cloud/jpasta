import { expect, test } from "@playwright/test";
import { addProductToCart, placePickupOrder } from "./helpers";

/**
 * Visual regression at the three review widths of the design gate (DESIGN
 * §10): 375 / 768 / 1440. Deterministic surfaces get full-page baselines;
 * live-data surfaces (board, kitchen — elapsed-time chips change per second)
 * are gated by the a11y + journey specs instead. Interactive states (item
 * sheet, cart drawer, order status) get viewport baselines at 375, the
 * one-hand mobile width they are designed for.
 *
 * The open/closed chip and the status timestamp depend on the wall clock,
 * so they are masked wherever they appear.
 */

const VIEWPORTS = [
  { name: "375", width: 375, height: 667 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
] as const;

const SURFACES = [
  { path: "/", name: "landing" },
  { path: "/menu", name: "menu" },
  { path: "/privacy", name: "privacy" },
  { path: "/console/login", name: "console-login" },
] as const;

for (const viewport of VIEWPORTS) {
  for (const surface of SURFACES) {
    test(`visual: ${surface.name} @ ${viewport.name}px`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto(surface.path);
      // Self-hosted webfonts must finish before pixel comparison.
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(
        `${surface.name}-${viewport.name}.png`,
        {
          fullPage: true,
          animations: "disabled",
          mask: [page.getByTestId("open-status")],
          maxDiffPixelRatio: 0.02,
        },
      );
    });
  }
}

test.describe("visual: interactive states @ 375", () => {
  test("item sheet over the menu", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/menu");
    await page.evaluate(() => document.fonts.ready);
    await page
      .getByRole("button", { name: "أضف", exact: true })
      .first()
      .click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(page).toHaveScreenshot("item-sheet-375.png", {
      animations: "disabled",
      mask: [page.getByTestId("open-status")],
      maxDiffPixelRatio: 0.02,
    });
  });

  test("cart drawer with a populated checkout", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await addProductToCart(page);
    await page.getByRole("button", { name: /عرض السلة/ }).click();
    const drawer = page.getByRole("dialog", { name: "سلتك" });
    await expect(drawer).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("cart-drawer-375.png", {
      animations: "disabled",
      mask: [page.getByTestId("open-status")],
      maxDiffPixelRatio: 0.02,
    });
  });

  test("order status page with masked live time", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const order = await placePickupOrder(page, {
      name: "زائر اللقطات",
      phone: "0599000421",
    });
    await page.goto(order.statusPath);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("order-status-375.png", {
      fullPage: true,
      animations: "disabled",
      mask: [
        page.getByTestId("status-order-number"),
        page.getByTestId("status-timestamp"),
        page.getByTestId("open-status"),
      ],
      maxDiffPixelRatio: 0.02,
    });
  });
});
