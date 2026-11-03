import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { Result } from "axe-core";
import { loginAsOwner, placePickupOrder } from "./helpers";

/**
 * axe-core gate (spec §6 / DESIGN §8): serious + critical violations fail.
 * The launch gate (§18.5) names /, /menu, /console and /console/kitchen;
 * /privacy and /console/login ride along because they are public surfaces.
 */

async function seriousViolations(page: Page): Promise<Result[]> {
  const results = await new AxeBuilder({ page })
    // The footer wordmark is pure decoration (aria-hidden, 6% opacity) and
    // WCAG 1.4.3 exempts decorative text — axe cannot infer "decorative".
    // Everything else stays in scope.
    .exclude("[data-axe-ignore]")
    .analyze();
  return results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
}

function describeViolations(violations: Result[]): string {
  return violations
    .map((v) => {
      const targets = v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(" | ");
      return `${v.id} (${v.impact}): ${v.help} — ${targets}`;
    })
    .join("\n");
}

const PUBLIC_PATHS = ["/", "/menu", "/privacy", "/console/login"];

for (const path of PUBLIC_PATHS) {
  test(`axe: no serious/critical violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const violations = await seriousViolations(page);
    expect(violations, describeViolations(violations)).toEqual([]);
  });
}

test("axe: no serious/critical violations on /console", async ({ page }) => {
  await loginAsOwner(page);
  await page.goto("/console");
  await expect(page.getByRole("region", { name: "وصل للتو" })).toBeVisible();
  const violations = await seriousViolations(page);
  expect(violations, describeViolations(violations)).toEqual([]);
});

test("axe: no serious/critical violations on /console/kitchen", async ({
  page,
}) => {
  await loginAsOwner(page);
  await page.goto("/console/kitchen");
  const violations = await seriousViolations(page);
  expect(violations, describeViolations(violations)).toEqual([]);
});

test("axe: no serious/critical violations on /console/orders", async ({
  page,
}) => {
  await loginAsOwner(page);
  await page.goto("/console/orders");
  await expect(
    page.getByRole("heading", { name: "أرشيف الطلبات" }),
  ).toBeVisible();
  const violations = await seriousViolations(page);
  expect(violations, describeViolations(violations)).toEqual([]);
});

test("axe: order detail and the printable receipt", async ({ page }) => {
  const order = await placePickupOrder(page, {
    name: "زائر الإيصال",
    phone: "0599000770",
  });
  await loginAsOwner(page);

  await page.goto(`/console/orders/${order.orderId}`);
  await expect(
    page.getByRole("heading", { name: order.orderNumber }),
  ).toBeVisible();
  let violations = await seriousViolations(page);
  expect(violations, describeViolations(violations)).toEqual([]);

  await page.goto(`/console/orders/${order.orderId}/receipt`);
  await expect(
    page.getByRole("article", { name: new RegExp(order.orderNumber) }),
  ).toBeVisible();
  violations = await seriousViolations(page);
  expect(violations, describeViolations(violations)).toEqual([]);
});
