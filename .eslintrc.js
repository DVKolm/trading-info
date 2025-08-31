module.exports = {
  root: true,
  env: {
    node: true,
    es6: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  extends: [
    'eslint:recommended',
  ],
  rules: {
    // General rules
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-debugger': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'no-var': 'error',
    'strict': ['error', 'global'],
    
    // Node.js specific
    'no-process-exit': 'error',
    'no-buffer-constructor': 'error',
    'no-new-require': 'error',
    'no-path-concat': 'error',
  },
  overrides: [
    {
      files: ['server/**/*.js'],
      env: {
        node: true,
      },
      rules: {
        'no-console': 'off', // Allow console in server files for debugging
      }
    }
  ],
};