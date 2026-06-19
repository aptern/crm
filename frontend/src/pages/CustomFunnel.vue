<template>
  <LayoutHeader>
    <template #left-header>
      <div class="flex items-center gap-2">
        <FeatherIcon
          :name="funnelIcon || 'filter'"
          class="h-5 w-5 text-ink-gray-6"
        />
        <div class="text-lg font-semibold text-ink-gray-8">
          {{ funnelName || funnel }}
        </div>
      </div>
    </template>
  </LayoutHeader>

  <div class="flex items-center gap-2 px-3 pt-3">
    <!-- I4/I5: поиск по организации/телефону внутри воронки -->
    <div class="max-w-xs flex-1">
      <FormControl
        type="text"
        v-model="search"
        :placeholder="__('Поиск: организация или телефон')"
        @input="onSearchInput"
      />
    </div>
  </div>

  <div
    v-if="!board || board.loading"
    class="p-8 text-center text-sm text-ink-gray-5"
  >
    {{ __('Загрузка…') }}
  </div>
  <div
    v-else-if="!board.data?.data?.length"
    class="p-8 text-center text-sm text-ink-gray-5"
  >
    {{ __('В этой воронке нет этапов. Добавьте их в «Параметры воронок».') }}
  </div>
  <!-- I33: единый нативный борд (как Лиды/Сделки), сгруппированный по этапу воронки -->
  <KanbanView
    v-else
    v-model="board"
    :options="{
      doctype: 'CRM Deal',
      amountField: 'annual_revenue',
      boardFilters: { nacifrah_funnel: funnel },
      getRoute: (row) => ({
        name: 'Deal',
        params: { dealId: row.name },
        query: { viewType: 'kanban' },
      }),
      onNewClick: (column) => onNewClick(column),
    }"
    @update="onKanbanUpdate"
  >
    <template #title="{ titleField, itemName }">
      <div class="flex gap-2 items-center">
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
        <div
          v-if="['modified', 'creation'].includes(fieldName)"
          class="truncate text-base"
        >
          <Tooltip :text="getRow(itemName, fieldName).label">
            <div>{{ getRow(itemName, fieldName).timeAgo }}</div>
          </Tooltip>
        </div>
        <div
          v-else-if="fieldName === '_assign'"
          class="flex items-center truncate"
        >
          <MultipleAvatar
            :avatars="getRow(itemName, fieldName).label"
            size="xs"
          />
        </div>
        <div v-else class="truncate text-base">
          {{ getRow(itemName, fieldName).label }}
        </div>
      </div>
    </template>

    <template #actions="{ itemName }">
      <div class="flex gap-2 items-center justify-between">
        <div class="flex items-center gap-1 text-xs text-ink-gray-4">
          <FeatherIcon name="clock" class="h-3.5 w-3.5" />
          <span>{{ getRow(itemName, 'creation').label }}</span>
        </div>
      </div>
    </template>
  </KanbanView>

  <Dialog v-model="showCreate" :options="{ title: __('Новая сделка') }">
    <template #body-content>
      <div class="flex flex-col gap-3">
        <div class="text-sm text-ink-gray-6">
          {{ __('Этап') }}: <span class="font-medium">{{ createStage }}</span>
        </div>
        <FormControl
          v-model="createTitle"
          type="text"
          :label="__('Название сделки')"
          :placeholder="__('Например, организация или контакт')"
          @keydown.enter="submitCreate"
        />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <Button :label="__('Отмена')" @click="showCreate = false" />
        <Button
          variant="solid"
          :label="__('Создать')"
          :loading="creating"
          @click="submitCreate"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import KanbanView from '@/components/Kanban/KanbanView.vue'
import MultipleAvatar from '@/components/MultipleAvatar.vue'
import {
  Avatar,
  Button,
  Dialog,
  FeatherIcon,
  FormControl,
  Tooltip,
  call,
  createResource,
  toast,
} from 'frappe-ui'
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import { usersStore } from '@/stores/users'
import { statusesStore } from '@/stores/statuses'
import { organizationsStore } from '@/stores/organizations'
import { formatDate, timeAgo, website, formatTime } from '@/utils'
import { formatRub, formatPhoneDisplay } from '@/utils/ruFormat'
import { getMeta } from '@/stores/meta'

const route = useRoute()
const funnel = ref(route.params.name)
const funnelName = ref('')
const funnelIcon = ref('')
const loading = ref(true)
const board = ref(null)

const { getUser } = usersStore()
const { getDealStatus } = statusesStore()
const { getOrganization } = organizationsStore()
const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta('CRM Deal')

const KANBAN_FIELDS = ['annual_revenue', 'mobile_no', '_assign', 'creation']

// I4/I5: поиск
const search = ref('')
const onSearchInput = useDebounceFn(() => setupBoard(), 400)

async function setupBoard() {
  loading.value = true
  try {
    const sf = await call('nacifrah.api.get_funnel_meta', { funnel: funnel.value })
    funnelName.value = sf?.funnel_name || funnel.value
    funnelIcon.value = sf?.icon || 'filter'
    const stages = sf?.stages || []
    const filters = { nacifrah_funnel: funnel.value }
    const s = (search.value || '').trim()
    if (s) {
      const digits = s.replace(/\D/g, '')
      if (digits && digits.length >= 3) filters.mobile_no = ['like', '%' + digits + '%']
      else filters.organization = ['like', '%' + s + '%']
    }
    board.value = createResource({
      url: 'crm.api.doc.get_data',
      params: {
        doctype: 'CRM Deal',
        filters,
        order_by: 'modified desc',
        page_length: 100,
        column_field: 'nacifrah_funnel_stage',
        title_field: 'organization',
        kanban_columns: JSON.stringify(stages),
        kanban_fields: JSON.stringify(KANBAN_FIELDS),
        view: { view_type: 'kanban' },
      },
      auto: true,
    })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось загрузить воронку'))
  } finally {
    loading.value = false
  }
}
onMounted(setupBoard)
watch(
  () => route.params.name,
  (n) => {
    if (n) {
      funnel.value = n
      search.value = ''
      setupBoard()
    }
  },
)

// ── карточка: те же rows/parseRows, что на бордах Сделок (единый шаблон) ──
function getRow(name, field) {
  function getValue(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value
    return { label: value }
  }
  const r = rows.value?.find((row) => row.name == name)
  return getValue(r ? r[field] : '')
}

const rows = computed(() => {
  if (!board.value?.data?.data || board.value.data.view_type !== 'kanban')
    return []
  return getKanbanRows(board.value.data.data, board.value.data.fields)
})

function getKanbanRows(data, columns) {
  let _rows = []
  data.forEach((column) => {
    column.data?.forEach((row) => _rows.push(row))
  })
  return parseRows(_rows, columns)
}

function parseRows(rowsArr, columns = []) {
  let key = 'fieldname'
  let type = 'fieldtype'
  return rowsArr.map((deal) => {
    let _rows = {}
    ;(board.value.data.rows || []).forEach((row) => {
      _rows[row] = deal[row]
      let fieldType = columns?.find((col) => (col[key] || col.value) == row)?.[
        type
      ]
      if (
        fieldType &&
        ['Date', 'Datetime'].includes(fieldType) &&
        !['modified', 'creation'].includes(row)
      ) {
        _rows[row] = formatDate(deal[row], '', true, fieldType == 'Datetime')
      }
      if (fieldType && fieldType == 'Currency') {
        _rows[row] =
          row === 'annual_revenue'
            ? formatRub(deal[row])
            : getFormattedCurrency(row, deal)
      }
      if (fieldType && fieldType == 'Float') _rows[row] = getFormattedFloat(row, deal)
      if (fieldType && fieldType == 'Percent') _rows[row] = getFormattedPercent(row, deal)
      if (row == 'organization') {
        _rows[row] = {
          label: deal.organization,
          logo: getOrganization(deal.organization)?.organization_logo,
        }
      } else if (row === 'website') {
        _rows[row] = website(deal.website)
      } else if (row == 'status') {
        _rows[row] = {
          label: deal.status,
          color: getDealStatus(deal.status)?.color,
        }
      } else if (row == 'deal_owner') {
        _rows[row] = {
          label: deal.deal_owner && getUser(deal.deal_owner).full_name,
          ...(deal.deal_owner && getUser(deal.deal_owner)),
        }
      } else if (row == '_assign') {
        let assignees = JSON.parse(deal._assign || '[]')
        _rows[row] = assignees.map((user) => ({
          name: user,
          image: getUser(user).user_image,
          label: getUser(user).full_name,
        }))
      } else if (['modified', 'creation'].includes(row)) {
        _rows[row] = {
          label: formatDate(deal[row], '', true, true),
          timeAgo: __(timeAgo(deal[row])),
        }
      } else if (row === 'mobile_no') {
        _rows[row] = {
          label: deal.mobile_no ? formatPhoneDisplay(deal.mobile_no) : '',
        }
      }
    })
    return _rows
  })
}

// ── drag-n-drop: перенос карточки между этапами воронки ──
async function onKanbanUpdate(data) {
  if (data?.item && data?.to) {
    try {
      await call('nacifrah.api.move_funnel_deal', {
        deal: data.item,
        stage: data.to,
      })
      board.value?.reload?.()
    } catch (e) {
      toast.error(e?.messages?.[0] || __('Не удалось переместить'))
      board.value?.reload?.()
    }
  }
}

// ── создание сделки на этапе (попап) ──
const showCreate = ref(false)
const createStage = ref('')
const createTitle = ref('')
const creating = ref(false)
function onNewClick(column) {
  createStage.value = column?.column?.name || ''
  createTitle.value = ''
  showCreate.value = true
}
async function submitCreate() {
  const title = (createTitle.value || '').trim()
  if (!title) return
  creating.value = true
  try {
    await call('nacifrah.api.create_deal', {
      funnel: funnel.value,
      stage: createStage.value,
      title,
    })
    showCreate.value = false
    createTitle.value = ''
    board.value?.reload?.()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось создать сделку'))
  } finally {
    creating.value = false
  }
}
</script>
