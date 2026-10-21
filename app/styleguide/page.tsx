'use client'

import { notFound } from 'next/navigation'

import { Styleguide } from './Styleguide'

export default function StyleguidePage() {
  if (!process.env.NEXT_PUBLIC_ENABLE_STYLEGUIDE) {
    notFound()
  }

  return <Styleguide />
}
