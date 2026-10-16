'use client'

import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { logPath, parseLogDate } from '../lib/format/logDate'
import { localDate } from '../lib/schema/dailyEntry'

import { DailyEntryForm } from './DailyEntryForm'

import type { DayControl } from './DailyEntryForm'

export function LogDay() {
  const params = useSearchParams()
  const asked = params.get('date')
  const [date, setDate] = useState(() => parseLogDate(asked, localDate()))
  const [from, setFrom] = useState<DayControl | undefined>(undefined)

  useEffect(() => {
    if (asked !== null && asked !== date) {
      window.history.replaceState(null, '', logPath(date))
    }
  }, [asked, date])

  const change = useCallback((next: string, control?: DayControl) => {
    setDate(next)
    setFrom(control)
    window.history.replaceState(null, '', logPath(next))
  }, [])

  return <DailyEntryForm key={date} date={date} onDateChange={change} focusOn={from} />
}
