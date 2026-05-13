import './TaskItem.css'

function TaskItem({ task, onToggle, onDelete }) {
  return (
    <li className={`task-item${task.done ? ' done' : ''}`}>
      <button
        className="toggle-btn"
        onClick={onToggle}
        aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
      >
        <span className="checkmark">{task.done ? '✓' : ''}</span>
      </button>
      <span className="task-text">{task.text}</span>
      <button className="delete-btn" onClick={onDelete} aria-label="Delete task">
        ×
      </button>
    </li>
  )
}

export default TaskItem
