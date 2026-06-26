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
    // UX-фикс: Высокий = оранжевый (был красноватый, сливался с Критичным)
    label: 'Высокий',
    chip: { backgroundColor: '#ffedd5', color: '#ea580c' },
    active: { backgroundColor: '#f97316', color: '#fff' },
  },
  {
    value: 'Medium',
    // UX-фикс: Средний = янтарный (был ЗЕЛЁНЫЙ — зелёный читается как «ок» и доминировал над Высоким)
    label: 'Средний',
    chip: { backgroundColor: '#fef3c7', color: '#b45309' },
    active: { backgroundColor: '#f59e0b', color: '#fff' },
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
