const symbolOverrides: Record<string, string> = {
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  CLP: 'CLP',
  CNY: '¥',
  COP: 'COL$',
  EUR: '€',
  GBP: '£',
  HKD: 'HK$',
  JPY: '¥',
  KRW: '₩',
  MXN: 'MX$',
  NZD: 'NZ$',
  SGD: 'S$',
  TWD: 'NT$',
  USD: '$',
};

export function getCurrencySymbol(code: string | null | undefined): string {
  const currency = (code || 'CNY').toUpperCase();
  if (symbolOverrides[currency]) return symbolOverrides[currency];

  try {
    const parts = new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value || currency;
  } catch {
    return currency;
  }
}
