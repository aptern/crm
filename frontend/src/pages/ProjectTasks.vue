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
          class="group/proj flex items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-gray-3"
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
            :title="projDisplay(p)"
            @click="selectOne(p.name)"
          >
            {{ projDisplay(p) }}
          </button>
          <button
            v-if="isManager()"
            class="hidden shrink-0 text-ink-gray-4 hover:text-ink-gray-7 group-hover/proj:block"
            :title="__('Переименовать проект')"
            @click.stop="openRename(p)"
          >
            <FeatherIcon name="edit-2" class="h-3.5 w-3.5" />
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
            v-if="groupBy === 'stage' && $route.params.viewType === 'kanban' && isManager()"
            variant="ghost"
            :label="__('Добавить этап')"
            iconLeft="plus"
            @click="openStageDialog"
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
          kanbanColumns: projectKanbanColumns,
        }"
      />
  <KanbanView
    v-if="$route.params.viewType == 'kanban' && rows.length"
    v-model="tasks"
    :options="{
      doctype: 'CRM Task',
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
      <!-- Чек-лист на борде (B6): счётчик + раскрытие пунктов по клику. Значок комментариев убран (B7). -->
      <div
        v-if="metaFor(itemName).cl_total"
        class="text-xs text-ink-gray-5"
        @click.stop
      >
        <button
          class="flex items-center gap-1 rounded px-1 -mx-1 hover:bg-surface-gray-2"
          :title="__('Показать чек-лист')"
          @click.stop="toggleChecklist(itemName)"
        >
          <FeatherIcon name="check-square" class="h-3 w-3" />
          {{ metaFor(itemName).cl_done }}/{{ metaFor(itemName).cl_total }}
          <FeatherIcon
            :name="openChecklists.has(itemName) ? 'chevron-up' : 'chevron-down'"
            class="h-3 w-3"
          />
        </button>
        <div
          v-if="openChecklists.has(itemName)"
          class="mt-1 flex flex-col gap-0.5"
        >
          <div
            v-if="!checklistItems(itemName).length"
            class="text-ink-gray-4 px-1"
          >…</div>
          <label
            v-for="it in checklistItems(itemName)"
            :key="it.name"
            class="flex items-start gap-1.5 cursor-pointer hover:bg-surface-gray-2 rounded px-1 -mx-1 py-0.5"
            @click.stop
          >
            <input
              type="checkbox"
              class="mt-0.5 shrink-0 cursor-pointer"
              :checked="!!it.is_done"
              @change.stop="toggleChecklistItem(itemName, it)"
            />
            <span
              class="leading-snug"
              :class="it.is_done ? 'line-through text-ink-gray-4' : 'text-ink-gray-7'"
            >{{ it.item }}</span>
          </label>
        </div>
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
              <span
                class="rounded px-1.5 py-0.5 text-xs font-medium leading-none"
                :style="priorityChipStyle(getRow(itemName, fieldName).label)"
              >{{ priorityLabel(getRow(itemName, fieldName).label) }}</span>
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
        <!-- status/priority уже отрисованы выше (иконка/чип) — не дублируем сырым значением. -->
        <div
          v-else-if="!['status', 'priority'].includes(fieldName)"
          class="truncate text-base"
        >
          {{ getRow(itemName, fieldName).label }}
        </div>
      </div>
    </template>
    <!-- Ссылка на сделку убрана с борта (B5) — она доступна внутри задачи. На борде только меню «…». -->
    <template #actions="{ itemName }">
      <div class="flex items-center justify-end">
        <Dropdown
          class="flex items-center"
          :options="actions(itemName)"
          variant="ghost"
          @click.stop.prevent
        >
          <Button icon="more-horizontal" variant="ghost" size="sm" />
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

  <!-- B19: диалог «Добавить этап» (этот проект / все проекты) -->
  <Dialog v-model="stageDialog" :options="{ title: __('Добавить этап') }">
    <template #body-content>
      <div class="flex flex-col gap-3">
        <FormControl
          :label="__('Название этапа')"
          v-model="stageForm.label"
          :placeholder="__('Например, Согласование макета')"
        />
        <div>
          <div class="mb-1 text-sm text-ink-gray-7">{{ __('Цвет') }}</div>
          <Popover>
            <template #target="{ togglePopover }">
              <button
                class="flex items-center gap-2 rounded border border-outline-gray-2 px-2 py-1.5 text-sm"
                @click="togglePopover"
              >
                <span class="h-3.5 w-3.5 rounded-full" :class="`bg-${stageForm.color}-500`" />
                {{ stageForm.color }}
              </button>
            </template>
            <template #body="{ togglePopover }">
              <div class="grid grid-cols-6 gap-1 rounded-lg bg-surface-modal p-2 shadow-xl ring-1 ring-black ring-opacity-5">
                <button
                  v-for="c in STAGE_PALETTE"
                  :key="c"
                  class="flex h-6 w-6 items-center justify-center rounded hover:bg-surface-gray-2"
                  @click="(stageForm.color = c, togglePopover())"
                >
                  <span class="h-3.5 w-3.5 rounded-full" :class="`bg-${c}-500`" />
                </button>
              </div>
            </template>
          </Popover>
        </div>
        <div>
          <div class="mb-1 text-sm text-ink-gray-7">{{ __('Куда добавить') }}</div>
          <div class="flex flex-col gap-1.5">
            <label v-if="singleProject" class="flex items-center gap-2 text-sm">
              <input type="radio" value="project" v-model="stageForm.scope" />
              {{ __('Только в этот проект') }}
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input type="radio" value="all" v-model="stageForm.scope" />
              {{ __('Во все проекты') }}
            </label>
          </div>
          <p v-if="!singleProject" class="mt-1 text-xs text-ink-gray-4">
            {{ __('Выберите один проект слева, чтобы добавить этап только в него.') }}
          </p>
        </div>
        <ErrorMessage v-if="stageErr" :message="stageErr" />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <Button :label="__('Отмена')" @click="stageDialog = false" />
        <Button variant="solid" :label="__('Добавить')" :loading="stageSaving" @click="saveStage" />
      </div>
    </template>
  </Dialog>

  <!-- I16: переименование проекта -->
  <Dialog v-model="renameDialog" :options="{ title: __('Переименовать проект') }">
    <template #body-content>
      <div class="flex flex-col gap-2">
        <FormControl
          :label="__('Название проекта')"
          v-model="renameVal"
          :placeholder="renameTarget?.organization || __('Например, ООО Ромашка')"
          @keydown.enter="saveRename"
        />
        <p class="text-xs text-ink-gray-4">
          {{ __('Пусто → показывается организация сделки.') }}
        </p>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <Button :label="__('Отмена')" @click="renameDialog = false" />
        <Button variant="solid" :label="__('Сохранить')" :loading="renameSaving" @click="saveRename" />
      </div>
    </template>
  </Dialog>
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
  Dialog,
  FormControl,
  ErrorMessage,
  Popover,
  call,
  createResource,
  toast,
} from 'frappe-ui'
import { computed, ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta('CRM Task')
const { getUser, crmUsers, isManager } = usersStore()
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
    fields: ['name', 'organization', 'nacifrah_project_name'],
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
const boardNonce = ref(0)
const selectionKey = computed(
  () =>
    (selected.value.slice().sort().join('|') || 'none') +
    ':' +
    groupBy.value +
    ':' +
    boardNonce.value,
)

// B19: пер-проектные этапы (колонки). Карта всех колонок (глобальные + пер-проектные)
// грузится один раз; для одиночного проекта показываем глобальные + его кастомные,
// чужие пер-проектные скрыты. Передаём явный kanban_columns в ViewControls (опционально).
const allStageColumns = ref([])
async function loadStageColumns() {
  try {
    allStageColumns.value = (await call('nacifrah.project_columns.get_stage_columns')) || []
  } catch (e) {
    allStageColumns.value = []
  }
}
onMounted(loadStageColumns)
const projectKanbanColumns = computed(() => {
  if (groupBy.value !== 'stage') return ''
  const cols = allStageColumns.value
  if (!cols.length) return ''
  const single = selected.value.length === 1 ? selected.value[0] : null
  const filtered = cols.filter((c) => !c.owner || (single ? c.owner === single : true))
  return JSON.stringify(
    filtered.map((c) => (c.color ? { name: c.name, color: c.color } : { name: c.name })),
  )
})

// Диалог «Добавить этап» (со scope: этот проект / все)
const STAGE_PALETTE = [
  'gray', 'blue', 'green', 'orange', 'red', 'purple',
  'pink', 'teal', 'cyan', 'yellow', 'violet', 'amber',
]
const stageDialog = ref(false)
const stageForm = ref({ label: '', color: 'blue', scope: 'project' })
const stageErr = ref('')
const stageSaving = ref(false)
const singleProject = computed(() => (selected.value.length === 1 ? selected.value[0] : null))
function openStageDialog() {
  stageErr.value = ''
  stageForm.value = { label: '', color: 'blue', scope: singleProject.value ? 'project' : 'all' }
  stageDialog.value = true
}
async function saveStage() {
  stageErr.value = ''
  const label = (stageForm.value.label || '').trim()
  if (!label) {
    stageErr.value = __('Введите название этапа')
    return
  }
  const scope = stageForm.value.scope === 'project' && singleProject.value ? 'project' : 'all'
  stageSaving.value = true
  try {
    await call('nacifrah.project_columns.add_project_stage', {
      project: singleProject.value || '',
      label,
      color: stageForm.value.color,
      scope,
    })
    stageDialog.value = false
    await loadStageColumns()
    boardNonce.value++ // форс-ремаунт ViewControls → новые kanban_columns
    toast.success(__('Этап добавлен'))
  } catch (e) {
    stageErr.value = e?.messages?.[0] || __('Не удалось добавить этап')
  } finally {
    stageSaving.value = false
  }
}

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

// Приоритет (I18, переделка B2): 4 уровня. Значения по-английски (Low/Medium/High/Urgent
// — совместимость с Frappe/SLA), русские подписи — на отображении. Срочность теперь
// отражает ДЕДЛАЙН (левая полоса), а это — именно ПРИОРИТЕТ важности.
const PRIORITY_LABELS = {
  Urgent: 'Критичный',
  High: 'Высокий',
  Medium: 'Средний',
  Low: 'Низкий',
}
// Цвета чипа приоритета: критичный — красный, высокий — бледно-красный, средний — зелёный, низкий — серый.
const PRIORITY_CHIP = {
  Urgent: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  High: { backgroundColor: '#fef2f2', color: '#ef4444' },
  Medium: { backgroundColor: '#dcfce7', color: '#15803d' },
  Low: { backgroundColor: '#f1f5f9', color: '#64748b' },
}
const PRIORITY_ORDER = ['Urgent', 'High', 'Medium', 'Low']
function priorityLabel(p) {
  return PRIORITY_LABELS[p] || p || __('Низкий')
}
function priorityChipStyle(p) {
  return PRIORITY_CHIP[p] || PRIORITY_CHIP.Low
}
function priorityOptions(task) {
  return PRIORITY_ORDER.map((p) => ({
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
// I16: имя проекта = заданное имя → организация → имя сделки (последнее лишь fallback).
function projDisplay(p) {
  return (p && (p.nacifrah_project_name || p.organization || p.name)) || __('Проект')
}
const boardTitle = computed(() => {
  if (allSelected.value) return __('Все проекты')
  if (selected.value.length === 1) {
    const p = projects.data?.find((x) => x.name === selected.value[0])
    return projDisplay(p)
  }
  return __('Выбрано проектов: {0}', [selected.value.length])
})

// I16: переименование проекта (карандаш) — хранится в nacifrah_project_name на сделке.
const renameDialog = ref(false)
const renameTarget = ref(null)
const renameVal = ref('')
const renameSaving = ref(false)
function openRename(p) {
  renameTarget.value = p
  renameVal.value = p.nacifrah_project_name || ''
  renameDialog.value = true
}
async function saveRename() {
  if (!renameTarget.value) return
  renameSaving.value = true
  try {
    await call('nacifrah.api.rename_project', {
      deal: renameTarget.value.name,
      name: renameVal.value || '',
    })
    renameDialog.value = false
    await projects.reload()
    toast.success(__('Проект переименован'))
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось переименовать'))
  } finally {
    renameSaving.value = false
  }
}

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

// --- Чек-лист на борде (B6): раскрытие, ленивая загрузка пунктов, переключение галочки ---
const openChecklists = ref(new Set())
const checklistData = ref({})
function checklistItems(name) {
  return checklistData.value[String(name)] || []
}
async function loadChecklist(name) {
  try {
    const data = await call('nacifrah.tasks_api.get_task_checklist', { task: name })
    checklistData.value = { ...checklistData.value, [String(name)]: data || [] }
  } catch (e) {
    checklistData.value = { ...checklistData.value, [String(name)]: [] }
  }
}
function toggleChecklist(name) {
  const s = new Set(openChecklists.value)
  const key = String(name)
  if (s.has(key)) {
    s.delete(key)
  } else {
    s.add(key)
    if (!checklistData.value[key]) loadChecklist(name)
  }
  openChecklists.value = s
}
async function toggleChecklistItem(name, it) {
  const next = it.is_done ? 0 : 1
  it.is_done = next // оптимистично
  try {
    await call('nacifrah.tasks_api.toggle_checklist_item', {
      item_name: it.name,
      is_done: next,
    })
    cardMetaResource.reload() // обновить счётчик x/y
  } catch (e) {
    it.is_done = next ? 0 : 1 // откат
    toast.error(e?.messages?.[0] || __('Не удалось изменить пункт'))
  }
}

// I19: левая полоса карточки — по ДЕДЛАЙНУ (просрочено=красный, сегодня=жёлтый,
// завтра/эта неделя=зелёный, дальше/нет срока=серый).
function getDeadlineColor(s) {
  const GRAY = '#94a3b8'
  if (!s) return GRAY
  const d = new Date(String(s).replace(' ', 'T'))
  if (isNaN(d)) return GRAY
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dd = new Date(d)
  dd.setHours(0, 0, 0, 0)
  const diffDays = Math.round((dd - today) / 86400000)
  if (diffDays < 0) return '#dc2626' // просрочено — красный
  if (diffDays === 0) return '#f59e0b' // сегодня — жёлтый
  // конец текущей недели (воскресенье)
  const endWeek = new Date(today)
  endWeek.setDate(today.getDate() + ((7 - today.getDay()) % 7))
  if (diffDays === 1 || dd <= endWeek) return '#16a34a' // завтра / эта неделя — зелёный
  return GRAY // дальше — серый
}
// I19: лёгкий ФОН карточки — по ПРИОРИТЕТУ, только Критичный/Высокий (остальные белые).
const PRIORITY_BG = {
  Urgent: '#fef2f2', // лёгкий красный
  High: '#fff7ed', // лёгкий оранжевый
}
function cardStyleFor(fields) {
  const style = {
    borderLeftWidth: '4px',
    borderLeftColor: getDeadlineColor(fields?.due_date),
  }
  const bg = PRIORITY_BG[fields?.priority]
  if (bg) style.backgroundColor = bg
  return style
}

async function onKanbanUpdate(data) {
  // Вид «по сроку»: корзины производные и read-only. Перетаскивание карточки меняет
  // дедлайн; любые операции с колонками НЕ сохраняем (иначе перезатрём этапный вид).
  if (groupBy.value === 'deadline') {
    if (data?.item && data?.to) {
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

// Дедлайн по умолчанию (B9): сегодня + 2 рабочих дня (выходные пропускаем).
function defaultDueDate() {
  const d = new Date()
  let added = 0
  while (added < 2) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay() // 0=вс, 6=сб
    if (day !== 0 && day !== 6) added++
  }
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 00:00:00`
}

function createTask(column) {
  const defaults = {
    status: 'Backlog',
    priority: 'Medium',
    due_date: defaultDueDate(),
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
