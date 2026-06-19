// M6(д): ЕДИНЫЙ источник приоритетов задачи (правило централизации заказчика).
// Значения — нативные Frappe (Low/Medium/High/Urgent), русские подписи + цвета — здесь.
// Тянут: борд задач (ProjectTasks.vue) И попап создания (FieldLayout/Field.vue).
// Порядок — по убыванию важности (Критичный → Низкий), как на борде.
export const TASK_PRIORITIES = [
  {
    value: 'Urgent',
    label: 'Критичный',
    chip: { backgroundColor: '#fee2e2', color: '#b91c1c' },
    active: { backgroundColor: '#dc2626', color: '#fff' },
  },
  {
    value: 'High',
    label: 'Высокий',
    chip: { backgroundColor: '#fef2f2', color: '#ef4444' },
    active: { backgroundColor: '#f87171', color: '#fff' },
  },
  {
    value: 'Medium',
    label: 'Средний',
    chip: { backgroundColor: '#dcfce7', color: '#15803d' },
    active: { backgroundColor: '#16a34a', color: '#fff' },
  },
  {
    value: 'Low',
    label: 'Низкий',
    chip: { backgroundColor: '#f1f5f9', color: '#64748b' },
    active: { backgroundColor: '#94a3b8', color: '#fff' },
  },
]

export const PRIORITY_LABELS = Object.fromEntries(
  TASK_PRIORITIES.map((p) => [p.value, p.label]),
)
export const PRIORITY_CHIP = Object.fromEntries(
  TASK_PRIORITIES.map((p) => [p.value, p.chip]),
)
// Порядок значений по убыванию важности (для дропдауна борда).
export const PRIORITY_ORDER = TASK_PRIORITIES.map((p) => p.value)
