const money = (amount, currency) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

export function formatPrice({ amount, currency, unit }) {
  const value = money(amount, currency);
  if (unit === 'fixed') return `${value} fixed`;
  if (unit === 'per-month') return `from ${value}/mo`;
  return `from ${value}`;
}
