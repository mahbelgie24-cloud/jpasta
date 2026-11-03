import { expect, test } from "@playwright/test";
import {
  addProductToCart,
  placeDeliveryOrder,
  placePickupOrder,
} from "./helpers";

/**
 * Storefront journeys (spec §8.1): landing, menu + search, and the two
 * ordering channels (pickup / delivery) through the real cart drawer, with
 * the token-gated status page closing the loop.
 */

test.describe("landing", () => {
  test("tells the brand story and offers the menu", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "باستا",
    );
    const menuLink = page.getByRole("link", { name: /القائمة|اطلب/ }).first();
    await expect(menuLink).toBeVisible();
    await expect(menuLink).toHaveAttribute("href", /\/menu/);
    // The visit section carries hours + location (spec §1 business facts).
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });
});

test.describe("menu", () => {
  test("lists products and search filters by dish name", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.getByRole("heading", { name: "القائمة" })).toBeVisible();

    const cards = page.locator("article");
    const total = await cards.count();
    expect(total).toBeGreaterThan(0);

    // Search by the first product's own name — no hardcoded catalog facts.
    const first =
      (await page.locator("article h3").first().textContent()) ?? "";
    const query = first.trim();
    await page.getByLabel("ابحث في القائمة").fill(query);
    const results = page.locator("article h3");
    await expect(results.first()).toHaveText(query);
    expect(await results.count()).toBeLessThanOrEqual(total);

    await page.getByRole("button", { name: "مسح البحث" }).click();
    await expect(cards).toHaveCount(total);
  });

  test("checkout rejects a submission without a name", async ({ page }) => {
    await addProductToCart(page);
    await page.getByRole("button", { name: /عرض السلة/ }).click();
    const drawer = page.getByRole("dialog", { name: "سلتك" });
    await drawer.getByRole("button", { name: /إرسال الطلب/ }).click();
    await expect(
      drawer.getByText("اكتب اسمك حتى نعرف لمن الطلب."),
    ).toBeVisible();
  });
});

test.describe("order journeys", () => {
  test("pickup order reaches the status page", async ({ page }) => {
    const order = await placePickupOrder(page, {
      name: "زائر تجريبي",
      phone: "0599000123",
    });
    await page.goto(order.statusPath);
    await expect(page.getByText(order.orderNumber)).toBeVisible();
    await expect(page.getByText("وصل طلبك")).toBeVisible();
    // Pickup carries no delivery fee — the breakdown shows a total only.
    await expect(page.getByText("الإجمالي")).toBeVisible();
    await expect(page.getByText("التوصيل")).toHaveCount(0);
  });

  test("delivery order carries the selected zone fee", async ({ page }) => {
    const order = await placeDeliveryOrder(page, {
      name: "زائر توصيل",
      phone: "0599000456",
      address: "حي الجном، قرب جامع الرحمة — اختبار آلي",
    });
    await page.goto(order.statusPath);
    await expect(page.getByText(order.orderNumber)).toBeVisible();
    // The zone row proves the fee came from the customer's zone (v2 §18.2).
    await expect(page.getByText(/التوصيل —/)).toBeVisible();
  });
});
