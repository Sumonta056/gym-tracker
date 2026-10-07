'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import type { ReactNode } from 'react'

export const TOAST_MS = 2000

export const SAVED_MESSAGE = 'Saved'

type ToastApi = { show: (message: string) => void }

type Shown = { key: number; message: string }

const ToastContext = createContext<ToastApi | null>(null)

const SILENT: ToastApi = { show: () => undefined }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null)
  const count = useRef(0)

  const show = useCallback((message: string) => {
    count.current += 1
    setShown({ key: count.current, message })
  }, [])

  useEffect(() => {
    if (shown === null) {
      return
    }

    const timer = setTimeout(() => {
      setShown(null)
    }, TOAST_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [shown])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        data-testid="toast-region"
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-[60] flex justify-center px-5 md:px-7 lg:left-60"
      >
        {shown === null ? null : (
          <p
            key={shown.key}
            className="bg-surface-2 border-border text-text rounded-full border px-4 py-2.5 text-sm font-semibold"
          >
            {shown.message}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? SILENT
}
