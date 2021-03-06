module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es6: true,
    mocha: true,
  },
  extends: ['prettier', 'airbnb-base', 'plugin:mocha/recommended'],
  plugins: ['prettier', 'mocha'],
  ignorePatterns: ['db/config/config.js', 'db/models/index.js'],
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
    'mocha/no-mocha-arrows': 'off',
    'no-constant-condition': ['error', { checkLoops: false }],
    quotes: 'off',
    indent: 'off',
    curly: 'off',
  },
};
