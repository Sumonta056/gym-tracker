'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import type { ReactNode } from 'react'

type FocusModeValue = {
  focus: boolean
  setFocus: (focus: boolean) => void
}

const FocusModeContext = createContext<FocusModeValue>({
  focus: false,
  setFocus: () => undefined,
})

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState(false)
  const value = useMemo(() => ({ focus, setFocus }), [focus])

  return <FocusModeContext.Provider value={value}>{children}</FocusModeContext.Provider>
}

export function useFocusModeOn(): boolean {
  return useContext(FocusModeContext).focus
}

export function useFocusMode(active: boolean): void {
  const { setFocus } = useContext(FocusModeContext)

  useEffect(() => {
    if (!active) {
      return
    }

    setFocus(true)

    return () => {
      setFocus(false)
    }
  }, [active, setFocus])
}
