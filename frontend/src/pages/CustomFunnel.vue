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
    <div
      v-else-if="!board.columns?.length"
      class="p-8 text-center text-sm text-ink-gray-5"
    >
      {{ __('В этой воронке нет этапов. Добавьте их в «Параметры воронок».') }}
    </div>
    <div v-else class="flex items-start gap-3">
      <div
        v-for="col in board.columns"
        :key="col.stage"
        class="flex w-72 shrink-0 flex-col gap-2 rounded-lg bg-surface-gray-1 p-2.5"
      >
        <div class="flex items-center justify-between">
          <span
            class="rounded px-1.5 py-0.5 text-xs font-medium"
            :class="pill(col.color)"
          >
            {{ col.stage }}
            <span v-if="col.is_won"> ✓</span>
            <span v-else-if="col.is_lost"> ✕</span>
          </span>
          <span class="text-xs text-ink-gray-5">{{ col.count }}</span>
        </div>
        <!-- I25/I3: сумма сделок этапа (как на нативных бордах Лиды/Сделки) -->
        <div
          v-if="col.sum"
          class="px-0.5 text-xs font-semibold text-ink-gray-7"
        >
          {{ formatRub(col.sum) }}
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
            <!-- I10/I3: клик по карточке → выезд карточки справа (как Лиды/Сделки) -->
            <div
              class="cursor-pointer rounded-lg border bg-surface-white p-2.5 text-sm transition hover:border-outline-gray-3 hover:shadow-sm"
              :data-name="d.name"
              @click="openCard(d)"
            >
              <div class="flex items-center gap-2">
                <Avatar size="sm" :label="d.title" />
                <div class="truncate font-medium text-ink-gray-8">
                  {{ d.title }}
                </div>
              </div>
              <div class="mt-2 flex items-center justify-between">
                <span class="font-medium text-ink-gray-7">{{
                  formatRub(d.amount)
                }}</span>
                <div @click.stop>
                  <Dropdown :options="moveOptions(d, col.stage)">
                    <Button variant="ghost" size="sm" icon="more-horizontal" />
                  </Dropdown>
                </div>
              </div>
              <div
                v-if="d.mobile_no"
                class="mt-1 text-xs text-ink-gray-5"
              >
                {{ formatPhoneDisplay(d.mobile_no) }}
              </div>
              <div v-if="d.creation" class="mt-1 text-xs text-ink-gray-4">
                {{ fmtDate(d.creation) }}
              </div>
            </div>
          </template>
        </Draggable>

        <!-- I29/I3: создание сделки — центральный попап (а не inline-инпут) -->
        <Button
          variant="ghost"
          size="sm"
          iconLeft="plus"
          :label="__('Сделка')"
          class="w-full justify-start"
          @click="openCreate(col.stage)"
        />
      </div>
    </div>
  </div>

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
import {
  Avatar,
  Button,
  Dialog,
  Dropdown,
  FeatherIcon,
  FormControl,
  call,
  toast,
} from 'frappe-ui'
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Draggable from 'vuedraggable'
import { recordSlideOverStore } from '@/stores/recordSlideOver'
import { formatRub, formatPhoneDisplay } from '@/utils/ruFormat'

// I3: дата создания на карточке (как на нативных бордах Сделок)
function fmtDate(s) {
  if (!s) return ''
  const d = new Date(String(s).replace(' ', 'T'))
  if (isNaN(d.getTime())) return ''
  return (
    d.toLocaleDateString('ru-RU') +
    ' ' +
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  )
}

const route = useRoute()
const funnel = ref(route.params.name)
const board = ref({ columns: [] })
const loading = ref(true)

const { openRecord } = recordSlideOverStore()

// I29: создание сделки через центральный попап
const showCreate = ref(false)
const createStage = ref('')
const createTitle = ref('')
const creating = ref(false)

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
// I10: открыть сделку в right-slide-over (единая логика со Сделками/Лидами)
function openCard(d) {
  openRecord('CRM Deal', d.name)
}
function openCreate(stage) {
  createStage.value = stage
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
    await load()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось создать сделку'))
  } finally {
    creating.value = false
  }
}
function moveOptions(d, current) {
  return (board.value.columns || [])
    .filter((c) => c.stage !== current)
    .map((c) => ({
      label: '→ ' + c.stage,
      onClick: () => moveDeal(d.name, c.stage),
    }))
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
</script>
