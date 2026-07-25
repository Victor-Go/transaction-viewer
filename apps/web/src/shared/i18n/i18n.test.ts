import { describe, expect, it } from 'vitest';

import {
  DISPLAY_LOCALES,
  flattenTranslationKeys,
  normalizeLanguage,
  resources,
} from './i18n';

describe('localization configuration', () => {
  it.each([
    ['en', 'en'],
    ['en-CA', 'en'],
    ['en-GB', 'en'],
    ['fr', 'fr'],
    ['fr-CA', 'fr'],
    ['fr-FR', 'fr'],
    ['es-MX', 'en'],
    ['', 'en'],
  ] as const)('normalizes %j to %s', (input, expected) => {
    expect(normalizeLanguage(input)).toBe(expected);
  });

  it('maps UI languages to Canadian display locales', () => {
    expect(DISPLAY_LOCALES).toEqual({ en: 'en-CA', fr: 'fr-CA' });
  });

  it('keeps English and French resources complete and symmetric', () => {
    expect(flattenTranslationKeys(resources.en.translation)).toEqual(
      flattenTranslationKeys(resources.fr.translation),
    );
  });
});
