import { useState } from 'react'
import TaskItem from './TaskItem'
import './Quadrant.css'

function Quadrant({
  id,
  title,
  subtitle,
  colorClass,
  tasks,
  totalCount,
  visibleCount,
  quadrants,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onEditTask,
  onMoveTask,
}) {
  const [input, setInput] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  function handleAdd(event) {
    event.preventDefault()
    const result = onAddTask(id, input)

    if (!result.ok) {
      setErrorMessage(result.error)
      return
    }

    setInput('')
    setErrorMessage('')
  }

  return (
    <section className={`quadrant ${colorClass}`} aria-label={`${title} quadrant`}>
      <div className="quadrant-header">
        <h2>{title}</h2>
        <p>{subtitle}</p>
        <p className="count-text" aria-live="polite">
          {totalCount} total{visibleCount !== totalCount ? ` • ${visibleCount} shown` : ''}
        </p>
      </div>

      <ul className="task-list">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            quadrants={quadrants}
            currentQuadrantId={id}
            onToggle={() => onToggleTask(id, task.id)}
            onDelete={() => onDeleteTask(id, task.id)}
            onSave={(nextText) => onEditTask(id, task.id, nextText)}
            onMove={(targetQuadrantId) => onMoveTask(id, task.id, targetQuadrantId)}
          />
        ))}
      </ul>

      {!tasks.length ? <p className="empty-message">No tasks match this view.</p> : null}

      <form className="add-task-form" onSubmit={handleAdd}>
        <label className="sr-only" htmlFor={`add-${id}`}>
          Add task to {title}
        </label>
        <input
          id={`add-${id}`}
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Add a task…"
          {...(errorMessage ? { 'aria-describedby': `error-${id}` } : {})}
          maxLength={120}
        />
        <button type="submit" aria-label={`Add task to ${title}`}>+</button>
      </form>

      <p className="input-error" id={`error-${id}`} role="status" aria-live="polite">
        {errorMessage}
      </p>
    </section>
  )
}

export default Quadrant
