<template>
  <LayoutHeader>
    <template #left-header>
      <div class="flex items-center gap-2">
        <FeatherIcon :name="board.icon || 'filter'" class="h-5 w-5 text-ink-gray-6" />
        <div class="text-lg font-semibold text-ink-gray-8">
          {{ board.funnel_name || funnel }}
        </div>
      </div>
    </template>
  </LayoutHeader>

  <div class="flex-1 overflow-auto p-3">
    <div v-if="loading" class="p-8 text-center text-sm text-ink-gray-5">
      {{ __('Загрузка…') }}
    </div>
    <div v-else-if="!board.columns?.length" class="p-8 text-center text-sm text-ink-gray-5">
      {{ __('В этой воронке нет этапов. Добавьте их в «Параметры воронок».') }}
    </div>
    <div v-else class="flex items-start gap-3">
      <div
        v-for="col in board.columns"
        :key="col.stage"
        class="flex w-72 shrink-0 flex-col gap-2 rounded-lg bg-surface-gray-1 p-2.5"
      >
        <div class="flex items-center justify-between">
          <span class="rounded px-1.5 py-0.5 text-xs font-medium" :class="pill(col.color)">
            {{ col.stage }}
            <span v-if="col.is_won"> ✓</span>
            <span v-else-if="col.is_lost"> ✕</span>
          </span>
          <span class="text-xs text-ink-gray-5">{{ col.count }}</span>
        </div>

        <Draggable
          :list="col.deals"
          group="funnel-deals"
          item-key="name"
          :data-stage="col.stage"
          class="flex min-h-[8px] flex-col gap-2"
          @end="onDealDrop"
        >
          <template #item="{ element: d }">
            <div
              class="rounded-lg border bg-surface-white p-2 text-sm"
              :data-name="d.name"
            >
              <div class="truncate font-medium text-ink-gray-8">{{ d.title }}</div>
              <div class="mt-1 flex items-center justify-between">
                <span class="text-xs text-ink-gray-5">{{ fmtAmount(d.amount) }}</span>
                <Dropdown :options="moveOptions(d, col.stage)">
                  <Button variant="ghost" size="sm" icon="more-horizontal" />
                </Dropdown>
              </div>
            </div>
          </template>
        </Draggable>

        <div class="flex items-center gap-1">
          <input
            v-model="newDeal[col.stage]"
            class="flex-1 rounded border border-outline-gray-2 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-outline-gray-3"
            :placeholder="__('Новая сделка…')"
            @keydown.enter="addDeal(col.stage)"
          />
          <Button variant="ghost" size="sm" icon="plus" @click="addDeal(col.stage)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import { Button, Dropdown, FeatherIcon, call, toast } from 'frappe-ui'
import { ref, reactive, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Draggable from 'vuedraggable'

const route = useRoute()
const funnel = ref(route.params.name)
const board = ref({ columns: [] })
const loading = ref(true)
const newDeal = reactive({})

async function load() {
  loading.value = true
  try {
    board.value = await call('nacifrah.api.get_board', { funnel: funnel.value })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось загрузить воронку'))
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(
  () => route.params.name,
  (n) => {
    if (n) {
      funnel.value = n
      load()
    }
  },
)

function pill(color) {
  const c = color || 'gray'
  if (c === 'black') return '!bg-gray-200 !text-ink-gray-9'
  return `!bg-${c}-100 !text-${c}-700`
}
function fmtAmount(a) {
  return a ? new Intl.NumberFormat('ru-RU').format(a) + ' ₽' : ''
}
function moveOptions(d, current) {
  return (board.value.columns || [])
    .filter((c) => c.stage !== current)
    .map((c) => ({ label: '→ ' + c.stage, onClick: () => moveDeal(d.name, c.stage) }))
}
async function moveDeal(deal, stage) {
  try {
    await call('nacifrah.api.move_funnel_deal', { deal, stage })
    await load()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось переместить'))
  }
}
function onDealDrop(e) {
  const stage = e?.to?.dataset?.stage
  const deal = e?.item?.dataset?.name
  if (stage && deal && e.from?.dataset?.stage !== stage) {
    moveDeal(deal, stage)
  }
}
async function addDeal(stage) {
  const title = (newDeal[stage] || '').trim()
  if (!title) return
  newDeal[stage] = ''
  try {
    await call('nacifrah.api.create_deal', { funnel: funnel.value, stage, title })
    await load()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось создать сделку'))
  }
}
</script>
