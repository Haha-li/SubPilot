// ponytail: 扣款当天拉一次并缓存；接口失败用上次成功或内置汇率，不另做历史汇率
const DEFAULT_RATES_TO_CNY: Record<string, number> = {
  CNY: 1, USD: 7.25, EUR: 7.85, GBP: 9.15, JPY: 0.048,
  HKD: 0.93, KRW: 0.0052, TWD: 0.225, SGD: 5.38, THB: 0.20,
  MYR: 1.53, IDR: 0.00045, PHP: 0.13, VND: 0.00029, INR: 0.087,
  PKR: 0.026, BDT: 0.066, LKR: 0.024, CHF: 8.15, SEK: 0.69,
  NOK: 0.68, DKK: 1.05, PLN: 1.82, CZK: 0.31, HUF: 0.020,
  RUB: 0.080, TRY: 0.22, UAH: 0.18, RON: 1.58, BGN: 4.01,
  CAD: 5.28, MXN: 0.42, BRL: 1.28, ARS: 0.0072, CLP: 0.0075,
  COP: 0.0018, PEN: 1.94, AUD: 4.72, NZD: 4.35, AED: 1.97,
  SAR: 1.93, ILS: 1.96, ZAR: 0.40, EGP: 0.15, NGN: 0.0048,
  KES: 0.056, MAD: 0.73, LBP: 0.000081,
};

let cached: { day: string; rates: Record<string, number> } | null = null;
let loadRates: ((now: Date) => Promise<Record<string, number>>) | null = null;

export function setRateLoader(loader: ((now: Date) => Promise<Record<string, number>>) | null) {
  loadRates = loader;
}

export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number {
  const fromCode = from.toUpperCase();
  const toCode = to.toUpperCase();
  if (fromCode === toCode) return amount;
  const fromRate = rates[fromCode];
  const toRate = rates[toCode];
  if (!fromRate || !toRate) return Number.NaN;
  return amount * fromRate / toRate;
}

async function fetchDailyRates(now: Date): Promise<Record<string, number>> {
  const day = now.toISOString().slice(0, 10);
  if (cached?.day === day) return cached.rates;
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/CNY');
    const data = await response.json() as { rates?: Record<string, number> };
    if (!response.ok || !data.rates) throw new Error('rate api failed');
    const rates: Record<string, number> = { CNY: 1 };
    for (const [code, rate] of Object.entries(data.rates)) {
      if (typeof rate === 'number' && rate > 0) rates[code.toUpperCase()] = 1 / rate;
    }
    cached = { day, rates };
    return rates;
  } catch {
    return cached?.rates || DEFAULT_RATES_TO_CNY;
  }
}

export async function convertToCurrency(
  amount: number,
  from: string,
  to: string,
  now = new Date(),
): Promise<number> {
  const rates = await (loadRates || fetchDailyRates)(now);
  return convertAmount(amount, from, to, rates);
}
