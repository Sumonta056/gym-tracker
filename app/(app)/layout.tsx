import { AppNav } from '../../components/AppNav'
import { AppGuards } from '../../components/errors/AppGuards'
import { SyncRunner } from '../../components/sync/SyncRunner'
import { ResumePrompt } from '../../components/workout/ResumePrompt'

import type { ReactNode } from 'react'

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <AppGuards />
      <SyncRunner />
      <AppNav>{children}</AppNav>
      <ResumePrompt />
    </>
  )
}
