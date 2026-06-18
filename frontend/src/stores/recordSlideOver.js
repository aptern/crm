import { ref } from 'vue'

// I10: лиды/сделки открываются right-slide-over поверх списка (как «Сотрудники»),
// без перехода на отдельную страницу. Глобальное состояние оверлея.
const show = ref(false)
const doctype = ref('') // 'CRM Deal' | 'CRM Lead'
const name = ref('')

function openRecord(_doctype, _name) {
  if (!_name) return
  doctype.value = _doctype
  name.value = _name
  show.value = true
}

function close() {
  show.value = false
}

export function recordSlideOverStore() {
  return { show, doctype, name, openRecord, close }
}
