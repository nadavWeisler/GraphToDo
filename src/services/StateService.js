/**
 * StateService – persistence abstraction layer.
 *
 * Decouples the application from any specific storage mechanism.
 * The default provider is `window.localStorage`, making it a resilient
 * local fallback while keeping the interface open for future adapters
 * (IndexedDB, remote API, etc.).
 *
 * Usage:
 *   const service = createStateService()
 *   service.set('my-key', { foo: 'bar' })
 *   const value = service.get('my-key', null)
 *   service.remove('my-key')
 *
 * To swap the underlying storage (e.g. in tests):
 *   const service = createStateService(myCustomStorageAdapter)
 */
export class StateService {
  /**
   * @param {Storage} storageProvider – any object implementing the
   *   Web Storage interface: getItem, setItem, removeItem.
   *   Defaults to window.localStorage.
   */
  constructor(storageProvider = window.localStorage) {
    this.storage = storageProvider
  }

  /**
   * Returns true when the underlying storage provider is operational.
   * Uses a lightweight probe write/delete to detect quota errors or
   * environments where storage is blocked (e.g. private-browsing restrictions).
   */
  isAvailable() {
    try {
      const probeKey = '__graphtodo_probe__'
      this.storage.setItem(probeKey, '1')
      this.storage.removeItem(probeKey)
      return true
    } catch {
      return false
    }
  }

  /**
   * Reads and JSON-parses the value stored at `key`.
   * Returns `initialValue` when the key is absent.
   * Propagates JSON.parse errors so callers can handle corrupt data.
   *
   * @param {string} key
   * @param {*} initialValue – returned when the key is not present
   */
  get(key, initialValue = null) {
    const raw = this.storage.getItem(key)
    if (raw === null) return initialValue
    return JSON.parse(raw)
  }

  /**
   * JSON-serialises `value` and writes it under `key`.
   *
   * @param {string} key
   * @param {*} value – must be JSON-serialisable
   */
  set(key, value) {
    this.storage.setItem(key, JSON.stringify(value))
  }

  /**
   * Removes the entry for `key` from the underlying storage.
   *
   * @param {string} key
   */
  remove(key) {
    this.storage.removeItem(key)
  }
}

/**
 * Factory that creates a `StateService` backed by `localStorage` by default.
 * Pass a custom `storageProvider` to swap the underlying mechanism.
 *
 * @param {Storage} [storageProvider]
 * @returns {StateService}
 */
export function createStateService(storageProvider) {
  return new StateService(storageProvider)
}
