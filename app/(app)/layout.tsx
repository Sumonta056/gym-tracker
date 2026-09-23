import { AppNav } from '../../components/AppNav'

import type { ReactNode } from 'react'

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AppNav>{children}</AppNav>
}
