export interface CurrencyMeta {
  code: string;
  symbol: string;
  label: string;
  searchText: string;
}

const commonCurrencyCodes = [
  'CNY', 'USD', 'EUR', 'GBP', 'JPY', 'HKD', 'TWD', 'KRW', 'SGD', 'AUD', 'CAD',
] as const;

const isoCurrencyCodes = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD',
  'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP',
  'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR',
  'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS',
  'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR',
  'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP',
  'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO',
  'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN',
  'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG',
  'SEK', 'SGD', 'SHP', 'SLE', 'SLL', 'SOS', 'SRD', 'SSP', 'STN', 'SVC',
  'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD',
  'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST',
  'XAF', 'XCD', 'XCG', 'XDR', 'XOF', 'XPF', 'XSU', 'YER', 'ZAR', 'ZMW',
  'ZWG', 'ZWL',
] as const;

const currencyOverrides: Record<string, { label?: string; symbol?: string; keywords?: string[] }> = {
  AED: { label: '阿联酋迪拉姆', symbol: 'د.إ' },
  ARS: { label: '阿根廷比索', symbol: 'ARS' },
  AUD: { label: '澳元', symbol: 'A$' },
  BDT: { label: '孟加拉塔卡', symbol: '৳' },
  BGN: { label: '保加利亚列弗', symbol: 'лв' },
  BRL: { label: '巴西雷亚尔', symbol: 'R$' },
  CAD: { label: '加元', symbol: 'C$' },
  CHF: { label: '瑞士法郎', symbol: 'CHF' },
  CLP: { label: '智利比索', symbol: 'CLP' },
  CNY: { label: '人民币', symbol: '¥', keywords: ['RMB', 'renminbi', 'yuan'] },
  COP: { label: '哥伦比亚比索', symbol: 'COL$' },
  CZK: { label: '捷克克朗', symbol: 'Kč' },
  DKK: { label: '丹麦克朗', symbol: 'kr' },
  EGP: { label: '埃及镑', symbol: 'E£' },
  EUR: { label: '欧元', symbol: '€', keywords: ['euro'] },
  GBP: { label: '英镑', symbol: '£', keywords: ['pound', 'sterling'] },
  HKD: { label: '港币', symbol: 'HK$' },
  HUF: { label: '匈牙利福林', symbol: 'Ft' },
  IDR: { label: '印尼盾', symbol: 'Rp' },
  ILS: { label: '以色列新谢克尔', symbol: '₪' },
  INR: { label: '印度卢比', symbol: '₹' },
  JPY: { label: '日元', symbol: '¥', keywords: ['yen'] },
  KES: { label: '肯尼亚先令', symbol: 'KSh' },
  KRW: { label: '韩元', symbol: '₩', keywords: ['won'] },
  LBP: { label: '黎巴嫩镑', symbol: 'L£' },
  LKR: { label: '斯里兰卡卢比', symbol: 'Rs' },
  MAD: { label: '摩洛哥迪拉姆', symbol: 'MAD' },
  MXN: { label: '墨西哥比索', symbol: 'MX$' },
  MYR: { label: '马来西亚林吉特', symbol: 'RM' },
  NGN: { label: '尼日利亚奈拉', symbol: '₦' },
  NOK: { label: '挪威克朗', symbol: 'kr' },
  NZD: { label: '新西兰元', symbol: 'NZ$' },
  PEN: { label: '秘鲁索尔', symbol: 'S/' },
  PHP: { label: '菲律宾比索', symbol: '₱' },
  PKR: { label: '巴基斯坦卢比', symbol: '₨' },
  PLN: { label: '波兰兹罗提', symbol: 'zł' },
  RON: { label: '罗马尼亚列伊', symbol: 'lei' },
  RUB: { label: '俄罗斯卢布', symbol: '₽' },
  SAR: { label: '沙特里亚尔', symbol: '﷼' },
  SEK: { label: '瑞典克朗', symbol: 'kr' },
  SGD: { label: '新加坡元', symbol: 'S$' },
  THB: { label: '泰铢', symbol: '฿' },
  TRY: { label: '土耳其里拉', symbol: '₺' },
  TWD: { label: '台币', symbol: 'NT$' },
  UAH: { label: '乌克兰格里夫纳', symbol: '₴' },
  USD: { label: '美元', symbol: '$', keywords: ['dollar'] },
  VND: { label: '越南盾', symbol: '₫' },
  ZAR: { label: '南非兰特', symbol: 'R' },
};

function getIntlCurrencyLabel(code: string): string {
  try {
    const displayNames = new Intl.DisplayNames(['zh-CN'], { type: 'currency' });
    return displayNames.of(code) || code;
  } catch {
    return code;
  }
}

function getIntlCurrencySymbol(code: string): string {
  try {
    const parts = new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value || code;
  } catch {
    return code;
  }
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

function buildCurrency(code: string): CurrencyMeta {
  const override = currencyOverrides[code] || {};
  const symbol = override.symbol || getIntlCurrencySymbol(code);
  const label = override.label || getIntlCurrencyLabel(code);
  const searchText = normalizeSearchText([code, symbol, label, ...(override.keywords || [])].join(' '));
  return { code, symbol, label, searchText };
}

const orderedCurrencyCodes = [
  ...commonCurrencyCodes,
  ...isoCurrencyCodes.filter((code) => !commonCurrencyCodes.includes(code as any)),
];

export const currencies: CurrencyMeta[] = orderedCurrencyCodes.map(buildCurrency);

export function matchesCurrency(currency: CurrencyMeta, query: string): boolean {
  const keyword = normalizeSearchText(query);
  return !keyword || currency.searchText.includes(keyword);
}

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
  KES: 0.056, MAD: 0.73, LBP: 0.000081,
};

// 运行时汇率（优先用 API 获取的）
let liveRates: Record<string, number> = { ...defaultRatesToCNY };

const RATES_CACHE_KEY = 'exchangeRates';
const RATES_DATE_KEY = 'exchangeRatesDate';

function getCachedRates(allowStale = false): Record<string, number> | null {
  const date = localStorage.getItem(RATES_DATE_KEY);
  const today = new Date().toISOString().slice(0, 10);
  if (!allowStale && date !== today) return null;
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
      liveRates = { ...defaultRatesToCNY, ...rates };
      cacheRates(rates);
    }
  } catch {
    const stale = getCachedRates(true);
    if (stale) liveRates = { ...defaultRatesToCNY, ...stale };
  }
}

export function convert(amount: number, from: string, to: string): number {
  const fromCode = from.toUpperCase();
  const toCode = to.toUpperCase();
  if (fromCode === toCode) return amount;

  const fromRate = liveRates[fromCode] || defaultRatesToCNY[fromCode];
  const toRate = liveRates[toCode] || defaultRatesToCNY[toCode];
  if (!fromRate || !toRate) return Number.NaN;

  const cny = amount * fromRate;
  return cny / toRate;
}

export function getSymbol(code: string): string {
  const normalizedCode = code.toUpperCase();
  return currencies.find(c => c.code === normalizedCode)?.symbol || getIntlCurrencySymbol(normalizedCode);
}
