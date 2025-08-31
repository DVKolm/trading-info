module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    // Мягкие правила для разработки
    '@typescript-eslint/no-unused-vars': 'warn',
    'no-unused-vars': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': 'off'
  }
};