// Единый источник вычисления дедлайна по умолчанию (правило централизации заказчика, N1.3).
// Сейчас используется только во фронте (бэкенд свой дефолт +N раб.дней не считает —
// регулярные задачи берут календарные due_in_days). Если позже понадобится на бэке —
// логика здесь одна, тянуть отсюда.

// Дата +N РАБОЧИХ дней (пропуская сб/вс) в формате "YYYY-MM-DD 00:00:00".
export function defaultDueDate(workingDays = 2) {
  const d = new Date()
  let added = 0
  while (added < workingDays) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay() // 0=вс, 6=сб
    if (day !== 0 && day !== 6) added++
  }
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 00:00:00`
}
