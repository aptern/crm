// C (заказчик): Дашборд виден не всем, а только полным админам + кому админ выдал доступ
// (Команда → Права доступа → «Доступ к Дашборду»). Бэкенд: nacifrah.hr.can_see_dashboard.
import { ref } from 'vue'
import { call } from 'frappe-ui'
import { napi } from '@/utils/api'

export const canSeeDashboard = ref(false)
let _loaded = false

export async function loadDashboardAccess(force = false) {
  if (_loaded && !force) return canSeeDashboard.value
  _loaded = true
  try {
    canSeeDashboard.value = !!(await call(napi('hr.can_see_dashboard')))
  } catch (e) {
    canSeeDashboard.value = false
  }
  return canSeeDashboard.value
}
