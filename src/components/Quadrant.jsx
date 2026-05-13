import { useState } from 'react'
import TaskItem from './TaskItem'
import './Quadrant.css'

function Quadrant({ id, title, subtitle, colorClass, tasks, onAddTask, onToggleTask, onDeleteTask }) {
  const [input, setInput] = useState('')

  function handleAdd(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    onAddTask(id, text)
    setInput('')
  }

  return (
    <div className={`quadrant ${colorClass}`}>
      <div className="quadrant-header">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <ul className="task-list">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onToggle={() => onToggleTask(id, task.id)}
            onDelete={() => onDeleteTask(id, task.id)}
          />
        ))}
      </ul>
      <form className="add-task-form" onSubmit={handleAdd}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a task…"
          aria-label={`Add task to ${title}`}
        />
        <button type="submit" aria-label="Add">+</button>
      </form>
    </div>
  )
}

export default Quadrant
