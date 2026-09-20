import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

describe('the ui harness', () => {
  it('renders into a jsdom document and matches with jest-dom', () => {
    render(createElement('button', { type: 'button' }, 'Log a set'))
    expect(screen.getByRole('button', { name: 'Log a set' })).toBeInTheDocument()
  })

  it('exposes a fake indexedDB', () => {
    expect(globalThis.indexedDB).toBeDefined()
    expect(typeof globalThis.indexedDB.open).toBe('function')
  })
})
