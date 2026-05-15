import { render, screen, within } from '@testing-library/react'
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
