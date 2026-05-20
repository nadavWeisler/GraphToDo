import { useMemo, useState, useEffect } from 'react'
import { QUADRANTS, STORAGE_KEY } from './quadrants'

function emptyTasks() {
  return Object.fromEntries(QUADRANTS.map((quadrant) => [quadrant.id, []]))
}

function normalizeText(value) {
  return value.trim().replace(/\s+/g, ' ')
}

function loadInitialState() {
  const fallback = { tasks: emptyTasks(), hideCompleted: false }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    const tasks = { ...emptyTasks(), ...(parsed.tasks ?? {}) }
    const hideCompleted = Boolean(parsed.config?.hideCompleted)
    return { tasks, hideCompleted }
  } catch {
    return fallback
  }
}

export function useGraphToDoStore() {
  const [initial] = useState(loadInitialState)
  const [tasks, setTasks] = useState(initial.tasks)
  const [hideCompleted, setHideCompleted] = useState(initial.hideCompleted)

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tasks,
        config: { hideCompleted },
      })
    )
  }, [tasks, hideCompleted])

  const visibleTasks = useMemo(() => {
    const next = emptyTasks()
    for (const quadrant of QUADRANTS) {
      const list = tasks[quadrant.id] ?? []
      next[quadrant.id] = hideCompleted ? list.filter((task) => !task.done) : list
    }
    return next
  }, [tasks, hideCompleted])

  function addTask(quadrantId, text) {
    const cleanText = normalizeText(text)
    if (!cleanText) return { ok: false, error: 'Task cannot be empty.' }

    setTasks((prev) => ({
      ...prev,
      [quadrantId]: [
        ...(prev[quadrantId] ?? []),
        {
          id: crypto.randomUUID(),
          text: cleanText,
          done: false,
        },
      ],
    }))
    return { ok: true }
  }

  function setHideCompletedFilter(nextValue) {
    setHideCompleted(Boolean(nextValue))
  }

  return {
    tasks,
    hideCompleted,
    visibleTasks,
    addTask,
    setHideCompletedFilter,
  }
}
