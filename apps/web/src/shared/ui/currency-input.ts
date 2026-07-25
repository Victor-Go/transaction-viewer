export const isValidCurrencyDraft = (value: string): boolean =>
  value === '' || /^\d+(?:[.,]\d{0,2})?$/.test(value);
