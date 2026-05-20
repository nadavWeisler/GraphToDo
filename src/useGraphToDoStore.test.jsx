import { act, renderHook } from '@testing-library/react'
import { QUADRANTS, STORAGE_KEY } from './quadrants'
import { useGraphToDoStore } from './useGraphToDoStore'

test('loads tasks and hideCompleted from persisted state', () => {
  const firstQuadrantId = QUADRANTS[0].id
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tasks: {
        [firstQuadrantId]: [{ id: 't1', text: 'Stored task', done: true }],
        ...Object.fromEntries(QUADRANTS.slice(1).map((quadrant) => [quadrant.id, []])),
      },
      config: { hideCompleted: true },
    })
  )

  const { result } = renderHook(() => useGraphToDoStore())

  expect(result.current.tasks[firstQuadrantId]).toHaveLength(1)
  expect(result.current.hideCompleted).toBe(true)
  expect(result.current.visibleTasks[firstQuadrantId]).toHaveLength(0)
})

test('setHideCompletedFilter persists updated config', () => {
  const firstQuadrantId = QUADRANTS[0].id
  const { result } = renderHook(() => useGraphToDoStore())

  act(() => {
    result.current.addTask(firstQuadrantId, 'Persist me')
  })

  act(() => {
    result.current.setHideCompletedFilter(true)
  })

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
  expect(saved.config.hideCompleted).toBe(true)
  expect(saved.tasks[firstQuadrantId].some((task) => task.text === 'Persist me')).toBe(true)
})
