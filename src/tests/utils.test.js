import { describe, it, expect } from 'vitest'
import { cn } from '../lib/utils.js'

describe('cn', () => {
  it('merges class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('drops falsy values', () => {
    expect(cn('foo', null, undefined, false, 'bar')).toBe('foo bar')
  })

  it('resolves tailwind conflicts (last wins)', () => {
    // tailwind-merge: bg-red-500 then bg-blue-500 → bg-blue-500 wins
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
  })

  it('handles conditional objects (clsx)', () => {
    expect(cn({ 'text-accent': true, 'text-muted': false })).toBe('text-accent')
  })
})
