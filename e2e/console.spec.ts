import { expect, test } from "@playwright/test";
import { boardCard, enterPin, loginAsOwner, placePickupOrder } from "./helpers";

/**
 * Console journeys (spec §8.2/§8.3): PIN auth, the live board with its
 * conditional transitions, the KDS, and cancellation with a reason. Every
 * assertion is scoped to the order the test itself placed, so parallel
 * workers sharing the local database never interfere.
 */

test.describe("console auth", () => {
  test("redirects unauthenticated visitors to the PIN login", async ({
    page,
  }) => {
    await page.goto("/console");
    await page.waitForURL(/\/console\/login$/);
    await expect(
      page.getByRole("heading", { name: "كونسول JPasta" }),
    ).toBeVisible();
  });

  test("rejects a wrong PIN with the throttle message", async ({ page }) => {
    await page.goto("/console/login");
    // 000000 is never the seeded PIN; the attempt feeds the DB throttle and
    // the successful login in the other tests clears the counter. Against a
    // dirty local database the throttle may answer instead of the PIN check
    // — both messages are legitimate rejections.
    await enterPin(page, "000000");
    // `p` scopes past Next's empty __next-route-announcer__ [role=alert] div.
    await expect(page.locator('p[role="alert"]')).toContainText(
      /غير صحيح|محاولات كثيرة/,
    );
    await page.waitForURL(/\/console\/login$/);
  });

  test("logs out back to the login screen", async ({ page }) => {
    await loginAsOwner(page);
    await page.getByRole("button", { name: "تسجيل الخروج" }).click();
    await page.waitForURL(/\/console\/login$/);
  });
});

test.describe("console settings", () => {
  // Deliberately changes only cosmetic values: journeys in other parallel
  // workers depend on the ordering flag and the minimum order, so those are
  // enforced at the integration level instead.
  test("owner settings save and persist", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/console/settings");

    const footer = page.getByLabel("تذييل الإيصال");
    await footer.fill("إيصال اختبار آلي — JPasta");
    await page.getByRole("button", { name: "حفظ الإعدادات" }).click();
    await expect(page.getByRole("status")).toContainText("حُفظت");

    // The action revalidates the settings tag — a reload reads the new row.
    await page.reload();
    await expect(page.getByLabel("تذييل الإيصال")).toHaveValue(
      /إيصال اختبار آلي/,
    );

    await page
      .getByLabel("تذييل الإيصال")
      .fill("شكراً لكم — JPasta، باستا طازة تُطبخ عند الطلب");
    await page.getByRole("button", { name: "حفظ الإعدادات" }).click();
    await expect(page.getByRole("status")).toContainText("حُفظت");
  });
});

test.describe("console board", () => {
  test("advances an order received → preparing → ready → completed", async ({
    page,
  }) => {
    const order = await placePickupOrder(page, {
      name: "زائر تجريبي",
      phone: "0599000777",
    });

    await loginAsOwner(page);
    await page.goto("/console");
    const received = page.getByRole("region", { name: "وصل للتو" });
    const card = boardCard(page, order.orderNumber);

    await expect(
      received.locator(`article:has-text("${order.orderNumber}")`),
    ).toBeVisible();
    await expect(card.getByText("زائر تجريبي")).toBeVisible();
    await expect(card.getByRole("link", { name: /0599000777/ })).toBeVisible();

    await card.getByRole("button", { name: "ابدأ التحضير" }).click();
    const preparing = page.getByRole("region", { name: "جارٍ التحضير" });
    await expect(
      preparing.locator(`article:has-text("${order.orderNumber}")`),
    ).toBeVisible();

    await card.getByRole("button", { name: "جاهز" }).click();
    const ready = page.getByRole("region", { name: "جاهز للتسليم" });
    await expect(
      ready.locator(`article:has-text("${order.orderNumber}")`),
    ).toBeVisible();

    await card.getByRole("button", { name: "تم التسليم ✓" }).click();
    await expect(boardCard(page, order.orderNumber)).toHaveCount(0);

    // The status page must reflect the completed state.
    await page.goto(order.statusPath);
    await expect(page.getByText("تم التسليم")).toBeVisible();
  });

  test("cancels an order with a required reason", async ({ page }) => {
    const order = await placePickupOrder(page, {
      name: "زائر ملغى",
      phone: "0599000888",
    });

    await loginAsOwner(page);
    await page.goto("/console");
    const card = boardCard(page, order.orderNumber);
    await expect(card).toBeVisible();

    // Two-press arming, then the inline reason field (no native prompt).
    await card.getByRole("button", { name: "إلغاء" }).click();
    await card.getByLabel("سبب الإلغاء (مطلوب)").fill("إلغاء تجريبي آلي");
    await card.getByRole("button", { name: "تأكيد الإلغاء" }).click();
    await expect(boardCard(page, order.orderNumber)).toHaveCount(0);
  });

  test("shows the ticket on the kitchen display", async ({ page }) => {
    const order = await placePickupOrder(page, {
      name: "زائر مطبخ",
      phone: "0599000999",
    });

    await loginAsOwner(page);
    await page.goto("/console/kitchen");
    await expect(page.getByText(order.orderNumber)).toBeVisible();
  });

  test("archive lists the day's orders and opens the receipt", async ({
    page,
  }) => {
    const order = await placePickupOrder(page, {
      name: "زائر الأرشيف",
      phone: "0599000555",
    });

    await loginAsOwner(page);
    await page.goto("/console/orders");
    await expect(
      page.getByRole("heading", { name: "أرشيف الطلبات" }),
    ).toBeVisible();
    await expect(page.getByText(order.orderNumber).first()).toBeVisible();

    await page
      .getByRole("link", { name: new RegExp(order.orderNumber) })
      .first()
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/console/orders/${order.orderId}$`),
    );
    await expect(
      page.getByRole("heading", { name: order.orderNumber }),
    ).toBeVisible();

    await page.getByRole("link", { name: "الإيصال" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/console/orders/${order.orderId}/receipt$`),
    );
    await expect(page.getByText(order.orderNumber)).toBeVisible();
  });

  test("exports the day as PII-free CSV, with PII only on request", async ({
    page,
  }) => {
    const order = await placePickupOrder(page, {
      name: "زائر التصدير",
      phone: "0599000666",
    });
    await loginAsOwner(page);

    const orders = await page.request.get(
      "/console/reports/export?kind=orders",
    );
    expect(orders.status()).toBe(200);
    expect(orders.headers()["content-type"]).toContain("text/csv");
    const body = await orders.text();
    expect(body).toContain("order_number");
    expect(body).toContain(order.orderNumber);
    expect(body).not.toContain("0599000666");

    const withPii = await page.request.get(
      "/console/reports/export?kind=orders&pii=1",
    );
    expect(await withPii.text()).toContain("0599000666");

    const z = await page.request.get("/console/reports/export?kind=z");
    expect(z.status()).toBe(200);
    expect(await z.text()).toContain("cash_ils");
  });
});

test.describe("manual order entry", () => {
  test("nuggets refuse to submit until a sauce is chosen, then enter the queue", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/console/new");

    await page.getByLabel("ابحث عن صنف").fill("ناجتس");
    await page
      .getByRole("button", { name: /ناجتس الدجاج/ })
      .first()
      .click();

    await page.getByLabel("اسم الزبون").fill("زبون يدوي");
    await page.getByLabel("هاتف الزبون").fill("0599000888");

    await page.getByRole("button", { name: "أدخل الطلب للطابور" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("الصوص");

    await page.getByRole("radio", { name: "بافلو" }).click();
    await page.getByRole("button", { name: "أدخل الطلب للطابور" }).click();
    await expect(
      page.getByRole("heading", { name: /دخل الطابور/ }),
    ).toBeVisible();
  });
});
