<template>
  <div class="flex flex-col h-full">
    <!-- E5 (Bitrix24): фильтр «В работе» прячет ключевые (финальные) этапы -->
    <div v-if="hasFinalStages" class="flex items-center gap-2 px-3 pt-2.5">
      <Button
        :variant="hideFinalStages ? 'solid' : 'subtle'"
        size="sm"
        :label="__('В работе')"
        :tooltip="__('Скрыть ключевые (финальные) этапы')"
        @click="hideFinalStages = !hideFinalStages"
      />
      <span class="text-xs text-ink-gray-5">
        {{ hideFinalStages ? __('Финальные этапы скрыты') : __('Показаны все этапы') }}
      </span>
    </div>
    <!-- E5(2) (Bitrix24): drag-зона снизу — бросить карточку на финальный этап (Выиграна/Проиграна).
         Появляется только во время перетаскивания; зоны — обычные drop-таргеты group="fields"
         с data-column = имя финального этапа, статус ставится тем же путём updateColumn. -->
    <div
      v-if="dragging && finalStageColumns.length"
      class="fixed bottom-0 right-0 z-50 flex justify-center gap-3 border-t border-outline-gray-2 bg-surface-white/95 px-3 py-2.5 shadow-lg"
      :style="{ left: dragZoneLeft }"
    >
      <Draggable
        v-for="z in finalStageColumns"
        :key="z.name"
        :list="zoneBucket"
        group="fields"
        item-key="name"
        :data-column="z.name"
        class="flex min-w-48 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed text-sm font-semibold transition-all duration-200 ease-out"
        :class="[
          z.kind === 'key_positive'
            ? 'border-green-400 bg-green-50 text-green-700'
            : 'border-red-400 bg-red-50 text-red-700',
          hoveredZone === z.name ? 'h-14 shadow-md' : 'h-12',
        ]"
        @mouseenter="hoveredZone = z.name"
        @mouseleave="hoveredZone = null"
      >
        <template #header>
          <div class="pointer-events-none flex items-center gap-1.5">
            <FeatherIcon
              :name="z.kind === 'key_positive' ? 'check-circle' : 'x-circle'"
              class="h-4 w-4"
            />
            {{ z.name }}
          </div>
        </template>
        <template #item="{ element }">
          <span :key="element.name" class="hidden" />
        </template>
      </Draggable>
    </div>
    <div class="flex overflow-x-auto h-full">
    <Draggable
      v-if="columns"
      :list="columns"
      item-key="column"
      :delay="isTouchScreenDevice() ? 200 : 0"
      class="flex sm:mx-2.5 mx-2 pb-3.5"
      @end="updateColumn"
    >
      <template #item="{ element: column }">
        <div
          v-if="!column.column.delete && !(hideFinalStages && isFinalStage(column))"
          class="flex flex-col gap-2.5 min-w-64 w-64 hover:bg-surface-gray-2 rounded-lg p-2.5"
        >
          <div class="flex gap-2 items-center group justify-between">
            <div class="flex items-center text-base">
              <Popover>
                <template #target="{ togglePopover }">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="hover:!bg-surface-gray-2"
                    @click="togglePopover"
                  >
                    <IndicatorIcon :class="parseColor(column.column.color)" />
                  </Button>
                </template>
                <template #body>
                  <div
                    class="flex flex-col gap-3 px-3 py-2.5 min-w-40 rounded-lg bg-surface-modal shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none"
                  >
                    <!-- G8: палитра сеткой квадратов (а не широкой полосой) -->
                    <div class="grid grid-cols-5 gap-1.5">
                      <button
                        v-for="color in colors"
                        :key="color"
                        type="button"
                        class="grid size-6 place-items-center rounded hover:bg-surface-gray-3"
                        @click="() => (column.column.color = color)"
                      >
                        <IndicatorIcon :class="parseColor(color)" />
                      </button>
                    </div>
                    <div class="flex flex-row-reverse">
                      <Button
                        variant="solid"
                        :label="__('Apply')"
                        @click="updateColumn"
                      />
                    </div>
                  </div>
                </template>
              </Popover>
              <!-- B17: название этапа — цветная пилюля по цвету колонки -->
              <div
                class="rounded px-2 py-0.5 text-sm font-medium"
                :class="stagePillClass(column.column.color)"
              >
                {{ column.column.name }}
              </div>
              <!-- E5: метка ключевого (финального) этапа -->
              <span
                v-if="stageKind(column) !== 'normal'"
                class="ml-1 grid size-4 place-items-center rounded-full text-[10px] font-bold leading-none"
                :class="stageKind(column) === 'key_positive' ? '!bg-green-100 !text-green-700' : '!bg-red-100 !text-red-700'"
                :title="stageKind(column) === 'key_positive' ? __('Ключевой положительный (финал)') : __('Ключевой отрицательный (финал)')"
              >
                {{ stageKind(column) === 'key_positive' ? '✓' : '✕' }}
              </span>
            </div>
            <div class="flex">
              <Dropdown :options="actions(column)">
                <template #default>
                  <Button
                    class="hidden group-hover:flex"
                    icon="more-horizontal"
                    variant="ghost"
                  />
                </template>
              </Dropdown>
              <Button
                icon="plus"
                variant="ghost"
                @click="options.onNewClick(column)"
              />
            </div>
          </div>
          <!-- I25 (как Bitrix): сумма всех сделок этапа -->
          <div
            v-if="amountField && stageSums[column.column.name] !== undefined"
            class="rounded bg-surface-gray-3 px-2 py-1 text-center text-sm font-semibold text-ink-gray-7"
          >
            {{ formatRub(stageSums[column.column.name] || 0) }}
          </div>
          <div class="overflow-y-auto flex flex-col gap-2 h-full">
            <Draggable
              :list="column.data"
              group="fields"
              item-key="name"
              class="flex flex-col gap-2 flex-1"
              :delay="isTouchScreenDevice() ? 200 : 0"
              :data-column="column.column.name"
              @start="onCardDragStart"
              @end="onCardDragEnd"
            >
              <template #item="{ element: fields }">
                <component
                  :is="options.getRoute ? 'router-link' : 'div'"
                  class="pt-2 px-3 pb-1.5 rounded-lg border bg-surface-white text-base flex flex-col text-ink-gray-9"
                  :data-name="fields.name"
                  :style="options.cardStyle ? options.cardStyle(fields) : undefined"
                  v-bind="{
                    to: options.getRoute ? options.getRoute(fields) : undefined,
                    onClick: options.onClick
                      ? () => options.onClick(fields)
                      : undefined,
                  }"
                >
                  <slot
                    name="title"
                    v-bind="{ fields, titleField, itemName: fields.name }"
                  >
                    <div class="h-5 flex items-center">
                      <div v-if="fields[titleField]">
                        {{ fields[titleField] }}
                      </div>
                      <div v-else class="text-ink-gray-4">
                        {{ __('No Title') }}
                      </div>
                    </div>
                  </slot>
                  <div class="border-b h-px my-1.5" />

                  <div class="flex flex-row flex-wrap items-center gap-x-3 gap-y-1">
                    <template v-for="value in column.fields" :key="value">
                      <slot
                        name="fields"
                        v-bind="{
                          fields,
                          fieldName: value,
                          itemName: fields.name,
                        }"
                      >
                        <div v-if="fields[value]" class="truncate">
                          {{ fmtKanbanVal(fields[value]) }}
                        </div>
                      </slot>
                    </template>
                  </div>
                  <div class="border-b h-px mt-1.5 mb-1" />
                  <slot name="actions" v-bind="{ itemName: fields.name }">
                    <div class="flex gap-2 items-center justify-between">
                      <div></div>
                      <Button icon="plus" variant="ghost" @click.stop.prevent />
                    </div>
                  </slot>
                </component>
              </template>
            </Draggable>
            <div
              v-if="column.column.count < column.column.all_count"
              class="flex items-center justify-center"
            >
              <Button
                :label="__('Load More')"
                @click="emit('loadMore', column.column.name)"
              />
            </div>
          </div>
        </div>
      </template>
    </Draggable>
    <div class="shrink-0 min-w-64">
      <Autocomplete
        value=""
        :options="deletedColumns"
        @change="(e) => addColumn(e)"
      >
        <template #target="{ togglePopover }">
          <Button
            class="w-full mt-2.5 mb-1 mr-5"
            :label="__('Add Column')"
            iconLeft="plus"
            @click="togglePopover()"
          />
        </template>
        <template #footer>
          <Button
            class="w-full"
            :label="__('Reload Columns')"
            :iconLeft="RefreshIcon"
            @click="updateColumn(null, true)"
          />
        </template>
      </Autocomplete>
    </div>

    <!-- B18: удаление колонки с карточками — предупреждение + перенос -->
    <Dialog v-model="delDialog" :options="{ title: __('Удалить колонку') }">
      <template #body-content>
        <p class="text-sm text-ink-gray-7">
          {{
            __('В колонке «{0}» есть карточки ({1}). Куда их перенести?', [
              delColumn?.column?.name,
              delColumn?.column?.all_count,
            ])
          }}
        </p>
        <FormControl
          class="mt-3"
          type="select"
          :label="__('Перенести в')"
          v-model="delMoveTo"
          :options="moveTargetOptions"
        />
        <div class="mt-4 flex justify-end gap-2">
          <Button :label="__('Отмена')" @click="delDialog = false" />
          <Button
            variant="solid"
            theme="red"
            :label="__('Перенести и удалить')"
            :loading="delBusy"
            :disabled="!delMoveTo"
            @click="confirmMoveAndDelete"
          />
        </div>
      </template>
    </Dialog>
    </div>
  </div>
</template>
<script setup>
import RefreshIcon from '@/components/Icons/RefreshIcon.vue'
import { napi } from '@/utils/api'
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import { isTouchScreenDevice, colors, parseColor, formatDate } from '@/utils'
import { statusesStore } from '@/stores/statuses'
import Draggable from 'vuedraggable'
import { Dropdown, Popover, Dialog, FormControl, call, toast } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import { formatRub } from '@/utils/ruFormat'

// UX-фикс: дефолтный рендер поля карточки канбана показывал сырые значения, в т.ч.
// datetime из БД («2026-06-19 03:13:29.281415» с микросекундами). Форматируем дату.
function fmtKanbanVal(val) {
  if (typeof val !== 'string') return val
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(val))
    return formatDate(val, '', true, true)
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return formatDate(val, '', true, false)
  return val
}

const { getDealStatus, getLeadStatus } = statusesStore()

// E5 (Bitrix24): ключевые (финальные) этапы = нативный type Won/Lost. Фильтр «В работе» их прячет.
// I7: «в работе» включён ПО УМОЛЧАНИЮ — финальные (Won/Lost) этапы скрыты при входе
// (на бордах без финальных этапов фильтр не показывается и ничего не скрывает).
const hideFinalStages = ref(true)
function stageKind(column) {
  const dt = props.options?.doctype
  const name = column?.column?.name
  if (!name) return 'normal'
  // I34: для кастомных воронок финальность приходит флагами прямо на колонке
  // (get_funnel_meta → is_won/is_lost). Лиды/Сделки этих флагов на колонке не несут.
  if (column?.column?.is_won) return 'key_positive'
  if (column?.column?.is_lost) return 'key_negative'
  let type
  try {
    if (dt === 'CRM Deal') type = getDealStatus(name)?.type
    else if (dt === 'CRM Lead') type = getLeadStatus(name)?.type
  } catch (e) {
    type = undefined
  }
  if (type === 'Won') return 'key_positive'
  if (type === 'Lost') return 'key_negative'
  return 'normal'
}
function isFinalStage(column) {
  return stageKind(column) !== 'normal'
}
const hasFinalStages = computed(() =>
  (columns.value || []).some((c) => isFinalStage(c)),
)

// E5(2): drag-зона снизу. Показываем во время перетаскивания карточки; зоны —
// финальные этапы (Won/Lost). Перенос карточки на зону = смена статуса тем же
// механизмом updateColumn (зона — drop-таргет group="fields" с data-column).
const dragging = ref(false)
const zoneBucket = ref([])
// I11: зона активна при наведении (плавный рост вверх); отступ слева — чтобы не
// заходить на левое меню (220px развёрнуто / 48px свёрнуто, общий ключ с AppSidebar).
const hoveredZone = ref(null)
const _sidebarCollapsed = useStorage('isSidebarCollapsed', false)
const dragZoneLeft = computed(() => (_sidebarCollapsed.value ? '48px' : '220px'))
const finalStageColumns = computed(() =>
  (columns.value || [])
    .filter((c) => isFinalStage(c))
    .map((c) => ({ name: c.column.name, kind: stageKind(c) })),
)
function onCardDragStart() {
  zoneBucket.value = []
  hoveredZone.value = null
  dragging.value = true
}
function onCardDragEnd(d) {
  dragging.value = false
  updateColumn(d)
}

const props = defineProps({
  options: {
    type: Object,
    default: () => ({
      getRoute: null,
      onClick: null,
      onNewClick: null,
    }),
  },
})

const emit = defineEmits(['update', 'loadMore'])

const kanban = defineModel({ type: Object })

// B18: подтверждение удаления колонки с карточками + перенос их в другую колонку.
const delDialog = ref(false)
const delColumn = ref(null)
const delMoveTo = ref('')
const delBusy = ref(false)
function confirmDeleteColumn(column) {
  const allCount = column.column?.all_count || 0
  const dt = props.options?.doctype
  const cf = kanban.value?.data?.column_field
  if (allCount > 0 && dt && cf) {
    delColumn.value = column
    const others = (columns.value || [])
      .map((c) => c.column.name)
      .filter((n) => n !== column.column.name && !columns.value.find((c) => c.column.name === n && c.column.delete))
    delMoveTo.value = others[0] || ''
    delDialog.value = true
  } else {
    doDeleteColumn(column)
  }
}
function doDeleteColumn(column) {
  column.column['delete'] = true
  updateColumn()
}
async function confirmMoveAndDelete() {
  if (!delMoveTo.value) return
  delBusy.value = true
  try {
    await call(napi('tasks_api.move_kanban_records'), {
      doctype: props.options?.doctype,
      column_field: kanban.value?.data?.column_field,
      from_value: delColumn.value.column.name,
      to_value: delMoveTo.value,
    })
    doDeleteColumn(delColumn.value)
    delDialog.value = false
    updateColumn(null, true) // перезагрузить колонки/данные
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось перенести карточки'))
  } finally {
    delBusy.value = false
  }
}
const moveTargetOptions = computed(() =>
  (columns.value || [])
    .filter((c) => !c.column.delete && c.column.name !== delColumn.value?.column?.name)
    .map((c) => ({ label: c.column.name, value: c.column.name })),
)

const titleField = computed(() => {
  return kanban.value?.data?.title_field
})

const columns = computed(() => {
  if (!kanban.value?.data?.data || kanban.value.data.view_type != 'kanban')
    return []
  let _columns = kanban.value.data.data

  let has_color = _columns.some((column) => column.column?.color)
  if (!has_color) {
    _columns.forEach((column, i) => {
      column.column['color'] = colors[i % colors.length]
    })
  }
  return _columns
})

// I25 (как Bitrix): сумма всех сделок этапа — плашка над колонкой. Грузим только если
// родитель передал options.amountField (Лиды/Сделки); сумма из бэкенда (не зависит от
// пагинации карточек), с теми же фильтрами борда.
const stageSums = ref({})
const amountField = computed(() => props.options?.amountField)
async function loadStageSums() {
  const cf = kanban.value?.data?.column_field
  if (!amountField.value || !props.options?.doctype || !cf) {
    stageSums.value = {}
    return
  }
  try {
    stageSums.value =
      (await call(napi('api.get_kanban_stage_sums'), {
        doctype: props.options.doctype,
        column_field: cf,
        amount_field: amountField.value,
        filters: JSON.stringify(props.options?.boardFilters || {}),
      })) || {}
  } catch (e) {
    stageSums.value = {}
  }
}
watch(
  () => (columns.value || []).map((c) => c.column?.name).join('|'),
  loadStageSums,
  { immediate: true },
)

const deletedColumns = computed(() => {
  const _columns = kanban.value?.data?.kanban_columns || []
  return _columns
    ?.filter((col) => col['delete'])
    .map((col) => {
      return { label: col.name, value: col.name }
    })
})

// B17: классы цветной пилюли для названия этапа (светлый фон + тёмный текст того же цвета)
function stagePillClass(color) {
  const c = color || 'gray'
  if (c === 'black') return '!bg-gray-200 !text-ink-gray-9'
  return `!bg-${c}-100 !text-${c}-700`
}

function actions(column) {
  return [
    {
      group: __('Options'),
      hideLabel: true,
      items: [
        {
          label: __('Delete'),
          icon: 'trash-2',
          onClick: () => confirmDeleteColumn(column),
        },
      ],
    },
  ]
}

function addColumn(e) {
  let column = columns.value.find((col) => col.column.name == e.value)
  column.column['delete'] = false
  columns.value.splice(columns.value.indexOf(column), 1)
  columns.value.push(column)
  updateColumn()
}

function updateColumn(d, fetchNewColumns = false) {
  let toColumn = d?.to?.dataset.column
  let fromColumn = d?.from?.dataset.column
  let itemName = d?.item?.dataset.name

  let _columns = []
  columns.value.forEach((col) => {
    col.column['order'] = col.data.map((d) => d.name)
    if (col.column.page_length) {
      delete col.column.page_length
    }
    _columns.push(col.column)
  })

  let data = { kanban_columns: _columns, fetchNewColumns }

  if (toColumn != fromColumn) {
    data = { item: itemName, to: toColumn, kanban_columns: _columns }
  }

  emit('update', data)
}
</script>
