import { fireEvent, render, screen, within } from '@testing-library/react'
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

test('moves a task between quadrants with drag and drop', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  await user.type(within(q1).getByRole('textbox', { name: 'Add task to Do First' }), 'Plan sprint{enter}')

  const task = within(q1).getByText('Plan sprint').closest('li')
  const q3 = getQuadrantByLabel('Delegate')
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
  fireEvent.dragOver(q3, { dataTransfer })
  fireEvent.drop(q3, { dataTransfer })

  expect(within(q1).queryByText('Plan sprint')).toBeNull()
  expect(within(q3).getByText('Plan sprint')).toBeTruthy()
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
