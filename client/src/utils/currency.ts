export const currencies = [
  // 亚洲
  { code: 'CNY', symbol: '¥', label: '人民币' },
  { code: 'JPY', symbol: '¥', label: '日元' },
  { code: 'KRW', symbol: '₩', label: '韩元' },
  { code: 'HKD', symbol: 'HK$', label: '港币' },
  { code: 'TWD', symbol: 'NT$', label: '台币' },
  { code: 'SGD', symbol: 'S$', label: '新加坡元' },
  { code: 'THB', symbol: '฿', label: '泰铢' },
  { code: 'MYR', symbol: 'RM', label: '马来西亚林吉特' },
  { code: 'IDR', symbol: 'Rp', label: '印尼盾' },
  { code: 'PHP', symbol: '₱', label: '菲律宾比索' },
  { code: 'VND', symbol: '₫', label: '越南盾' },
  { code: 'INR', symbol: '₹', label: '印度卢比' },
  { code: 'PKR', symbol: '₨', label: '巴基斯坦卢比' },
  { code: 'BDT', symbol: '৳', label: '孟加拉塔卡' },
  { code: 'LKR', symbol: 'Rs', label: '斯里兰卡卢比' },
  // 欧洲
  { code: 'EUR', symbol: '€', label: '欧元' },
  { code: 'GBP', symbol: '£', label: '英镑' },
  { code: 'CHF', symbol: 'CHF', label: '瑞士法郎' },
  { code: 'SEK', symbol: 'kr', label: '瑞典克朗' },
  { code: 'NOK', symbol: 'kr', label: '挪威克朗' },
  { code: 'DKK', symbol: 'kr', label: '丹麦克朗' },
  { code: 'PLN', symbol: 'zł', label: '波兰兹罗提' },
  { code: 'CZK', symbol: 'Kč', label: '捷克克朗' },
  { code: 'HUF', symbol: 'Ft', label: '匈牙利福林' },
  { code: 'RUB', symbol: '₽', label: '俄罗斯卢布' },
  { code: 'TRY', symbol: '₺', label: '土耳其里拉' },
  { code: 'UAH', symbol: '₴', label: '乌克兰格里夫纳' },
  { code: 'RON', symbol: 'lei', label: '罗马尼亚列伊' },
  { code: 'BGN', symbol: 'лв', label: '保加利亚列弗' },
  // 北美
  { code: 'USD', symbol: '$', label: '美元' },
  { code: 'CAD', symbol: 'C$', label: '加元' },
  { code: 'MXN', symbol: 'MX$', label: '墨西哥比索' },
  // 南美
  { code: 'BRL', symbol: 'R$', label: '巴西雷亚尔' },
  { code: 'ARS', symbol: 'ARS', label: '阿根廷比索' },
  { code: 'CLP', symbol: 'CLP', label: '智利比索' },
  { code: 'COP', symbol: 'COL$', label: '哥伦比亚比索' },
  { code: 'PEN', symbol: 'S/', label: '秘鲁索尔' },
  // 大洋洲
  { code: 'AUD', symbol: 'A$', label: '澳元' },
  { code: 'NZD', symbol: 'NZ$', label: '新西兰元' },
  // 中东/非洲
  { code: 'AED', symbol: 'د.إ', label: '阿联酋迪拉姆' },
  { code: 'SAR', symbol: '﷼', label: '沙特里亚尔' },
  { code: 'ILS', symbol: '₪', label: '以色列新谢克尔' },
  { code: 'ZAR', symbol: 'R', label: '南非兰特' },
  { code: 'EGP', symbol: 'E£', label: '埃及镑' },
  { code: 'NGN', symbol: '₦', label: '尼日利亚奈拉' },
  { code: 'KES', symbol: 'KSh', label: '肯尼亚先令' },
  { code: 'MAD', symbol: 'MAD', label: '摩洛哥迪拉姆' },
] as const;

// 默认硬编码汇率（API 失败时的 fallback，各币种兑 CNY）
export const defaultRatesToCNY: Record<string, number> = {
  CNY: 1, USD: 7.25, EUR: 7.85, GBP: 9.15, JPY: 0.048,
  HKD: 0.93, KRW: 0.0052, TWD: 0.225, SGD: 5.38, THB: 0.20,
  MYR: 1.53, IDR: 0.00045, PHP: 0.13, VND: 0.00029, INR: 0.087,
  PKR: 0.026, BDT: 0.066, LKR: 0.024, CHF: 8.15, SEK: 0.69,
  NOK: 0.68, DKK: 1.05, PLN: 1.82, CZK: 0.31, HUF: 0.020,
  RUB: 0.080, TRY: 0.22, UAH: 0.18, RON: 1.58, BGN: 4.01,
  CAD: 5.28, MXN: 0.42, BRL: 1.28, ARS: 0.0072, CLP: 0.0075,
  COP: 0.0018, PEN: 1.94, AUD: 4.72, NZD: 4.35, AED: 1.97,
  SAR: 1.93, ILS: 1.96, ZAR: 0.40, EGP: 0.15, NGN: 0.0048,
  KES: 0.056, MAD: 0.73,
};

// 运行时汇率（优先用 API 获取的）
let liveRates: Record<string, number> = { ...defaultRatesToCNY };

const RATES_CACHE_KEY = 'exchangeRates';
const RATES_DATE_KEY = 'exchangeRatesDate';

function getCachedRates(): Record<string, number> | null {
  const date = localStorage.getItem(RATES_DATE_KEY);
  const today = new Date().toISOString().slice(0, 10);
  if (date !== today) return null;
  const cached = localStorage.getItem(RATES_CACHE_KEY);
  return cached ? JSON.parse(cached) : null;
}

function cacheRates(rates: Record<string, number>) {
  localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(rates));
  localStorage.setItem(RATES_DATE_KEY, new Date().toISOString().slice(0, 10));
}

export async function fetchRates(): Promise<void> {
  const cached = getCachedRates();
  if (cached) {
    liveRates = cached;
    return;
  }
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/CNY');
    const data = await res.json();
    if (data.rates) {
      const rates: Record<string, number> = { CNY: 1 };
      for (const [code, rate] of Object.entries(data.rates)) {
        rates[code] = 1 / (rate as number);
      }
      liveRates = rates;
      cacheRates(rates);
    }
  } catch {
    // API 失败，用默认汇率
  }
}

export function convert(amount: number, from: string, to: string): number {
  const cny = amount * (liveRates[from] || defaultRatesToCNY[from] || 1);
  return cny / (liveRates[to] || defaultRatesToCNY[to] || 1);
}

export function getSymbol(code: string): string {
  return currencies.find(c => c.code === code)?.symbol || code;
}
