const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [2, 'never'],
    'scope-enum': [
      2,
      'always',
      ['setup', 'db', 'sync', 'ui', 'design', 'charts', 'pwa', 'auth', 'csv', 'test', 'docs', 'ci'],
    ],
  },
}

export default config
