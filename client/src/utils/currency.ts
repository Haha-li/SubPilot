export const currencies = [
  { code: 'CNY', symbol: '¥', label: '人民币' },
  { code: 'USD', symbol: '$', label: '美元' },
  { code: 'EUR', symbol: '€', label: '欧元' },
  { code: 'GBP', symbol: '£', label: '英镑' },
  { code: 'JPY', symbol: '¥', label: '日元' },
  { code: 'HKD', symbol: 'HK$', label: '港币' },
  { code: 'KRW', symbol: '₩', label: '韩元' },
  { code: 'TWD', symbol: 'NT$', label: '台币' },
  { code: 'SGD', symbol: 'S$', label: '新加坡元' },
  { code: 'CAD', symbol: 'C$', label: '加元' },
  { code: 'AUD', symbol: 'A$', label: '澳元' },
] as const;

export const ratesToCNY: Record<string, number> = {
  CNY: 1,
  USD: 7.25,
  EUR: 7.85,
  GBP: 9.15,
  JPY: 0.048,
  HKD: 0.93,
  KRW: 0.0052,
  TWD: 0.225,
  SGD: 5.38,
  CAD: 5.28,
  AUD: 4.72,
};

export function convert(amount: number, from: string, to: string): number {
  const cny = amount * (ratesToCNY[from] || 1);
  return cny / (ratesToCNY[to] || 1);
}

export function getSymbol(code: string): string {
  return currencies.find(c => c.code === code)?.symbol || code;
}
