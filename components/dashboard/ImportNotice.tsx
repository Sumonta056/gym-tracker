'use client'

import { useEffect, useState } from 'react'

import { readResult, resultText } from '../csv/importResult'
import { Card } from '../ui/Card'

import type { ImportOutcome } from '../csv/importResult'

export function ImportNoticeView({ outcome }: { outcome: ImportOutcome | null }) {
  return (
    <div role="status" aria-live="polite">
      {outcome === null ? null : (
        <Card className="mb-3" data-testid="import-notice">
          <p className="text-text text-sm font-bold">{resultText(outcome)}</p>
        </Card>
      )}
    </div>
  )
}

export function ImportNotice() {
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)

  useEffect(() => {
    const read = readResult(window.location.search)

    if (read === null) {
      return
    }

    setOutcome(read)
    window.history.replaceState(window.history.state, '', window.location.pathname)
  }, [])

  return <ImportNoticeView outcome={outcome} />
}
