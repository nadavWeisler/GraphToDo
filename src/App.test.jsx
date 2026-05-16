import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { QUADRANTS, STORAGE_KEY } from './quadrants'

function getQuadrantByLabel(label) {
  return screen.getByRole('region', { name: `${label} quadrant` })
}

test('adds, toggles, and deletes a task', async () => {
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
  await user.click(toggleBtn)
  expect(within(firstRegion).getByRole('button', { name: 'Mark incomplete' })).toBeTruthy()

  await user.click(within(firstRegion).getByRole('button', { name: 'Delete task' }))
  expect(within(firstRegion).queryByText('Pay rent')).toBeNull()
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

test('moves a task between quadrants with drag and drop', async () => {
  const [firstQuadrant, , thirdQuadrant] = QUADRANTS
  const user = userEvent.setup()
  render(<App />)

  const firstRegion = getQuadrantByLabel(firstQuadrant.title)
  await user.type(
    within(firstRegion).getByRole('textbox', { name: `Add task to ${firstQuadrant.title}` }),
    'Plan sprint{enter}'
  )

  const task = within(firstRegion).getByText('Plan sprint').closest('li')
  const thirdRegion = getQuadrantByLabel(thirdQuadrant.title)
  const dragData = new Map()
  const dataTransfer = {
    dropEffect: 'none',
    effectAllowed: 'all',
    types: [],
    setData(type, value) {
      dragData.set(type, value)
      this.types = [...dragData.keys()]
    },
    getData(type) {
      return dragData.get(type) ?? ''
    },
  }

  fireEvent.dragStart(task, { dataTransfer })
  fireEvent.dragOver(thirdRegion, { dataTransfer })
  fireEvent.drop(thirdRegion, { dataTransfer })

  expect(within(firstRegion).queryByText('Plan sprint')).toBeNull()
  expect(within(thirdRegion).getByText('Plan sprint')).toBeTruthy()
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

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
  expect(saved.tasks[firstQuadrant.id].some((task) => task.text === 'Write tests')).toBe(true)
  expect(saved.tasks[secondQuadrant.id].some((task) => task.text === 'Review roadmap')).toBe(true)
  expect(saved.tasks.q1).toBeUndefined()
  expect(saved.tasks.q2).toBeUndefined()
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

  const editInput = within(q1).getByRole('textbox', { name: 'Edit task text' })
  expect(document.activeElement).toBe(editInput)

  await user.clear(editInput)
  await user.type(editInput, 'Draft summary updated{enter}')

  expect(document.activeElement).toBe(within(q1).getByRole('button', { name: 'Edit task' }))
})

test('returns focus to the edit button when editing is cancelled', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  await user.type(within(q1).getByRole('textbox', { name: 'Add task to Do First' }), 'Review notes{enter}')

  await user.click(within(q1).getByRole('button', { name: 'Edit task' }))
  const editInput = within(q1).getByRole('textbox', { name: 'Edit task text' })

  await user.type(editInput, '{Escape}')

  expect(document.activeElement).toBe(within(q1).getByRole('button', { name: 'Edit task' }))
})
