import { afterEach, describe, expect, it, vi } from "vitest";
import * as settingsModule from "@/lib/server/settings";
import { placeOrder } from "@/lib/server/orders";

/**
 * The settings table carries the owner's ordering kill switch and minimum
 * order. If it cannot be read, the money path must refuse the order rather
 * than silently re-enabling storefront intake with a zero minimum.
 */
describe("shop settings fail closed", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses an order when the settings read fails", async () => {
    vi.spyOn(settingsModule, "readShopSettings").mockRejectedValue(
      new settingsModule.ShopSettingsUnavailableError("database down"),
    );

    const result = await placeOrder({
      idempotencyKey: "settings-unavailable-1",
      channel: "takeaway",
      customer: {
        name: "زبون",
        phone: "0566064976",
        address: "",
      },
      lines: [
        {
          productId: "00000000-0000-4000-8000-000000000000",
          quantity: 1,
          selections: [],
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("غير متاحة");
  });
});
