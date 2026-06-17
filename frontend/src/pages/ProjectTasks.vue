<template>
  <div class="flex h-full overflow-hidden">
    <!-- Левая панель: выбор проекта(ов) -->
    <div class="flex w-60 shrink-0 flex-col border-r border-outline-gray-1 bg-surface-gray-1">
      <div
        class="flex h-12 shrink-0 items-center justify-between border-b border-outline-gray-1 px-3"
      >
        <span class="text-base font-semibold text-ink-gray-8">{{ __('Проекты') }}</span>
        <span class="text-xs text-ink-gray-5"
          >{{ selected.length }}/{{ projects.data?.length || 0 }}</span
        >
      </div>
      <div class="flex-1 overflow-y-auto p-2">
        <button
          class="mb-1 flex w-full items-center rounded px-2 py-1.5 text-sm hover:bg-surface-gray-3"
          :class="allSelected ? 'bg-surface-gray-3 font-medium text-ink-gray-9' : 'text-ink-gray-7'"
          @click="selectAll"
        >
          {{ __('Все проекты') }}
        </button>
        <div
          v-for="p in projects.data"
          :key="p.name"
          class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-gray-3"
          :class="selected.includes(p.name) ? 'bg-surface-gray-3' : ''"
        >
          <input
            type="checkbox"
            class="shrink-0 cursor-pointer"
            :checked="selected.includes(p.name)"
            @change.stop="toggle(p.name)"
          />
          <button
            class="flex-1 truncate text-left text-sm text-ink-gray-8"
            :title="p.organization || p.name"
            @click="selectOne(p.name)"
          >
            {{ p.organization || p.name }}
          </button>
        </div>
        <div
          v-if="projects.data && !projects.data.length"
          class="px-2 py-4 text-sm text-ink-gray-5"
        >
          {{ __('Пока нет проектов') }}
        </div>
      </div>
    </div>
    <!-- Правая часть: канбан задач выбранных проектов -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <LayoutHeader>
        <template #left-header>
          <div class="flex items-center gap-3">
            <div class="truncate text-lg font-semibold text-ink-gray-8">{{ boardTitle }}</div>
            <div class="flex rounded-md bg-surface-gray-2 p-0.5 text-sm">
              <button
                class="rounded px-2.5 py-1"
                :class="
                  groupBy === 'stage'
                    ? 'bg-surface-white font-medium text-ink-gray-9 shadow-sm'
                    : 'text-ink-gray-6'
                "
                @click="groupBy = 'stage'"
              >
                {{ __('По этапам') }}
              </button>
              <button
                class="rounded px-2.5 py-1"
                :class="
                  groupBy === 'deadline'
                    ? 'bg-surface-white font-medium text-ink-gray-9 shadow-sm'
                    : 'text-ink-gray-6'
                "
                @click="groupBy = 'deadline'"
              >
                {{ __('По сроку') }}
              </button>
            </div>
          </div>
        </template>
        <template #right-header>
          <CustomActions
            v-if="tasksListView?.customListActions"
            :actions="tasksListView.customListActions"
          />
          <Button
            v-if="selected.length === 1"
            variant="ghost"
            :label="__('История проекта')"
            @click="showHistory = true"
          />
          <Button
            variant="solid"
            :label="__('Create')"
            iconLeft="plus"
            :disabled="!selected.length"
            @click="createTask"
          />
        </template>
      </LayoutHeader>
      <ProjectHistory
        v-if="selected.length === 1"
        v-model="showHistory"
        :project="selected[0]"
      />
      <ViewControls
        :key="selectionKey"
        ref="viewControls"
        v-model="tasks"
        v-model:loadMore="loadMore"
        v-model:resizeColumn="triggerResize"
        v-model:updatedPageCount="updatedPageCount"
        doctype="CRM Task"
        :filters="boardFilters"
        :options="{
          allowedViews: ['list', 'kanban'],
          defaultColumnField: columnField,
          defaultKanbanFields: kanbanFields,
        }"
      />
  <KanbanView
    v-if="$route.params.viewType == 'kanban' && rows.length"
    v-model="tasks"
    :options="{
      onClick: (row) => showTask(row.name),
      onNewClick: (column) => createTask(column),
      cardStyle: cardStyleFor,
    }"
    @update="onKanbanUpdate"
    @loadMore="(columnName) => viewControls.loadMoreKanban(columnName)"
  >
    <template #title="{ titleField, itemName }">
      <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <div v-if="titleField === 'status'">
          <TaskStatusIcon :status="getRow(itemName, titleField).label" />
        </div>
        <div v-else-if="titleField === 'priority'">
          <TaskPriorityIcon :priority="getRow(itemName, titleField).label" />
        </div>
        <div v-else-if="titleField === 'assigned_to'">
          <Avatar
            v-if="getRow(itemName, titleField).full_name"
            class="flex items-center"
            :image="getRow(itemName, titleField).user_image"
            :label="getRow(itemName, titleField).full_name"
            size="sm"
          />
        </div>
        <div
          v-if="['modified', 'creation'].includes(titleField)"
          class="truncate text-base"
        >
          <Tooltip :text="getRow(itemName, titleField).label">
            <div>{{ getRow(itemName, titleField).timeAgo }}</div>
          </Tooltip>
        </div>
        <div
          v-else-if="getRow(itemName, titleField).label"
          class="truncate text-base"
        >
          {{ getRow(itemName, titleField).label }}
        </div>
        <div v-else class="text-ink-gray-4">{{ __('No Title') }}</div>
      </div>
      <div
        v-if="metaFor(itemName).cl_total || metaFor(itemName).comments"
        class="flex items-center gap-3 text-xs text-ink-gray-5"
      >
        <span v-if="metaFor(itemName).cl_total" class="flex items-center gap-1">
          <FeatherIcon name="check-square" class="h-3 w-3" />
          {{ metaFor(itemName).cl_done }}/{{ metaFor(itemName).cl_total }}
        </span>
        <span v-if="metaFor(itemName).comments" class="flex items-center gap-1">
          <FeatherIcon name="message-circle" class="h-3 w-3" />
          {{ metaFor(itemName).comments }}
        </span>
      </div>
      </div>
    </template>
    <template #fields="{ fieldName, itemName }">
      <div v-if="fieldName === 'due_date'" class="inline-flex" @click.stop>
        <input
          type="date"
          :value="dueInputValue(getRow(itemName, fieldName).label)"
          class="cursor-pointer rounded border-0 px-1.5 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-outline-gray-3"
          :style="dueChipStyle(getRow(itemName, fieldName).label)"
          :title="__('Изменить срок')"
          @click.stop
          @change.stop="(e) => updateDue(itemName, e.target.value)"
        />
      </div>
      <div v-else-if="fieldName === 'assigned_to'" @click.stop>
        <Dropdown :options="assigneeOptions(itemName)">
          <button
            class="flex items-center"
            :title="__('Назначить исполнителя')"
            @click.stop.prevent
          >
            <Avatar
              v-if="getRow(itemName, 'assigned_to').full_name"
              :image="getRow(itemName, 'assigned_to').user_image"
              :label="getRow(itemName, 'assigned_to').full_name"
              size="sm"
            />
            <span v-else class="flex items-center text-ink-gray-4">
              <FeatherIcon name="user-plus" class="h-4 w-4" />
            </span>
          </button>
        </Dropdown>
      </div>
      <div
        v-else-if="getRow(itemName, fieldName).label"
        class="truncate flex items-center gap-2"
      >
        <div v-if="fieldName === 'status'">
          <TaskStatusIcon
            class="size-3"
            :status="getRow(itemName, fieldName).label"
          />
        </div>
        <div v-else-if="fieldName === 'priority'" @click.stop>
          <Dropdown :options="priorityOptions(itemName)">
            <button
              class="flex items-center"
              :title="__('Изменить приоритет')"
              @click.stop.prevent
            >
              <TaskPriorityIcon :priority="getRow(itemName, fieldName).label" />
            </button>
          </Dropdown>
        </div>
        <div
          v-if="['modified', 'creation'].includes(fieldName)"
          class="truncate text-base"
        >
          <Tooltip :text="getRow(itemName, fieldName).label">
            <div>{{ getRow(itemName, fieldName).timeAgo }}</div>
          </Tooltip>
        </div>
        <div
          v-else-if="fieldName == 'description'"
          class="truncate text-base max-h-44"
        >
          <TextEditor
            v-if="getRow(itemName, fieldName).label"
            :content="getRow(itemName, fieldName).label"
            :editable="false"
            editor-class="!prose-sm max-w-none focus:outline-none"
            class="flex-1 overflow-hidden"
          />
        </div>
        <div v-else class="truncate text-base">
          {{ getRow(itemName, fieldName).label }}
        </div>
      </div>
    </template>
    <template #actions="{ itemName }">
      <div class="flex gap-2 items-center justify-between">
        <div>
          <Button
            v-if="getRow(itemName, 'reference_docname').label"
            class="-ml-2"
            variant="ghost"
            size="sm"
            :label="
              getRow(itemName, 'reference_doctype').label == 'CRM Deal'
                ? __('Deal')
                : __('Lead')
            "
            :iconRight="ArrowUpRightIcon"
            @click.stop="
              redirect(
                getRow(itemName, 'reference_doctype').label,
                getRow(itemName, 'reference_docname').label,
              )
            "
          />
        </div>
        <Dropdown
          class="flex items-center gap-2"
          :options="actions(itemName)"
          variant="ghost"
          @click.stop.prevent
        >
          <Button icon="more-horizontal" variant="ghost" />
        </Dropdown>
      </div>
    </template>
  </KanbanView>
  <TasksListView
    v-else-if="tasks.data && rows.length"
    ref="tasksListView"
    v-model="tasks.data.page_length_count"
    v-model:list="tasks"
    :rows="rows"
    :columns="columns"
    :options="{
      showTooltip: false,
      resizeColumn: true,
      rowCount: tasks.data.row_count,
      totalCount: tasks.data.total_count,
    }"
    @loadMore="() => loadMore++"
    @columnWidthUpdated="() => triggerResize++"
    @updatePageCount="(count) => (updatedPageCount = count)"
    @showTask="showTask"
    @applyFilter="(data) => viewControls.applyFilter(data)"
    @applyLikeFilter="(data) => viewControls.applyLikeFilter(data)"
    @likeDoc="(data) => viewControls.likeDoc(data)"
    @selectionsChanged="
      (selections) => viewControls.updateSelections(selections)
    "
  />
      <EmptyState
        v-else-if="tasks.data && !rows.length"
        name="Tasks"
        :icon="Email2Icon"
      />
    </div>
  </div>
</template>

<script setup>
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import CustomActions from '@/components/CustomActions.vue'
import ArrowUpRightIcon from '@/components/Icons/ArrowUpRightIcon.vue'
import TaskStatusIcon from '@/components/Icons/TaskStatusIcon.vue'
import TaskPriorityIcon from '@/components/Icons/TaskPriorityIcon.vue'
import Email2Icon from '@/components/Icons/Email2Icon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import ViewControls from '@/components/ViewControls.vue'
import TasksListView from '@/components/ListViews/TasksListView.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import KanbanView from '@/components/Kanban/KanbanView.vue'
import ProjectHistory from '@/components/ProjectHistory.vue'
import { useDoctypeModal } from '@/composables/doctypeModal'
import { getMeta } from '@/stores/meta'
import { usersStore } from '@/stores/users'
import { formatDate, timeAgo } from '@/utils'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import {
  Tooltip,
  Avatar,
  TextEditor,
  Dropdown,
  FeatherIcon,
  call,
  createResource,
  toast,
} from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta('CRM Task')
const { getUser, crmUsers } = usersStore()
const { updateOnboardingStep } = useOnboarding('frappecrm')
const { capture } = useTelemetry()

const router = useRouter()
const route = useRoute()

// --- Выбор проекта(ов) для доски задач (один / несколько / все) ---
const projects = createResource({
  url: 'frappe.client.get_list',
  params: {
    doctype: 'CRM Deal',
    filters: { nacifrah_is_project: 1 },
    fields: ['name', 'organization'],
    order_by: 'modified desc',
    limit_page_length: 0,
  },
  auto: true,
  onSuccess(data) {
    if (initialized.value) return
    initialized.value = true
    const routeId = route.params.projectId
    if (routeId) selected.value = [routeId]
    else selected.value = (data || []).map((p) => p.name)
  },
})

const selected = ref([])
const initialized = ref(false)
const showHistory = ref(false)

const allSelected = computed(
  () =>
    projects.data &&
    projects.data.length > 0 &&
    selected.value.length === projects.data.length,
)
function selectAll() {
  selected.value = (projects.data || []).map((p) => p.name)
}
function selectOne(name) {
  selected.value = [name]
}
function toggle(name) {
  const i = selected.value.indexOf(name)
  if (i >= 0) selected.value.splice(i, 1)
  else selected.value.push(name)
}
const boardFilters = computed(() => {
  const sel = selected.value
  return {
    reference_doctype: 'CRM Deal',
    reference_docname:
      sel.length === 1 ? sel[0] : ['in', sel.length ? sel : ['__nonesuch__']],
  }
})
// Представление доски: по этапам (nacifrah_stage) или по сроку (nacifrah_deadline_bucket)
const groupBy = ref('stage')
const columnField = computed(() =>
  groupBy.value === 'deadline' ? 'nacifrah_deadline_bucket' : 'nacifrah_stage',
)
const selectionKey = computed(
  () => (selected.value.slice().sort().join('|') || 'none') + ':' + groupBy.value,
)

// Карточка на борде: показываем приоритет, исполнителя и дедлайн-чип
const kanbanFields = JSON.stringify(['priority', 'assigned_to', 'due_date'])

function dueChipStyle(s) {
  const gray = { backgroundColor: '#f1f5f9', color: '#475569' }
  if (!s) return gray
  const d = new Date(String(s).replace(' ', 'T'))
  if (isNaN(d)) return gray
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dd = new Date(d)
  dd.setHours(0, 0, 0, 0)
  if (dd < today) return { backgroundColor: '#fee2e2', color: '#b91c1c' }
  if (dd.getTime() === today.getTime()) return { backgroundColor: '#ffedd5', color: '#c2410c' }
  return gray
}
function formatDueDate(s) {
  if (!s) return ''
  const d = new Date(String(s).replace(' ', 'T'))
  if (isNaN(d)) return s
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}
// YYYY-MM-DD для нативного <input type="date">
function dueInputValue(s) {
  if (!s) return ''
  const str = String(s)
  return str.length >= 10 ? str.slice(0, 10) : ''
}
// Изменение дедлайна прямо с карточки (без открытия задачи)
async function updateDue(task, val) {
  try {
    await call('frappe.client.set_value', {
      doctype: 'CRM Task',
      name: task,
      fieldname: 'due_date',
      value: val || null,
    })
    tasks.value.reload()
    cardMetaResource.reload()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось изменить срок'))
  }
}

// Смена приоритета прямо с карточки (карточка перекрашивается)
const PRIORITY_LABELS = { High: 'Высокий', Medium: 'Средний', Low: 'Низкий' }
function priorityOptions(task) {
  return ['High', 'Medium', 'Low'].map((p) => ({
    label: PRIORITY_LABELS[p],
    onClick: () => updatePriority(task, p),
  }))
}
async function updatePriority(task, val) {
  try {
    await call('frappe.client.set_value', {
      doctype: 'CRM Task',
      name: task,
      fieldname: 'priority',
      value: val,
    })
    tasks.value.reload()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось изменить приоритет'))
  }
}

// Назначение/смена исполнителя прямо с карточки
function assigneeOptions(task) {
  const opts = (crmUsers.value || []).map((u) => ({
    label: u.full_name || u.name,
    onClick: () => updateAssignee(task, u.name),
  }))
  opts.push({ label: __('Снять исполнителя'), onClick: () => updateAssignee(task, '') })
  return opts
}
async function updateAssignee(task, email) {
  try {
    await call('frappe.client.set_value', {
      doctype: 'CRM Task',
      name: task,
      fieldname: 'assigned_to',
      value: email || null,
    })
    tasks.value.reload()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось назначить исполнителя'))
  }
}
const boardTitle = computed(() => {
  if (allSelected.value) return __('Все проекты')
  if (selected.value.length === 1) {
    const p = projects.data?.find((x) => x.name === selected.value[0])
    return (p && (p.organization || p.name)) || __('Проект')
  }
  return __('Выбрано проектов: {0}', [selected.value.length])
})

const tasksListView = ref(null)

// tasks data is loaded in the ViewControls component
const tasks = ref({})
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const viewControls = ref(null)

function getRow(name, field) {
  function getValue(value) {
    if (value && typeof value === 'object') {
      return value
    }
    return { label: value }
  }
  return getValue(rows.value?.find((row) => row.name == name)[field])
}

const rows = computed(() => {
  if (!tasks.value?.data?.data) return []

  if (tasks.value.data.view_type === 'kanban') {
    return getKanbanRows(tasks.value.data.data, tasks.value.data.fields)
  }

  openTaskFromURL()
  return parseRows(tasks.value?.data.data, tasks.value?.data.columns)
})

const columns = computed(() => {
  let _columns = tasks.value?.data?.columns || []

  // Set align right for last column
  if (_columns.length) {
    _columns = _columns.map((col, index) => {
      if (index === _columns.length - 1) {
        return { ...col, align: 'right' }
      }
      return col
    })
  }

  return _columns
})

function getKanbanRows(data, columns) {
  let _rows = []
  data.forEach((column) => {
    column.data?.forEach((row) => {
      _rows.push(row)
    })
  })
  return parseRows(_rows, columns)
}

function parseRows(rows, columns = []) {
  let view_type = tasks.value.data.view_type
  let key = view_type === 'kanban' ? 'fieldname' : 'key'
  let type = view_type === 'kanban' ? 'fieldtype' : 'type'

  return rows.map((task) => {
    let _rows = {}
    tasks.value?.data.rows.forEach((row) => {
      _rows[row] = task[row]

      let fieldType = columns?.find((col) => (col[key] || col.value) == row)?.[
        type
      ]

      if (
        fieldType &&
        ['Date', 'Datetime'].includes(fieldType) &&
        !['modified', 'creation', 'due_date'].includes(row)
      ) {
        _rows[row] = formatDate(task[row], '', true, fieldType == 'Datetime')
      }

      if (fieldType && fieldType == 'Currency') {
        _rows[row] = getFormattedCurrency(row, task)
      }

      if (fieldType && fieldType == 'Float') {
        _rows[row] = getFormattedFloat(row, task)
      }

      if (fieldType && fieldType == 'Percent') {
        _rows[row] = getFormattedPercent(row, task)
      }

      if (['modified', 'creation'].includes(row)) {
        _rows[row] = {
          label: formatDate(task[row]),
          timeAgo: __(timeAgo(task[row])),
        }
      } else if (row == 'assigned_to') {
        _rows[row] = {
          label: task.assigned_to && getUser(task.assigned_to).full_name,
          ...(task.assigned_to && getUser(task.assigned_to)),
        }
      }
    })
    return _rows
  })
}

// Бейджи карточки: чек-лист x/y + счётчик комментариев (одним запросом на видимые задачи)
const cardMeta = ref({})
const taskNames = computed(() => (rows.value || []).map((r) => r.name).filter(Boolean))
const cardMetaResource = createResource({
  url: 'nacifrah.tasks_api.get_task_card_meta',
  makeParams: () => ({ tasks: JSON.stringify(taskNames.value) }),
  onSuccess(data) {
    cardMeta.value = data || {}
  },
})
watch(
  taskNames,
  (names) => {
    if (names && names.length) cardMetaResource.reload()
  },
  { immediate: true },
)
function metaFor(name) {
  return cardMeta.value[String(name)] || {}
}

// Цвет карточки по приоритету: левая полоса (High=красный, Medium=янтарный, Low=синий)
const PRIORITY_COLORS = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#3b82f6',
}
function cardStyleFor(fields) {
  const c = PRIORITY_COLORS[fields?.priority]
  return c ? { borderLeftWidth: '4px', borderLeftColor: c } : {}
}

async function onKanbanUpdate(data) {
  // В виде «по сроку» перетаскивание карточки меняет дедлайн (корзина — производная)
  if (groupBy.value === 'deadline' && data?.item && data?.to) {
    try {
      await call('nacifrah.tasks_api.set_task_due_for_bucket', {
        task: data.item,
        bucket: data.to,
      })
      tasks.value.reload()
      cardMetaResource.reload()
    } catch (e) {
      toast.error(e?.messages?.[0] || __('Не удалось перенести задачу'))
    }
    return
  }
  viewControls.value?.updateKanbanSettings(data)
}

const { showModal } = useDoctypeModal()

const taskCallbacks = {
  afterInsert: () => {
    tasks.value.reload()
    updateOnboardingStep('create_first_task')
    capture('task_created')
  },
  afterUpdate: () => {
    tasks.value.reload()
    capture('task_updated')
  },
}

function showTask(name) {
  showModal({
    name,
    doctype: 'CRM Task',
    title: 'Task',
    callbacks: taskCallbacks,
  })
}

function createTask(column) {
  const defaults = {
    status: 'Backlog',
    priority: 'Low',
    reference_doctype: 'CRM Deal',
    reference_docname: route.params.projectId || selected.value[0],
  }

  if (column?.column?.name) {
    let column_field = tasks.value.params.column_field
    if (column_field) {
      defaults[column_field] = column.column.name
    }
  }

  showModal({
    doctype: 'CRM Task',
    title: 'Task',
    defaults: defaults,
    callbacks: taskCallbacks,
  })
}

function actions(name) {
  return [
    {
      label: __('Delete'),
      icon: 'trash-2',
      onClick: () => {
        deleteTask(name)
        tasks.value.reload()
      },
    },
  ]
}

async function deleteTask(name) {
  await call('frappe.client.delete', {
    doctype: 'CRM Task',
    name,
  })
}

function redirect(doctype, docname) {
  if (!docname) return
  let name = doctype == 'CRM Deal' ? 'Deal' : 'Lead'
  let params = { leadId: docname }
  if (name == 'Deal') {
    params = { dealId: docname }
  }
  router.push({ name: name, params: params })
}

const openTaskFromURL = () => {
  const searchParams = new URLSearchParams(window.location.search)
  const taskName = searchParams.get('open')

  if (taskName && rows.value?.length) {
    showTask(parseInt(taskName))
    searchParams.delete('open')
    window.history.replaceState(null, '', window.location.pathname)
  }
}
</script>
