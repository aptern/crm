<!--
  SalesBoard — ЕДИНЫЙ ШАБЛОН доски для Лидов, Сделок и кастомных воронок (I34 Stage B).
  Заказчик: «Чтобы был один шаблон и все воронки делались именно в нём. Правка шаблона
  меняет все воронки». Здесь живёт ВЕСЬ функционал/визуал доски: тулбар (ViewControls —
  фильтры, «Мои», «в работе», настройка канбана, поиск, переключатель видов), канбан со
  слотами карточки, drag-зона в ключевой этап, список и group_by. Страницы Leads/Deals/
  CustomFunnel — тонкие обёртки: задают doctype, фильтры, поля и обработчики.

  Параметры различий между воронками:
    doctype            — 'CRM Deal' | 'CRM Lead'
    filters            — default_filters для ViewControls (что показывать)
    boardFilters       — фильтр канбан-резолвера
    kanbanFields       — JSON списка полей карточки по умолчанию
    amountField        — поле суммы (итоги колонок)
    allowedViews       — какие виды доступны
    defaultColumnField — колонки по кастомному полю (воронка: nacifrah_funnel_stage)
    kanbanColumns      — явные колонки (воронка задаёт свои этапы)
    noViewPersist      — не сохранять настройки вида (воронки = общий doctype CRM Deal)
    getRoute           — куда ведёт клик по карточке
    onNewClick         — создать запись на этапе
    moveHandler        — кастомный перенос (воронка: смена этапа); иначе сохраняем вид
    listComponent      — компонент списка (DealsListView/LeadsListView); null = только канбан
    emptyName/emptyIcon— пустое состояние
-->
<template>
  <ViewControls
    :ref="setVC"
    v-model="list"
    v-model:loadMore="loadMore"
    v-model:resizeColumn="triggerResize"
    v-model:updatedPageCount="updatedPageCount"
    :doctype="doctype"
    :filters="filters"
    :options="{
      allowedViews,
      defaultKanbanFields: kanbanFields,
      ...(defaultColumnField ? { defaultColumnField } : {}),
      ...(kanbanColumns ? { kanbanColumns } : {}),
      ...(noViewPersist ? { noViewPersist: true } : {}),
    }"
  />
  <KanbanView
    v-if="route.params.viewType == 'kanban'"
    v-model="list"
    :options="{
      doctype,
      // NACIFRAH (ux-critique [d_leads] 122): у ЛИДОВ сумма всегда 0 ₽ (поле суммы — для
      // сделок) → не показываем итоги/суммы на доске лидов; на сделках показываем.
      amountField: isLead ? '' : amountField,
      boardFilters,
      getRoute,
      onNewClick: (column) => onNewClick?.(column),
    }"
    @update="onUpdate"
    @loadMore="(columnName) => viewControls.loadMoreKanban(columnName)"
  >
    <template #title="{ titleField, itemName }">
      <div class="flex items-center gap-2">
        <div v-if="titleField === 'status'">
          <IndicatorIcon :class="getRow(itemName, titleField).color" />
        </div>
        <div
          v-else-if="
            titleField === 'organization' && getRow(itemName, titleField).label
          "
        >
          <Avatar
            class="flex items-center"
            :image="getRow(itemName, titleField).logo"
            :label="getRow(itemName, titleField).label"
            size="sm"
          />
        </div>
        <div
          v-else-if="
            titleField === 'lead_name' && getRow(itemName, titleField).label
          "
        >
          <Avatar
            class="flex items-center"
            :image="getRow(itemName, titleField).image"
            :label="getRow(itemName, titleField).image_label"
            size="sm"
          />
        </div>
        <div
          v-else-if="
            ['deal_owner', 'lead_owner'].includes(titleField) &&
            getRow(itemName, titleField).full_name
          "
        >
          <Avatar
            class="flex items-center"
            :image="getRow(itemName, titleField).user_image"
            :label="getRow(itemName, titleField).full_name"
            size="sm"
          />
        </div>
        <div v-else-if="titleField === 'mobile_no'">
          <PhoneIcon class="h-4 w-4" />
        </div>
        <div
          v-if="
            [
              'modified',
              'creation',
              'first_response_time',
              'first_responded_on',
              'response_by',
            ].includes(titleField)
          "
          class="truncate text-base"
        >
          <Tooltip :text="getRow(itemName, titleField).label">
            <div>{{ getRow(itemName, titleField).timeAgo }}</div>
          </Tooltip>
        </div>
        <div v-else-if="titleField === 'sla_status'" class="truncate text-base">
          <Badge
            v-if="getRow(itemName, titleField).value"
            :variant="'subtle'"
            :theme="getRow(itemName, titleField).color"
            size="md"
            :label="getRow(itemName, titleField).value"
          />
        </div>
        <div
          v-else-if="getRow(itemName, titleField).label"
          class="truncate text-base"
        >
          {{ getRow(itemName, titleField).label }}
        </div>
        <div v-else class="text-ink-gray-4">{{ __('No Title') }}</div>
      </div>
    </template>

    <template #fields="{ fieldName, itemName }">
      <div
        v-if="getRow(itemName, fieldName).label && fieldName !== 'creation'"
        class="truncate flex items-center gap-2"
      >
        <div v-if="fieldName === 'status'">
          <IndicatorIcon :class="getRow(itemName, fieldName).color" />
        </div>
        <div v-else-if="fieldName === 'organization'">
          <Avatar
            v-if="getRow(itemName, fieldName).label"
            class="flex items-center"
            :image="getRow(itemName, fieldName).logo"
            :label="getRow(itemName, fieldName).label"
            size="xs"
          />
        </div>
        <div v-else-if="fieldName === 'lead_name'">
          <Avatar
            v-if="getRow(itemName, fieldName).label"
            class="flex items-center"
            :image="getRow(itemName, fieldName).image"
            :label="getRow(itemName, fieldName).image_label"
            size="xs"
          />
        </div>
        <div v-else-if="['deal_owner', 'lead_owner'].includes(fieldName)">
          <Avatar
            v-if="getRow(itemName, fieldName).full_name"
            class="flex items-center"
            :image="getRow(itemName, fieldName).user_image"
            :label="getRow(itemName, fieldName).full_name"
            size="xs"
          />
        </div>
        <div
          v-if="
            [
              'modified',
              'creation',
              'first_response_time',
              'first_responded_on',
              'response_by',
            ].includes(fieldName)
          "
          class="truncate text-base"
        >
          <Tooltip :text="getRow(itemName, fieldName).label">
            <div>{{ getRow(itemName, fieldName).timeAgo }}</div>
          </Tooltip>
        </div>
        <div v-else-if="fieldName === 'sla_status'" class="truncate text-base">
          <Badge
            v-if="getRow(itemName, fieldName).value"
            :variant="'subtle'"
            :theme="getRow(itemName, fieldName).color"
            size="md"
            :label="getRow(itemName, fieldName).value"
          />
        </div>
        <div
          v-else-if="fieldName === '_assign'"
          class="flex items-center truncate"
        >
          <MultipleAvatar :avatars="getRow(itemName, fieldName).label" size="xs" />
        </div>
        <div v-else class="truncate text-base">
          {{ fmtMaybeDate(getRow(itemName, fieldName).label) }}
        </div>
      </div>
    </template>

    <template #actions="{ itemName }">
      <div class="flex gap-2 items-center justify-between">
        <!-- единый вид: дата и время создания вместо иконок-счётчиков -->
        <div class="flex items-center gap-1 text-xs text-ink-gray-4">
          <FeatherIcon name="clock" class="h-3.5 w-3.5" />
          <span>{{ getRow(itemName, 'creation').label }}</span>
        </div>
        <Dropdown
          v-if="cardActions"
          class="flex items-center gap-2"
          :options="cardActions(itemName, getRow)"
          variant="ghost"
          @click.stop.prevent
        >
          <!-- NACIFRAH (ux-critique [d_leads] 126): тултип — раньше «+» был без подписи. -->
          <Button icon="plus" variant="ghost" :tooltip="__('Создать задачу или заметку')" />
        </Dropdown>
      </div>
    </template>
  </KanbanView>

  <component
    :is="listComponent"
    v-else-if="listComponent && list.data && rows.length"
    ref="listView"
    v-model="list.data.page_length_count"
    v-model:list="list"
    :rows="rows"
    :columns="columns"
    :options="{
      showTooltip: false,
      resizeColumn: true,
      rowCount: list.data.row_count,
      totalCount: list.data.total_count,
    }"
    @loadMore="() => loadMore++"
    @columnWidthUpdated="() => triggerResize++"
    @updatePageCount="(count) => (updatedPageCount = count)"
    @applyFilter="(data) => viewControls.applyFilter(data)"
    @applyLikeFilter="(data) => viewControls.applyLikeFilter(data)"
    @likeDoc="(data) => viewControls.likeDoc(data)"
    @selectionsChanged="(selections) => viewControls.updateSelections(selections)"
  />
  <EmptyState
    v-else-if="listComponent && list.data && !rows.length"
    :name="emptyName"
    :icon="emptyIcon"
  />
</template>

<script setup>
import MultipleAvatar from '@/components/MultipleAvatar.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import KanbanView from '@/components/Kanban/KanbanView.vue'
import ViewControls from '@/components/ViewControls.vue'
import { getMeta } from '@/stores/meta'
import { usersStore } from '@/stores/users'
import { organizationsStore } from '@/stores/organizations'
import { statusesStore } from '@/stores/statuses'
import { formatDate, timeAgo, website, formatTime } from '@/utils'
import { formatRub, formatPhoneDisplay } from '@/utils/ruFormat'
import { AMOUNT_FIELD } from '@/utils/cardFields'
import { Tooltip, Avatar, Badge, Dropdown, FeatherIcon, Button } from 'frappe-ui'
import { useRoute } from 'vue-router'
import { ref, computed, h } from 'vue'

const props = defineProps({
  doctype: { type: String, required: true },
  filters: { type: Object, default: () => ({}) },
  boardFilters: { type: Object, default: () => ({}) },
  kanbanFields: { type: String, default: '' },
  amountField: { type: String, default: AMOUNT_FIELD },
  allowedViews: { type: Array, default: () => ['list', 'group_by', 'kanban'] },
  defaultColumnField: { type: String, default: '' },
  kanbanColumns: { type: String, default: '' },
  noViewPersist: { type: Boolean, default: false },
  getRoute: { type: Function, required: true },
  onNewClick: { type: Function, default: null },
  moveHandler: { type: Function, default: null },
  listComponent: { type: [Object, Function], default: null },
  emptyName: { type: String, default: '' },
  emptyIcon: { type: [Object, Function], default: null },
  // карточные действия (звонок/заметка/задача); null = не показывать «+»
  cardActions: { type: Function, default: null },
})

// двусторонняя связь с обёрткой: данные доски и экземпляр ViewControls (для хлебных крошек)
const list = defineModel({ type: Object, default: () => ({}) })
const viewControls = defineModel('viewControls', { default: null })
// функц-ref надёжно прокидывает экземпляр ViewControls в модель (для хлебных крошек обёртки)
function setVC(el) {
  viewControls.value = el
}

const listView = ref(null)
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)

const route = useRoute()
const isLead = computed(() => props.doctype === 'CRM Lead')

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } = getMeta(
  props.doctype,
)
const { getUser } = usersStore()
const { getDealStatus, getLeadStatus } = statusesStore()
const { getOrganization } = organizationsStore()

function statusColor(status) {
  return isLead.value ? getLeadStatus(status)?.color : getDealStatus(status)?.color
}

// listView передаёт наружу свои customListActions — обёртка их не использует напрямую,
// но держим ref для совместимости с DealsListView/LeadsListView API.
defineExpose({ list, viewControls, listView, reload: () => list.value?.reload?.() })

function getRow(name, field) {
  function getValue(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value
    return { label: value }
  }
  const r = rows.value?.find((row) => row.name == name)
  return getValue(r ? r[field] : '')
}

// UX-фикс: на карточке канбана конфигурируемое поле-дата иногда показывалось СЫРЫМ
// («2026-06-19 03:13:29.281415» с микросекундами). Если значение похоже на сырой
// datetime/date из БД — форматируем в человекочитаемый вид (дд.мм.гггг чч:мм).
function fmtMaybeDate(val) {
  if (typeof val !== 'string') return val
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(val))
    return formatDate(val, '', true, true)
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return formatDate(val, '', true, false)
  return val
}

const rows = computed(() => {
  if (!list.value?.data?.data) return []
  if (list.value.data.view_type === 'group_by') {
    if (!list.value?.data.group_by_field?.fieldname) return []
    return getGroupedByRows(
      list.value?.data.data,
      list.value?.data.group_by_field,
      list.value.data.columns,
    )
  } else if (list.value.data.view_type === 'kanban') {
    return getKanbanRows(list.value.data.data, list.value.data.fields)
  } else {
    return parseRows(list.value?.data.data, list.value.data.columns)
  }
})

const columns = computed(() => {
  let _columns = list.value?.data?.columns || []
  if (_columns.length) {
    _columns = _columns.map((col, index) => {
      if (index === _columns.length - 1) return { ...col, align: 'right' }
      return col
    })
  }
  return _columns
})

function getGroupedByRows(listRows, groupByField, cols) {
  let groupedRows = []
  groupByField.options?.forEach((option) => {
    let filteredRows
    if (!option) {
      filteredRows = listRows.filter((row) => !row[groupByField.fieldname])
    } else {
      filteredRows = listRows.filter(
        (row) => row[groupByField.fieldname] == option,
      )
    }
    let groupDetail = {
      label: groupByField.label,
      group: option || __(' '),
      collapsed: false,
      rows: parseRows(filteredRows, cols),
    }
    if (groupByField.fieldname == 'status') {
      groupDetail.icon = () => h(IndicatorIcon, { class: statusColor(option) })
    }
    groupedRows.push(groupDetail)
  })
  return groupedRows || listRows
}

function getKanbanRows(data, cols) {
  let _rows = []
  data.forEach((column) => {
    column.data?.forEach((row) => _rows.push(row))
  })
  return parseRows(_rows, cols)
}

function parseRows(rowsArr, cols = []) {
  let view_type = list.value.data.view_type
  let key = view_type === 'kanban' ? 'fieldname' : 'key'
  let type = view_type === 'kanban' ? 'fieldtype' : 'type'

  return rowsArr.map((doc) => {
    let _rows = {}
    ;(list.value.data.rows || []).forEach((row) => {
      _rows[row] = doc[row]

      let fieldType = cols?.find((col) => (col[key] || col.value) == row)?.[type]

      if (fieldType && ['Date', 'Datetime'].includes(fieldType)) {
        _rows[row] = formatDate(doc[row], '', true, fieldType == 'Datetime')
      } else if (['creation', 'modified'].includes(row) && doc[row]) {
        // UX-фикс: creation/modified показывались на карточке СЫРЫМИ
        // («2026-06-19 03:13:29.281415» с микросекундами), т.к. в cols у них нет fieldType.
        // Форматируем явно (всегда Datetime).
        _rows[row] = formatDate(doc[row], '', true, true)
      }
      if (fieldType && fieldType == 'Currency') {
        // сумма — российский формат (разряды пробелами, без копеек, ₽)
        _rows[row] =
          row === 'annual_revenue'
            ? formatRub(doc[row])
            : getFormattedCurrency(row, doc)
      }
      if (fieldType && fieldType == 'Float') _rows[row] = getFormattedFloat(row, doc)
      if (fieldType && fieldType == 'Percent')
        _rows[row] = getFormattedPercent(row, doc)

      if (row == 'lead_name') {
        _rows[row] = {
          label: doc.lead_name,
          image: doc.image,
          image_label: doc.first_name,
        }
      } else if (row == 'organization') {
        _rows[row] = {
          label: doc.organization,
          logo: getOrganization(doc.organization)?.organization_logo,
        }
      } else if (row === 'mobile_no') {
        // телефон — маска +7 (XXX) XXX-XX-XX
        _rows[row] = { label: doc.mobile_no ? formatPhoneDisplay(doc.mobile_no) : '' }
      } else if (row === 'website') {
        _rows[row] = website(doc.website)
      } else if (row == 'status') {
        _rows[row] = { label: doc.status, color: statusColor(doc.status) }
      } else if (row == 'sla_status') {
        let value = doc.sla_status
        let tooltipText = value
        let color =
          doc.sla_status == 'Failed'
            ? 'red'
            : doc.sla_status == 'Fulfilled'
              ? 'green'
              : 'orange'
        if (value == 'First Response Due' || value == 'Rolling Response Due') {
          value = __(timeAgo(doc.response_by))
          tooltipText = formatDate(doc.response_by)
          if (new Date(doc.response_by) < new Date()) color = 'red'
        }
        _rows[row] = { label: tooltipText, value: value, color: color }
      } else if (row == 'deal_owner' || row == 'lead_owner') {
        let owner = doc[row]
        _rows[row] = {
          label: owner && getUser(owner).full_name,
          ...(owner && getUser(owner)),
        }
      } else if (row == '_assign') {
        let assignees = JSON.parse(doc._assign || '[]')
        _rows[row] = assignees.map((user) => ({
          name: user,
          image: getUser(user).user_image,
          label: getUser(user).full_name,
        }))
      } else if (['modified', 'creation'].includes(row)) {
        _rows[row] = {
          label: formatDate(doc[row], '', true, true),
          timeAgo: __(timeAgo(doc[row])),
        }
      } else if (
        ['first_response_time', 'first_responded_on', 'response_by'].includes(row)
      ) {
        let field = row == 'response_by' ? 'response_by' : 'first_responded_on'
        _rows[row] = {
          label: doc[field] ? formatDate(doc[field]) : '',
          timeAgo: doc[row]
            ? row == 'first_response_time'
              ? formatTime(doc[row])
              : __(timeAgo(doc[row]))
            : '',
        }
      }
    })
    _rows['_email_count'] = doc._email_count
    _rows['_note_count'] = doc._note_count
    _rows['_task_count'] = doc._task_count
    _rows['_comment_count'] = doc._comment_count
    return _rows
  })
}

// перенос карточки: воронка задаёт moveHandler (смена этапа), иначе — сохраняем настройку
// вида (как Лиды/Сделки). Операции с колонками воронки не персистим (общий doctype).
function onUpdate(data) {
  if (props.moveHandler) {
    props.moveHandler(data)
  } else {
    viewControls.value?.updateKanbanSettings(data)
  }
}
</script>
