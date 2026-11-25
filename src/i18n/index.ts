import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import rw from './locales/rw.json';
import fr from './locales/fr.json';

/**
 * All UI text goes through translation files. English ships at launch;
 * Kinyarwanda (rw) and French (fr) files exist and fall back to English
 * for any key not yet translated.
 */
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, rw: { translation: rw }, fr: { translation: fr } },
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'rw', 'fr'],
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

export default i18n;
