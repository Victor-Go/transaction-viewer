import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

export type AppLanguage = 'en' | 'fr';

export const LANGUAGE_STORAGE_KEY = 'card-platform-language';
export const DISPLAY_LOCALES: Readonly<Record<AppLanguage, string>> = {
  en: 'en-CA',
  fr: 'fr-CA',
};

export const normalizeLanguage = (language: string): AppLanguage => {
  const base = language.trim().toLowerCase().split(/[-_]/)[0];
  return base === 'fr' ? 'fr' : 'en';
};

export const resources = {
  en: {
    translation: {
      app: {
        primaryNavigation: 'Primary',
        brand: 'Card Platform',
        demoAccount: 'Demo account',
        account: 'Account · {{accountId}}',
        language: 'Language',
        english: 'English',
        french: 'French',
      },
      history: {
        title: 'Transaction history',
        supporting:
          'Purchases, posting updates, and reversals—clear at a glance and ready when you need the detail.',
        transactions: 'Transactions',
        loadingTotal: 'Loading total…',
        resultCount_one: '{{formattedCount}} result',
        resultCount_other: '{{formattedCount}} results',
        filters: 'Transaction search and filters',
        filterByStatus: 'Filter by status',
        all: 'All',
        searchByDate: 'Search by date',
        editDateSearch: 'Edit date search: {{range}}',
        clearDateSearch: 'Clear date search: {{range}}',
        loading: 'Loading transactions',
        emptyTitle: 'No transactions found',
        emptyAll: 'There are no Transactions yet.',
        emptyStatus: 'There are no {{status}} transactions for this account.',
        emptyDate: 'No Transactions were found from {{range}}',
        emptyStatusDate: 'No {{status}} Transactions were found from {{range}}',
        listLabel: 'Transactions',
        viewDetails: 'View details for {{merchant}}',
        details: 'Details',
        retryLoadMore: 'Retry load more',
        loadMore: 'Load more',
        loadContractError:
          'Transaction data could not be verified. Please retry.',
        loadError:
          'Transactions could not be loaded. Check your connection and retry.',
      },
      status: {
        pending: 'Pending',
        posted: 'Posted',
        reversed: 'Reversed',
      },
      create: {
        open: 'Create transaction',
        title: 'Create transaction',
        description: 'Record a CAD purchase for this demo account.',
        close: 'Close create transaction',
        cancel: 'Cancel',
        submit: 'Create purchase',
        merchant: 'Merchant name',
        amount: 'Amount (CAD)',
        amountPlaceholder: '0.00',
        amountHint: 'Use a period or comma for cents.',
        pendingNote:
          'New transactions begin as Pending and normally become Posted in about 5–10 seconds in this demo.',
        merchantRequired: 'Enter a merchant name.',
        merchantLength: 'Enter a merchant name between 1 and 120 characters.',
        amountInvalid: 'Enter a CAD amount from $0.01 to $999,999,999.99.',
        conflict:
          'This purchase conflicts with an earlier request. Review the details and try again.',
        rejected:
          'The purchase details were rejected. Review the fields and try again.',
        uncertain:
          'The result is uncertain. Retry to safely check the same purchase attempt.',
        uncertainNetwork:
          'The result is uncertain. Check your connection and retry safely.',
      },
      detail: {
        title: 'Transaction details',
        closeLabel: 'Close details',
        close: 'Close',
        loading: 'Loading transaction details',
        notFound:
          'This transaction could not be found for the current account.',
        contractError: 'The transaction response could not be verified safely.',
        loadError: 'Transaction details could not be loaded.',
        retry: 'Retry',
        pending:
          'New transactions begin as Pending and normally become Posted in about 5–10 seconds in this demo.',
        pollingError:
          'The latest status could not be checked. We will retry shortly.',
        transactionDate: 'Transaction date',
        created: 'Created',
        updated: 'Last updated',
        reversed: 'Reversed',
        eligibility: 'Reversal eligibility',
        pendingNotReversible:
          'This transaction cannot be reversed until it is Posted.',
        alreadyReversed: 'This transaction has already been reversed.',
        invalidDeadline:
          'Reversal eligibility could not be verified, so reversal is disabled.',
        deadline: 'This transaction can be reversed before {{date}}.',
        expired: 'The reversal window has expired.',
        reverse: 'Reverse transaction',
      },
      reverse: {
        title: 'Reverse this transaction?',
        description:
          'This action changes the transaction status to Reversed and cannot be undone here.',
        close: 'Close confirmation',
        cancel: 'Cancel',
        submit: 'Reverse transaction',
        submitting: 'Submitting…',
        genericError: 'The request could not be completed.',
        conflict:
          'This reversal conflicts with an earlier request. Close and review the transaction before trying again.',
        uncertain:
          'The result is uncertain. Retry to safely check the same reversal attempt.',
      },
      dateSearch: {
        title: 'Search transactions by date',
        description: 'Choose an inclusive range of local calendar dates.',
        close: 'Close date search',
        start: 'Start date',
        end: 'End date',
        selectStart: 'Select a start date',
        selectEnd: 'Select an end date',
        previousYear: 'Previous year',
        previousMonth: 'Previous month',
        nextMonth: 'Next month',
        nextYear: 'Next year',
        cancel: 'Cancel',
        search: 'Search',
        invalid: 'Choose a valid date range within the supported limits.',
        configurationError: 'The date picker configuration is invalid.',
      },
      common: {
        retry: 'Retry',
        close: 'Close',
      },
    },
  },
  fr: {
    translation: {
      app: {
        primaryNavigation: 'Principale',
        brand: 'Plateforme de cartes',
        demoAccount: 'Compte démo',
        account: 'Compte · {{accountId}}',
        language: 'Langue',
        english: 'Anglais',
        french: 'Français',
      },
      history: {
        title: 'Historique des transactions',
        supporting:
          'Achats, mises à jour de comptabilisation et annulations—clairs en un coup d’œil.',
        transactions: 'Transactions',
        loadingTotal: 'Chargement du total…',
        resultCount_one: '{{formattedCount}} résultat',
        resultCount_other: '{{formattedCount}} résultats',
        filters: 'Recherche et filtres de transactions',
        filterByStatus: 'Filtrer par état',
        all: 'Toutes',
        searchByDate: 'Rechercher par date',
        editDateSearch: 'Modifier la recherche par date : {{range}}',
        clearDateSearch: 'Effacer la recherche par date : {{range}}',
        loading: 'Chargement des transactions',
        emptyTitle: 'Aucune transaction trouvée',
        emptyAll: 'Il n’y a pas encore de transactions.',
        emptyStatus: 'Aucune transaction {{status}} pour ce compte.',
        emptyDate: 'Aucune transaction trouvée du {{range}}',
        emptyStatusDate: 'Aucune transaction {{status}} trouvée du {{range}}',
        listLabel: 'Transactions',
        viewDetails: 'Voir les détails de {{merchant}}',
        details: 'Détails',
        retryLoadMore: 'Réessayer le chargement',
        loadMore: 'Charger plus',
        loadContractError:
          'Les données de transaction n’ont pas pu être vérifiées. Réessayez.',
        loadError:
          'Impossible de charger les transactions. Vérifiez votre connexion et réessayez.',
      },
      status: {
        pending: 'En attente',
        posted: 'Comptabilisée',
        reversed: 'Annulée',
      },
      create: {
        open: 'Créer une transaction',
        title: 'Créer une transaction',
        description:
          'Enregistrer un achat en dollars canadiens pour ce compte démo.',
        close: 'Fermer la création de transaction',
        cancel: 'Annuler',
        submit: 'Créer l’achat',
        merchant: 'Nom du commerçant',
        amount: 'Montant (CAD)',
        amountPlaceholder: '0,00',
        amountHint: 'Utilisez un point ou une virgule pour les cents.',
        pendingNote:
          'Les nouvelles transactions commencent en attente et sont normalement comptabilisées dans environ 5 à 10 secondes dans cette démo.',
        merchantRequired: 'Saisissez un nom de commerçant.',
        merchantLength: 'Saisissez un nom de commerçant de 1 à 120 caractères.',
        amountInvalid: 'Saisissez un montant CAD de 0,01 $ à 999 999 999,99 $.',
        conflict:
          'Cet achat entre en conflit avec une demande précédente. Vérifiez les détails et réessayez.',
        rejected:
          'Les détails de l’achat ont été refusés. Vérifiez les champs et réessayez.',
        uncertain:
          'Le résultat est incertain. Réessayez pour vérifier la même tentative d’achat.',
        uncertainNetwork:
          'Le résultat est incertain. Vérifiez votre connexion et réessayez.',
      },
      detail: {
        title: 'Détails de la transaction',
        closeLabel: 'Fermer les détails',
        close: 'Fermer',
        loading: 'Chargement des détails de la transaction',
        notFound: 'Cette transaction est introuvable pour le compte actuel.',
        contractError:
          'La réponse de transaction n’a pas pu être vérifiée de façon sûre.',
        loadError: 'Impossible de charger les détails de la transaction.',
        retry: 'Réessayer',
        pending:
          'Les nouvelles transactions commencent en attente et sont normalement comptabilisées dans environ 5 à 10 secondes dans cette démo.',
        pollingError:
          'Impossible de vérifier le dernier état. Nous réessaierons bientôt.',
        transactionDate: 'Date de transaction',
        created: 'Créée',
        updated: 'Dernière mise à jour',
        reversed: 'Annulée',
        eligibility: 'Admissibilité à l’annulation',
        pendingNotReversible:
          'Cette transaction ne peut pas être annulée avant sa comptabilisation.',
        alreadyReversed: 'Cette transaction a déjà été annulée.',
        invalidDeadline:
          'L’admissibilité à l’annulation n’a pas pu être vérifiée; l’annulation est désactivée.',
        deadline: 'Cette transaction peut être annulée avant le {{date}}.',
        expired: 'La période d’annulation est expirée.',
        reverse: 'Annuler la transaction',
      },
      reverse: {
        title: 'Annuler cette transaction?',
        description:
          'Cette action change l’état de la transaction à Annulée et ne peut pas être défaite ici.',
        close: 'Fermer la confirmation',
        cancel: 'Conserver',
        submit: 'Annuler la transaction',
        submitting: 'Envoi…',
        genericError: 'La demande n’a pas pu être effectuée.',
        conflict:
          'Cette annulation entre en conflit avec une demande précédente. Fermez et vérifiez la transaction avant de réessayer.',
        uncertain:
          'Le résultat est incertain. Réessayez pour vérifier la même tentative d’annulation.',
      },
      dateSearch: {
        title: 'Rechercher des transactions par date',
        description: 'Choisissez une plage inclusive de dates civiles locales.',
        close: 'Fermer la recherche par date',
        start: 'Date de début',
        end: 'Date de fin',
        selectStart: 'Sélectionnez une date de début',
        selectEnd: 'Sélectionnez une date de fin',
        previousYear: 'Année précédente',
        previousMonth: 'Mois précédent',
        nextMonth: 'Mois suivant',
        nextYear: 'Année suivante',
        cancel: 'Annuler',
        search: 'Rechercher',
        invalid:
          'Choisissez une plage de dates valide dans les limites prises en charge.',
        configurationError:
          'La configuration du sélecteur de dates est invalide.',
      },
      common: {
        retry: 'Réessayer',
        close: 'Fermer',
      },
    },
  },
} as const;

export const flattenTranslationKeys = (
  value: Readonly<Record<string, unknown>>,
  prefix = '',
): string[] =>
  Object.entries(value)
    .flatMap(([key, child]) => {
      const path = prefix.length === 0 ? key : `${prefix}.${key}`;
      return typeof child === 'object' && child !== null
        ? flattenTranslationKeys(
            child as Readonly<Record<string, unknown>>,
            path,
          )
        : [path];
    })
    .sort();

const detector = new LanguageDetector();
void i18n
  .use(detector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: ['en', 'fr'],
    fallbackLng: 'en',
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
      convertDetectedLanguage: normalizeLanguage,
    },
    initAsync: false,
  });

const updateDocumentLanguage = (language: string) => {
  document.documentElement.lang = normalizeLanguage(language);
};

updateDocumentLanguage(i18n.resolvedLanguage ?? i18n.language);
i18n.on('languageChanged', updateDocumentLanguage);

export const getDisplayLocale = (language: string): string =>
  DISPLAY_LOCALES[normalizeLanguage(language)];

export default i18n;
