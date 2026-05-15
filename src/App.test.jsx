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

test('adds a task with a due date and shows it in the task list', async () => {
  const user = userEvent.setup()
  render(<App />)

  const q1 = getQuadrantByLabel('Do First')
  const addInput = within(q1).getByRole('textbox', { name: 'Add task to Do First' })
  const dateInput = within(q1).getByLabelText('Due date')
  await user.type(addInput, 'Submit report')
  await user.type(dateInput, '2030-12-31')
  await user.click(within(q1).getByRole('button', { name: 'Add task to Do First' }))

  expect(within(q1).getByText('Submit report')).toBeTruthy()
  const saved = JSON.parse(localStorage.getItem('graphtodo.tasks.v1'))
  expect(saved.tasks.q1.some((t) => t.text === 'Submit report' && t.dueDate === '2030-12-31')).toBe(true)
})

test('shows overdue indicator for tasks with a past due date', async () => {
  localStorage.setItem(
    'graphtodo.tasks.v1',
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
    'graphtodo.tasks.v1',
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
    'graphtodo.tasks.v1',
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

  // The edit form date input is the first "Due date" input (inside task list); the add form's is below
  const dateInputs = within(q1).getAllByLabelText('Due date')
  await user.type(dateInputs[0], '2030-06-15')

  await user.click(within(q1).getByRole('button', { name: 'Save task' }))

  const saved = JSON.parse(localStorage.getItem('graphtodo.tasks.v1'))
  expect(saved.tasks.q1.some((t) => t.text === 'Fix bug' && t.dueDate === '2030-06-15')).toBe(true)
})
