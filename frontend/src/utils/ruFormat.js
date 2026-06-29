// I6/I9: российские форматы — телефон и сумма.
// Маски/символ легко поменять здесь одной строкой (заказчик может прислать свой шаблон).

import { flt } from '@/utils/numberFormat'
import { dayjsLocal } from 'frappe-ui'

// B (заказчик): дата на карточке доски — фактическая. Сегодня → время «чч:мм», иначе
// «25 мая» (число + короткий месяц, родительный для мая). Единый источник формата.
export const RU_MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]
export function formatCardDate(dateStr) {
  if (!dateStr) return ''
  const d = dayjsLocal(dateStr)
  if (!d || !d.isValid || !d.isValid()) return ''
  const now = dayjsLocal()
  if (d.isSame(now, 'day')) return d.format('HH:mm')
  return `${d.date()} ${RU_MONTHS_SHORT[d.month()]}`
}

// --- Телефон (I6) ---------------------------------------------------------
// Только цифры (для хранения/поиска независимо от форматирования ввода).
export function normalizePhoneToDigits(s) {
  return String(s == null ? '' : s).replace(/\D/g, '')
}

// I31: извлечь ровно 10 значащих цифр (без кода страны 7/8) — ТЗ заказчика.
export function extractPhoneDigits(value) {
  const digits = String(value == null ? '' : value).replace(/\D/g, '')
  if (digits.length > 0 && (digits[0] === '7' || digits[0] === '8')) {
    return digits.slice(1, 11) // следующие 10 цифр после кода страны
  }
  return digits.slice(0, 10)
}

// I31: прогрессивная маска ввода "+7 (XXX) XXX-XX-XX" (формируется по мере набора).
export function formatPhoneInput(value) {
  const digits = extractPhoneDigits(value)
  if (digits.length === 0) return ''
  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 8),
    digits.slice(8, 10),
  ]
  let formatted = '+7'
  if (parts[0]) formatted += ` (${parts[0]}${parts[0].length === 3 ? ')' : ''}`
  if (parts[1]) formatted += ` ${parts[1]}`
  if (parts[2]) formatted += `-${parts[2]}`
  if (parts[3]) formatted += `-${parts[3]}`
  return formatted
}

// I31: валиден ровно при 10 значащих цифрах.
export function isPhoneValid(value) {
  return extractPhoneDigits(value).length === 10
}

// Отображение РФ-номера маской +7 (XXX) XXX-XX-XX. Не-РФ номера — как есть.
export function formatPhoneDisplay(s) {
  let d = normalizePhoneToDigits(s)
  if (!d) return ''
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1) // 8XXXXXXXXXX → 7XXXXXXXXXX
  if (d.length === 10) d = '7' + d // 10 цифр → добавим код страны
  if (d.length !== 11 || d[0] !== '7') return String(s) // не РФ-формат — оставляем как есть
  const p = d.slice(1)
  return `+7 (${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6, 8)}-${p.slice(8, 10)}`
}

// --- Сумма (I9) -----------------------------------------------------------
// Фолбэк-символ. Сам символ — ИЗ НАСТРОЕК (N1.1): boot кладёт
// window.sysdefaults.currency_symbol (FCRM Settings.currency → Currency.symbol).
export const RUBLE_SIGN = '₽'

// Символ валюты из настроек, фолбэк ₽ — чтобы менялся из одного места (System Settings).
export function currencySign() {
  try {
    return (window.sysdefaults && window.sysdefaults.currency_symbol) || RUBLE_SIGN
  } catch {
    return RUBLE_SIGN
  }
}

// Разряды через пробел, БЕЗ копеек, знак валюты ВПЛОТНУЮ: 1234567 → "1 234 567₽"
// (по маске заказчика «110 000₽» — без пробела перед символом). Символ — из настроек.
export function formatRub(value, sign = currencySign()) {
  const n = Math.round(flt(value, 0) || 0)
  const grouped = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return (n < 0 ? '-' : '') + grouped + (sign || '')
}
