import { Suspense } from 'react'

import { LogDay } from '../../../components/LogDay'

export default function LogPage() {
  return (
    <Suspense fallback={null}>
      <LogDay />
    </Suspense>
  )
}
