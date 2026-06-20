<!-- Кастомная воронка — ПОЛНАЯ копия доски «Сделки» (Deals.vue) на едином <SalesBoard>.
     Отличия ТОЛЬКО воронки: фильтр по nacifrah_funnel, колонки по этапам
     (nacifrah_funnel_stage), перенос карточки = смена этапа, создание сделки привязывается
     к воронке/этапу. Орг-поле в создании = Link на CRM Organization (выпадающий список
     клиентов) — приходит из стандартного DealModal, как у «Сделок» (L1-FIX). -->
<template>
  <LayoutHeader>
    <template #left-header>
      <div class="flex items-center gap-2">
        <FeatherIcon :name="funnelIcon || 'filter'" class="h-5 w-5 text-ink-gray-6" />
        <div class="text-lg font-semibold text-ink-gray-8">
          {{ funnelName || funnel }}
        </div>
      </div>
    </template>
    <template #right-header>
      <CustomActions
        v-if="board?.listView?.customListActions"
        :actions="board.listView.customListActions"
      />
      <Button
        variant="solid"
        :label="__('Создать')"
        iconLeft="plus"
        @click="onCreateClick"
      />
    </template>
  </LayoutHeader>

  <SalesBoard
    ref="board"
    v-model="deals"
    v-model:viewControls="viewControls"
    doctype="CRM Deal"
    :filters="{ nacifrah_funnel: funnel }"
    :boardFilters="{ nacifrah_funnel: funnel }"
    :kanbanFields="dealKanbanFields"
    :allowedViews="['list', 'group_by', 'kanban']"
    defaultColumnField="nacifrah_funnel_stage"
    :kanbanColumns="funnelKanbanColumns"
    :noViewPersist="true"
    :getRoute="
      (row) => ({
        name: 'Deal',
        params: { dealId: row.name },
        query: { viewType: 'kanban' },
      })
    "
    :onNewClick="onNewClick"
    :moveHandler="onMove"
    :cardActions="actions"
    :listComponent="DealsListView"
    emptyName="Deals"
    :emptyIcon="DealsIcon"
  />

  <DealModal
    v-if="showDealModal"
    v-model="showDealModal"
    :defaults="defaults"
    :openAfterCreate="false"
    @afterCreate="deals?.reload?.()"
  />
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import CustomActions from '@/components/CustomActions.vue'
import { DEFAULT_CARD_KANBAN_FIELDS } from '@/utils/cardFields'
import SalesBoard from '@/components/SalesBoard.vue'
import DealsListView from '@/components/ListViews/DealsListView.vue'
import DealModal from '@/components/Modals/DealModal.vue'
import DealsIcon from '@/components/Icons/DealsIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import { globalStore } from '@/stores/global'
import { callEnabled } from '@/composables/telephony'
import { useDoctypeModal } from '@/composables/doctypeModal'
import { Button, FeatherIcon, call, toast } from 'frappe-ui'
import { ref, reactive, computed, watch, onMounted, h } from 'vue'
import { useRoute } from 'vue-router'

const { makeCall } = globalStore()
const { showModal } = useDoctypeModal()

const route = useRoute()
const funnel = ref(route.params.name)
const funnelName = ref('')
const funnelIcon = ref('')
const funnelStages = ref([])

const board = ref(null)
const viewControls = ref(null)
const deals = ref({})

// I13: поля карточки сделки (как у «Сделок») — единый источник @/utils/cardFields
const dealKanbanFields = DEFAULT_CARD_KANBAN_FIELDS

// явные колонки воронки (имя+цвет+is_won/is_lost) для ViewControls/KanbanView
const funnelKanbanColumns = computed(() => {
  if (!funnelStages.value.length) return ''
  return JSON.stringify(funnelStages.value)
})

async function loadFunnelMeta() {
  try {
    const m = await call('nacifrah.api.get_funnel_meta', { funnel: funnel.value })
    funnelName.value = m?.funnel_name || funnel.value
    funnelIcon.value = m?.icon || 'filter'
    funnelStages.value = m?.stages || []
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось загрузить воронку'))
  }
}
onMounted(loadFunnelMeta)
watch(
  () => route.params.name,
  (n) => {
    if (n) {
      funnel.value = n
      loadFunnelMeta()
    }
  },
)

// перенос карточки = смена этапа воронки; операции с колонками не персистим
async function onMove(data) {
  if (data?.item && data?.to) {
    try {
      await call('nacifrah.api.move_funnel_deal', { deal: data.item, stage: data.to })
      deals.value?.reload?.()
    } catch (e) {
      toast.error(e?.messages?.[0] || __('Не удалось переместить'))
      deals.value?.reload?.()
    }
  }
}

// ── создание сделки через полный DealModal (как у «Сделок»), с привязкой к воронке ──
const showDealModal = ref(false)
const defaults = reactive({})

function openCreate(stageName) {
  // очистить и проставить воронку + этап
  Object.keys(defaults).forEach((k) => delete defaults[k])
  defaults.nacifrah_funnel = funnel.value
  if (stageName) defaults.nacifrah_funnel_stage = stageName
  showDealModal.value = true
}
// «+» на колонке канбана → этап = колонка
function onNewClick(column) {
  openCreate(column?.column?.name || funnelStages.value?.[0]?.name || '')
}
// кнопка «Создать» в шапке → первый этап воронки
function onCreateClick() {
  openCreate(funnelStages.value?.[0]?.name || '')
}

// карточные действия (звонок/заметка/задача) — идентично «Сделкам»
function actions(itemName, getRow) {
  let mobile_no = getRow(itemName, 'mobile_no')?.label || ''
  let acts = [
    {
      icon: h(PhoneIcon, { class: 'h-4 w-4' }),
      label: __('Make a Call'),
      onClick: () => makeCall(mobile_no),
      condition: () => mobile_no && callEnabled.value,
    },
    {
      icon: h(NoteIcon, { class: 'h-4 w-4' }),
      label: __('New Note'),
      onClick: () => showNote(itemName),
    },
    {
      icon: h(TaskIcon, { class: 'h-4 w-4' }),
      label: __('New Task'),
      onClick: () => showTask(itemName),
    },
  ]
  return acts.filter((a) => (a.condition ? a.condition() : true))
}
function showNote(name) {
  showModal({
    doctype: 'FCRM Note',
    title: 'Note',
    defaults: { reference_doctype: 'CRM Deal', reference_docname: name },
  })
}
function showTask(name) {
  showModal({
    doctype: 'CRM Task',
    title: 'Task',
    defaults: { reference_doctype: 'CRM Deal', reference_docname: name },
    popup: true, // I22: создание задачи — центральный попап
  })
}
</script>
