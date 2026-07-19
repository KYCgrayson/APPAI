"use client";

import { useMemo, useState } from "react";

interface OrderItem {
  id: number;
  name: string;
  quantity: string;
  unitPrice: string;
}

interface Props {
  data: {
    heading?: string;
    description?: string;
    storeName?: string;
    storeDescription?: string;
    isConfigured?: boolean;
    paymentUrl?: string;
    paymentHeading?: string;
    paymentInstructions?: string;
    currency?: string;
    submitLabel?: string;
    successMessage?: string;
    maxItems?: number;
  };
  themeColor: string;
  darkMode?: boolean;
  pageSlug: string;
  parentSlug?: string | null;
  locale: string;
  sectionOrder?: number;
}

type Step = "order" | "payment" | "success";
type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

const initialItems: OrderItem[] = [{ id: 1, name: "", quantity: "1", unitPrice: "" }];

function parseAmount(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseQuantity(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function money(value: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "TWD" || currency === "JPY" ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function SimpleOrderSection({
  data,
  themeColor,
  darkMode = false,
  pageSlug,
  parentSlug,
  locale,
  sectionOrder,
}: Props) {
  const isConfigured = Boolean(data.isConfigured && data.paymentUrl);
  const currency = data.currency || "TWD";
  const maxItems = data.maxItems ?? 20;
  const [step, setStep] = useState<Step>("order");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<OrderItem[]>(initialItems);

  const normalizedItems = useMemo(
    () =>
      items.map((item) => {
        const quantity = parseQuantity(item.quantity);
        const unitPrice = parseAmount(item.unitPrice);
        return {
          ...item,
          quantityNumber: quantity,
          unitPriceNumber: unitPrice,
          subtotal: quantity * unitPrice,
        };
      }),
    [items],
  );

  const validItems = normalizedItems.filter(
    (item) => item.name.trim() && item.quantityNumber > 0 && item.unitPriceNumber > 0,
  );
  const total = validItems.reduce((sum, item) => sum + item.subtotal, 0);

  if (!isConfigured) {
    return (
      <section className="py-12 md:py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h2 className="text-xl font-bold">Simple Order is not configured</h2>
          <p className="mt-2 text-sm leading-6">
            Add the private notification recipient and payment URL before publishing.
          </p>
        </div>
      </section>
    );
  }

  function updateItem(id: number, patch: Partial<OrderItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addItem() {
    setItems((current) =>
      current.length >= maxItems
        ? current
        : [...current, { id: Date.now(), name: "", quantity: "1", unitPrice: "" }],
    );
  }

  function removeItem(id: number) {
    setItems((current) =>
      current.length === 1 ? current : current.filter((item) => item.id !== id),
    );
  }

  function validateOrder(): string | null {
    if (!customerName.trim()) return "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      return "Please enter a valid email address.";
    }
    if (!preferredDate) return "Please enter your preferred date.";
    const incompleteRow = normalizedItems.find(
      (item) =>
        (item.name.trim() || item.unitPrice.trim()) &&
        !(item.name.trim() && item.quantityNumber > 0 && item.unitPriceNumber > 0),
    );
    if (incompleteRow) return "Complete or remove every item row before checkout.";
    if (validItems.length === 0 || total <= 0) {
      return "Please enter at least one item with quantity and unit price.";
    }
    return null;
  }

  function checkout() {
    const error = validateOrder();
    if (error) {
      setState({ kind: "error", message: error });
      return;
    }
    setState({ kind: "idle" });
    setStep("payment");
  }

  async function submitOrder() {
    const error = validateOrder();
    if (error) {
      setState({ kind: "error", message: error });
      return;
    }

    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/v1/simple-order-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageSlug,
          parentSlug: parentSlug ?? null,
          locale,
          sectionOrder,
          customer: {
            name: customerName.trim(),
            email: customerEmail.trim(),
          },
          preferredDate,
          note,
          items: validItems.map((item) => ({
            name: item.name.trim(),
            quantity: item.quantityNumber,
            unitPrice: item.unitPriceNumber,
          })),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Order submission failed (${res.status}).`);
      }

      setStep("success");
      setState({ kind: "idle" });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Could not submit the order.",
      });
    }
  }

  const inputClass = `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${
    darkMode
      ? "border-gray-700 bg-gray-900 text-gray-100 placeholder:text-gray-500"
      : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
  }`;
  const labelClass = `block text-sm font-medium ${darkMode ? "text-gray-200" : "text-gray-700"}`;
  const cardClass = darkMode
    ? "border-gray-700 bg-gray-900 text-gray-100"
    : "border-gray-100 bg-white text-gray-900";

  if (step === "success") {
    return (
      <section className="py-12 md:py-20 px-4 sm:px-6">
        <div className={`max-w-2xl mx-auto text-center rounded-2xl border p-8 md:p-10 ${cardClass}`}>
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-white"
            style={{ backgroundColor: themeColor }}
          >
            ✓
          </div>
          <h2 className="mt-5 text-2xl md:text-3xl font-bold">
            {data.successMessage || "Order sent. The shop owner will confirm quantity and date by email."}
          </h2>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: themeColor }}>
            {data.storeName || "Simple Order"}
          </p>
          <h2 className={`mt-2 text-3xl md:text-5xl font-bold ${darkMode ? "text-white" : "text-gray-950"}`}>
            {data.heading || "Place an order"}
          </h2>
          {(data.description || data.storeDescription) && (
            <p className={`mt-4 max-w-2xl mx-auto leading-7 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
              {data.description || data.storeDescription}
            </p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className={`rounded-2xl border p-5 md:p-6 shadow-sm ${cardClass}`}>
            <div className="grid gap-4 md:grid-cols-3">
              <label className={labelClass}>
                Name
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={inputClass}
                  style={{ ["--tw-ring-color" as string]: `${themeColor}33` }}
                />
              </label>
              <label className={labelClass}>
                Email
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className={inputClass}
                  style={{ ["--tw-ring-color" as string]: `${themeColor}33` }}
                />
              </label>
              <label className={labelClass}>
                Preferred date
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className={inputClass}
                  style={{ ["--tw-ring-color" as string]: `${themeColor}33` }}
                />
              </label>
            </div>

            <div className="mt-6 space-y-3">
              {normalizedItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`grid gap-3 rounded-xl border p-3 md:grid-cols-[1.4fr_0.6fr_0.8fr_0.8fr_auto] ${
                    darkMode ? "border-gray-700 bg-gray-950" : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <label className={labelClass}>
                    {index === 0 ? "Item" : <span className="sr-only">Item</span>}
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(item.id, { name: e.target.value })}
                      placeholder="Cake, flowers, custom item..."
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    {index === 0 ? "Qty" : <span className="sr-only">Qty</span>}
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    {index === 0 ? "Unit price" : <span className="sr-only">Unit price</span>}
                    <input
                      type="number"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.id, { unitPrice: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <div className={labelClass}>
                    {index === 0 ? "Subtotal" : <span className="sr-only">Subtotal</span>}
                    <div className="mt-1 rounded-lg px-1 py-2.5 text-sm font-semibold">
                      {money(item.subtotal, currency, locale)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className={`self-end rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      darkMode
                        ? "border-gray-700 text-gray-300 hover:border-red-500 hover:text-red-300"
                        : "border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-600"
                    }`}
                    aria-label="Remove item"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addItem}
              disabled={items.length >= maxItems}
              className={`mt-4 rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                darkMode ? "border-gray-700 text-gray-200" : "border-gray-300 text-gray-700"
              }`}
            >
              Add item
            </button>

            <label className={`mt-5 ${labelClass}`}>
              Note
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className={inputClass}
              />
            </label>
          </div>

          <aside className={`h-fit rounded-2xl border p-5 shadow-sm ${cardClass}`}>
            <div className="flex items-center justify-between gap-4">
              <span className={darkMode ? "text-gray-400" : "text-gray-500"}>Total</span>
              <strong className="text-2xl">{money(total, currency, locale)}</strong>
            </div>

            {step === "payment" ? (
              <div
                className={`mt-5 rounded-xl border p-4 ${
                  darkMode ? "border-amber-700 bg-amber-950/30" : "border-amber-200 bg-amber-50"
                }`}
              >
                <h3 className="font-bold">{data.paymentHeading || "Please complete payment"}</h3>
                <p className={`mt-2 text-sm leading-6 ${darkMode ? "text-amber-100" : "text-amber-900"}`}>
                  {data.paymentInstructions ||
                    "After payment, submit this order. The shop owner will confirm quantity and date, then reply by email."}
                </p>
                <a
                  href={data.paymentUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block rounded-lg px-4 py-3 text-center text-sm font-bold text-white transition hover:opacity-90"
                  style={{ backgroundColor: themeColor }}
                >
                  Open payment link
                </a>
                <button
                  type="button"
                  onClick={submitOrder}
                  disabled={state.kind === "submitting"}
                  className="mt-3 w-full rounded-lg border px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ borderColor: themeColor, color: themeColor }}
                >
                  {state.kind === "submitting" ? "Sending..." : data.submitLabel || "I completed payment, request confirmation"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={checkout}
                className="mt-5 w-full rounded-lg px-4 py-3 text-sm font-bold text-white transition hover:opacity-90"
                style={{ backgroundColor: themeColor }}
              >
                Checkout
              </button>
            )}

            {step === "payment" && (
              <button
                type="button"
                onClick={() => {
                  setState({ kind: "idle" });
                  setStep("order");
                }}
                className={`mt-3 w-full text-sm underline-offset-4 hover:underline ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                Edit order
              </button>
            )}

            {state.kind === "error" && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {state.message}
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
