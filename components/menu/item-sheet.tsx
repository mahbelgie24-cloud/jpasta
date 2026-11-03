"use client";

import { useMemo, useState } from "react";
import { DishMedia } from "@/components/brand/dish-media";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { useCart } from "@/components/menu/cart-context";
import { addMinor, multiplyMinor, type Minor } from "@/lib/pricing";
import type { ModifierGroup, Product } from "@/lib/menu-data";

/**
 * Item customization sheet — per-product modifier groups (sauce / pasta type
 * / paid extras). Required groups start unanswered and block the add-to-cart
 * action until the customer chooses. Native radio/checkbox inputs give correct
 * keyboard behaviour and form semantics; the visual pills are labels.
 * Multi-group caps are enforced HERE as well as on the server, so a
 * valid-looking cart never fails at checkout.
 */

interface Selection {
  singles: Record<string, string>;
  multi: Record<string, Set<string>>;
}

function buildSelection(product: Product): Selection {
  const singles: Record<string, string> = {};
  const multi: Record<string, Set<string>> = {};
  for (const g of product.groups) {
    if (g.type === "single") {
      // A required choice must be made by the customer — never sleep-walk
      // into the first option. Optional single groups keep a default.
      if (g.required) continue;
      const first = g.options[0];
      if (first) singles[g.id] = first.id;
    } else {
      multi[g.id] = new Set();
    }
  }
  return { singles, multi };
}

function findOption(group: ModifierGroup, optionId: string) {
  return group.options.find((o) => o.id === optionId);
}

const pillBase =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-basil-600";
const pillActive = "border-2 border-basil-700 bg-basil-50 text-basil-800";
const pillIdle =
  "border-cream-300 bg-cream-100 text-ink-soft hover:border-basil-300";
const pillDisabled = "cursor-not-allowed opacity-45";

export function ItemSheet({
  product,
  open,
  onClose,
  orderingEnabled = true,
}: {
  product: Product;
  open: boolean;
  onClose: () => void;
  orderingEnabled?: boolean;
}) {
  const cart = useCart();
  const [selection, setSelection] = useState<Selection>(() =>
    buildSelection(product),
  );
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  const { unitPriceMinor, detailAr } = useMemo(() => {
    let price: Minor = product.basePriceMinor;
    const details: string[] = [];

    for (const g of product.groups) {
      if (g.type === "single") {
        const optId = selection.singles[g.id];
        const opt = optId ? findOption(g, optId) : undefined;
        if (!opt) continue;
        price = addMinor(price, opt.priceMinor);
        const isNeutral =
          (g.id === "heat" && opt.id === "mild") ||
          (g.id === "doneness" && opt.id === "al-dente");
        if (g.id === "size") details.unshift(opt.nameAr);
        else if (!isNeutral) details.push(opt.nameAr);
      } else {
        for (const id of selection.multi[g.id] ?? []) {
          const opt = findOption(g, id);
          if (opt) {
            price = addMinor(price, opt.priceMinor);
            details.push(opt.nameAr);
          }
        }
      }
    }
    return { unitPriceMinor: price, detailAr: details.join(" • ") };
  }, [product, selection]);

  const total = multiplyMinor(unitPriceMinor, quantity);
  const trimmedNote = note.trim();

  const missingRequired = product.groups.filter((group) => {
    if (!group.required) return false;
    if (group.type === "single") return !selection.singles[group.id];
    return (selection.multi[group.id]?.size ?? 0) === 0;
  });
  const canAdd = orderingEnabled && missingRequired.length === 0;

  function toggleMulti(group: ModifierGroup, optionId: string) {
    setSelection((current) => {
      const next = { ...current.multi };
      const set = new Set(next[group.id] ?? []);
      if (set.has(optionId)) {
        set.delete(optionId);
      } else {
        if (
          group.maxSelections !== undefined &&
          set.size >= group.maxSelections
        ) {
          return current; // cap reached — ignore silently (disabled in UI)
        }
        set.add(optionId);
      }
      next[group.id] = set;
      return { ...current, multi: next };
    });
  }

  function add() {
    if (!canAdd) return;
    const singlesPart = Object.entries(selection.singles)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([groupKey, optionKey]) => `${groupKey}=${optionKey}`)
      .join(",");
    const multiPart = Object.entries(selection.multi)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([groupKey, set]) => `${groupKey}=${[...set].sort().join("+")}`)
      .join("|");
    // A different kitchen note is a different line — never silently merge it
    // into another line and drop the note (v1 defect).
    const key = `${product.id}:${singlesPart}:${multiPart}:${trimmedNote}`;

    const selections = [
      ...Object.entries(selection.singles).map(([groupKey, optionKey]) => ({
        groupKey,
        optionKey,
      })),
      ...Object.entries(selection.multi).flatMap(([groupKey, set]) =>
        [...set].map((optionKey) => ({ groupKey, optionKey })),
      ),
    ];

    cart.add({
      key,
      productId: product.id,
      nameAr: product.nameAr,
      detailAr,
      note: trimmedNote || undefined,
      quantity,
      unitPriceMinor,
      lineTotalMinor: total,
      selections,
    });
    onClose();
    setQuantity(1);
    setNote("");
    setSelection(buildSelection(product));
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={product.nameAr}
      footer={
        <div className="space-y-2">
          {orderingEnabled && missingRequired.length > 0 && (
            <p
              role="status"
              aria-live="polite"
              className="text-center text-xs font-bold text-terracotta"
            >
              اختر {missingRequired.map((g) => g.nameAr).join(" و")} لإتمام
              الإضافة
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <Stepper value={quantity} onChange={setQuantity} label="الكمية" />
            <Button
              type="submit"
              form={`item-form-${product.id}`}
              size="lg"
              className="flex-1"
              disabled={!canAdd}
            >
              {orderingEnabled ? (
                <span className="flex flex-col items-center leading-tight">
                  <span>أضف للسلة</span>
                  <Price minor={total} className="text-sm" />
                </span>
              ) : (
                "الطلب غير متاح مؤقتاً"
              )}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id={`item-form-${product.id}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!orderingEnabled) return;
          add();
        }}
      >
        <div className="flex items-start gap-4">
          <div className="w-32 shrink-0 overflow-hidden rounded-xl bg-cream-100">
            <DishMedia product={product} decorative className="w-full" />
          </div>
          <p className="pt-1 text-sm leading-relaxed text-ink-soft">
            {product.descAr}
          </p>
        </div>

        <div className="mt-5 space-y-5">
          {product.groups.map((group) => {
            const chosen = selection.multi[group.id] ?? new Set<string>();
            const atMax =
              group.maxSelections !== undefined &&
              chosen.size >= group.maxSelections;
            const unanswered =
              group.required &&
              (group.type === "single"
                ? !selection.singles[group.id]
                : chosen.size === 0);
            const hintId = `group-hint-${product.id}-${group.id}`;
            return (
              <fieldset
                key={group.id}
                aria-describedby={unanswered ? hintId : undefined}
              >
                <legend className="flex items-center gap-2 text-sm font-bold text-ink">
                  {group.nameAr}
                  {group.required && (
                    <>
                      <span className="text-terracotta" aria-hidden>
                        *
                      </span>
                      <span className="text-[11px] font-bold text-terracotta">
                        مطلوب
                      </span>
                    </>
                  )}
                  {group.type === "multi" &&
                    group.maxSelections !== undefined &&
                    group.maxSelections > 1 && (
                      <span className="text-xs font-normal text-ink-soft">
                        (حتى {group.maxSelections})
                      </span>
                    )}
                </legend>

                {unanswered && (
                  <p
                    id={hintId}
                    className="mt-1 text-xs font-bold text-terracotta"
                  >
                    اختر خياراً واحداً للمتابعة
                  </p>
                )}

                <div className="mt-2.5 flex flex-wrap gap-2">
                  {group.options.map((opt) => {
                    if (group.type === "single") {
                      const active = selection.singles[group.id] === opt.id;
                      return (
                        <label
                          key={opt.id}
                          className={`${pillBase} ${active ? pillActive : pillIdle}`}
                        >
                          <input
                            type="radio"
                            name={`group-${product.id}-${group.id}`}
                            value={opt.id}
                            checked={active}
                            onChange={() =>
                              setSelection((s) => ({
                                ...s,
                                singles: { ...s.singles, [group.id]: opt.id },
                              }))
                            }
                            className="sr-only"
                          />
                          {opt.nameAr}
                          {opt.priceMinor > 0 && (
                            <Price minor={opt.priceMinor} className="text-xs" />
                          )}
                        </label>
                      );
                    }

                    const active = chosen.has(opt.id);
                    const disabled = atMax && !active;
                    return (
                      <label
                        key={opt.id}
                        className={`${pillBase} ${active ? pillActive : pillIdle} ${disabled ? pillDisabled : ""}`}
                      >
                        <input
                          type="checkbox"
                          name={`group-${product.id}-${group.id}`}
                          value={opt.id}
                          checked={active}
                          disabled={disabled}
                          onChange={() => toggleMulti(group, opt.id)}
                          className="sr-only"
                        />
                        {opt.nameAr}
                        {opt.priceMinor > 0 && (
                          <Price minor={opt.priceMinor} className="text-xs" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <div>
            <label
              htmlFor={`note-${product.id}`}
              className="text-sm font-bold text-ink"
            >
              ملاحظة للمطبخ{" "}
              <span className="font-normal text-ink-soft">(اختياري)</span>
            </label>
            <input
              id={`note-${product.id}`}
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={140}
              placeholder="مثال: بدون بصل، صلصة زيادة عالجنب…"
              className="mt-2 min-h-12 w-full rounded-md border border-cream-300 bg-cream-50 px-4 text-sm transition-colors outline-none placeholder:text-ink-soft/50 focus:border-basil-500"
            />
          </div>
        </div>
      </form>
    </Sheet>
  );
}
