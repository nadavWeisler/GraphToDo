import { useState } from 'react'
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

function createTask(text) {
  return { id: crypto.randomUUID(), text, done: false }
}

function App() {
  const [tasks, setTasks] = useState({
    q1: [],
    q2: [],
    q3: [],
    q4: [],
  })

  function handleAddTask(quadrantId, text) {
    setTasks((prev) => ({
      ...prev,
      [quadrantId]: [...prev[quadrantId], createTask(text)],
    }))
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

  return (
    <div className="app">
      <header className="app-header">
        <h1>Eisenhower Matrix</h1>
        <p>Organise tasks by urgency and importance to maximise productivity</p>
      </header>

      <div className="matrix-labels">
        <span className="axis-label urgent-label">← Urgent</span>
        <span className="axis-label not-urgent-label">Not Urgent →</span>
      </div>

      <div className="matrix-container">
        <div className="importance-label-left">
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
              tasks={tasks[q.id]}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
            />
          ))}
        </div>

        <div className="importance-label-right">
          <span>Not Important</span>
        </div>
      </div>
    </div>
  )
}

export default App
