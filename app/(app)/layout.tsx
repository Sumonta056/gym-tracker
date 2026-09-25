import { AppNav } from '../../components/AppNav'
import { SyncRunner } from '../../components/sync/SyncRunner'

import type { ReactNode } from 'react'

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <SyncRunner />
      <AppNav>{children}</AppNav>
    </>
  )
}
