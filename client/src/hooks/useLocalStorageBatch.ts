import { useCallback, useRef } from 'react';

// Debounced localStorage operations
let localStorageQueue = new Map<string, any>();
let localStorageTimer: NodeJS.Timeout | null = null;

/**
 * Custom hook for batched localStorage operations to improve performance
 */
export const useLocalStorageBatch = () => {
  const batchedLocalStorageSet = useCallback((key: string, value: any) => {
    localStorageQueue.set(key, value);
    
    if (localStorageTimer) {
      clearTimeout(localStorageTimer);
    }
    
    localStorageTimer = setTimeout(() => {
      localStorageQueue.forEach((val, k) => {
        try {
          localStorage.setItem(k, typeof val === 'string' ? val : JSON.stringify(val));
        } catch (error) {
          console.error(`Error saving to localStorage key "${k}":`, error);
        }
      });
      localStorageQueue.clear();
      localStorageTimer = null;
    }, 500); // Batch localStorage writes every 500ms
  }, []);

  const getLocalStorageItem = useCallback((key: string) => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error(`Error reading from localStorage key "${key}":`, error);
      return null;
    }
  }, []);

  const removeLocalStorageItem = useCallback((key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, []);

  return {
    batchedLocalStorageSet,
    getLocalStorageItem,
    removeLocalStorageItem
  };
};