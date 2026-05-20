import { useRef, useState } from 'react'
import TaskItem from './TaskItem'
import './Quadrant.css'

const TASK_DRAG_MIME_TYPE = 'application/x-graphtodo-task'

function Quadrant({
  id,
  title,
  subtitle,
  colorClass,
  tasks,
  totalCount,
  visibleCount,
  quadrants,
  announcementId,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onEditTask,
  onMoveTask,
}) {
  const [input, setInput] = useState('')
  const [addDueDate, setAddDueDate] = useState('')
  const [addDueTime, setAddDueTime] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const addInputRef = useRef(null)
  const [isDragOver, setIsDragOver] = useState(false)

  function handleAdd(event) {
    event.preventDefault()
    const result = onAddTask(id, input, addDueDate || null, addDueTime || null)

    if (!result.ok) {
      setErrorMessage(result.error)
      return
    }

    setInput('')
    setAddDueDate('')
    setAddDueTime('')
    setErrorMessage('')
    addInputRef.current?.focus()
  }

  function handleTaskDragStart(event, sourceQuadrantId, taskId) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(
      TASK_DRAG_MIME_TYPE,
      JSON.stringify({ sourceQuadrantId, taskId })
    )
  }

  function handleDragOver(event) {
    if (!event.dataTransfer.types.includes(TASK_DRAG_MIME_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (!isDragOver) {
      setIsDragOver(true)
    }
  }

  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDragOver(false)
    }
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragOver(false)

    const rawPayload = event.dataTransfer.getData(TASK_DRAG_MIME_TYPE)
    if (!rawPayload) return

    try {
      const { sourceQuadrantId, taskId } = JSON.parse(rawPayload)
      const result = onMoveTask(sourceQuadrantId, taskId, id)

      if (!result.ok) {
        setErrorMessage(result.error)
        return
      }

      setErrorMessage('')
    } catch {
      setErrorMessage('Unable to move the dropped task.')
    }
  }

  return (
    <section
      className={`quadrant ${colorClass}${isDragOver ? ' drag-over' : ''}`}
      aria-label={`${title} quadrant`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
            announcementId={announcementId}
            currentQuadrantId={id}
            onToggle={() => onToggleTask(id, task.id)}
            onDelete={() => onDeleteTask(id, task.id)}
            onSave={(payload) => onEditTask(id, task.id, payload.text, payload.dueDate, payload.dueTime)}
            onMove={(targetQuadrantId) => onMoveTask(id, task.id, targetQuadrantId)}
            onDragStart={handleTaskDragStart}
            onDragEnd={() => setIsDragOver(false)}
          />
        ))}
      </ul>

      {!tasks.length ? <p className="empty-message">No tasks match this view.</p> : null}

      <form className="add-task-form" onSubmit={handleAdd}>
        <div className="add-task-row">
          <label className="sr-only" htmlFor={`add-${id}`}>
            Add task to {title}
          </label>
          <input
            ref={addInputRef}
            id={`add-${id}`}
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Add a task…"
            {...(errorMessage ? { 'aria-describedby': `error-${id}` } : {})}
            maxLength={120}
          />
          <button type="submit" aria-label={`Add task to ${title}`}>+</button>
        </div>
        <div className="add-task-date-row">
          <label className="sr-only" htmlFor={`add-due-date-${id}`}>New task due date</label>
          <input
            id={`add-due-date-${id}`}
            type="date"
            value={addDueDate}
            onChange={(event) => setAddDueDate(event.target.value)}
            aria-label="New task due date"
          />
          <label className="sr-only" htmlFor={`add-due-time-${id}`}>New task due time</label>
          <input
            id={`add-due-time-${id}`}
            type="time"
            value={addDueTime}
            onChange={(event) => setAddDueTime(event.target.value)}
            aria-label="New task due time"
            disabled={!addDueDate}
          />
        </div>
      </form>

      <p className="input-error" id={`error-${id}`} role="status" aria-live="polite">
        {errorMessage}
      </p>
    </section>
  )
}

export default Quadrant
