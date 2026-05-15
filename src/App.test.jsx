import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

function getQuadrantByLabel(label) {
  return screen.getByRole('region', { name: `${label} quadrant` })
}

test('adds, toggles, and deletes a task', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  const addInput = within(q1).getByRole('textbox', { name: 'Add task to Do First' })
  await user.type(addInput, 'Pay rent{enter}')

  expect(within(q1).getByText('Pay rent')).toBeTruthy()

  const toggleBtn = within(q1).getByRole('button', { name: 'Mark complete' })
  await user.click(toggleBtn)
  expect(within(q1).getByRole('button', { name: 'Mark incomplete' })).toBeTruthy()

  await user.click(within(q1).getByRole('button', { name: 'Delete task' }))
  expect(within(q1).queryByText('Pay rent')).toBeNull()
})

test('reopens a completed task from the task itself and updates completed controls', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  const clearCompletedButton = screen.getByRole('button', { name: 'Clear completed' })

  await user.type(within(q1).getByRole('textbox', { name: 'Add task to Do First' }), 'Pay rent{enter}')
  expect(clearCompletedButton.disabled).toBe(true)

  await user.click(within(q1).getByRole('button', { name: 'Mark complete' }))
  expect(clearCompletedButton.disabled).toBe(false)

  await user.click(within(q1).getByRole('button', { name: 'Reopen task: Pay rent' }))

  expect(within(q1).getByRole('button', { name: 'Mark complete' })).toBeTruthy()
  expect(within(q1).queryByRole('button', { name: 'Mark incomplete' })).toBeNull()
  expect(clearCompletedButton.disabled).toBe(true)
})

test('moves a task between quadrants', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  await user.type(within(q1).getByRole('textbox', { name: 'Add task to Do First' }), 'Send update{enter}')

  const moveSelect = within(q1).getByRole('combobox', { name: 'Move task' })
  await user.selectOptions(moveSelect, 'q2')

  expect(within(q1).queryByText('Send update')).toBeNull()
  const q2 = getQuadrantByLabel('Schedule')
  expect(within(q2).getByText('Send update')).toBeTruthy()
})

test('loads tasks from storage and persists updates', async () => {
  const user = userEvent.setup()
  localStorage.setItem(
    'graphtodo.tasks.v1',
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
  const q2 = getQuadrantByLabel('Schedule')
  expect(within(q2).getByText('Review roadmap')).toBeTruthy()

  const q1 = getQuadrantByLabel('Do First')
  await user.type(within(q1).getByRole('textbox', { name: 'Add task to Do First' }), 'Write tests{enter}')

  const saved = JSON.parse(localStorage.getItem('graphtodo.tasks.v1'))
  expect(saved.tasks.q1.some((task) => task.text === 'Write tests')).toBe(true)
})

test('shows validation error for duplicate tasks in same quadrant', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  const addInput = within(q1).getByRole('textbox', { name: 'Add task to Do First' })

  await user.type(addInput, 'Prepare slides{enter}')
  await user.type(addInput, ' prepare   slides {enter}')

  expect(within(q1).getByText('A similar task already exists in this quadrant.')).toBeTruthy()
})
