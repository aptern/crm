<!-- Кастомная воронка — тонкая обёртка над единым шаблоном доски <SalesBoard> (I34).
     Отличия воронки: колонки по этапам (nacifrah_funnel_stage), перенос = смена этапа,
     создание сделки на этапе. Весь остальной вид/функционал — из общего шаблона. -->
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

  <SalesBoard
    ref="board"
    v-model="deals"
    v-model:viewControls="viewControls"
    doctype="CRM Deal"
    :filters="{ nacifrah_funnel: funnel }"
    :boardFilters="{ nacifrah_funnel: funnel }"
    :kanbanFields="kanbanFields"
    :allowedViews="['kanban']"
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
  />

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
import SalesBoard from '@/components/SalesBoard.vue'
import { Button, Dialog, FeatherIcon, FormControl, call, toast } from 'frappe-ui'
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const funnel = ref(route.params.name)
const funnelName = ref('')
const funnelIcon = ref('')
const funnelStages = ref([])

const board = ref(null)
const viewControls = ref(null)
const deals = ref({})

const kanbanFields = JSON.stringify([
  'annual_revenue',
  'mobile_no',
  '_assign',
  'creation',
])

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
      await call('nacifrah.api.move_funnel_deal', {
        deal: data.item,
        stage: data.to,
      })
      deals.value?.reload?.()
    } catch (e) {
      toast.error(e?.messages?.[0] || __('Не удалось переместить'))
      deals.value?.reload?.()
    }
  }
}

// создание сделки на этапе (попап)
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
    deals.value?.reload?.()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось создать сделку'))
  } finally {
    creating.value = false
  }
}
</script>
