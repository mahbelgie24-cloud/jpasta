import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

/**
 * Shared E2E helpers. Journeys go through the real UI only (keypad, cart
 * drawer, board buttons) — no API shortcuts — because the flows themselves
 * are the contract (server-recomputed prices, PIN auth, conditional
 * transitions).
 */

let envLoaded = false;

/** Parse the git-ignored .env.local; values are never logged or echoed. */
export function loadLocalEnv(): void {
  if (envLoaded) return;
  envLoaded = true;
  let raw: string;
  try {
    raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  } catch {
    return; // CI provides the environment directly
  }
  for (const line of raw.split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    const key = match?.[1];
    const value = match?.[2];
    if (key && value !== undefined && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/** 6-digit console PIN for the local/CI owner account. */
export function ownerPin(): string {
  loadLocalEnv();
  const pin = process.env.JPASTA_OWNER_PIN;
  if (!pin || !/^\d{6}$/.test(pin)) {
    throw new Error(
      "Console E2E needs JPASTA_OWNER_PIN (6 digits) in .env.local or the environment.",
    );
  }
  return pin;
}

/**
 * Enter a PIN through the real keypad. Clicks before hydration are
 * swallowed, so the entry advances one digit per attempt and only ever
 * considers the pad's own state (dots, busy indicator, error alert) — the
 * pad can never be over-filled and the PIN is submitted exactly once.
 * `toPass` reruns the body until the submission is genuinely in flight (or
 * already rejected/navigated), not merely until one iteration succeeds.
 */
export async function enterPin(page: Page, pin: string): Promise<void> {
  await expect(async () => {
    if (new URL(page.url()).pathname !== "/console/login") return; // navigated
    if (await page.getByText("جارٍ التحقق…").first().isVisible()) return; // in flight
    // allTextContents never waits — the error <p> often does not exist yet.
    const alerts = await page.locator('p[role="alert"]').allTextContents();
    if (alerts.some((text) => text.trim().length > 0)) return; // rejected
    const count = await enteredDigitCount(page);
    if (count < pin.length) {
      await page
        .getByRole("button", { name: pin.charAt(count), exact: true })
        .click();
      await expect(page.locator('[role="status"]').first()).toHaveText(
        `${count + 1} من 6 أرقام`,
      );
    }
    // Six digits entered but the submit has not surfaced yet — keep polling.
    throw new Error("pin entry not settled yet");
  }).toPass({ timeout: 30_000 });
}

/**
 * The pad's progress lives in the sr-only status node the component renders
 * for screen readers («3 من 6 أرقام» / «أدخل الرمز») — always present, so
 * reading it never waits.
 */
async function enteredDigitCount(page: Page): Promise<number> {
  const text =
    (await page
      .locator('[role="status"]')
      .first()
      .textContent()
      .catch(() => "")) ?? "";
  const n = Number.parseInt(text.trim(), 10);
  return Number.isFinite(n) && n >= 1 && n <= 6 ? n : 0;
}

/** Log in through the real keypad path; auto-submits at 6 digits. */
export async function loginAsOwner(page: Page): Promise<void> {
  await page.goto("/console/login");
  await enterPin(page, ownerPin());
  await page.waitForURL(/\/console$/);
}

export interface PlacedOrder {
  orderNumber: string;
  orderId: string;
  accessToken: string;
  /** Token-gated status page path, as handed out by the confirmation UI. */
  statusPath: string;
}

function extractOrderNumber(text: string): string {
  const value = /JP-\d{6}-\d{3,}/.exec(text)?.[0];
  if (!value) throw new Error(`no order number found in: ${text}`);
  return value;
}

async function readConfirmation(page: Page): Promise<PlacedOrder> {
  // On success the sheet's title flips from «سلتك» to «تم استلام طلبك».
  const confirmation = page.getByRole("dialog", { name: "تم استلام طلبك" });
  const heading = confirmation.getByRole("heading", { name: /وصلنا/ });
  await expect(heading).toBeVisible();
  const headingText = (await heading.textContent()) ?? "";
  const orderNumber = extractOrderNumber(headingText);

  const statusPath = await confirmation
    .getByRole("link", { name: "تابع حالة طلبك" })
    .getAttribute("href");
  if (!statusPath) throw new Error("status link missing after placement");
  const url = new URL(statusPath, "http://localhost");
  const orderId = url.pathname.split("/").pop();
  const accessToken = url.searchParams.get("t");
  if (!orderId || !accessToken) {
    throw new Error(`unparseable status link: ${statusPath}`);
  }
  return { orderNumber, orderId, accessToken, statusPath };
}

/** Add the first available product with its default selections. */
export async function addProductToCart(page: Page): Promise<void> {
  await page.goto("/menu");
  await page.getByRole("button", { name: "أضف", exact: true }).first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: /أضف للسلة/ }).click();
  // The thumb-zone cart bar appears only once the cart holds items.
  await expect(page.getByRole("button", { name: /عرض السلة/ })).toBeVisible();
}

/**
 * Place a pickup order through the cart drawer and return the placed-order
 * references from the confirmation screen (order number, id, access token).
 */
export async function placePickupOrder(
  page: Page,
  customer: { name: string; phone: string },
): Promise<PlacedOrder> {
  await addProductToCart(page);
  await page.getByRole("button", { name: /عرض السلة/ }).click();
  const drawer = page.getByRole("dialog", { name: "سلتك" });
  await drawer.getByText("استلام من المحل").click();
  await drawer.getByLabel("الاسم").fill(customer.name);
  await drawer.getByLabel("رقم الهاتف").fill(customer.phone);
  await drawer.getByRole("button", { name: /إرسال الطلب/ }).click();
  return readConfirmation(page);
}

/**
 * Place a delivery order through the cart drawer (zone select + address) and
 * return the placed-order references.
 */
export async function placeDeliveryOrder(
  page: Page,
  customer: { name: string; phone: string; address: string },
): Promise<PlacedOrder> {
  await addProductToCart(page);
  await page.getByRole("button", { name: /عرض السلة/ }).click();
  const drawer = page.getByRole("dialog", { name: "سلتك" });
  // Delivery is the default order type; keep it and fill the extras it adds.
  const zones = drawer.getByLabel("منطقة التوصيل");
  await expect(zones).toBeVisible();
  const zoneOptions = await zones.locator("option").count();
  if (zoneOptions < 1) throw new Error("no active delivery zones in the DB");
  await drawer.getByLabel("العنوان").fill(customer.address);
  await drawer.getByLabel("الاسم").fill(customer.name);
  await drawer.getByLabel("رقم الهاتف").fill(customer.phone);
  // The selected zone's fee must appear in the summary before submit.
  await expect(drawer.getByText("التوصيل", { exact: true })).toBeVisible();
  await drawer.getByRole("button", { name: /إرسال الطلب/ }).click();
  return readConfirmation(page);
}

/** The board card for a given order number (used across console tests). */
export function boardCard(page: Page, orderNumber: string) {
  return page.locator("article", { hasText: orderNumber });
}
