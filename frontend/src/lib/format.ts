export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

export const fmtPct = (x: number, digits = 1) =>
  `${x.toFixed(digits)}%`;

export const fmtX = (x: number, digits = 2) =>
  `${x.toFixed(digits)}x`;