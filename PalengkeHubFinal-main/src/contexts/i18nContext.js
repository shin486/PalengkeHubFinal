import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from '../i18n/en.json';
import fil from '../i18n/fil.json';

const I18nContext = createContext();

export const useI18n = () => useContext(I18nContext);

const LANGUAGE_KEY = '@palengkehub_language';
const translations = { en, fil };

export const I18nProvider = ({ children }) => {
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (saved && translations[saved]) {
        setLocale(saved);
      }
    } catch (error) {
      console.warn('Error loading language:', error);
    }
  };

  const changeLanguage = async (newLocale) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, newLocale);
      setLocale(newLocale);
    } catch (error) {
      console.warn('Error saving language:', error);
    }
  };

  // t('home.title') -> "Home" or "Home" (Filipino)
  // t('home.title', 'Home') -> falls back to the given default instead of
  // the raw dotted key when the translation is missing from en.json/fil.json.
  // Supports interpolation: t('nav.hello', { name: 'Alex' }) or t('nav.hello', 'Hello {name}', { name: 'Alex' })
  const t = (key, defaultValue, params) => {
    const hasExplicitDefault = defaultValue !== undefined && typeof defaultValue === 'string';
    const fallback = hasExplicitDefault ? defaultValue : key;
    const interpolationParams = typeof defaultValue === 'object' && defaultValue !== null ? defaultValue : params;
    const keys = key.split('.');
    let value = translations[locale];
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = fallback;
        break;
      }
    }
    let result = (typeof value === 'string' ? value : (hasExplicitDefault ? fallback : '')) || fallback;
    if (interpolationParams && typeof interpolationParams === 'object') {
      Object.keys(interpolationParams).forEach((p) => {
        result = result.replace(new RegExp(`%\\{${p}\\}|\\{${p}\\}`, 'g'), interpolationParams[p]);
      });
    }
    return result;
  };

  const value = {
    locale,
    changeLanguage,
    t,
    en,
    fil,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};