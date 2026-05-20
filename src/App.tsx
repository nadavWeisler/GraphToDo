import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import Quadrant from './components/Quadrant'
import './App.css'
import { QUADRANTS, QUADRANT_IDS, STORAGE_KEY, LEGACY_STORAGE_KEY } from './quadrants'
import type { QuadrantState, Task, TaskMutationResult } from './types'

const MAX_TASK_LENGTH = 120
const EXPORT_SCHEMA_VERSION = 1

type UnknownRecord = Record<string, unknown>

type ValidTaskInput = {
  id: string
  text: string
  done: boolean
  dueDate?: string | null
  dueTime?: string | null
}

interface AppConfig {
  hideCompleted: boolean
}

interface LoadStateResult {
  tasks: QuadrantState
  config: AppConfig
  storageAvailable: boolean
}

function emptyTasks(): QuadrantState {
  return Object.fromEntries(QUADRANT_IDS.map((id) => [id, [] as Task[]]))
}

function compactTasks(tasks: QuadrantState): QuadrantState {
  const compacted: QuadrantState = {}
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

function isValidTask(task: unknown): task is ValidTaskInput {
  if (!task || typeof task !== 'object' || Array.isArray(task)) return false
  const source = task as UnknownRecord
  return (
    typeof source.id === 'string' &&
    typeof source.text === 'string' &&
    typeof source.done === 'boolean' &&
    (source.dueDate === undefined || source.dueDate === null || typeof source.dueDate === 'string') &&
    (source.dueTime === undefined || source.dueTime === null || typeof source.dueTime === 'string')
  )
}

function sanitizeTask(task: ValidTaskInput): Task | null {
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

function isDuplicate(
  tasks: QuadrantState,
  quadrantId: string,
  text: string,
  excludedTaskId: string | null = null
): boolean {
  const normalized = normalizeText(text).toLowerCase()
  return tasks[quadrantId].some(
    (task) => task.id !== excludedTaskId && normalizeText(task.text).toLowerCase() === normalized
  )
}

function validateTasksShape(data: unknown): QuadrantState | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const source = data as UnknownRecord
  const next = emptyTasks()

  for (const { id, legacyId } of QUADRANTS) {
    let quadrantTasks: unknown[] | null = null

    if (Array.isArray(source[id])) {
      quadrantTasks = source[id]
    } else if (Array.isArray(source[legacyId])) {
      quadrantTasks = source[legacyId]
    }

    if (quadrantTasks === null) {
      if (id in source && !Array.isArray(source[id])) return null
      if (legacyId in source && !Array.isArray(source[legacyId])) return null
      continue
    }

    const sanitized = quadrantTasks
      .filter(isValidTask)
      .map(sanitizeTask)
      .filter((task): task is Task => task !== null)

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

function validateImportedTasksShape(data: unknown): QuadrantState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Expected an object with q1, q2, q3, and q4 arrays.')
  }

  const source = data as UnknownRecord
  const next = emptyTasks()

  for (const { id, legacyId } of QUADRANTS) {
    const dataKey = id in source ? id : legacyId in source ? legacyId : null
    if (!dataKey) {
      throw new Error(`Missing required quadrant "${id}".`)
    }

    if (!Array.isArray(source[dataKey])) {
      throw new Error(`Quadrant "${dataKey}" must be an array of tasks.`)
    }

    const sanitized: Task[] = []
    for (const [index, rawTask] of source[dataKey].entries()) {
      if (!rawTask || typeof rawTask !== 'object' || Array.isArray(rawTask)) {
        throw new Error(`Task ${index + 1} in "${dataKey}" must be an object.`)
      }

      const task = rawTask as UnknownRecord

      if (typeof task.id !== 'string' || !task.id.trim()) {
        throw new Error(`Task ${index + 1} in "${dataKey}" is missing a valid "id" string.`)
      }

      if (typeof task.text !== 'string') {
        throw new Error(`Task ${index + 1} in "${dataKey}" is missing a valid "text" string.`)
      }

      if (!normalizeText(task.text)) {
        throw new Error(`Task ${index + 1} in "${dataKey}" must have non-empty "text".`)
      }

      if (typeof task.done !== 'boolean') {
        throw new Error(`Task ${index + 1} in "${dataKey}" is missing a valid "done" boolean.`)
      }

      const text = normalizeText(task.text).slice(0, MAX_TASK_LENGTH)
      sanitized.push({
        text,
        done: task.done,
        id: task.id.trim(),
        dueDate: typeof task.dueDate === 'string' ? task.dueDate : null,
        dueTime: typeof task.dueTime === 'string' ? task.dueTime : null,
      })
    }

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

function defaultConfig(): AppConfig {
  return { hideCompleted: false }
}

function parseConfig(config: unknown): AppConfig {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return defaultConfig()
  }

  const source = config as UnknownRecord
  return {
    hideCompleted: typeof source.hideCompleted === 'boolean' ? source.hideCompleted : false,
  }
}

function loadState(): LoadStateResult {
  if (!canUseLocalStorage()) {
    return { tasks: emptyTasks(), config: defaultConfig(), storageAvailable: false }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as UnknownRecord
      const tasks = validateTasksShape(parsed.tasks ?? parsed) ?? emptyTasks()
      const config = parseConfig(parsed.config)
      return { tasks, config, storageAvailable: true }
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as UnknownRecord
      const tasks = validateTasksShape(parsed.tasks ?? parsed) ?? emptyTasks()
      return { tasks, config: defaultConfig(), storageAvailable: true }
    }
  } catch {
    // fall through to defaults
  }
  return { tasks: emptyTasks(), config: defaultConfig(), storageAvailable: true }
}

function App() {
  const [initialState] = useState<LoadStateResult>(loadState)
  const [tasks, setTasks] = useState<QuadrantState>(initialState.tasks)
  const [storageAvailable, setStorageAvailable] = useState<boolean>(initialState.storageAvailable)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [hideCompleted, setHideCompleted] = useState<boolean>(initialState.config.hideCompleted)
  const [sortByDueDate, setSortByDueDate] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const importInputRef = useRef<HTMLInputElement | null>(null)

  function persistState(nextTasks: QuadrantState, nextHideCompleted: boolean = hideCompleted): void {
    if (!storageAvailable) return
    try {
      const compacted = compactTasks(nextTasks)
      if (Object.keys(compacted).length === 0) {
        localStorage.removeItem(STORAGE_KEY)
        return
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ tasks: compacted, config: { hideCompleted: nextHideCompleted } })
      )
    } catch {
      setStorageAvailable(false)
    }
  }

  function updateTasks(nextOrUpdater: QuadrantState | ((prev: QuadrantState) => QuadrantState)): void {
    setTasks((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater
      persistState(next)
      return next
    })
  }

  const normalizedSearch = searchQuery.trim().toLowerCase()

  const visibleTasks = useMemo<QuadrantState>(() => {
    const next = emptyTasks()
    for (const { id } of QUADRANTS) {
      let filtered = tasks[id].filter((task) => {
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

  function handleAddTask(
    quadrantId: string,
    text: string,
    dueDate: string | null = null,
    dueTime: string | null = null
  ): TaskMutationResult {
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
      [quadrantId]: [...prev[quadrantId], createTask(cleanText, dueDate || null, dueTime || null)],
    }))

    return { ok: true }
  }

  function handleToggleTask(quadrantId: string, taskId: string): void {
    updateTasks((prev) => ({
      ...prev,
      [quadrantId]: prev[quadrantId].map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task
      ),
    }))
  }

  function handleDeleteTask(quadrantId: string, taskId: string): void {
    updateTasks((prev) => ({
      ...prev,
      [quadrantId]: prev[quadrantId].filter((task) => task.id !== taskId),
    }))
  }

  function handleEditTask(
    quadrantId: string,
    taskId: string,
    nextText: string,
    dueDate: string | null = null,
    dueTime: string | null = null
  ): TaskMutationResult {
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
      [quadrantId]: prev[quadrantId].map((task) =>
        task.id === taskId
          ? { ...task, text: cleanText, dueDate: dueDate || null, dueTime: dueTime || null }
          : task
      ),
    }))

    return { ok: true }
  }

  function handleMoveTask(
    sourceQuadrantId: string,
    taskId: string,
    targetQuadrantId: string
  ): TaskMutationResult {
    if (sourceQuadrantId === targetQuadrantId) return { ok: true }

    const sourceTask = tasks[sourceQuadrantId].find((task) => task.id === taskId)
    if (!sourceTask) return { ok: false, error: 'Task not found.' }

    if (isDuplicate(tasks, targetQuadrantId, sourceTask.text)) {
      return { ok: false, error: 'A similar task already exists in the target quadrant.' }
    }

    updateTasks((prev) => ({
      ...prev,
      [sourceQuadrantId]: prev[sourceQuadrantId].filter((task) => task.id !== taskId),
      [targetQuadrantId]: [...prev[targetQuadrantId], sourceTask],
    }))

    return { ok: true }
  }

  function handleClearCompleted(): void {
    updateTasks((prev) => {
      const next = emptyTasks()

      for (const id of QUADRANT_IDS) {
        next[id] = prev[id].filter((task) => !task.done)
      }

      return next
    })
    setStatusMessage('Completed tasks cleared.')
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

  async function handleImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as UnknownRecord
      const imported = validateImportedTasksShape(parsed.tasks ?? parsed)

      updateTasks(imported)
      setStatusMessage('Tasks imported successfully.')
    } catch (error) {
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

  const hasCompletedTasks = QUADRANTS.some(({ id }) => tasks[id].some((task) => task.done))

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
              tasks={visibleTasks[q.id]}
              totalCount={tasks[q.id].length}
              visibleCount={visibleTasks[q.id].length}
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

export default App
