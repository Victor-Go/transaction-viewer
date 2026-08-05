const CURRENCY_DRAFT_PATTERN = /^\d+(?:[.,]\d{0,2})?$/;

const isAtMostMinorUnits = (value: string, maximumMinorUnits: number) => {
  const [whole = '', fraction = ''] = value.replace(',', '.').split('.');
  const normalizedMinorUnits =
    `${whole.replace(/^0+/, '') || '0'}${fraction.padEnd(2, '0')}`.replace(
      /^0+/,
      '',
    ) || '0';
  const maximum = String(maximumMinorUnits);

  return (
    normalizedMinorUnits.length < maximum.length ||
    (normalizedMinorUnits.length === maximum.length &&
      normalizedMinorUnits <= maximum)
  );
};

export const isValidCurrencyDraft = (
  value: string,
  maximumMinorUnits?: number,
): boolean =>
  (value === '' || CURRENCY_DRAFT_PATTERN.test(value)) &&
  (maximumMinorUnits === undefined ||
    value === '' ||
    isAtMostMinorUnits(value, maximumMinorUnits));
