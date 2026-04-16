type ExchangeRates = {
  INR_TO_MYR: number;
  MYR_TO_INR: number;
  fetchedAt: number;
};

let cachedRates: ExchangeRates | null = null;
const CACHE_TTL = 60 * 1000; // 1 minute — "real-time" but not hammering API

export async function getExchangeRates(): Promise<ExchangeRates> {
  const now = Date.now();

  if (cachedRates && now - cachedRates.fetchedAt < CACHE_TTL) {
    return cachedRates;
  }

  try {
    // Free API — no key required
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=INR&to=MYR"
    );

    if (!res.ok) throw new Error("Exchange rate fetch failed");

    const data = (await res.json()) as { rates: { MYR: number } };
    const INR_TO_MYR = data.rates.MYR;

    cachedRates = {
      INR_TO_MYR,
      MYR_TO_INR: 1 / INR_TO_MYR,
      fetchedAt: now,
    };

    return cachedRates;
  } catch (err) {
    console.error("Currency fetch error:", err);

    // Fallback to last cached if available
    if (cachedRates) return cachedRates;

    // Hardcoded fallback if no cache
    return {
      INR_TO_MYR: 0.051,
      MYR_TO_INR: 19.6,
      fetchedAt: now,
    };
  }
}

export function convertINRtoMYR(amountINR: number, rate: number): number {
  return Number((amountINR * rate).toFixed(2));
}

export function convertMYRtoINR(amountMYR: number, rate: number): number {
  return Number((amountMYR * rate).toFixed(2));
}