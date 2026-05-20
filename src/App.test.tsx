import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import App from './App'
import { QUADRANTS, STORAGE_KEY, LEGACY_STORAGE_KEY } from './quadrants'

function getQuadrantByLabel(label: string): HTMLElement {
  return screen.getByRole('region', { name: `${label} quadrant` })
}

test('adds and deletes a task without completion history', async () => {
  const firstQuadrant = QUADRANTS[0]
  const user = userEvent.setup()
  render(<App />)

  const firstRegion = getQuadrantByLabel(firstQuadrant.title)
  const addInput = within(firstRegion).getByRole('textbox', {
    name: `Add task to ${firstQuadrant.title}`,
  })
  await user.type(addInput, 'Pay rent{enter}')

  expect(within(firstRegion).getByText('Pay rent')).toBeTruthy()

  const toggleBtn = within(firstRegion).getByRole('button', { name: 'Mark complete' })
  expect(toggleBtn.getAttribute('aria-describedby')).toBe('task-action-status')
  await user.click(toggleBtn)
  expect(within(firstRegion).getByRole('button', { name: 'Mark incomplete' })).toBeTruthy()
  expect(screen.getByText('Task "Pay rent" marked as completed.')).toBeTruthy()

  const deleteBtn = within(firstRegion).getByRole('button', { name: 'Delete task' })
  expect(deleteBtn.getAttribute('aria-describedby')).toBe('task-action-status')
  await user.click(deleteBtn)
  expect(within(firstRegion).queryByText('Pay rent')).toBeNull()
  expect(screen.getByText('Task "Pay rent" deleted.')).toBeTruthy()
})

test('reopens a completed task from the task itself and updates completed controls', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  const clearCompletedButton = screen.getByRole('button', { name: 'Clear completed' }) as HTMLButtonElement

  await user.type(within(q1).getByRole('textbox', { name: 'Add task to Do First' }), 'Pay rent{enter}')
  expect(clearCompletedButton.disabled).toBe(true)

  await user.click(within(q1).getByRole('button', { name: 'Mark complete' }))
  expect(clearCompletedButton.disabled).toBe(false)
  const completedTask = JSON.parse(localStorage.getItem(STORAGE_KEY)).tasks[QUADRANTS[0].id][0]

  await user.click(within(q1).getByRole('button', { name: 'Reopen task: Pay rent' }))

  expect(within(q1).getByRole('button', { name: 'Mark complete' })).toBeTruthy()
  expect(within(q1).queryByRole('button', { name: 'Mark incomplete' })).toBeNull()
  expect(clearCompletedButton.disabled).toBe(true)

  const reopenedTask = JSON.parse(localStorage.getItem(STORAGE_KEY)).tasks[QUADRANTS[0].id][0]
  expect(reopenedTask.done).toBe(false)
  expect(reopenedTask.history.completedAt).toBe(completedTask.history.completedAt)
  expect(reopenedTask.history.archivedAt).toBeNull()
})

test('archives deleted tasks that were previously completed', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  await user.type(within(q1).getByRole('textbox', { name: 'Add task to Do First' }), 'Archive me{enter}')
  await user.click(within(q1).getByRole('button', { name: 'Mark complete' }))

  const completedTask = JSON.parse(localStorage.getItem(STORAGE_KEY)).tasks[QUADRANTS[0].id][0]
  await user.click(within(q1).getByRole('button', { name: 'Delete task' }))

  expect(within(q1).queryByText('Archive me')).toBeNull()

  await waitFor(() => {
    const archivedTask = JSON.parse(localStorage.getItem(STORAGE_KEY)).tasks[QUADRANTS[0].id][0]
    expect(archivedTask.history.completedAt).toBe(completedTask.history.completedAt)
    expect(typeof archivedTask.history.archivedAt).toBe('string')
    expect(archivedTask.history.archiveReason).toBe('deleted')
  })
})

test('moves a task between quadrants', async () => {
  const [firstQuadrant, secondQuadrant] = QUADRANTS
  const user = userEvent.setup()
  render(<App />)

  const firstRegion = getQuadrantByLabel(firstQuadrant.title)
  await user.type(
    within(firstRegion).getByRole('textbox', { name: `Add task to ${firstQuadrant.title}` }),
    'Send update{enter}'
  )

  const moveSelect = within(firstRegion).getByRole('combobox', { name: 'Move task' })
  await user.selectOptions(moveSelect, secondQuadrant.id)

  expect(within(firstRegion).queryByText('Send update')).toBeNull()
  const secondRegion = getQuadrantByLabel(secondQuadrant.title)
  expect(within(secondRegion).getByText('Send update')).toBeTruthy()
})

test('moves a task with keyboard controls and updates move metadata atomically', async () => {
  const [firstQuadrant, secondQuadrant] = QUADRANTS
  const user = userEvent.setup()
  const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tasks: {
        [firstQuadrant.id]: [
          {
            id: 'task-with-metadata',
            text: 'Ship release',
            done: false,
            dueDate: null,
            dueTime: null,
            lastModified: 123,
            quadrantId: firstQuadrant.id,
          },
        ],
        [secondQuadrant.id]: [],
        ...Object.fromEntries(QUADRANTS.slice(2).map((quadrant) => [quadrant.id, []])),
      },
    })
  )

  try {
    render(<App />)

    const firstRegion = getQuadrantByLabel(firstQuadrant.title)
    const moveSelect = within(firstRegion).getByRole('combobox', { name: 'Move task' })
    moveSelect.focus()
    await user.keyboard('{ArrowDown}')
    await user.selectOptions(moveSelect, secondQuadrant.id)

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(saved.tasks[firstQuadrant.id]).toBeUndefined()
      expect(saved.tasks[secondQuadrant.id]).toHaveLength(1)
      expect(saved.tasks[secondQuadrant.id][0]).toMatchObject({
        id: 'task-with-metadata',
        text: 'Ship release',
        lastModified: 1_700_000_000_000,
        quadrantId: secondQuadrant.id,
      })
    })
  } finally {
    nowSpy.mockRestore()
  }
})

test('moves a task between quadrants with drag and drop', async () => {
  const [firstQuadrant, , thirdQuadrant] = QUADRANTS
  const user = userEvent.setup()
  render(<App />)

  const firstRegion = getQuadrantByLabel(firstQuadrant.title)
  await user.type(
    within(firstRegion).getByRole('textbox', { name: `Add task to ${firstQuadrant.title}` }),
    'Plan sprint{enter}'
  )
  await user.click(within(firstRegion).getByRole('button', { name: 'Mark complete' }))

  const savedBeforeMove = JSON.parse(localStorage.getItem(STORAGE_KEY))
  const createdTask = savedBeforeMove.tasks[firstQuadrant.id][0]

  const task = within(firstRegion).getByText('Plan sprint').closest('li') as HTMLElement
  const thirdRegion = getQuadrantByLabel(thirdQuadrant.title)
  const dragData = new Map<string, string>()
  const dataTransfer = {
    dropEffect: 'none' as DataTransfer['dropEffect'],
    effectAllowed: 'all' as DataTransfer['effectAllowed'],
    types: [] as string[],
    setData(type: string, value: string) {
      dragData.set(type, value)
      this.types = [...dragData.keys()]
    },
    getData(type: string) {
      return dragData.get(type) ?? ''
    },
  }

  fireEvent.dragStart(task, { dataTransfer })
  fireEvent.dragOver(thirdRegion, { dataTransfer })
  fireEvent.drop(thirdRegion, { dataTransfer })

  expect(within(firstRegion).queryByText('Plan sprint')).toBeNull()
  expect(within(thirdRegion).getByText('Plan sprint')).toBeTruthy()

  await waitFor(() => {
    const savedAfterMove = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(
      (savedAfterMove.tasks[firstQuadrant.id] ?? []).some((task) => task.id === createdTask.id)
    ).toBe(false)
    expect(savedAfterMove.tasks[thirdQuadrant.id]).toContainEqual(createdTask)
  })
})

test('moves a task between quadrants with keyboard drag-and-drop controls', async () => {
  const [firstQuadrant, , thirdQuadrant] = QUADRANTS
  const user = userEvent.setup()
  render(<App />)

  const firstRegion = getQuadrantByLabel(firstQuadrant.title)
  await user.type(
    within(firstRegion).getByRole('textbox', { name: `Add task to ${firstQuadrant.title}` }),
    'Prepare retrospective{enter}'
  )

  const task = within(firstRegion).getByText('Prepare retrospective').closest('li')
  task.focus()
  fireEvent.keyDown(task, { key: ' ', code: 'Space' })

  expect(
    screen.getByText(
      'Picked up "Prepare retrospective". Focus a quadrant and press Enter or Space to drop it.'
    )
  ).toBeTruthy()

  const thirdRegion = getQuadrantByLabel(thirdQuadrant.title)
  thirdRegion.focus()
  fireEvent.keyDown(thirdRegion, { key: 'Enter', code: 'Enter' })

  expect(within(firstRegion).queryByText('Prepare retrospective')).toBeNull()
  expect(within(thirdRegion).getByText('Prepare retrospective')).toBeTruthy()
})

test('loads tasks from legacy storage keys and persists current quadrant ids', async () => {
  const [firstQuadrant, secondQuadrant] = QUADRANTS
  const user = userEvent.setup()
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tasks: {
        q1: [],
        q2: [{ id: 'existing', text: 'Review roadmap', done: false }],
        q3: [],
        q4: [],
      },
    })
  )

  render(<App />)
  const secondRegion = getQuadrantByLabel(secondQuadrant.title)
  expect(within(secondRegion).getByText('Review roadmap')).toBeTruthy()

  const firstRegion = getQuadrantByLabel(firstQuadrant.title)
  await user.type(
    within(firstRegion).getByRole('textbox', { name: `Add task to ${firstQuadrant.title}` }),
    'Write tests{enter}'
  )

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) as string) as { tasks: Record<string, Array<{ text: string }>> }
  expect(saved.tasks[firstQuadrant.id].some((task) => task.text === 'Write tests')).toBe(true)
  expect(saved.tasks[secondQuadrant.id].some((task) => task.text === 'Review roadmap')).toBe(true)
  expect(saved.tasks.q1).toBeUndefined()
  expect(saved.tasks.q2).toBeUndefined()
})

test('removes emptied quadrants from persisted storage', async () => {
  const [firstQuadrant, secondQuadrant] = QUADRANTS
  const user = userEvent.setup()
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tasks: {
        [firstQuadrant.legacyId]: [{ id: 'task-1', text: 'Only item', done: false }],
        [secondQuadrant.legacyId]: [{ id: 'task-2', text: 'Keep me', done: false }],
      },
    })
  )

  render(<App />)
  const q1 = getQuadrantByLabel('Do First')
  await user.click(within(q1).getByRole('button', { name: 'Delete task' }))

  await waitFor(() => {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) as string) as { tasks: Record<string, unknown> }
    expect(saved.tasks[firstQuadrant.legacyId]).toBeUndefined()
    expect(saved.tasks[secondQuadrant.legacyId]).toBeUndefined()
    expect(saved.tasks[secondQuadrant.id]).toEqual([{
      id: 'task-2',
      text: 'Keep me',
      done: false,
      dueDate: null,
      dueTime: null,
      history: { completedAt: null, archivedAt: null, archiveReason: null },
    }])
  })
})

test('archives completed tasks when clearing them from the active view', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  await user.type(within(q1).getByRole('textbox', { name: 'Add task to Do First' }), 'Finish report{enter}')
  await user.click(within(q1).getByRole('button', { name: 'Mark complete' }))
  const completedTask = JSON.parse(localStorage.getItem(STORAGE_KEY)).tasks[QUADRANTS[0].id][0]
  await user.click(screen.getByRole('button', { name: 'Clear completed' }))

  await waitFor(() => {
    expect(within(q1).queryByText('Finish report')).toBeNull()
    const archivedTask = JSON.parse(localStorage.getItem(STORAGE_KEY)).tasks[QUADRANTS[0].id][0]
    expect(archivedTask.history.completedAt).toBe(completedTask.history.completedAt)
    expect(typeof archivedTask.history.archivedAt).toBe('string')
    expect(archivedTask.history.archiveReason).toBe('cleared-completed')
  })
})

test('optimistically updates task deletion, rolls back on save failure, and retries', async () => {
  const user = userEvent.setup()
  const firstQuadrant = QUADRANTS[0]
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tasks: {
        [firstQuadrant.id]: [
          { id: 'task-a', text: 'Rollback me', done: false },
          { id: 'task-b', text: 'Keep me', done: false },
        ],
        ...Object.fromEntries(QUADRANTS.slice(1).map((quadrant) => [quadrant.id, []])),
      },
    })
  )

  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  expect(within(q1).getByText('Rollback me')).toBeTruthy()

  const originalSetItem = Storage.prototype.setItem
  let shouldFail = true
  const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (...args) {
    if (shouldFail) {
      shouldFail = false
      throw new Error('storage write failed')
    }
    return originalSetItem.call(this, ...args)
  })

  try {
    await user.click(within(q1).getAllByRole('button', { name: 'Delete task' })[0])

    await waitFor(() => {
      expect(within(q1).getByText('Rollback me')).toBeTruthy()
      expect(screen.getByText('Could not sync delete task.')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Retry delete task' })).toBeTruthy()
    })

    await user.click(screen.getByRole('button', { name: 'Retry delete task' }))

    await waitFor(() => {
      expect(within(q1).queryByText('Rollback me')).toBeNull()
    })
  } finally {
    setItemSpy.mockRestore()
  }
})

test('persists config flags alongside tasks in state.v2 format', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  await user.type(within(q1).getByRole('textbox', { name: 'Add task to Do First' }), 'Config test{enter}')

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) as string) as { tasks: unknown; config: unknown }
  expect(saved).toHaveProperty('tasks')
  expect(saved).toHaveProperty('config')
  expect(typeof saved.config).toBe('object')
})

test('loads hideCompleted config from storage', async () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tasks: {
        q1: [
          { id: 't1', text: 'Active task', done: false },
          { id: 't3', text: 'Done in q1', done: true },
        ],
        q2: [{ id: 't2', text: 'Done task', done: true }],
        q3: [],
        q4: [],
      },
      config: { hideCompleted: true },
    })
  )

  render(<App />)

  expect(within(getQuadrantByLabel('Do First')).getByText('Active task')).toBeTruthy()
  expect(within(getQuadrantByLabel('Do First')).queryByText('Done in q1')).toBeNull()
  expect(within(getQuadrantByLabel('Schedule')).queryByText('Done task')).toBeNull()
})

test('shows validation error for duplicate tasks in same quadrant', async () => {
  const firstQuadrant = QUADRANTS[0]
  const user = userEvent.setup()
  render(<App />)

  const firstRegion = getQuadrantByLabel(firstQuadrant.title)
  const addInput = within(firstRegion).getByRole('textbox', {
    name: `Add task to ${firstQuadrant.title}`,
  })

  await user.type(addInput, 'Prepare slides{enter}')
  await user.type(addInput, ' prepare   slides {enter}')

  expect(within(firstRegion).getByText('A similar task already exists in this quadrant.')).toBeTruthy()
})

test('keeps focus on the add input after creating a task', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  const addInput = within(q1).getByRole('textbox', { name: 'Add task to Do First' })

  addInput.focus()
  await user.type(addInput, 'Plan sprint{enter}')
  expect(document.activeElement).toBe(addInput)
})

test('moves focus into and out of the edit form logically', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  await user.type(within(q1).getByRole('textbox', { name: 'Add task to Do First' }), 'Draft summary{enter}')

  const editButton = within(q1).getByRole('button', { name: 'Edit task' })
  await user.click(editButton)

  const dialog = screen.getByRole('dialog', { name: 'Edit task' })
  const editInput = within(dialog).getByRole('textbox', { name: 'Edit task text' })
  expect(document.activeElement).toBe(editInput)

  await user.clear(editInput)
  await user.type(editInput, 'Draft summary updated{enter}')

  expect(document.activeElement).toBe(within(q1).getByRole('button', { name: 'Edit task' }))
  expect(screen.queryByRole('dialog', { name: 'Edit task' })).toBe(null)
})

test('returns focus to the edit button when editing is cancelled', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  await user.type(within(q1).getByRole('textbox', { name: 'Add task to Do First' }), 'Review notes{enter}')

  await user.click(within(q1).getByRole('button', { name: 'Edit task' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit task' })
  const editInput = within(dialog).getByRole('textbox', { name: 'Edit task text' })

  await user.type(editInput, '{Escape}')

  expect(document.activeElement).toBe(within(q1).getByRole('button', { name: 'Edit task' }))
  expect(screen.queryByRole('dialog', { name: 'Edit task' })).toBe(null)
})

test('imports valid JSON tasks and shows success message', async () => {
  const user = userEvent.setup()
  const [firstQuadrant] = QUADRANTS
  const { container } = render(<App />)

  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File(
    [
      JSON.stringify({
        tasks: {
          [firstQuadrant.id]: [{ id: 'a', text: 'Plan sprint', done: false }],
          ...Object.fromEntries(QUADRANTS.slice(1).map((quadrant) => [quadrant.id, []])),
        },
      }),
    ],
    'tasks.json',
    { type: 'application/json' }
  )

  await user.upload(fileInput, file)

  const q1 = getQuadrantByLabel('Do First')
  expect(within(q1).getByText('Plan sprint')).toBeTruthy()
  expect(screen.getByText('Tasks imported successfully.')).toBeTruthy()
})

test('shows actionable error when imported JSON schema is invalid', async () => {
  const user = userEvent.setup()
  const [firstQuadrant] = QUADRANTS
  const { container } = render(<App />)

  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File(
    [
      JSON.stringify({
        tasks: {
          [firstQuadrant.id]: [{ id: 'a', done: false }],
          ...Object.fromEntries(QUADRANTS.slice(1).map((quadrant) => [quadrant.id, []])),
        },
      }),
    ],
    'invalid-tasks.json',
    { type: 'application/json' }
  )

  await user.upload(fileInput, file)

  expect(
    screen.getByText(
      `Import failed: Invalid JSON structure found. Task 1 in "${firstQuadrant.id}" missing a valid "text" string.`
    )
  ).toBeTruthy()
})

test('aggregates all schema validation errors during import', async () => {
  const user = userEvent.setup()
  const [firstQuadrant, secondQuadrant] = QUADRANTS
  const { container } = render(<App />)

  const fileInput = container.querySelector('input[type="file"]')
  const file = new File(
    [
      JSON.stringify({
        tasks: {
          [firstQuadrant.id]: [{ id: 'a', text: 'Plan sprint', done: 'nope' }],
          [secondQuadrant.id]: [{ text: 'Schedule retro', done: false }],
        },
      }),
    ],
    'invalid-tasks.json',
    { type: 'application/json' }
  )

  await user.upload(fileInput, file)

  const status = container.querySelector('.status-message')?.textContent ?? ''
  expect(status).toContain('Import failed: Invalid JSON structure found.')
  expect(status).toContain(`Task 1 in "${firstQuadrant.id}" missing a valid "done" boolean.`)
  expect(status).toContain(`Task 1 in "${secondQuadrant.id}" missing a valid "id" string.`)
  expect(status).toContain(`Missing required quadrant "${QUADRANTS[2].id}".`)
  expect(status).toContain(`Missing required quadrant "${QUADRANTS[3].id}".`)
})

test('falls back to in-memory tasks when localStorage is unavailable', async () => {
  const user = userEvent.setup()
  const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('storage unavailable')
  })
  const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage unavailable')
  })
  const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('storage unavailable')
  })

  try {
    render(<App />)

    expect(
      screen.getByText(
        'Local storage is unavailable. Tasks are only kept in memory and may be lost on refresh.'
      )
    ).toBeTruthy()

    const q1 = getQuadrantByLabel('Do First')
    const addInput = within(q1).getByRole('textbox', { name: 'Add task to Do First' })
    await user.type(addInput, 'Stay focused{enter}')

    expect(within(q1).getByText('Stay focused')).toBeTruthy()
  } finally {
    getItemSpy.mockRestore()
    setItemSpy.mockRestore()
    removeItemSpy.mockRestore()
  }
})

test('loads persisted tasks when writes are blocked but reads still work (quota exceeded)', async () => {
  const firstQuadrant = QUADRANTS[0]
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tasks: { [firstQuadrant.id]: [{ id: 'q-task', text: 'Quota task', done: false }] },
      config: { hideCompleted: false },
    })
  )

  const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('QuotaExceededError')
  })
  const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('QuotaExceededError')
  })

  try {
    render(<App />)

    expect(within(getQuadrantByLabel(firstQuadrant.title)).getByText('Quota task')).toBeTruthy()

    expect(
      screen.getByText(
        'Local storage is unavailable. Tasks are only kept in memory and may be lost on refresh.'
      )
    ).toBeTruthy()
  } finally {
    setItemSpy.mockRestore()
    removeItemSpy.mockRestore()
  }
})

test('falls back to defaults when localStorage contains corrupted JSON', () => {
  localStorage.setItem(STORAGE_KEY, 'this is not valid json {{{{')

  render(<App />)

  for (const quadrant of QUADRANTS) {
    expect(within(getQuadrantByLabel(quadrant.title)).queryAllByRole('listitem')).toHaveLength(0)
  }
})

test('loads state from localStorage on hard refresh (simulated re-mount with persisted data)', () => {
  const firstQuadrant = QUADRANTS[0]
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tasks: {
        [firstQuadrant.id]: [{ id: 'persist-1', text: 'Survived refresh', done: false }],
      },
      config: { hideCompleted: false },
    })
  )

  render(<App />)

  expect(
    within(getQuadrantByLabel(firstQuadrant.title)).getByText('Survived refresh')
  ).toBeTruthy()
})

test('drag-over applies visual feedback class on quadrant', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  await user.type(within(q1).getByRole('textbox', { name: 'Add task to Do First' }), 'Highlight test{enter}')

  const taskItem = within(q1).getByText('Highlight test').closest('li') as HTMLElement
  const q2 = getQuadrantByLabel('Schedule')

  const dragData = new Map<string, string>()
  const dataTransfer = {
    dropEffect: 'none' as DataTransfer['dropEffect'],
    effectAllowed: 'all' as DataTransfer['effectAllowed'],
    types: [] as string[],
    setData(type: string, value: string) {
      dragData.set(type, value)
      this.types = [...dragData.keys()]
    },
    getData(type: string) {
      return dragData.get(type) ?? ''
    },
  }

  fireEvent.dragStart(taskItem, { dataTransfer })
  fireEvent.dragOver(q2, { dataTransfer })
  expect(q2.classList.contains('drag-over')).toBe(true)

  fireEvent.dragLeave(q2, { dataTransfer, relatedTarget: document.body })
  expect(q2.classList.contains('drag-over')).toBe(false)
})

test('can set and display a due date on a task', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  await user.type(within(q1).getByRole('textbox', { name: 'Add task to Do First' }), 'Fix bug{enter}')

  await user.click(within(q1).getByRole('button', { name: 'Edit task' }))

  const dialog = screen.getByRole('dialog', { name: 'Edit task' })
  const dueDateInput = within(dialog).getByLabelText('Due date')
  await user.type(dueDateInput, '2099-12-31')

  await user.click(within(dialog).getByRole('button', { name: 'Save task' }))

  expect(within(q1).getByLabelText(/Due:/)).toBeTruthy()
})

test('sort by due date orders tasks within a quadrant', async () => {
  const user = userEvent.setup()
  localStorage.setItem(
    LEGACY_STORAGE_KEY,
    JSON.stringify({
      tasks: {
        q1: [
          { id: 'a', text: 'Later task', done: false, dueDate: '2099-12-31' },
          { id: 'b', text: 'Earlier task', done: false, dueDate: '2099-06-01' },
          { id: 'c', text: 'No date task', done: false, dueDate: null },
        ],
        q2: [],
        q3: [],
        q4: [],
      },
    })
  )

  render(<App />)

  const sortCheckbox = screen.getByRole('checkbox', { name: 'Sort by due date' })
  await user.click(sortCheckbox)

  const q1 = getQuadrantByLabel('Do First')
  const items = within(q1).getAllByRole('listitem')
  const texts = items.map((el) => el.textContent)

  const earlierIdx = texts.findIndex((t) => t?.includes('Earlier task'))
  const laterIdx = texts.findIndex((t) => t?.includes('Later task'))
  const noDateIdx = texts.findIndex((t) => t?.includes('No date task'))

  expect(earlierIdx).toBeLessThan(laterIdx)
  expect(laterIdx).toBeLessThan(noDateIdx)
})

test('adds a task with a due date and shows it in the task list', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  const addInput = within(q1).getByRole('textbox', { name: 'Add task to Do First' })
  const dateInput = within(q1).getByLabelText('New task due date')
  await user.type(addInput, 'Submit report')
  await user.type(dateInput, '2030-12-31')
  await user.click(within(q1).getByRole('button', { name: 'Add task to Do First' }))

  expect(within(q1).getByText('Submit report')).toBeTruthy()
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) as string) as { tasks: Record<string, Array<{ text: string; dueDate: string }>> }
  expect(saved.tasks[QUADRANTS[0].id].some((t) => t.text === 'Submit report' && t.dueDate === '2030-12-31')).toBe(true)
})

test('shows overdue indicator for tasks with a past due date', async () => {
  localStorage.setItem(
    LEGACY_STORAGE_KEY,
    JSON.stringify({
      tasks: {
        q1: [{ id: 'task1', text: 'Old task', done: false, dueDate: '2000-01-01', dueTime: null }],
        q2: [],
        q3: [],
        q4: [],
      },
    })
  )

  render(<App />)
  const q1 = getQuadrantByLabel('Do First')
  const badge = within(q1).getByLabelText(/overdue/i)
  expect(badge).toBeTruthy()
})

test('shows due-today indicator for tasks due today', async () => {
  const today = new Date()
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')

  localStorage.setItem(
    LEGACY_STORAGE_KEY,
    JSON.stringify({
      tasks: {
        q1: [{ id: 'task2', text: 'Due today task', done: false, dueDate: todayStr, dueTime: null }],
        q2: [],
        q3: [],
        q4: [],
      },
    })
  )

  render(<App />)
  const q1 = getQuadrantByLabel('Do First')
  const badge = within(q1).getByLabelText(/due today/i)
  expect(badge).toBeTruthy()
})

test('edit task can set and update due date', async () => {
  const user = userEvent.setup()
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tasks: {
        q1: [{ id: 'task3', text: 'Fix bug', done: false, dueDate: null, dueTime: null }],
        q2: [],
        q3: [],
        q4: [],
      },
    })
  )

  render(<App />)
  const q1 = getQuadrantByLabel('Do First')

  await user.click(within(q1).getByRole('button', { name: 'Edit task' }))

  const dialog = screen.getByRole('dialog', { name: 'Edit task' })
  const dateInput = within(dialog).getByLabelText('Due date')
  await user.type(dateInput, '2030-06-15')

  await user.click(within(dialog).getByRole('button', { name: 'Save task' }))

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) as string) as { tasks: Record<string, Array<{ text: string; dueDate: string }>> }
  expect(saved.tasks[QUADRANTS[0].id].some((t) => t.text === 'Fix bug' && t.dueDate === '2030-06-15')).toBe(true)
})

test('edit task opens a modal with current values and saves updates', async () => {
  const user = userEvent.setup()
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tasks: {
        q1: [{ id: 'task4', text: 'Plan launch', done: false, dueDate: '2030-06-15', dueTime: '09:30' }],
        q2: [],
        q3: [],
        q4: [],
      },
    })
  )

  render(<App />)
  const q1 = getQuadrantByLabel('Do First')

  await user.click(within(q1).getByRole('button', { name: 'Edit task' }))

  const dialog = screen.getByRole('dialog', { name: 'Edit task' })
  const textInput = within(dialog).getByRole('textbox', { name: 'Edit task text' })
  const dateInput = within(dialog).getByLabelText('Due date')
  const timeInput = within(dialog).getByLabelText('Due time')

  expect(textInput.value).toBe('Plan launch')
  expect(dateInput.value).toBe('2030-06-15')
  expect(timeInput.value).toBe('09:30')

  await user.clear(textInput)
  await user.type(textInput, 'Plan launch checklist')
  await user.clear(dateInput)
  await user.type(dateInput, '2030-06-20')
  await user.clear(timeInput)
  await user.type(timeInput, '10:45')
  await user.click(within(dialog).getByRole('button', { name: 'Save task' }))

  expect(screen.queryByRole('dialog', { name: 'Edit task' })).toBe(null)
  expect(within(q1).getByText('Plan launch checklist')).toBeTruthy()

  await waitFor(() => {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    const savedTask = saved.tasks[QUADRANTS[0].id][0]
    expect(savedTask.text).toBe('Plan launch checklist')
    expect(savedTask.dueDate).toBe('2030-06-20')
    expect(savedTask.dueTime).toBe('10:45')
  })
})

test('canceling modal editing discards draft changes', async () => {
  const user = userEvent.setup()
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tasks: {
        q1: [{ id: 'task5', text: 'Refine copy', done: false, dueDate: '2030-07-01', dueTime: null }],
        q2: [],
        q3: [],
        q4: [],
      },
    })
  )

  render(<App />)
  const q1 = getQuadrantByLabel('Do First')

  await user.click(within(q1).getByRole('button', { name: 'Edit task' }))

  let dialog = screen.getByRole('dialog', { name: 'Edit task' })
  const textInput = within(dialog).getByRole('textbox', { name: 'Edit task text' })
  const dateInput = within(dialog).getByLabelText('Due date')

  await user.clear(textInput)
  await user.type(textInput, 'Refine homepage copy')
  await user.clear(dateInput)
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  expect(screen.queryByRole('dialog', { name: 'Edit task' })).toBe(null)
  expect(within(q1).getByText('Refine copy')).toBeTruthy()

  await user.click(within(q1).getByRole('button', { name: 'Edit task' }))
  dialog = screen.getByRole('dialog', { name: 'Edit task' })

  expect(within(dialog).getByRole('textbox', { name: 'Edit task text' }).value).toBe('Refine copy')
  expect(within(dialog).getByLabelText('Due date').value).toBe('2030-07-01')
})
