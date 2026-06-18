// I6/I9: российские форматы — телефон и сумма.
// Маски/символ легко поменять здесь одной строкой (заказчик может прислать свой шаблон).

import { flt } from '@/utils/numberFormat'

// --- Телефон (I6) ---------------------------------------------------------
// Только цифры (для хранения/поиска независимо от форматирования ввода).
export function normalizePhoneToDigits(s) {
  return String(s == null ? '' : s).replace(/\D/g, '')
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
export const RUBLE_SIGN = '₽'

// Разряды через пробел, БЕЗ копеек, знак рубля ВПЛОТНУЮ: 1234567 → "1 234 567₽"
// (по маске заказчика «110 000₽» — без пробела перед ₽).
export function formatRub(value, sign = RUBLE_SIGN) {
  const n = Math.round(flt(value, 0) || 0)
  const grouped = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return (n < 0 ? '-' : '') + grouped + (sign || '')
}
