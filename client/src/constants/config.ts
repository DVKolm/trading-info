/**
 * Application configuration constants
 */

export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || '',
  TIMEOUT: 10000, // 10 seconds
} as const;

export const TELEGRAM_CONFIG = {
  CHANNEL_URL: 'https://t.me/DailyTradiBlog',
  CHANNEL_USERNAME: '@H.E.A.R.T.',
  AUTHORIZED_USER_IDS: ['781182099', '5974666109'],
} as const;

export const CACHE_CONFIG = {
  SUBSCRIPTION_CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  LESSON_CACHE_MAX_SIZE: 50, // Maximum cached lessons
  LOCALSTORAGE_BATCH_DELAY: 500, // milliseconds
} as const;

export const UI_CONFIG = {
  SCROLL_THROTTLE_DELAY: 250, // milliseconds
  SCROLL_SAVE_THRESHOLD: 100, // pixels
  LOADING_ANIMATION_DELAY: 300, // milliseconds
  WELCOME_ANIMATION_DELAY: 100, // milliseconds
} as const;

export const THEME_CONFIG = {
  DEFAULT_THEME: 'dark' as const,
  TELEGRAM_HEADER_COLOR: '#1e1e1e',
  TELEGRAM_BACKGROUND_COLOR: '#1e1e1e',
} as const;