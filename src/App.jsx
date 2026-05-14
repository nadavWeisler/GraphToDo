import { useEffect, useMemo, useRef, useState } from 'react'
import Quadrant from './components/Quadrant'
import './App.css'

const QUADRANTS = [
  {
    id: 'q1',
    colorClass: 'q1',
    title: 'Do First',
    subtitle: 'Urgent & Important',
  },
  {
    id: 'q2',
    colorClass: 'q2',
    title: 'Schedule',
    subtitle: 'Not Urgent & Important',
  },
  {
    id: 'q3',
    colorClass: 'q3',
    title: 'Delegate',
    subtitle: 'Urgent & Not Important',
  },
  {
    id: 'q4',
    colorClass: 'q4',
    title: 'Eliminate',
    subtitle: 'Not Urgent & Not Important',
  },
]

const STORAGE_KEY = 'graphtodo.tasks.v1'
const MAX_TASK_LENGTH = 120

function emptyTasks() {
  return {
    q1: [],
    q2: [],
    q3: [],
    q4: [],
  }
}

function normalizeText(value) {
  return value.trim().replace(/\s+/g, ' ')
}

function createTask(text) {
  return { id: crypto.randomUUID(), text, done: false }
}

function isValidTask(task) {
  return (
    task &&
    typeof task.id === 'string' &&
    typeof task.text === 'string' &&
    typeof task.done === 'boolean'
  )
}

function sanitizeTask(task) {
  const text = normalizeText(task.text).slice(0, MAX_TASK_LENGTH)
  if (!text) return null
  return {
    id: task.id,
    text,
    done: task.done,
  }
}

function isDuplicate(tasks, quadrantId, text, excludedTaskId = null) {
  const normalized = normalizeText(text).toLowerCase()
  return tasks[quadrantId].some(
    (task) => task.id !== excludedTaskId && normalizeText(task.text).toLowerCase() === normalized
  )
}

function validateTasksShape(data) {
  if (!data || typeof data !== 'object') return null
  const next = emptyTasks()

  for (const { id } of QUADRANTS) {
    if (!Array.isArray(data[id])) return null

    const sanitized = data[id]
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

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyTasks()
    const parsed = JSON.parse(raw)
    return validateTasksShape(parsed.tasks ?? parsed) ?? emptyTasks()
  } catch {
    return emptyTasks()
  }
}

function App() {
  const [tasks, setTasks] = useState(loadTasks)
  const [searchQuery, setSearchQuery] = useState('')
  const [hideCompleted, setHideCompleted] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const importInputRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks }))
  }, [tasks])

  const normalizedSearch = searchQuery.trim().toLowerCase()

  const visibleTasks = useMemo(() => {
    const next = emptyTasks()
    for (const { id } of QUADRANTS) {
      next[id] = tasks[id].filter((task) => {
        if (hideCompleted && task.done) return false
        if (!normalizedSearch) return true
        return task.text.toLowerCase().includes(normalizedSearch)
      })
    }
    return next
  }, [hideCompleted, normalizedSearch, tasks])

  function handleAddTask(quadrantId, text) {
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

    setTasks((prev) => ({
      ...prev,
      [quadrantId]: [...prev[quadrantId], createTask(cleanText)],
    }))

    return { ok: true }
  }

  function handleToggleTask(quadrantId, taskId) {
    setTasks((prev) => ({
      ...prev,
      [quadrantId]: prev[quadrantId].map((t) =>
        t.id === taskId ? { ...t, done: !t.done } : t
      ),
    }))
  }

  function handleDeleteTask(quadrantId, taskId) {
    setTasks((prev) => ({
      ...prev,
      [quadrantId]: prev[quadrantId].filter((t) => t.id !== taskId),
    }))
  }

  function handleEditTask(quadrantId, taskId, nextText) {
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

    setTasks((prev) => ({
      ...prev,
      [quadrantId]: prev[quadrantId].map((task) =>
        task.id === taskId ? { ...task, text: cleanText } : task
      ),
    }))

    return { ok: true }
  }

  function handleMoveTask(sourceQuadrantId, taskId, targetQuadrantId) {
    if (sourceQuadrantId === targetQuadrantId) return { ok: true }

    const sourceTask = tasks[sourceQuadrantId].find((task) => task.id === taskId)
    if (!sourceTask) return { ok: false, error: 'Task not found.' }

    if (isDuplicate(tasks, targetQuadrantId, sourceTask.text)) {
      return { ok: false, error: 'A similar task already exists in the target quadrant.' }
    }

    setTasks((prev) => {
      const movingTask = prev[sourceQuadrantId].find((task) => task.id === taskId)
      if (!movingTask) return prev

      return {
        ...prev,
        [sourceQuadrantId]: prev[sourceQuadrantId].filter((task) => task.id !== taskId),
        [targetQuadrantId]: [...prev[targetQuadrantId], movingTask],
      }
    })

    return { ok: true }
  }

  function handleClearCompleted() {
    setTasks((prev) => ({
      q1: prev.q1.filter((task) => !task.done),
      q2: prev.q2.filter((task) => !task.done),
      q3: prev.q3.filter((task) => !task.done),
      q4: prev.q4.filter((task) => !task.done),
    }))
    setStatusMessage('Completed tasks cleared.')
  }

  function handleExport() {
    const payload = {
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

  async function handleImport(event) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const imported = validateTasksShape(parsed.tasks ?? parsed)

      if (!imported) {
        setStatusMessage('Import failed: invalid GraphToDo JSON format.')
        return
      }

      setTasks(imported)
      setStatusMessage('Tasks imported successfully.')
    } catch {
      setStatusMessage('Import failed: unable to parse JSON.')
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = ''
      }
    }
  }

  const hasCompletedTasks = QUADRANTS.some(({ id }) =>
    tasks[id].some((task) => task.done)
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
            onChange={(event) => setHideCompleted(event.target.checked)}
          />
          <span>Hide completed</span>
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
