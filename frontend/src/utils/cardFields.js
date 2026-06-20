// ЕДИНЫЙ источник полей карточки канбана (правило централизации заказчика).
// Доски «Сделки», «Лиды» и кастомные воронки показывают ОДИН набор полей — тянут
// отсюда, не копируют. Поле суммы (итоги колонок) — тоже здесь, чтобы менялось из
// одного места.

// Поле суммы сделки/лида — по нему считаются итоги колонок канбана (SalesBoard).
export const AMOUNT_FIELD = 'annual_revenue'

// Поля карточки по умолчанию: сумма, телефон, исполнитель, дата создания (I13/I33).
export const DEFAULT_CARD_FIELDS = [AMOUNT_FIELD, 'mobile_no', '_assign', 'creation']

// Готовая JSON-строка для prop :kanbanFields (компоненты передают список строкой).
export const DEFAULT_CARD_KANBAN_FIELDS = JSON.stringify(DEFAULT_CARD_FIELDS)
