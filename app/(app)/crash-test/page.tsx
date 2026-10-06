import { notFound } from 'next/navigation'

import { ForcedCrash } from '../../../components/errors/ForcedCrash'
import { crashTestEnabled } from '../../../lib/flags'

export default function CrashTestPage() {
  if (!crashTestEnabled()) {
    notFound()
  }

  return <ForcedCrash />
}
