"use client";

import { arabicCount } from "@/lib/arabic";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import { Price } from "@/components/ui/price";
import { tryToMinorUnits } from "@/lib/pricing";
import {
  createIngredient,
  fetchInventoryState,
  fetchProductRecipes,
  saveRecipeLine,
  stockMove,
} from "@/app/actions/inventory";
import type { AdminProduct } from "@/app/actions/menu-admin";
import type { IngredientRow } from "@/lib/server/inventory";

/**
 * Inventory & recipes admin (Phase 4, owner-only). Low-stock rows highlight
 * in bronze; every stock change is an audited move (purchase / waste /
 * adjustment); recipes drive the automatic deduction on every sale.
 */

interface RecipeLine {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  quantityUsed: number;
}

const inputClass =
  "min-h-11 w-full rounded-md border border-cream-300 bg-cream-50 px-3 text-sm outline-none transition-colors focus:border-basil-500";

export function InventoryAdmin() {
  const [ingredients, setIngredients] = useState<IngredientRow[] | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // expanded row state
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [moveQty, setMoveQty] = useState<Record<string, string>>({});
  const [moveCost, setMoveCost] = useState<Record<string, string>>({});
  const [moveNote, setMoveNote] = useState<Record<string, string>>({});

  // new ingredient form
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("g");
  const [newStock, setNewStock] = useState("");
  const [newThreshold, setNewThreshold] = useState("");
  const [newCost, setNewCost] = useState("");

  // recipe editor
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [recipeLines, setRecipeLines] = useState<RecipeLine[] | null>(null);
  const [recipeIngredient, setRecipeIngredient] = useState("");
  const [recipeQty, setRecipeQty] = useState("");

  const load = useCallback(async () => {
    const res = await fetchInventoryState();
    if (res.ok) {
      setIngredients(res.ingredients);
      setProducts(res.products);
      // Functional update keeps this initializer independent of the current
      // selection — otherwise every product change reloads the whole panel.
      setSelectedProduct((current) => current || res.products[0]?.id || "");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    void load();
  }, [load]);

  const loadRecipes = useCallback(async (productId: string) => {
    const res = await fetchProductRecipes(productId);
    setRecipeLines(res.ok ? res.rows : []);
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;
    let cancelled = false;
    void fetchProductRecipes(selectedProduct).then((res) => {
      if (!cancelled) setRecipeLines(res.ok ? res.rows : []);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedProduct]);

  async function act(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMessage: string,
  ) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    setNotice(res.ok ? okMessage : (res.error ?? "تعذر التنفيذ"));
    if (res.ok) await load();
    return res.ok;
  }

  async function create() {
    const costPerUnitMinor = tryToMinorUnits(newCost.trim() || "0");
    if (costPerUnitMinor === null) {
      setNotice("تكلفة الوحدة غير صحيحة — أدخل رقماً مثل 12.50.");
      return;
    }
    const ok = await act(
      () =>
        createIngredient({
          name: newName,
          unit: newUnit,
          openingStock: Number.parseFloat(newStock || "0") || 0,
          reorderThreshold: Number.parseFloat(newThreshold || "0") || 0,
          costPerUnitMinor,
        }),
      "✓ أُضيف المكوّن",
    );
    if (ok) {
      setNewName("");
      setNewStock("");
      setNewThreshold("");
      setNewCost("");
    }
  }

  const lowCount = (ingredients ?? []).filter((i) => i.isLow).length;

  return (
    <div className="mt-4 space-y-5">
      {notice && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md bg-basil-100 px-4 py-3 text-center text-sm font-bold text-basil-800"
        >
          {notice}
        </p>
      )}

      {/* ── ingredients ─────────────────────────────────────────── */}
      <div className="rounded-card bg-cream-50 p-4 shadow-card">
        <h2 className="flex items-center gap-2 font-bold text-ink">
          المخزون
          {lowCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-bronze/15 px-2.5 py-1 text-xs font-bold text-warning">
              <AlertTriangle className="size-3.5" aria-hidden />
              {arabicCount(lowCount, {
                one: "مكوّن واحد تحت الحد",
                two: "مكوّنان تحت الحد",
                few: "مكوّنات تحت الحد",
                many: "مكوّناً تحت الحد",
              })}
            </span>
          )}
        </h2>

        {ingredients === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-ink-soft">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            جارٍ التحميل…
          </div>
        ) : ingredients.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-soft">
            لا مكوّنات بعد — أضف أول مكوّن من النموذج بالأسفل.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {ingredients.map((ing) => (
              <li
                key={ing.id}
                className={`rounded-xl border p-3.5 ${ing.isLow ? "border-bronze/50 bg-bronze/5" : "border-cream-200 bg-cream-100"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink">
                      {ing.name}
                      {ing.isLow && (
                        <AlertTriangle
                          className="ms-1.5 inline size-4 text-warning"
                          aria-label="تحت حد الطلب"
                        />
                      )}
                    </p>
                    <p className="text-xs text-ink-soft">
                      حد الطلب: {ing.reorderThreshold} {ing.unit} · التكلفة:{" "}
                      <Price
                        minor={ing.costPerUnitMinor}
                        className="font-bold"
                      />{" "}
                      / {ing.unit}
                    </p>
                  </div>
                  <p
                    className={`text-xl font-extrabold tabular-nums ${ing.isLow ? "text-warning" : "text-basil-800"}`}
                  >
                    {ing.currentStock}
                    <span className="ms-1 text-xs font-bold text-ink-soft">
                      {ing.unit}
                    </span>
                  </p>
                </div>

                <div className="mt-2 flex gap-1.5">
                  {(
                    [
                      { kind: "purchase", label: "شراء" },
                      { kind: "waste", label: "هالك" },
                      { kind: "adjustment", label: "تسوية" },
                    ] as const
                  ).map((btn) => (
                    <button
                      key={btn.kind}
                      type="button"
                      onClick={() =>
                        setOpenRow(
                          openRow === `${ing.id}:${btn.kind}`
                            ? null
                            : `${ing.id}:${btn.kind}`,
                        )
                      }
                      className="inline-flex min-h-11 items-center rounded-full border border-cream-300 bg-cream-100 px-3 text-xs font-bold text-ink-soft transition-colors hover:border-basil-400"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {openRow?.startsWith(`${ing.id}:`) && (
                  <div className="mt-2.5 grid grid-cols-[100px_1fr_auto] items-end gap-2 rounded-lg bg-cream-50 p-3">
                    {(() => {
                      const kind = openRow.split(":")[1] as
                        "purchase" | "waste" | "adjustment";
                      return (
                        <>
                          <div>
                            <label
                              htmlFor={`qty-${ing.id}-${kind}`}
                              className="text-[10px] font-bold text-ink-soft"
                            >
                              الكمية ({ing.unit})
                            </label>
                            <input
                              id={`qty-${ing.id}-${kind}`}
                              type="text"
                              inputMode="decimal"
                              dir="ltr"
                              value={moveQty[`${ing.id}:${kind}`] ?? ""}
                              onChange={(e) =>
                                setMoveQty((m) => ({
                                  ...m,
                                  [`${ing.id}:${kind}`]: e.target.value,
                                }))
                              }
                              className={`mt-1 ${inputClass} font-bold tabular-nums`}
                              maxLength={9}
                            />
                          </div>
                          {kind === "purchase" && (
                            <div>
                              <label
                                htmlFor={`cost-${ing.id}`}
                                className="text-[10px] font-bold text-ink-soft"
                              >
                                تكلفة الوحدة الجديدة (₪) — اختياري
                              </label>
                              <input
                                id={`cost-${ing.id}`}
                                type="text"
                                inputMode="decimal"
                                dir="ltr"
                                value={moveCost[ing.id] ?? ""}
                                onChange={(e) =>
                                  setMoveCost((m) => ({
                                    ...m,
                                    [ing.id]: e.target.value,
                                  }))
                                }
                                className={`mt-1 ${inputClass}`}
                                maxLength={8}
                              />
                            </div>
                          )}
                          <div className="col-span-3">
                            <input
                              type="text"
                              value={moveNote[`${ing.id}:${kind}`] ?? ""}
                              onChange={(e) =>
                                setMoveNote((m) => ({
                                  ...m,
                                  [`${ing.id}:${kind}`]: e.target.value,
                                }))
                              }
                              placeholder="ملاحظة (المورد / السبب)"
                              aria-label="ملاحظة الحركة"
                              className={`${inputClass} min-h-11 text-xs`}
                              maxLength={140}
                            />
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              const qty = Number.parseFloat(
                                moveQty[`${ing.id}:${kind}`] || "0",
                              );
                              let costPerUnitMinor: number | undefined;
                              const costRaw = moveCost[ing.id]?.trim() ?? "";
                              if (kind === "purchase" && costRaw) {
                                const parsed = tryToMinorUnits(costRaw);
                                if (parsed === null) {
                                  setNotice(
                                    "تكلفة الوحدة غير صحيحة — استخدم رقماً مثل 12.50.",
                                  );
                                  return;
                                }
                                costPerUnitMinor = parsed;
                              }
                              const ok = await act(
                                () =>
                                  stockMove({
                                    ingredientId: ing.id,
                                    qty:
                                      kind === "waste" ? -Math.abs(qty) : qty,
                                    kind,
                                    note: moveNote[`${ing.id}:${kind}`],
                                    costPerUnitMinor,
                                  }),
                                "✓ سُجّلت الحركة في السجل",
                              );
                              if (ok) {
                                setMoveQty((m) => ({
                                  ...m,
                                  [`${ing.id}:${kind}`]: "",
                                }));
                                if (kind === "purchase") {
                                  setMoveCost((m) => ({
                                    ...m,
                                    [ing.id]: "",
                                  }));
                                }
                              }
                            }}
                            className="col-span-3 inline-flex min-h-11 items-center justify-center rounded-full bg-basil-700 text-sm font-bold text-cream-50 disabled:opacity-50"
                          >
                            تسجيل
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── recipes ─────────────────────────────────────────────── */}
      <div className="rounded-card bg-cream-50 p-4 shadow-card">
        <h2 className="font-bold text-ink">وصفات الأطباق</h2>
        <p className="mt-1 text-xs text-ink-soft">
          كل بيع يخصم كميات الوصفة تلقائياً من المخزون — بحركة مُسجّلة مرجعها
          الطلب.
        </p>
        <div className="mt-3">
          <label
            htmlFor="recipe-product"
            className="text-xs font-bold text-ink-soft"
          >
            اختر الطبق
          </label>
          <select
            id="recipe-product"
            value={selectedProduct}
            onChange={(e) => {
              setSelectedProduct(e.target.value);
              setRecipeLines(null);
            }}
            className={`mt-1 ${inputClass}`}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameAr} — {p.categoryNameAr}
              </option>
            ))}
          </select>
        </div>

        {recipeLines === null ? (
          <div className="flex items-center justify-center gap-2 py-6 text-ink-soft">
            <Loader2 className="size-4 animate-spin" aria-hidden />
          </div>
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {recipeLines.length === 0 && (
                <li className="rounded-lg border border-dashed border-cream-300 py-4 text-center text-xs text-ink-soft">
                  لا وصفة بعد — أضف مكونات هذا الطبق
                </li>
              )}
              {recipeLines.map((line) => (
                <li
                  key={line.ingredientId}
                  className="flex items-center gap-2 rounded-lg border border-cream-200 bg-cream-100 p-2.5"
                >
                  <span className="flex-1 text-sm font-bold text-ink">
                    {line.ingredientName}{" "}
                    <span className="text-xs font-normal text-ink-soft">
                      / {line.unit}
                    </span>
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    defaultValue={String(line.quantityUsed)}
                    aria-label={`كمية ${line.ingredientName}`}
                    onBlur={async (e) => {
                      const v = Number.parseFloat(e.target.value);
                      if (
                        Number.isFinite(v) &&
                        v > 0 &&
                        v !== line.quantityUsed
                      ) {
                        const res = await saveRecipeLine({
                          productId: selectedProduct,
                          ingredientId: line.ingredientId,
                          quantityUsed: v,
                        });
                        if (!res.ok) setNotice(res.error ?? "تعذر حفظ الوصفة");
                        await loadRecipes(selectedProduct);
                      }
                    }}
                    className="min-h-11 w-24 rounded-md border border-cream-300 bg-cream-50 px-2 py-1.5 text-center text-sm font-bold tabular-nums outline-none focus:border-basil-500"
                    maxLength={9}
                  />
                  <button
                    type="button"
                    aria-label={`حذف ${line.ingredientName} من الوصفة`}
                    onClick={async () => {
                      const res = await saveRecipeLine({
                        productId: selectedProduct,
                        ingredientId: line.ingredientId,
                        quantityUsed: null,
                      });
                      if (!res.ok) setNotice(res.error ?? "تعذر الحذف");
                      await loadRecipes(selectedProduct);
                    }}
                    className="flex size-11 items-center justify-center rounded-full text-ink-soft hover:bg-terracotta/10 hover:text-terracotta"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>

            {ingredients && ingredients.length > 0 && (
              <div className="mt-3 grid grid-cols-[1fr_100px_auto] items-end gap-2">
                <div>
                  <label
                    htmlFor="recipe-ing"
                    className="text-xs font-bold text-ink-soft"
                  >
                    مكوّن
                  </label>
                  <select
                    id="recipe-ing"
                    value={recipeIngredient}
                    onChange={(e) => setRecipeIngredient(e.target.value)}
                    className={`mt-1 ${inputClass}`}
                  >
                    <option value="">اختر…</option>
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="recipe-qty"
                    className="text-xs font-bold text-ink-soft"
                  >
                    الكمية
                  </label>
                  <input
                    id="recipe-qty"
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    value={recipeQty}
                    onChange={(e) => setRecipeQty(e.target.value)}
                    className={`mt-1 ${inputClass} font-bold tabular-nums`}
                    maxLength={9}
                  />
                </div>
                <button
                  type="button"
                  disabled={!recipeIngredient || !recipeQty}
                  onClick={async () => {
                    const ok = await act(
                      () =>
                        saveRecipeLine({
                          productId: selectedProduct,
                          ingredientId: recipeIngredient,
                          quantityUsed: Number.parseFloat(recipeQty),
                        }),
                      "✓ حُفظت الوصفة",
                    );
                    if (ok) {
                      setRecipeIngredient("");
                      setRecipeQty("");
                      await loadRecipes(selectedProduct);
                    }
                  }}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-basil-700 px-4 text-sm font-bold text-cream-50 disabled:opacity-50"
                >
                  <Plus className="size-4" aria-hidden />
                  أضف للموصفة
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── new ingredient ──────────────────────────────────────── */}
      <div className="rounded-card border border-dashed border-basil-300 bg-basil-50/50 p-4">
        <p className="font-bold text-ink">مكوّن جديد</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="الاسم"
            aria-label="اسم المكوّن"
            className={inputClass}
            maxLength={60}
          />
          <select
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            aria-label="الوحدة"
            className={inputClass}
          >
            <option value="g">جرام g</option>
            <option value="ml">مللي ml</option>
            <option value="piece">حبة piece</option>
          </select>
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={newStock}
            onChange={(e) => setNewStock(e.target.value)}
            placeholder="رصيد افتتاحي"
            aria-label="الرصيد الافتتاحي"
            className={inputClass}
            maxLength={9}
          />
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={newThreshold}
            onChange={(e) => setNewThreshold(e.target.value)}
            placeholder="حد الطلب"
            aria-label="حد الطلب"
            className={inputClass}
            maxLength={9}
          />
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={newCost}
            onChange={(e) => setNewCost(e.target.value)}
            placeholder="تكلفة الوحدة ₪"
            aria-label="تكلفة الوحدة"
            className={inputClass}
            maxLength={8}
          />
        </div>
        <button
          type="button"
          disabled={busy || newName.trim().length < 2}
          onClick={() => void create()}
          className="mt-2.5 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-basil-800 px-5 text-sm font-bold text-cream-50 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          أضف المكوّن
        </button>
      </div>
    </div>
  );
}
