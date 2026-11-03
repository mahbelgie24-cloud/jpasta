import { expect, test } from "@playwright/test";
import { addProductToCart } from "./helpers";

/**
 * Keyboard-only pass (DESIGN.md §10 checklist): skip link actually moves
 * focus (WCAG 2.4.1), native-dialog sheets trap focus and return it, and
 * the thumb-zone cart bar is reachable without a pointer.
 */

test.describe("mandatory modifiers", () => {
  test("chicken nuggets cannot be added without choosing a sauce", async ({
    page,
  }) => {
    await page.goto("/menu");
    const card = page.locator("article", { hasText: "ناجتس الدجاج" });
    await card.getByRole("button", { name: "أضف", exact: true }).click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const add = sheet.getByRole("button", { name: /أضف للسلة/ });
    await expect(add).toBeDisabled();
    await expect(sheet.getByText("اختر خياراً واحداً للمتابعة")).toBeVisible();

    await sheet.locator("label").filter({ hasText: "بافلو" }).click();
    await expect(sheet.getByRole("radio", { name: "بافلو" })).toBeChecked();
    await expect(add).toBeEnabled();
    await add.click();

    await page.getByRole("button", { name: /عرض السلة/ }).click();
    const drawer = page.getByRole("dialog", { name: "سلتك" });
    await expect(drawer.getByText("بافلو")).toBeVisible();
  });
});

test.describe("keyboard-only", () => {
  for (const path of ["/", "/menu"]) {
    test(`skip link moves focus to <main> on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: "تخطَّ إلى المحتوى" }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator("main")).toBeFocused();
    });
  }

  test("item sheet traps focus and returns it to the trigger on Esc", async ({
    page,
  }) => {
    await page.goto("/menu");
    const trigger = page
      .getByRole("button", { name: "أضف", exact: true })
      .first();
    await trigger.focus();
    await page.keyboard.press("Enter");

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    // Focus must be inside the dialog while it is open (focus trap).
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.closest("dialog") !== null),
      )
      .toBe(true);

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    // Native <dialog> returns focus to the invoker — never lost (DESIGN §8).
    await expect(trigger).toBeFocused();
  });

  test("cart bar is reachable and operable by keyboard", async ({ page }) => {
    await addProductToCart(page);
    const cartBar = page.getByRole("button", { name: /عرض السلة/ });
    await cartBar.focus();
    await page.keyboard.press("Enter");

    const drawer = page.getByRole("dialog", { name: "سلتك" });
    await expect(drawer).toBeVisible();
    // Esc closes the checkout sheet from the keyboard alone.
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  });
});
