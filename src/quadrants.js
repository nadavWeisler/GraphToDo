const LEGACY_QUADRANT_IDS = ['q1', 'q2', 'q3', 'q4']

function createQuadrantId(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export const QUADRANTS = [
  {
    title: 'Do First',
    subtitle: 'Urgent & Important',
  },
  {
    title: 'Schedule',
    subtitle: 'Not Urgent & Important',
  },
  {
    title: 'Delegate',
    subtitle: 'Urgent & Not Important',
  },
  {
    title: 'Eliminate',
    subtitle: 'Not Urgent & Not Important',
  },
].map((quadrant, index) => ({
  ...quadrant,
  id: createQuadrantId(quadrant.title),
  legacyId: LEGACY_QUADRANT_IDS[index],
  colorClass: `q${index + 1}`,
}))

export const QUADRANT_IDS = QUADRANTS.map(({ id }) => id)

export const STORAGE_KEY = 'graphtodo.tasks.v1'
