import { useEffect, useMemo, useRef, useState } from 'react'
import Quadrant from './components/Quadrant'
import './App.css'
import { QUADRANTS, QUADRANT_IDS, STORAGE_KEY, LEGACY_STORAGE_KEY } from './quadrants'
import type { Task, TasksState, AppConfig, TaskActionResult } from './types'

const MAX_TASK_LENGTH = 120

function isDueToday(dueDate) {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return false
  const today = new Date()
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
  return dueDate === todayStr
}

function emptyTasks(): TasksState {
  return Object.fromEntries(QUADRANT_IDS.map((id) => [id, []]))
}

function compactTasks(tasks: TasksState): Partial<TasksState> {
  const compacted: Partial<TasksState> = {}
  for (const { id } of QUADRANTS) {
    const quadrantTasks = tasks[id]
    if (Array.isArray(quadrantTasks) && quadrantTasks.length) {
      compacted[id] = quadrantTasks
    }
  }
  return compacted
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function createTask(text: string, dueDate: string | null = null, dueTime: string | null = null): Task {
  return { id: crypto.randomUUID(), text, done: false, dueDate, dueTime }
}

function isValidTask(task: unknown): task is Task {
  if (!task || typeof task !== 'object' || Array.isArray(task)) return false
  const t = task as Record<string, unknown>
  return (
    typeof t['id'] === 'string' &&
    typeof t['text'] === 'string' &&
    typeof t['done'] === 'boolean' &&
    (t['dueDate'] === undefined || t['dueDate'] === null || typeof t['dueDate'] === 'string') &&
    (t['dueTime'] === undefined || t['dueTime'] === null || typeof t['dueTime'] === 'string')
  )
}

function sanitizeTask(task: Task): Task | null {
  const text = normalizeText(task.text).slice(0, MAX_TASK_LENGTH)
  if (!text) return null
  return {
    id: task.id,
    text,
    done: task.done,
    dueDate: typeof task.dueDate === 'string' ? task.dueDate : null,
    dueTime: typeof task.dueTime === 'string' ? task.dueTime : null,
  }
}

function dueDateSortKey(dueDate: string | null): number {
  if (!dueDate) return Infinity
  return new Date(dueDate + 'T00:00:00').getTime()
}

function isDuplicate(tasks: TasksState, quadrantId: string, text: string, excludedTaskId: string | null = null): boolean {
  const normalized = normalizeText(text).toLowerCase()
  return tasks[quadrantId]?.some(
    (task) => task.id !== excludedTaskId && normalizeText(task.text).toLowerCase() === normalized
  ) ?? false
}

function validateTasksShape(data: unknown): TasksState | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const record = data as Record<string, unknown>
  const next = emptyTasks()

  for (const { id, legacyId } of QUADRANTS) {
    let quadrantTasks: unknown[] | null = null

    if (Array.isArray(record[id])) {
      quadrantTasks = record[id] as unknown[]
    } else if (Array.isArray(record[legacyId])) {
      quadrantTasks = record[legacyId] as unknown[]
    }

    if (quadrantTasks === null) {
      if (id in record && !Array.isArray(record[id])) return null
      if (legacyId in record && !Array.isArray(record[legacyId])) return null
      continue
    }

    const sanitized = quadrantTasks
      .filter(isValidTask)
      .map(sanitizeTask)
      .filter((t): t is Task => t !== null)

    const deduped: Task[] = []
    const seen = new Set<string>()
    for (const task of sanitized) {
      const key = normalizeText(task.text).toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(task)
    }

    next[id] = deduped
  }

  return next
}

function canUseLocalStorage(): boolean {
  try {
    const probeKey = `${STORAGE_KEY}.probe`
    localStorage.setItem(probeKey, '1')
    localStorage.removeItem(probeKey)
    return true
  } catch {
    return false
  }
}

function validateImportedTasksShape(data) {
  const next = emptyTasks()
  const validationErrors = []

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      isValid: false,
      processedData: next,
      validationErrors: [
        {
          path: 'tasks',
          index: null,
          quadrantId: null,
          message: 'Expected an object with q1, q2, q3, and q4 arrays.',
        },
      ],
    }
  }

  for (const { id, legacyId } of QUADRANTS) {
    const dataKey = id in record ? id : legacyId in record ? legacyId : null
    if (!dataKey) {
      validationErrors.push({
        path: `tasks.${id}`,
        index: null,
        quadrantId: id,
        message: `Missing required quadrant "${id}".`,
      })
      continue
    }

    if (!Array.isArray(data[dataKey])) {
      validationErrors.push({
        path: `tasks.${dataKey}`,
        index: null,
        quadrantId: id,
        message: `Quadrant "${dataKey}" must be an array of tasks.`,
      })
      continue
    }

    const sanitized = []
    for (const [index, task] of data[dataKey].entries()) {
      const taskPath = `tasks.${dataKey}[${index}]`

      if (!task || typeof task !== 'object' || Array.isArray(task)) {
        validationErrors.push({
          path: taskPath,
          index,
          quadrantId: id,
          message: 'Task must be an object.',
        })
        continue
      }

      let hasError = false

      if (typeof task.id !== 'string' || !task.id.trim()) {
        validationErrors.push({
          path: `${taskPath}.id`,
          index,
          quadrantId: id,
          message: 'Task is missing a valid "id" string.',
        })
        hasError = true
      }

      if (typeof task.text !== 'string') {
        validationErrors.push({
          path: `${taskPath}.text`,
          index,
          quadrantId: id,
          message: 'Task is missing a valid "text" string.',
        })
        hasError = true
      } else if (!normalizeText(task.text)) {
        validationErrors.push({
          path: `${taskPath}.text`,
          index,
          quadrantId: id,
          message: 'Task must have non-empty "text".',
        })
        hasError = true
      }

      if (typeof task.done !== 'boolean') {
        validationErrors.push({
          path: `${taskPath}.done`,
          index,
          quadrantId: id,
          message: 'Task is missing a valid "done" boolean.',
        })
        hasError = true
      }

      if (
        task.dueDate !== undefined &&
        task.dueDate !== null &&
        typeof task.dueDate !== 'string'
      ) {
        validationErrors.push({
          path: `${taskPath}.dueDate`,
          index,
          quadrantId: id,
          message: 'Task "dueDate" must be a string or null when provided.',
        })
        hasError = true
      }

      if (
        task.dueTime !== undefined &&
        task.dueTime !== null &&
        typeof task.dueTime !== 'string'
      ) {
        validationErrors.push({
          path: `${taskPath}.dueTime`,
          index,
          quadrantId: id,
          message: 'Task "dueTime" must be a string or null when provided.',
        })
        hasError = true
      }

      if (hasError) {
        continue
      }

      const text = normalizeText(t['text'] as string).slice(0, MAX_TASK_LENGTH)
      sanitized.push({
        text,
        done: task.done,
        id: task.id.trim(),
        dueDate: typeof task.dueDate === 'string' ? task.dueDate : null,
        dueTime: typeof task.dueTime === 'string' ? task.dueTime : null,
        sourceIndex: index,
      })
    }

    const deduped: Task[] = []
    const seen = new Set<string>()
    for (const task of sanitized) {
      const key = normalizeText(task.text).toLowerCase()
      if (seen.has(key)) {
        validationErrors.push({
          path: `tasks.${dataKey}[${task.sourceIndex}].text`,
          index: task.sourceIndex,
          quadrantId: id,
          message: 'Task text duplicates another task in the same quadrant.',
        })
        continue
      }
      seen.add(key)
      deduped.push({
        text: task.text,
        done: task.done,
        id: task.id,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
      })
    }

    next[id] = deduped
  }

  return {
    isValid: validationErrors.length === 0,
    processedData: next,
    validationErrors,
  }
}

function formatImportValidationError(error) {
  if (typeof error.index === 'number' && error.quadrantId) {
    return `Item at index ${error.index} in "${error.quadrantId}" failed because ${error.message}`
  }

  return `Validation error at "${error.path}": ${error.message}`
}

function defaultConfig(): AppConfig {
  return { hideCompleted: false }
}

interface AppState {
  tasks: TasksState
  config: AppConfig
  storageAvailable: boolean
}

function loadState(): AppState {
  if (!canUseLocalStorage()) {
    return { tasks: emptyTasks(), config: defaultConfig(), storageAvailable: false }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const tasks = validateTasksShape(parsed['tasks'] ?? parsed) ?? emptyTasks()
      const rawConfig = parsed['config']
      const config: AppConfig = {
        ...defaultConfig(),
        ...(rawConfig && typeof rawConfig === 'object' ? rawConfig as Partial<AppConfig> : {}),
      }
      return { tasks, config, storageAvailable: true }
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as Record<string, unknown>
      const tasks = validateTasksShape(parsed['tasks'] ?? parsed) ?? emptyTasks()
      return { tasks, config: defaultConfig(), storageAvailable: true }
    }
  } catch {
    // fall through to defaults
  }
  return { tasks: emptyTasks(), config: defaultConfig(), storageAvailable: true }
}

function App() {
  const [initialState] = useState<AppState>(loadState)
  const [tasks, setTasks] = useState<TasksState>(initialState.tasks)
  const [storageAvailable, setStorageAvailable] = useState<boolean>(
    initialState.storageAvailable
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [hideCompleted, setHideCompleted] = useState(initialState.config.hideCompleted)
  const [sortByDueDate, setSortByDueDate] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [importValidationErrors, setImportValidationErrors] = useState([])
  const importInputRef = useRef(null)

  // Refs that always hold the latest state values for event handlers registered once on mount.
  // Updated in an effect after every render to avoid stale closures without re-registering
  // the listeners.
  const tasksRef = useRef(tasks)
  const hideCompletedRef = useRef(hideCompleted)
  const storageAvailableRef = useRef(storageAvailable)

  useEffect(() => {
    tasksRef.current = tasks
    hideCompletedRef.current = hideCompleted
    storageAvailableRef.current = storageAvailable
  })

  // Register lifecycle listeners once on mount:
  //  • beforeunload – flush the latest in-memory state to localStorage before the page
  //    unloads (hard refresh, tab close), closing the window where pending React renders
  //    could leave localStorage behind the in-memory state.
  //  • storage     – re-read and sync in-memory state when another tab writes to the
  //    same key, handling concurrent read/write conflicts across sessions.
  useEffect(() => {
    function handleBeforeUnload() {
      if (!storageAvailableRef.current) return
      try {
        const compacted = compactTasks(tasksRef.current)
        if (Object.keys(compacted).length === 0) {
          localStorage.removeItem(STORAGE_KEY)
          return
        }
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            tasks: compacted,
            config: { hideCompleted: hideCompletedRef.current },
            lastUpdated: Date.now(),
          })
        )
      } catch {
        // Best-effort: cannot handle storage errors during page unload
      }
    }

    function handleStorageChange(event) {
      if (event.storageArea !== localStorage) return
      if (event.key !== STORAGE_KEY && event.key !== LEGACY_STORAGE_KEY) return
      // Another tab modified localStorage; re-read and sync in-memory state
      const reloaded = loadState()
      setTasks(reloaded.tasks)
      setHideCompleted(reloaded.config.hideCompleted)
      if (!reloaded.storageAvailable) setStorageAvailable(false)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  function persistState(nextTasks, nextHideCompleted = hideCompleted) {
    if (!storageAvailable) return
    try {
      const compacted = compactTasks(nextTasks)
      if (Object.keys(compacted).length === 0) {
        localStorage.removeItem(STORAGE_KEY)
        return
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ tasks: compacted, config: { hideCompleted: nextHideCompleted }, lastUpdated: Date.now() })
      )
    } catch {
      setStorageAvailable(false)
    }
  }

  function updateTasks(nextOrUpdater: TasksState | ((prev: TasksState) => TasksState)): void {
    setTasks((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater
      persistState(next)
      return next
    })
  }

  const normalizedSearch = searchQuery.trim().toLowerCase()

  const visibleTasks = useMemo<TasksState>(() => {
    const next = emptyTasks()
    for (const { id } of QUADRANTS) {
      let filtered = (tasks[id] ?? []).filter((task) => {
        if (hideCompleted && task.done) return false
        if (!normalizedSearch) return true
        return task.text.toLowerCase().includes(normalizedSearch)
      })
      if (sortByDueDate) {
        filtered = [...filtered].sort((a, b) => dueDateSortKey(a.dueDate) - dueDateSortKey(b.dueDate))
      }
      next[id] = filtered
    }
    return next
  }, [hideCompleted, normalizedSearch, sortByDueDate, tasks])

  function handleAddTask(quadrantId: string, text: string, dueDate: string | null = null, dueTime: string | null = null): TaskActionResult {
    const cleanText = normalizeText(text)

    if (!cleanText) {
      return { ok: false, error: 'Task cannot be empty.' }
    }

    if (cleanText.length > MAX_TASK_LENGTH) {
      return { ok: false, error: `Task must be ${MAX_TASK_LENGTH} characters or fewer.` }
    }

    if (isDuplicate(tasks, quadrantId, cleanText)) {
      return { ok: false, error: 'A similar task already exists in this quadrant.' }
    }

    updateTasks((prev) => ({
      ...prev,
      [quadrantId]: [...(prev[quadrantId] ?? []), createTask(cleanText, dueDate || null, dueTime || null)],
    }))

    return { ok: true }
  }

  function handleToggleTask(quadrantId: string, taskId: string): void {
    updateTasks((prev) => ({
      ...prev,
      [quadrantId]: (prev[quadrantId] ?? []).map((t) =>
        t.id === taskId ? { ...t, done: !t.done } : t
      ),
    }))
  }

  function handleDeleteTask(quadrantId: string, taskId: string): void {
    updateTasks((prev) => ({
      ...prev,
      [quadrantId]: (prev[quadrantId] ?? []).filter((t) => t.id !== taskId),
    }))
  }

  function handleEditTask(quadrantId: string, taskId: string, nextText: string, dueDate: string | null = null, dueTime: string | null = null): TaskActionResult {
    const cleanText = normalizeText(nextText)

    if (!cleanText) {
      return { ok: false, error: 'Task cannot be empty.' }
    }

    if (cleanText.length > MAX_TASK_LENGTH) {
      return { ok: false, error: `Task must be ${MAX_TASK_LENGTH} characters or fewer.` }
    }

    if (isDuplicate(tasks, quadrantId, cleanText, taskId)) {
      return { ok: false, error: 'A similar task already exists in this quadrant.' }
    }

    updateTasks((prev) => ({
      ...prev,
      [quadrantId]: (prev[quadrantId] ?? []).map((task) =>
        task.id === taskId
          ? { ...task, text: cleanText, dueDate: dueDate || null, dueTime: dueTime || null }
          : task
      ),
    }))

    return { ok: true }
  }

  function handleMoveTask(sourceQuadrantId: string, taskId: string, targetQuadrantId: string): TaskActionResult {
    if (sourceQuadrantId === targetQuadrantId) return { ok: true }

    const sourceTask = (tasks[sourceQuadrantId] ?? []).find((task) => task.id === taskId)
    if (!sourceTask) return { ok: false, error: 'Task not found.' }

    if (isDuplicate(tasks, targetQuadrantId, sourceTask.text)) {
      return { ok: false, error: 'A similar task already exists in the target quadrant.' }
    }

    updateTasks((prev) => ({
      ...prev,
      [sourceQuadrantId]: (prev[sourceQuadrantId] ?? []).filter((task) => task.id !== taskId),
      [targetQuadrantId]: [...(prev[targetQuadrantId] ?? []), sourceTask],
    }))

    return { ok: true }
  }

  function handleClearCompleted(): void {
    updateTasks((prev) => {
      const next = emptyTasks()

      for (const id of QUADRANT_IDS) {
        next[id] = (prev[id] ?? []).filter((task) => !task.done)
      }

      return next
    })
  }

  function handleExport(): void {
    const payload = {
      version: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      tasks,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'graphtodo-backup.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setStatusMessage('Tasks exported to JSON.')
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const { isValid, processedData, validationErrors } = validateImportedTasksShape(
        parsed.tasks ?? parsed
      )

      updateTasks(processedData)

      if (isValid) {
        setImportValidationErrors([])
        setStatusMessage('Tasks imported successfully.')
        return
      }

      setImportValidationErrors(validationErrors)
      const importedCount = QUADRANTS.reduce(
        (total, quadrant) => total + processedData[quadrant.id].length,
        0
      )
      if (importedCount > 0) {
        setStatusMessage(
          `Tasks imported with ${validationErrors.length} validation error(s).`
        )
        return
      }

      setStatusMessage(`Import failed with ${validationErrors.length} validation error(s).`)
    } catch (error) {
      setImportValidationErrors([])
      if (error instanceof SyntaxError) {
        setStatusMessage('Import failed: invalid JSON syntax. Please upload a valid .json file.')
        return
      }

      if (error instanceof Error) {
        setStatusMessage(`Import failed: ${error.message}`)
        return
      }

      setStatusMessage('Import failed: unable to process this file.')
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = ''
      }
    }
  }

  const hasCompletedTasks = QUADRANTS.some(({ id }) =>
    (tasks[id] ?? []).some((task) => task.done)
  )
  const dueTodayCount = QUADRANTS.reduce(
    (count, { id }) =>
      count + tasks[id].filter((task) => !task.done && isDueToday(task.dueDate)).length,
    0
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>Eisenhower Matrix</h1>
        <p>Organize tasks by urgency and importance to maximize productivity</p>
      </header>

      <section className="toolbar" aria-label="Task controls">
        <label className="toolbar-field" htmlFor="task-search">
          <span>Search</span>
          <input
            id="task-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search tasks..."
          />
        </label>

        <label className="toolbar-checkbox" htmlFor="hide-completed">
          <input
            id="hide-completed"
            type="checkbox"
            checked={hideCompleted}
            onChange={(event) => {
              const nextHideCompleted = event.target.checked
              setHideCompleted(nextHideCompleted)
              persistState(tasks, nextHideCompleted)
            }}
          />
          <span>Hide completed</span>
        </label>

        <label className="toolbar-checkbox" htmlFor="sort-due-date">
          <input
            id="sort-due-date"
            type="checkbox"
            checked={sortByDueDate}
            onChange={(event) => setSortByDueDate(event.target.checked)}
          />
          <span>Sort by due date</span>
        </label>

        <div className="toolbar-actions">
          <button type="button" onClick={handleExport}>Export JSON</button>

          <button type="button" onClick={() => importInputRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            onChange={handleImport}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />

          <button
            type="button"
            onClick={handleClearCompleted}
            disabled={!hasCompletedTasks}
          >
            Clear completed
          </button>
        </div>
      </section>

      {!storageAvailable && (
        <p className="storage-warning" role="alert">
          Local storage is unavailable. Tasks are only kept in memory and may be lost on refresh.
        </p>
      )}

      <p className="status-message" role="status" aria-live="polite">
        {statusMessage}
      </p>
      {importValidationErrors.length > 0 && (
        <ul className="status-error-list" aria-label="Import validation errors">
          {importValidationErrors.map((error, index) => (
            <li key={`${error.path}-${index}`}>{formatImportValidationError(error)}</li>
          ))}
        </ul>
      )}

      <div className="matrix-labels" aria-hidden="true">
        <span className="axis-label urgent-label">← Urgent</span>
        <span className="axis-label not-urgent-label">Not Urgent →</span>
      </div>

      <div className="matrix-container">
        <div className="importance-label-left" aria-hidden="true">
          <span>Important</span>
        </div>

        <div className="matrix-grid">
          {QUADRANTS.map((q) => (
            <Quadrant
              key={q.id}
              id={q.id}
              title={q.title}
              subtitle={q.subtitle}
              colorClass={q.colorClass}
              tasks={visibleTasks[q.id] ?? []}
              totalCount={(tasks[q.id] ?? []).length}
              visibleCount={(visibleTasks[q.id] ?? []).length}
              quadrants={QUADRANTS}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onEditTask={handleEditTask}
              onMoveTask={handleMoveTask}
            />
          ))}
        </div>

        <div className="importance-label-right" aria-hidden="true">
          <span>Not Important</span>
        </div>
      </div>
    </div>
  )
}
