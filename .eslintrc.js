module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es6: true,
  },
  extends: ['prettier', 'airbnb-base'],
  plugins: ['prettier'],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  rules: {
    'nonblock-statement-body-position': 'off',
    'prettier/prettier': 'error',
    'no-use-before-define': 'off',
    'no-plusplus': 'off',
    'no-underscore-dangle': 'off',
    'func-names': 'off',
    'max-classes-per-file': 'off',
    'prefer-destructuring': 'off',
    'implicit-arrow-linebreak': 'off',
    'no-await-in-loop': 'off',
    'operator-linebreak': 'off',
    quotes: 'off',
    indent: 'off',
    curly: 'off',
  },
};
