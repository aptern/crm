// Глобальная live-реактивность для кастомных surfaces (запрос заказчика 2026-06-20:
// «все действия видны сразу, без ручного обновления, ВЕЗДЕ»).
//
// Бэкенд (nacifrah.realtime.notify_board) шлёт ОДИН канал `nacifrah_board_update`
// с payload {doctype} на любой insert/update/delete board-доктайпа. Доски (ViewControls)
// уже слушают его сами; этот композабл подключает ОСТАЛЬНЫЕ экраны (должности, сотрудники,
// отделы, кастомные воронки) одной строкой — тем же паттерном (debounce + фильтр по doctype).
import { onMounted, onUnmounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { globalStore } from '@/stores/global'

export const BOARD_EVENT = 'nacifrah_board_update'

// doctypes: строка | массив DocType'ов, которые волнуют этот экран.
// reloadFn: () => void|Promise — перечитать данные (должна быть дешёвой/идемпотентной).
export function useRealtimeRefresh(doctypes, reloadFn, { debounce = 700 } = {}) {
  const { $socket } = globalStore()
  const wanted = new Set([].concat(doctypes))
  const run = useDebounceFn(() => reloadFn(), debounce)
  const handler = (data) => {
    // нет doctype в payload → обновляем на всякий случай; иначе — только «наш» doctype
    if (!data || !data.doctype || wanted.has(data.doctype)) run()
  }
  onMounted(() => $socket && $socket.on(BOARD_EVENT, handler))
  onUnmounted(() => $socket && $socket.off(BOARD_EVENT, handler))
}
