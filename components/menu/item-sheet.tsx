"use client";

import { useMemo, useState } from "react";
import { DishIllustration } from "@/components/brand/dish-illustration";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { useCart } from "@/components/menu/cart-context";
import { addMinor, type Minor } from "@/lib/pricing";
import type { ModifierGroup, Product } from "@/lib/menu-data";

/**
 * Item customization sheet — pasta-accurate groups (size / heat / doneness /
 * extras) with a live total. Required groups preselect their first option;
 * the cart key hashes the selection so identical customizations merge.
 */

interface Selection {
  singles: Record<string, string>; // groupId -> optionId
  extras: Set<string>;
}

function buildSelection(product: Product): Selection {
  const singles: Record<string, string> = {};
  for (const g of product.groups) {
    if (g.type === "single") {
      const first = g.options[0];
      if (first) singles[g.id] = first.id;
    }
  }
  return { singles, extras: new Set() };
}

function findOption(group: ModifierGroup, optionId: string) {
  return group.options.find((o) => o.id === optionId);
}

export function ItemSheet({
  product,
  open,
  onClose,
}: {
  product: Product;
  open: boolean;
  onClose: () => void;
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
        if (opt) {
          price = addMinor(price, opt.priceMinor);
          const isNeutral =
            (g.id === "heat" && opt.id === "mild") ||
            (g.id === "doneness" && opt.id === "al-dente");
          if (!isNeutral && g.id !== "size") details.push(opt.nameAr);
          if (g.id === "size") details.unshift(opt.nameAr);
        }
      } else {
        for (const id of selection.extras) {
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

  const total = unitPriceMinor * quantity;

  function add() {
    const extrasIds = [...selection.extras].sort().join(",");
    const key = `${product.id}:${selection.singles["size"] ?? "one"}:${selection.singles["heat"] ?? "-"}:${selection.singles["doneness"] ?? "-"}:${extrasIds}`;
    // group.id === modifier_groups.key and option.id === modifiers.key in the
    // seeded schema, so the selections map 1:1 onto the server contract.
    const selections = [
      ...Object.entries(selection.singles).map(([groupKey, optionKey]) => ({
        groupKey,
        optionKey,
      })),
      ...[...selection.extras].map((optionKey) => ({
        groupKey: "extras",
        optionKey,
      })),
    ];
    cart.add({
      key,
      productId: product.id,
      nameAr: product.nameAr,
      detailAr,
      note: note.trim() || undefined,
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
        <div className="flex items-center justify-between gap-3">
          <Stepper value={quantity} onChange={setQuantity} label="الكمية" />
          <Button size="lg" onClick={add} className="flex-1">
            أضف للسلة · <Price minor={total} />
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-4">
        <div className="w-28 shrink-0 rounded-xl bg-cream-100 p-2">
          <DishIllustration
            sauce={product.sauce}
            toppings={product.toppings}
            className="w-full"
          />
        </div>
        <p className="pt-1 text-sm leading-relaxed text-ink-soft">
          {product.descAr}
        </p>
      </div>

      <div className="mt-5 space-y-5">
        {product.groups.map((group) => (
          <fieldset key={group.id}>
            <legend className="flex items-center gap-2 text-sm font-bold text-ink">
              {group.nameAr}
              {group.required && <span className="text-terracotta">*</span>}
              {group.type === "multi" && group.maxSelections && (
                <span className="text-xs font-normal text-ink-soft">
                  (حتى {group.maxSelections})
                </span>
              )}
            </legend>

            {group.type === "single" ? (
              <div
                className="mt-2.5 flex flex-wrap gap-2"
                role="radiogroup"
                aria-label={group.nameAr}
              >
                {group.options.map((opt) => {
                  const active = selection.singles[group.id] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() =>
                        setSelection((s) => ({
                          ...s,
                          singles: { ...s.singles, [group.id]: opt.id },
                        }))
                      }
                      className={
                        active
                          ? "inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-basil-700 bg-basil-50 px-4 text-sm font-bold text-basil-800"
                          : "inline-flex min-h-11 items-center gap-2 rounded-full border border-cream-300 bg-cream-100 px-4 text-sm font-bold text-ink-soft transition-colors hover:border-basil-300"
                      }
                    >
                      {opt.nameAr}
                      {opt.priceMinor > 0 && (
                        <Price minor={opt.priceMinor} className="text-xs" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {group.options.map((opt) => {
                  const active = selection.extras.has(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setSelection((s) => {
                          const next = new Set(s.extras);
                          if (next.has(opt.id)) {
                            next.delete(opt.id);
                          } else {
                            next.add(opt.id);
                          }
                          return { ...s, extras: next };
                        })
                      }
                      className={
                        active
                          ? "inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-basil-700 bg-basil-50 px-4 text-sm font-bold text-basil-800"
                          : "inline-flex min-h-11 items-center gap-2 rounded-full border border-cream-300 bg-cream-100 px-4 text-sm font-bold text-ink-soft transition-colors hover:border-basil-300"
                      }
                    >
                      {opt.nameAr}
                      {opt.priceMinor > 0 && (
                        <Price minor={opt.priceMinor} className="text-xs" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>
        ))}

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
    </Sheet>
  );
}
