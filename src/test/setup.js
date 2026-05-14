import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  localStorage.clear()

  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => 'blob:mock')
  }

  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = vi.fn()
  }
})
