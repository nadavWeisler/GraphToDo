import { useMemo, useState } from 'react'
import { QUADRANTS, QUADRANT_IDS, STORAGE_KEY, LEGACY_STORAGE_KEY } from './quadrants'

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

function emptyTasks() {
  return Object.fromEntries(QUADRANT_IDS.map((id) => [id, []]))
}

function compactTasks(tasks) {
  const compacted = {}
  for (const { id } of QUADRANTS) {
    const quadrantTasks = tasks[id]
    if (Array.isArray(quadrantTasks) && quadrantTasks.length) {
      compacted[id] = quadrantTasks
    }
  }
  return compacted
}

function normalizeText(value) {
  return value.trim().replace(/\s+/g, ' ')
}

function createTask(text, dueDate = null, dueTime = null) {
  return { id: crypto.randomUUID(), text, done: false, dueDate, dueTime }
}

function isValidTask(task) {
  return (
    task &&
    typeof task.id === 'string' &&
    typeof task.text === 'string' &&
    typeof task.done === 'boolean' &&
    (task.dueDate === undefined || task.dueDate === null || typeof task.dueDate === 'string') &&
    (task.dueTime === undefined || task.dueTime === null || typeof task.dueTime === 'string')
  )
}

function sanitizeTask(task) {
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

function dueDateSortKey(dueDate) {
  if (!dueDate) return Infinity
  return new Date(dueDate + 'T00:00:00').getTime()
}

function isDuplicate(tasks, quadrantId, text, excludedTaskId = null) {
  const normalized = normalizeText(text).toLowerCase()
  return tasks[quadrantId].some(
    (task) => task.id !== excludedTaskId && normalizeText(task.text).toLowerCase() === normalized
  )
}

function validateTasksShape(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const next = emptyTasks()

  for (const { id, legacyId } of QUADRANTS) {
    let quadrantTasks = null

    if (Array.isArray(data[id])) {
      quadrantTasks = data[id]
    } else if (Array.isArray(data[legacyId])) {
      quadrantTasks = data[legacyId]
    }

    if (quadrantTasks === null) {
      if (id in data && !Array.isArray(data[id])) return null
      if (legacyId in data && !Array.isArray(data[legacyId])) return null
      continue
    }

    const sanitized = quadrantTasks
      .filter(isValidTask)
      .map(sanitizeTask)
      .filter(Boolean)

    const deduped = []
    const seen = new Set()
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

function canUseLocalStorage() {
  try {
    const probeKey = `${STORAGE_KEY}.probe`
    localStorage.setItem(probeKey, '1')
    localStorage.removeItem(probeKey)
    return true
  } catch {
    return false
  }
}

export function validateImportedTasksShape(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Expected an object with q1, q2, q3, and q4 arrays.')
  }

  const next = emptyTasks()

  for (const { id, legacyId } of QUADRANTS) {
    const dataKey = id in data ? id : legacyId in data ? legacyId : null
    if (!dataKey) {
      throw new Error(`Missing required quadrant "${id}".`)
    }

    if (!Array.isArray(data[dataKey])) {
      throw new Error(`Quadrant "${dataKey}" must be an array of tasks.`)
    }

    const sanitized = []
    for (const [index, task] of data[dataKey].entries()) {
      if (!task || typeof task !== 'object' || Array.isArray(task)) {
        throw new Error(`Task ${index + 1} in "${dataKey}" must be an object.`)
      }

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

    const deduped = []
    const seen = new Set()
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

function defaultConfig() {
  return { hideCompleted: false }
}

function loadState() {
  if (!canUseLocalStorage()) {
    return { tasks: emptyTasks(), config: defaultConfig(), storageAvailable: false }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const tasks = validateTasksShape(parsed.tasks ?? parsed) ?? emptyTasks()
      const config = {
        ...defaultConfig(),
        ...(parsed.config && typeof parsed.config === 'object' ? parsed.config : {}),
      }
      return { tasks, config, storageAvailable: true }
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy)
      const tasks = validateTasksShape(parsed.tasks ?? parsed) ?? emptyTasks()
      return { tasks, config: defaultConfig(), storageAvailable: true }
    }
  } catch {
    // fall through to defaults
  }
  return { tasks: emptyTasks(), config: defaultConfig(), storageAvailable: true }
}

export function useGraphToDoStore() {
  const [initialState] = useState(loadState)
  const [tasks, setTasks] = useState(initialState.tasks)
  const [storageAvailable, setStorageAvailable] = useState(initialState.storageAvailable)
  const [searchQuery, setSearchQuery] = useState('')
  const [hideCompleted, setHideCompleted] = useState(initialState.config.hideCompleted)
  const [sortByDueDate, setSortByDueDate] = useState(false)

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
        JSON.stringify({ tasks: compacted, config: { hideCompleted: nextHideCompleted } })
      )
    } catch {
      setStorageAvailable(false)
    }
  }

  function updateTasks(nextOrUpdater) {
    setTasks((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater
      persistState(next)
      return next
    })
  }

  const normalizedSearch = searchQuery.trim().toLowerCase()

  const visibleTasks = useMemo(() => {
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

  function addTask(quadrantId, text, dueDate = null, dueTime = null) {
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

  function toggleTask(quadrantId, taskId) {
    updateTasks((prev) => ({
      ...prev,
      [quadrantId]: prev[quadrantId].map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
    }))
  }

  function deleteTask(quadrantId, taskId) {
    updateTasks((prev) => ({
      ...prev,
      [quadrantId]: prev[quadrantId].filter((t) => t.id !== taskId),
    }))
  }

  function editTask(quadrantId, taskId, nextText, dueDate = null, dueTime = null) {
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

  function moveTask(sourceQuadrantId, taskId, targetQuadrantId) {
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

  function clearCompleted() {
    updateTasks((prev) => {
      const next = emptyTasks()

      for (const id of QUADRANT_IDS) {
        next[id] = prev[id].filter((task) => !task.done)
      }

      return next
    })
  }

  function importTasks(nextTasks) {
    updateTasks(nextTasks)
  }

  function setHideCompletedFilter(nextHideCompleted) {
    setHideCompleted(nextHideCompleted)
    persistState(tasks, nextHideCompleted)
  }

  const hasCompletedTasks = QUADRANTS.some(({ id }) =>
    tasks[id].some((task) => task.done)
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
      {dueTodayCount > 0 && (
        <p className="due-reminder" role="status" aria-live="polite">
          Reminder: {dueTodayCount} task{dueTodayCount === 1 ? '' : 's'} due today.
        </p>
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
