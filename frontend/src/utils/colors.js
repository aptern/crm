// Палитра цветов этапов — ЕДИНЫЙ источник = бэкенд funnels.py PALETTE_COLORS (правило
// централизации заказчика, N1.4: «тянуть не копировать»). Тянут: пикер цвета в конструкторе
// воронок (Funnels.vue) И пикер цвета колонки задач (ProjectTasks.vue) — оба импортят
// STAGE_COLOR_PALETTE и реагируют, когда массив наполнится с бэка.
//
// Фолбэк ниже = зеркало текущего бэкенд-списка (если фетч не успел/недоступен — пикер всё равно
// показывает полный набор; все цвета поддержаны Tailwind-safelist + extend в tailwind.config.js).
import { reactive } from 'vue'
import { call } from 'frappe-ui'
import { napi } from '@/utils/api'

const FALLBACK = [
  'gray', 'red', 'rose', 'pink', 'fuchsia', 'purple', 'violet', 'indigo',
  'blue', 'sky', 'cyan', 'teal', 'emerald', 'green', 'lime', 'yellow',
  'amber', 'orange', 'slate', 'black',
]

// Реактивный массив: компоненты делают `const PALETTE = STAGE_COLOR_PALETTE` и v-for по нему.
export const STAGE_COLOR_PALETTE = reactive([...FALLBACK])

// Тянем канон с бэка один раз (модуль грузится при заходе на Воронки/Задачи — auth уже готов).
call(napi('funnels.get_stage_palette'))
  .then((p) => {
    if (Array.isArray(p) && p.length) {
      STAGE_COLOR_PALETTE.splice(0, STAGE_COLOR_PALETTE.length, ...p)
    }
  })
  .catch(() => {}) // молча: остаётся фолбэк
