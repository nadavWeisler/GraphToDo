import { useEffect, useMemo, useRef, useState } from 'react'
import './TaskEditModal.css'

const MAX_TASK_LENGTH = 120
const MAX_NOTES_LENGTH = 2000
const MAX_TAG_LENGTH = 30
const MAX_TAGS_COUNT = 10

function normalizeText(value) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeTag(value) {
  return value.trim().replace(/\s+/g, ' ')
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(value + 'T00:00:00')
  return !isNaN(parsed.getTime())
}

function isValidTimeString(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function createDraft(task) {
  return {
    text: task.text ?? '',
    dueDate: task.dueDate ?? '',
    dueTime: task.dueTime ?? '',
    tags: Array.isArray(task.tags) ? task.tags.join(', ') : '',
    notes: task.notes ?? '',
  }
}

function parseAndValidateTags(rawTags) {
  const pieces = rawTags.split(',').map(normalizeTag).filter(Boolean)
  const seen = new Set()
  const tags = []

  for (const tag of pieces) {
    if (tag.length > MAX_TAG_LENGTH) {
      return { ok: false, error: `Each tag must be ${MAX_TAG_LENGTH} characters or fewer.` }
    }

    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
  }

  if (tags.length > MAX_TAGS_COUNT) {
    return { ok: false, error: `Up to ${MAX_TAGS_COUNT} tags are allowed.` }
  }

  return { ok: true, tags }
}

function validateDraft(draft) {
  const text = normalizeText(draft.text)
  if (!text) {
    return { ok: false, error: 'Task cannot be empty.' }
  }

  if (text.length > MAX_TASK_LENGTH) {
    return { ok: false, error: `Task must be ${MAX_TASK_LENGTH} characters or fewer.` }
  }

  const dueDate = draft.dueDate || null
  const dueTime = draft.dueDate ? draft.dueTime || null : null

  if (dueDate && !isValidDateString(dueDate)) {
    return { ok: false, error: 'Due date must be a valid date.' }
  }

  if (draft.dueTime && !draft.dueDate) {
    return { ok: false, error: 'Due time requires a due date.' }
  }

  if (dueTime && !isValidTimeString(dueTime)) {
    return { ok: false, error: 'Due time must be valid.' }
  }

  const tagsResult = parseAndValidateTags(draft.tags)
  if (!tagsResult.ok) return tagsResult

  if (draft.notes.length > MAX_NOTES_LENGTH) {
    return { ok: false, error: `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.` }
  }

  return {
    ok: true,
    payload: {
      text,
      dueDate,
      dueTime,
      tags: tagsResult.tags,
      notes: draft.notes,
    },
  }
}

function TaskEditModal({ task, onClose, onSave }) {
  const [draft, setDraft] = useState(() => createDraft(task))
  const [initialDraft] = useState(() => createDraft(task))
  const [errorMessage, setErrorMessage] = useState('')
  const titleInputRef = useRef(null)

  useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

  const hasUnsavedChanges = useMemo(
    () =>
      draft.text !== initialDraft.text ||
      draft.dueDate !== initialDraft.dueDate ||
      draft.dueTime !== initialDraft.dueTime ||
      draft.tags !== initialDraft.tags ||
      draft.notes !== initialDraft.notes,
    [draft, initialDraft]
  )

  function handleAttemptClose() {
    if (hasUnsavedChanges && !window.confirm('Discard unsaved changes?')) {
      return
    }
    setErrorMessage('')
    onClose()
  }

  function handleSubmit(event) {
    event.preventDefault()
    const validation = validateDraft(draft)
    if (!validation.ok) {
      setErrorMessage(validation.error)
      return
    }

    const result = onSave(validation.payload)
    if (!result.ok) {
      setErrorMessage(result.error)
      return
    }

    setErrorMessage('')
    onClose()
  }

  return (
    <div
      className="task-edit-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleAttemptClose()
        }
      }}
    >
      <div
        className="task-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit task: ${task.text}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            handleAttemptClose()
          }
        }}
      >
        <h3>Edit task details</h3>
        <form className="task-edit-modal-form" onSubmit={handleSubmit}>
          <label htmlFor={`edit-modal-${task.id}`}>Edit task text</label>
          <input
            ref={titleInputRef}
            id={`edit-modal-${task.id}`}
            type="text"
            value={draft.text}
            onChange={(event) => setDraft((prev) => ({ ...prev, text: event.target.value }))}
            maxLength={MAX_TASK_LENGTH}
          />

          <div className="task-edit-modal-row">
            <div>
              <label htmlFor={`edit-modal-due-date-${task.id}`}>Due date</label>
              <input
                id={`edit-modal-due-date-${task.id}`}
                type="date"
                value={draft.dueDate}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    dueDate: event.target.value,
                    dueTime: event.target.value ? prev.dueTime : '',
                  }))
                }
                aria-label="Due date"
              />
            </div>
            <div>
              <label htmlFor={`edit-modal-due-time-${task.id}`}>Due time</label>
              <input
                id={`edit-modal-due-time-${task.id}`}
                type="time"
                value={draft.dueTime}
                onChange={(event) => setDraft((prev) => ({ ...prev, dueTime: event.target.value }))}
                aria-label="Due time"
                disabled={!draft.dueDate}
              />
            </div>
          </div>

          <label htmlFor={`edit-modal-tags-${task.id}`}>Tags (comma separated)</label>
          <input
            id={`edit-modal-tags-${task.id}`}
            type="text"
            value={draft.tags}
            onChange={(event) => setDraft((prev) => ({ ...prev, tags: event.target.value }))}
            aria-label="Tags"
          />

          <label htmlFor={`edit-modal-notes-${task.id}`}>Detailed notes</label>
          <textarea
            id={`edit-modal-notes-${task.id}`}
            value={draft.notes}
            onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
            maxLength={MAX_NOTES_LENGTH}
            rows={4}
            aria-label="Detailed notes"
          />

          <div className="task-edit-modal-actions">
            <button type="submit" className="task-action-btn" aria-label="Save task">
              Save
            </button>
            <button type="button" className="task-action-btn" onClick={handleAttemptClose}>
              Cancel
            </button>
          </div>
        </form>

        <p className="item-error" role="status" aria-live="polite">{errorMessage}</p>
      </div>
    </div>
  )
}

export default TaskEditModal
