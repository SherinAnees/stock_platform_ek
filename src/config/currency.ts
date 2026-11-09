export const CURRENCY_CODE = "EUR";
export const CURRENCY_SYMBOL = "€";
export const CURRENCY_LOCALE = "de-DE";

export function formatCurrency(n: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency: CURRENCY_CODE,
    maximumFractionDigits: 2,
    ...opts,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatCurrencyAmount(n: number): string {
  return `${CURRENCY_SYMBOL}${Number(n ?? 0).toFixed(2)}`;
}