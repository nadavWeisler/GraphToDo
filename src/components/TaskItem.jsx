import { useEffect, useRef, useState } from 'react'
import TaskEditModal from './TaskEditModal'
import './TaskItem.css'

function formatDueDateLabel(dueDate, dueTime) {
  if (!dueDate) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  if (isNaN(due.getTime())) return null
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24))
  const timeStr = dueTime ? ` ${dueTime}` : ''

  if (diffDays < 0) return { label: `Overdue${timeStr}`, urgency: 'overdue' }
  if (diffDays === 0) return { label: `Today${timeStr}`, urgency: 'today' }
  if (diffDays === 1) return { label: `Tomorrow${timeStr}`, urgency: 'soon' }
  if (diffDays <= 3) return { label: `${diffDays} days${timeStr}`, urgency: 'soon' }
  return {
    label: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + timeStr,
    urgency: 'normal',
  }
}

function TaskItem({
  task,
  quadrants,
  currentQuadrantId,
  onToggle,
  onDelete,
  onSave,
  onMove,
  onDragStart,
  onDragEnd,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const editButtonRef = useRef(null)
  const shouldRestoreFocusRef = useRef(false)

  useEffect(() => {
    if (!isEditing && shouldRestoreFocusRef.current) {
      editButtonRef.current?.focus()
      shouldRestoreFocusRef.current = false
    }
  }, [isEditing])

  function handleSave(payload) {
    const result = onSave(payload)
    if (!result.ok) {
      return result
    }

    shouldRestoreFocusRef.current = true
    setIsEditing(false)
    setErrorMessage('')
    return result
  }

  function handleMove(event) {
    const target = event.target.value
    const result = onMove(target)
    if (!result.ok) {
      setErrorMessage(result.error)
      return
    }

    setErrorMessage('')
  }

  function handleCancel() {
    shouldRestoreFocusRef.current = true
    setIsEditing(false)
  }

  const dueDateInfo = formatDueDateLabel(task.dueDate, task.dueTime)
  const ariaLabelSuffix =
    dueDateInfo?.urgency === 'overdue'
      ? ' (overdue)'
      : dueDateInfo?.urgency === 'today'
        ? ' (due today)'
        : ''

  return (
    <li
      className={`task-item${task.done ? ' done' : ''}`}
      draggable={!isEditing}
      onDragStart={(event) => onDragStart(event, currentQuadrantId, task.id)}
      onDragEnd={onDragEnd}
    >
      <button
        className="toggle-btn"
        onClick={onToggle}
        aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
      >
        <span className="checkmark" aria-hidden="true">{task.done ? '✓' : ''}</span>
      </button>

      {task.done ? (
        <button
          type="button"
          className="task-text task-text-btn"
          onClick={onToggle}
          aria-label={`Reopen task: ${task.text}`}
        >
          {task.text}
        </button>
      ) : (
        <div className="task-text-area">
          <span className="task-text">{task.text}</span>
          {dueDateInfo && (
            <span
              className={`due-date-badge due-date-${dueDateInfo.urgency}`}
              aria-label={`Due: ${dueDateInfo.label}${ariaLabelSuffix}`}
            >
              📅 {dueDateInfo.label}
            </span>
          )}
        </div>
      )}

      {!isEditing ? (
        <>
          <label className="sr-only" htmlFor={`move-${task.id}`}>Move task to another quadrant</label>
          <select
            id={`move-${task.id}`}
            className="move-select"
            value={currentQuadrantId}
            onChange={handleMove}
            aria-label="Move task"
          >
            {quadrants.map((quadrant) => (
              <option key={quadrant.id} value={quadrant.id}>
                {quadrant.title}
              </option>
            ))}
          </select>

          <button
            ref={editButtonRef}
            className="task-action-btn"
            onClick={() => setIsEditing(true)}
            aria-label="Edit task"
          >
            Edit
          </button>
        </>
      ) : null}

      <button className="delete-btn" onClick={onDelete} aria-label="Delete task">
        ×
      </button>

      <p className="item-error" role="status" aria-live="polite">{errorMessage}</p>

      <TaskEditModal
        isOpen={isEditing}
        task={task}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </li>
  )
}

export default TaskItem
