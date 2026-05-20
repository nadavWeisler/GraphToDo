import { useEffect, useMemo, useRef, useState } from 'react'
import Quadrant from './components/Quadrant'
import './App.css'
import { QUADRANTS, QUADRANT_IDS, STORAGE_KEY, LEGACY_STORAGE_KEY } from './quadrants'
import type { Task, TasksState, AppConfig, AppState, TaskResult } from './types'

const MAX_TASK_LENGTH = 120
const EXPORT_SCHEMA_VERSION = 1

function emptyTasks(): TasksState {
  return Object.fromEntries(QUADRANT_IDS.map((id) => [id, []]))
}

function compactTasks(tasks: TasksState): TasksState {
  const compacted: TasksState = {}
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

function createTask(text, dueDate = null, dueTime = null) {
  return {
    id: crypto.randomUUID(),
    text,
    done: false,
    dueDate,
    dueTime,
    history: {
      completedAt: null,
      archivedAt: null,
      archiveReason: null,
    },
  }
}

function isValidHistory(history) {
  return (
    history &&
    typeof history === 'object' &&
    !Array.isArray(history) &&
    (history.completedAt === undefined ||
      history.completedAt === null ||
      typeof history.completedAt === 'string') &&
    (history.archivedAt === undefined ||
      history.archivedAt === null ||
      typeof history.archivedAt === 'string') &&
    (history.archiveReason === undefined ||
      history.archiveReason === null ||
      typeof history.archiveReason === 'string')
  )
}

function sanitizeTaskHistory(task) {
  const history = isValidHistory(task.history) ? task.history : {}

  return {
    completedAt:
      typeof history.completedAt === 'string'
        ? history.completedAt
        : typeof task.completedAt === 'string'
          ? task.completedAt
          : null,
    archivedAt:
      typeof history.archivedAt === 'string'
        ? history.archivedAt
        : typeof task.archivedAt === 'string'
          ? task.archivedAt
          : null,
    archiveReason:
      typeof history.archiveReason === 'string'
        ? history.archiveReason
        : typeof task.archiveReason === 'string'
          ? task.archiveReason
          : null,
  }
}

function isArchivedTask(task) {
  return Boolean(task?.history?.archivedAt)
}

function markTaskComplete(task, completedAt = new Date().toISOString()) {
  return {
    ...task,
    done: true,
    history: {
      ...task.history,
      completedAt: task.history.completedAt ?? completedAt,
    },
  }
}

function markTaskIncomplete(task) {
  return {
    ...task,
    done: false,
  }
}

function archiveTask(task, archiveReason, archivedAt = new Date().toISOString()) {
  return {
    ...task,
    history: {
      ...task.history,
      completedAt: task.history.completedAt ?? (task.done ? archivedAt : null),
      archivedAt: task.history.archivedAt ?? archivedAt,
      archiveReason: task.history.archiveReason ?? archiveReason,
    },
  }
}

function isValidTask(task: unknown): task is Task {
  if (!task || typeof task !== 'object' || Array.isArray(task)) return false
  const t = task as Record<string, unknown>
  return (
    task &&
    typeof task.id === 'string' &&
    typeof task.text === 'string' &&
    typeof task.done === 'boolean' &&
    (task.dueDate === undefined || task.dueDate === null || typeof task.dueDate === 'string') &&
    (task.dueTime === undefined || task.dueTime === null || typeof task.dueTime === 'string') &&
    (task.history === undefined || isValidHistory(task.history)) &&
    (task.completedAt === undefined ||
      task.completedAt === null ||
      typeof task.completedAt === 'string') &&
    (task.archivedAt === undefined ||
      task.archivedAt === null ||
      typeof task.archivedAt === 'string') &&
    (task.archiveReason === undefined ||
      task.archiveReason === null ||
      typeof task.archiveReason === 'string')
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
    history: sanitizeTaskHistory(task),
  }
}

function dueDateSortKey(dueDate: string | null): number {
  if (!dueDate) return Infinity
  return new Date(dueDate + 'T00:00:00').getTime()
}

function isDuplicate(tasks: TasksState, quadrantId: string, text: string, excludedTaskId: string | null = null): boolean {
  const normalized = normalizeText(text).toLowerCase()
  return tasks[quadrantId].some(
    (task) =>
      !isArchivedTask(task) &&
      task.id !== excludedTaskId &&
      normalizeText(task.text).toLowerCase() === normalized
  )
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

function validateImportedTasksShape(data: unknown): TasksState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Expected an object with q1, q2, q3, and q4 arrays.')
  }

  const record = data as Record<string, unknown>
  const next = emptyTasks()
  const errors = []

  for (const { id, legacyId } of QUADRANTS) {
    const dataKey = id in record ? id : legacyId in record ? legacyId : null
    if (!dataKey) {
      errors.push(`Missing required quadrant "${id}".`)
      continue
    }

    const quadrantTasks = data[dataKey]
    if (!Array.isArray(quadrantTasks)) {
      errors.push(`Quadrant "${dataKey}" must be an array of tasks.`)
      continue
    }

    const sanitized = []
    for (const [index, task] of quadrantTasks.entries()) {
      const taskErrors = []
      if (!task || typeof task !== 'object' || Array.isArray(task)) {
        errors.push(`Task ${index + 1} in "${dataKey}" must be an object.`)
        continue
      }

      if (typeof task.id !== 'string' || !task.id.trim()) {
        taskErrors.push('missing a valid "id" string')
      }

      if (typeof task.text !== 'string') {
        taskErrors.push('missing a valid "text" string')
      } else if (!normalizeText(task.text)) {
        taskErrors.push('must have non-empty "text"')
      }

      if (typeof task.done !== 'boolean') {
        taskErrors.push('missing a valid "done" boolean')
      }

      if (task.dueDate !== undefined && task.dueDate !== null && typeof task.dueDate !== 'string') {
        taskErrors.push('"dueDate" must be a string when provided')
      }

      if (task.dueTime !== undefined && task.dueTime !== null && typeof task.dueTime !== 'string') {
        taskErrors.push('"dueTime" must be a string when provided')
      }

      if (taskErrors.length > 0) {
        errors.push(`Task ${index + 1} in "${dataKey}" ${taskErrors.join(', ')}.`)
        continue
      }

      const text = normalizeText(t.text as string).slice(0, MAX_TASK_LENGTH)
      sanitized.push({
        text,
        done: task.done,
        id: task.id.trim(),
        dueDate: typeof task.dueDate === 'string' ? task.dueDate : null,
        dueTime: typeof task.dueTime === 'string' ? task.dueTime : null,
        history: sanitizeTaskHistory(task),
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

  if (errors.length > 0) {
    throw new Error(`Invalid JSON structure found. ${errors.join(' ')}`)
  }

  return next
}

function defaultConfig(): AppConfig {
  return { hideCompleted: false }
}

function loadState() {
  const storageAvailable = canUseLocalStorage()

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const tasks = validateTasksShape((parsed.tasks ?? parsed) as unknown) ?? emptyTasks()
      const config: AppConfig = {
        ...defaultConfig(),
        ...(parsed.config && typeof parsed.config === 'object' ? parsed.config as Partial<AppConfig> : {}),
      }
      return { tasks, config, storageAvailable }
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy)
      const tasks = validateTasksShape(parsed.tasks ?? parsed) ?? emptyTasks()
      return { tasks, config: defaultConfig(), storageAvailable }
    }
  } catch {
    // fall through to defaults
  }
  return { tasks: emptyTasks(), config: defaultConfig(), storageAvailable }
}

function App() {
  const [initialState] = useState(loadState)
  const [tasks, setTasks] = useState(initialState.tasks)
  const [storageAvailable] = useState(initialState.storageAvailable)
  const [searchQuery, setSearchQuery] = useState('')
  const [hideCompleted, setHideCompleted] = useState(initialState.config.hideCompleted)
  const [sortByDueDate, setSortByDueDate] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [failedSyncAction, setFailedSyncAction] = useState(null)
  const importInputRef = useRef(null)
  const optimisticTaskVersionRef = useRef(0)
  const optimisticConfigVersionRef = useRef(0)
  const tasksRef = useRef(tasks)
  const hideCompletedRef = useRef(hideCompleted)

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    hideCompletedRef.current = hideCompleted
  }, [hideCompleted])

  function persistState(nextTasks, nextHideCompleted = hideCompletedRef.current) {
    if (!storageAvailable) return { ok: true }
    try {
      const compacted = compactTasks(nextTasks)
      if (Object.keys(compacted).length === 0) {
        localStorage.removeItem(STORAGE_KEY)
        return { ok: true }
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ tasks: compacted, config: { hideCompleted: nextHideCompleted } })
      )
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }

  function applyOptimisticTaskUpdate(nextOrUpdater, operationLabel) {
    const previous = tasksRef.current
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(previous) : nextOrUpdater
    const version = optimisticTaskVersionRef.current + 1
    optimisticTaskVersionRef.current = version
    setTasks(next)
    setFailedSyncAction(null)
    queueMicrotask(() => {
      const persistResult = persistState(next)
      if (persistResult.ok || optimisticTaskVersionRef.current !== version) return

      setTasks(previous)
      setStatusMessage(`Failed to save ${operationLabel}. Reverted. Retry to try again.`)
      setFailedSyncAction({
        operationLabel,
        retry: () => applyOptimisticTaskUpdate(nextOrUpdater, operationLabel),
      })
    })
    return { ok: true }
  }

  function applyOptimisticHideCompleted(nextHideCompleted) {
    const previousHideCompleted = hideCompletedRef.current
    const version = optimisticConfigVersionRef.current + 1
    optimisticConfigVersionRef.current = version
    setHideCompleted(nextHideCompleted)
    setFailedSyncAction(null)
    queueMicrotask(() => {
      const persistResult = persistState(tasksRef.current, nextHideCompleted)
      if (persistResult.ok || optimisticConfigVersionRef.current !== version) return

      setHideCompleted(previousHideCompleted)
      setStatusMessage('Failed to save preferences. Reverted. Retry to try again.')
      setFailedSyncAction({
        operationLabel: 'preferences',
        retry: () => applyOptimisticHideCompleted(nextHideCompleted),
      })
    })
  }

  const normalizedSearch = searchQuery.trim().toLowerCase()

  const activeTasks = useMemo(() => {
    const next = emptyTasks()
    for (const { id } of QUADRANTS) {
      next[id] = tasks[id].filter((task) => !isArchivedTask(task))
    }
    return next
  }, [tasks])

  const visibleTasks = useMemo(() => {
    const next = emptyTasks()
    for (const { id } of QUADRANTS) {
      let filtered = activeTasks[id].filter((task) => {
        if (hideCompleted && task.done) return false
        if (normalizedSearch && !task.text.toLowerCase().includes(normalizedSearch)) return false
        if (parsedTagFilter.length > 0) {
          const taskTags = (task.tags ?? []).map((t) => t.toLowerCase())
          if (!parsedTagFilter.every((ft) => taskTags.includes(ft))) return false
        }
        return true
      })
      if (sortByDueDate) {
        filtered = [...filtered].sort(
          (a, b) => dueDateSortKey(a.dueDate) - dueDateSortKey(b.dueDate)
        )
      }
      next[id] = filtered
    }
    return next
  }, [activeTasks, hideCompleted, normalizedSearch, sortByDueDate])

  function handleAddTask(quadrantId: string, text: string, dueDate: string | null = null, dueTime: string | null = null): TaskResult {
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

    applyOptimisticTaskUpdate((prev) => ({
      ...prev,
      [quadrantId]: [...prev[quadrantId], createTask(cleanText, dueDate || null, dueTime || null)],
    }), 'new task')
    return { ok: true }
  }

  function handleToggleTask(quadrantId, taskId) {
    applyOptimisticTaskUpdate((prev) => ({
      ...prev,
      [quadrantId]: prev[quadrantId].map((t) =>
        t.id === taskId ? (t.done ? markTaskIncomplete(t) : markTaskComplete(t)) : t
      ),
    }), 'task status')
  }

  function handleDeleteTask(quadrantId, taskId) {
    applyOptimisticTaskUpdate((prev) => ({
      ...prev,
      [quadrantId]: prev[quadrantId].filter((t) => t.id !== taskId),
    }), 'delete task')
  }

  function handleEditTask(quadrantId: string, taskId: string, nextText: string, dueDate: string | null = null, dueTime: string | null = null): TaskResult {
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

    applyOptimisticTaskUpdate((prev) => ({
      ...prev,
      [quadrantId]: prev[quadrantId].map((task) =>
        task.id === taskId
          ? { ...task, text: cleanText, dueDate: dueDate || null, dueTime: dueTime || null, tags }
          : task
      ),
    }), 'task edits')
    return { ok: true }
  }

  function handleMoveTask(sourceQuadrantId: string, taskId: string, targetQuadrantId: string): TaskResult {
    if (sourceQuadrantId === targetQuadrantId) return { ok: true }

    const sourceTask = tasks[sourceQuadrantId].find(
      (task) => task.id === taskId && !isArchivedTask(task)
    )
    if (!sourceTask) return { ok: false, error: 'Task not found.' }

    setActiveMoveTask({ sourceQuadrantId, taskId })
    setStatusMessage(
      `Picked up "${sourceTask.text}". Focus a quadrant and press Enter or Space to drop it.`
    )

    return { ok: true }
  }

  function handleCancelTaskMove(message = 'Task move cancelled.') {
    setActiveMoveTask(null)
    setStatusMessage(message)
  }

  function handleMoveTask(sourceQuadrantId, taskId, targetQuadrantId) {
    const sourceQuadrantTasks = tasks[sourceQuadrantId]
    const targetQuadrantTasks = tasks[targetQuadrantId]

    if (!sourceQuadrantTasks || !targetQuadrantTasks) {
      return { ok: false, error: 'Target quadrant not found.' }
    }

    const sourceTask = sourceQuadrantTasks.find((task) => task.id === taskId)
    if (!sourceTask) return { ok: false, error: 'Task not found.' }

    if (sourceQuadrantId === targetQuadrantId) {
      setActiveMoveTask(null)
      setStatusMessage(`Dropped "${sourceTask.text}" back into ${QUADRANTS.find((q) => q.id === targetQuadrantId)?.title ?? 'the current quadrant'}.`)
      return { ok: true }
    }

    if (isDuplicate(tasks, targetQuadrantId, sourceTask.text)) {
      return { ok: false, error: 'A similar task already exists in the target quadrant.' }
    }

    applyOptimisticTaskUpdate((prev) => ({
      ...prev,
      [sourceQuadrantId]: prev[sourceQuadrantId].filter((task) => task.id !== taskId),
      [targetQuadrantId]: [...prev[targetQuadrantId], sourceTask],
    }), 'task move')
    return { ok: true }
  }

  function handleClearCompleted() {
    applyOptimisticTaskUpdate((prev) => {
      const next = emptyTasks()

      for (const id of QUADRANT_IDS) {
        next[id] = prev[id].map((task) =>
          task.done ? archiveTask(task, 'cleared-completed') : task
        )
      }

      return next
    }, 'clearing completed tasks')
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

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Record<string, unknown>
      const imported = validateImportedTasksShape((parsed.tasks ?? parsed) as unknown)

      applyOptimisticTaskUpdate(imported, 'imported tasks')
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

  const hasCompletedTasks = QUADRANTS.some(({ id }) =>
    activeTasks[id].some((task) => task.done)
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

        <label className="toolbar-field" htmlFor="tag-filter">
          <span>Filter by tags</span>
          <input
            id="tag-filter"
            type="search"
            value={tagFilterInput}
            onChange={(event) => setTagFilterInput(event.target.value)}
            placeholder="tag1, tag2…"
          />
        </label>

        <label className="toolbar-checkbox" htmlFor="hide-completed">
          <input
            id="hide-completed"
            type="checkbox"
            checked={hideCompleted}
            onChange={(event) => {
              applyOptimisticHideCompleted(event.target.checked)
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

      {failedSyncAction && (
        <div className="sync-error" role="alert">
          <span>Could not sync {failedSyncAction.operationLabel}.</span>
          <button
            type="button"
            onClick={() => failedSyncAction.retry()}
          >
            Retry {failedSyncAction.operationLabel}
          </button>
        </div>
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
              tasks={visibleTasks[q.id]}
              totalCount={activeTasks[q.id].length}
              visibleCount={visibleTasks[q.id].length}
              quadrants={QUADRANTS}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onEditTask={handleEditTask}
              onMoveTask={handleMoveTask}
              activeMoveTask={activeMoveTask}
              onStartTaskMove={handleStartTaskMove}
              onCancelTaskMove={handleCancelTaskMove}
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
