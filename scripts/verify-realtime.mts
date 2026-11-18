/**
 * Production realtime verification (DEPLOY.md §5.4) — the deploy-gate check
 * that used to live as an ad-hoc recipe in /tmp (HANDOFF §2 lesson: ephemeral
 * tooling dies with /tmp).
 *
 * Two real browser contexts through the real UI only (keypad login, cart
 * drawer, board buttons — no API shortcuts):
 *   context A (console): keypad login, waits for the feed to settle.
 *   context B (storefront): places a real pickup order, then the script
 *   measures confirmation→ticket latency and enforces the spec §18.5 gate
 *   (< 1s) whenever the target is NOT local — a non-local target that never
 *   reaches «مباشر» FAILS the gate (a Durable Object outage must never read
 *   as a green deploy). Only a clearly-local target (plain `next start`,
 *   no DO) may warn instead.
 *
 * Self-cleaning by design: the test order is cancelled from the board with
 * a documented reason — best-effort even on failure paths, and an uncleaned
 * order is reported loudly so a human can cancel it (the JP-261116-001
 * lesson: a verification run must never pollute the live board).
 *
 * Run: npx tsx scripts/verify-realtime.mts [--base https://jpasta.ascendly.space]
 * Env: JPASTA_OWNER_PIN (6 digits, .env.local or environment) — never logged.
 */
import { chromium, expect, type Page } from "@playwright/test";
import {
  enterPin,
  loadLocalEnv,
  ownerPin,
  placePickupOrder,
  type PlacedOrder,
} from "../e2e/helpers";

loadLocalEnv();

const args = process.argv.slice(2);
const baseFlag = args.indexOf("--base");
const baseValue = baseFlag >= 0 ? args[baseFlag + 1] : undefined;
if (baseFlag >= 0 && !baseValue) {
  console.error("✗ --base needs a URL argument, e.g. --base https://jpasta.ps");
  process.exit(1);
}
const BASE =
  baseValue ?? process.env.VERIFY_BASE_URL ?? "http://127.0.0.1:3220";

// The owner PIN crosses the network to exactly this origin — https is the
// only acceptable transport off the private ranges (audit finding).
const baseUrl = new URL(BASE);
if (!/^https?:$/.test(baseUrl.protocol)) {
  console.error(
    `✗ refusing --base protocol ${baseUrl.protocol} (http/https only)`,
  );
  process.exit(1);
}
const hostname = baseUrl.hostname.replace(/^\[|\]$/g, "");
const PRIVATE_HOST =
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  hostname.endsWith(".localhost") ||
  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
if (baseUrl.protocol !== "https:" && !PRIVATE_HOST) {
  console.error(
    `✗ refusing non-https base ${baseUrl.protocol}//${hostname} — pass https:// for production`,
  );
  process.exit(1);
}
// A non-local target runs the strict gate; only localhost may warn (no DO).
const IS_LOCAL = PRIVATE_HOST;

const LIVE_BUDGET_MS = 1_000; // spec §18.5: realtime ticket latency < 1s
const CONNECT_TIMEOUT_MS = 45_000;
const APPEAR_TIMEOUT_MS = 15_000;
const CANCEL_REASON = "تنظيف فحص النشر الآلي — تم التحقق بنجاح";

function fail(message: string): never {
  // exitCode + throw (never process.exit): finally must still run so the
  // browser closes and the best-effort cancellation gets its chance.
  console.error(`✗ ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

async function cancelTestOrder(
  consolePage: Page,
  orderNumber: string,
): Promise<void> {
  const card = consolePage.locator("article", { hasText: orderNumber });
  await card.getByRole("button", { name: "إلغاء" }).click();
  await card.getByLabel("سبب الإلغاء (مطلوب)").fill(CANCEL_REASON);
  await card.getByRole("button", { name: "تأكيد الإلغاء" }).click();
  await card.waitFor({ state: "detached", timeout: 10_000 });
}

async function diagnoseStorefront(page: Page, error: unknown): Promise<never> {
  // A deploy gate must say WHY it failed, not just "Timeout waiting for …".
  const alerts = await page
    .locator('p[role="alert"]')
    .allTextContents()
    .catch(() => []);
  const shot = `/tmp/verify-realtime-failure-${Date.now()}.png`;
  await page.screenshot({ path: shot }).catch(() => undefined);
  console.error(`✗ storefront flow failed: ${String(error)}`);
  console.error(`  page: ${page.url()}`);
  console.error(
    `  alerts: ${JSON.stringify(alerts.filter((t: string) => t.trim()))}`,
  );
  console.error(`  screenshot: ${shot}`);
  process.exitCode = 1;
  throw error instanceof Error ? error : new Error(String(error));
}

const pin = ownerPin();

const browser = await chromium.launch();
let consolePage: Page | undefined;
let placed: PlacedOrder | undefined;
let cancelled = false;
try {
  // One shared baseURL: the e2e helpers navigate with relative paths.
  const consoleCtx = await browser.newContext({ baseURL: BASE });
  const storeCtx = await browser.newContext({ baseURL: BASE });
  consolePage = await consoleCtx.newPage();
  const storePage = await storeCtx.newPage();

  // 1. Console: real keypad login, then wait for a SETTLED feed state. On a
  // non-local target the settled state must be «مباشر» — the Durable Object
  // is the contract there, and polling forever means the gate fails.
  await consolePage.goto("/console/login");
  await enterPin(consolePage, pin);
  await consolePage.waitForURL(/\/console$/);
  const badge = consolePage
    .getByText(/مباشر|تحديث دوري|غير متصل|جارٍ الاتصال…/)
    .first();
  await badge.waitFor({ state: "visible", timeout: 30_000 });
  if (IS_LOCAL) {
    await expect(badge).not.toHaveText("جارٍ الاتصال…", {
      timeout: CONNECT_TIMEOUT_MS,
    });
  } else {
    await expect(badge).toHaveText("مباشر", { timeout: CONNECT_TIMEOUT_MS });
  }
  const mode = (await badge.textContent())?.trim() ?? "unknown";
  console.log(`connection: ${mode}`);

  // 2. Storefront: place a real pickup order through the cart drawer.
  try {
    placed = await placePickupOrder(storePage, {
      name: "فحص النشر الآلي",
      phone: "0599000777",
    });
  } catch (error) {
    await diagnoseStorefront(storePage, error);
  }
  if (!placed) {
    fail("order placement did not complete — no order to verify");
  }
  console.log(`order placed: ${placed.orderNumber}`);

  // 3. Measure confirmation→ticket latency (helpers stamp confirmedAt the
  // moment the confirmation heading becomes visible — the closest
  // real-UI proxy for the DB commit).
  const card = consolePage.locator("article", {
    hasText: placed.orderNumber,
  });
  await card.waitFor({ state: "visible", timeout: APPEAR_TIMEOUT_MS });
  const latencyMs = Date.now() - placed.confirmedAt;

  // 4. Self-clean: cancel the test order with a documented reason.
  await cancelTestOrder(consolePage, placed.orderNumber);
  cancelled = true;

  await storePage.close();
  await consolePage.close();
  await consoleCtx.close();
  await storeCtx.close();

  const result = {
    base: BASE,
    mode,
    orderNumber: placed.orderNumber,
    latencyMs,
    cancelled,
  };
  console.log(JSON.stringify(result, null, 2));

  if (mode === "مباشر") {
    if (latencyMs > LIVE_BUDGET_MS) {
      fail(
        `realtime latency ${latencyMs}ms exceeds the ${LIVE_BUDGET_MS}ms gate`,
      );
    }
    console.log(`✓ realtime gate passed: ${latencyMs}ms < ${LIVE_BUDGET_MS}ms`);
  } else if (IS_LOCAL) {
    console.log(
      `⚠ feed is "${mode}" (no Durable Object on a local target) — the <${LIVE_BUDGET_MS}ms gate applies to production runs`,
    );
  } else {
    fail(
      `non-local target settled on "${mode}" instead of «مباشر» — the realtime feed is not healthy`,
    );
  }
} finally {
  // Best-effort cleanup: a crashed verification must never strand a test
  // order on the live board. Never masks the original error.
  if (placed && !cancelled && consolePage) {
    try {
      await cancelTestOrder(consolePage, placed.orderNumber);
      cancelled = true;
      console.log(`cleaned up test order ${placed.orderNumber}`);
    } catch {
      console.error(
        `✗ UNCLEANED test order ${placed.orderNumber} — cancel it manually in /console`,
      );
    }
  }
  await browser.close();
}
