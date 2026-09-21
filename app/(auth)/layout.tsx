import type { ReactNode } from 'react'

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="bg-ground text-text flex min-h-dvh w-full flex-col items-center justify-center px-5 py-10 md:px-7">
      <main className="w-full max-w-[420px]">{children}</main>
    </div>
  )
}
