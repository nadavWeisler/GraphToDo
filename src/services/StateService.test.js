import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StateService, createStateService } from './StateService'

function makeMockStorage() {
  const store = {}
  return {
    getItem: vi.fn((key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null)),
    setItem: vi.fn((key, value) => { store[key] = value }),
    removeItem: vi.fn((key) => { delete store[key] }),
    _store: store,
  }
}

describe('StateService', () => {
  let storage
  let service

  beforeEach(() => {
    storage = makeMockStorage()
    service = new StateService(storage)
  })

  describe('isAvailable()', () => {
    it('returns true when the storage provider works normally', () => {
      expect(service.isAvailable()).toBe(true)
      expect(storage.setItem).toHaveBeenCalledWith('__graphtodo_probe__', '1')
      expect(storage.removeItem).toHaveBeenCalledWith('__graphtodo_probe__')
    })

    it('returns false when setItem throws', () => {
      storage.setItem.mockImplementation(() => { throw new Error('QuotaExceeded') })
      expect(service.isAvailable()).toBe(false)
    })

    it('returns false when removeItem throws', () => {
      storage.removeItem.mockImplementation(() => { throw new Error('storage error') })
      expect(service.isAvailable()).toBe(false)
    })
  })

  describe('get()', () => {
    it('returns initialValue when the key is absent', () => {
      expect(service.get('missing-key', [])).toEqual([])
    })

    it('returns null (default initialValue) when the key is absent and no initialValue is given', () => {
      expect(service.get('missing-key')).toBeNull()
    })

    it('returns the parsed JSON value when the key exists', () => {
      storage._store['my-key'] = JSON.stringify({ hello: 'world' })
      expect(service.get('my-key')).toEqual({ hello: 'world' })
    })

    it('correctly round-trips arrays', () => {
      const data = [1, 2, 3]
      storage._store['arr-key'] = JSON.stringify(data)
      expect(service.get('arr-key')).toEqual(data)
    })

    it('correctly round-trips primitive values', () => {
      storage._store['bool-key'] = JSON.stringify(false)
      expect(service.get('bool-key')).toBe(false)

      storage._store['num-key'] = JSON.stringify(42)
      expect(service.get('num-key')).toBe(42)
    })

    it('propagates a SyntaxError when stored value is not valid JSON', () => {
      storage._store['bad-key'] = 'not-json{'
      expect(() => service.get('bad-key')).toThrow(SyntaxError)
    })

    it('propagates errors thrown by the underlying getItem', () => {
      storage.getItem.mockImplementation(() => { throw new Error('storage unavailable') })
      expect(() => service.get('any-key')).toThrow('storage unavailable')
    })
  })

  describe('set()', () => {
    it('serialises the value as JSON and writes it', () => {
      service.set('my-key', { tasks: ['a', 'b'] })
      expect(storage.setItem).toHaveBeenCalledWith('my-key', JSON.stringify({ tasks: ['a', 'b'] }))
    })

    it('value can be read back with get()', () => {
      const data = { foo: 'bar', nested: { n: 1 } }
      service.set('round-trip', data)
      expect(service.get('round-trip')).toEqual(data)
    })

    it('overwrites an existing value', () => {
      service.set('key', 'first')
      service.set('key', 'second')
      expect(service.get('key')).toBe('second')
    })

    it('propagates errors thrown by the underlying setItem', () => {
      storage.setItem.mockImplementation(() => { throw new Error('QuotaExceeded') })
      expect(() => service.set('key', {})).toThrow('QuotaExceeded')
    })
  })

  describe('remove()', () => {
    it('removes the key from storage', () => {
      storage._store['del-key'] = JSON.stringify('value')
      service.remove('del-key')
      expect(storage.removeItem).toHaveBeenCalledWith('del-key')
      expect(service.get('del-key')).toBeNull()
    })

    it('does not throw when the key does not exist', () => {
      expect(() => service.remove('nonexistent')).not.toThrow()
    })

    it('propagates errors thrown by the underlying removeItem', () => {
      storage.removeItem.mockImplementation(() => { throw new Error('storage error') })
      expect(() => service.remove('key')).toThrow('storage error')
    })
  })

  describe('createStateService()', () => {
    it('creates a StateService instance', () => {
      const svc = createStateService(storage)
      expect(svc).toBeInstanceOf(StateService)
      expect(svc.storage).toBe(storage)
    })

    it('defaults to window.localStorage when no provider is given', () => {
      const svc = createStateService()
      expect(svc.storage).toBe(window.localStorage)
    })
  })
})
