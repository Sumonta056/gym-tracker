import { test as setup } from '@playwright/test'

import { saveState, signIn } from './support/account'

setup('signs the test account in and saves the session cookies', async ({ baseURL }) => {
  const host = new URL(baseURL ?? 'http://127.0.0.1').hostname

  saveState(await signIn(host))
})
