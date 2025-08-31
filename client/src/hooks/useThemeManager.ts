import { useState, useCallback, useEffect } from 'react';
import { useLocalStorageBatch } from './useLocalStorageBatch';

type Theme = 'light' | 'dark';

export const useThemeManager = () => {
  const [theme, setTheme] = useState<Theme>('dark');
  const { batchedLocalStorageSet, getLocalStorageItem } = useLocalStorageBatch();

  const loadTheme = useCallback(() => {
    try {
      const savedTheme = getLocalStorageItem('app_theme') as Theme;
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else {
        // Default to dark theme
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  }, [getLocalStorageItem]);

  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    batchedLocalStorageSet('app_theme', newTheme);
  }, [batchedLocalStorageSet]);

  // Initialize theme
  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  return {
    theme,
    handleThemeChange
  };
};