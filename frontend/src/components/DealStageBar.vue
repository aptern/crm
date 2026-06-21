<template>
  <!-- F4 (P-D11 + P-REF): горизонтальный бар этапов ТЕКУЩЕЙ воронки (как Bitrix скрин 536).
       Этапы кликабельны → set_deal_stage (оптимистично + reload). Справа — «Перенести в воронку»
       → get_funnels_for_move → выбор воронки/этапа → move_deal_to_funnel.
       Источник истины — бэкенд nacifrah.crm_bridge (этапы, цвета, флаг current). -->
  <div
    v-if="currentFunnel?.stages?.length"
    class="flex items-center gap-2 border-b border-outline-gray-1 px-5 py-2.5"
  >
    <!-- бар этапов -->
    <div class="flex min-w-0 flex-1 items-center overflow-x-auto py-0.5">
      <button
        v-for="(st, i) in currentFunnel.stages"
        :key="st.stage"
        type="button"
        class="relative flex h-8 shrink-0 items-center whitespace-nowrap pl-4 pr-3 text-sm transition-colors first:rounded-l-md last:rounded-r-md"
        :class="stageClass(st)"
        :style="i === 0 ? {} : { marginLeft: '-9px' }"
        :disabled="busy"
        :title="st.stage"
        @click="onStageClick(st)"
      >
        <!-- стрелка-«шеврон» справа (форма этапа как в Bitrix); цвет = фон сегмента,
             задаётся инлайн-стилем (не tailwind-класс — чтобы не вырезался при purge). -->
        <span
          v-if="i !== currentFunnel.stages.length - 1"
          class="dsb-chevron"
          :style="{ borderLeftColor: segmentHex(st) }"
        />
        <span class="relative z-10 max-w-[160px] truncate">
          {{ stageLabel(st) }}
        </span>
      </button>
    </div>

    <!-- перенос в другую воронку -->
    <Popover placement="bottom-end">
      <template #target="{ togglePopover, isOpen }">
        <Button
          class="shrink-0"
          variant="subtle"
          :label="__('Перенести в воронку')"
          :iconRight="isOpen ? 'chevron-up' : 'chevron-down'"
          :loading="busy"
          @click="
            () => {
              loadFunnels()
              togglePopover()
            }
          "
        />
      </template>
      <template #body="{ close }">
        <div
          class="my-2 max-h-[60vh] min-w-64 overflow-y-auto rounded-lg bg-surface-modal p-1.5 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none"
        >
          <div
            v-if="funnels.loading"
            class="flex items-center justify-center gap-2 px-3 py-4 text-base text-ink-gray-5"
          >
            <LoadingIndicator class="h-4 w-4" />
            <span>{{ __('Loading...') }}</span>
          </div>
          <template v-else>
            <div v-for="f in allFunnels" :key="f.funnel" class="mb-1 last:mb-0">
              <div
                class="px-2 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-ink-gray-5"
              >
                {{ f.label }}
                <span v-if="f.current" class="text-ink-gray-4">
                  ({{ __('текущая') }})
                </span>
              </div>
              <button
                v-for="st in f.stages"
                :key="f.funnel + '::' + st.stage"
                type="button"
                class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-base text-ink-gray-8 hover:bg-surface-gray-2"
                :disabled="busy"
                @click="onMoveClick(f, st, close)"
              >
                <IndicatorIcon :class="parseColor(st.color)" />
                <span class="truncate">{{ stageLabel(st) }}</span>
              </button>
            </div>
            <div
              v-if="!allFunnels.length"
              class="px-3 py-4 text-center text-base text-ink-gray-5"
            >
              {{ __('Нет воронок') }}
            </div>
          </template>
        </div>
      </template>
    </Popover>
  </div>
</template>

<script setup>
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import { parseColor, isTranslatable } from '@/utils'
import { napi } from '@/utils/api'
import { createResource, Button, Popover, call, toast } from 'frappe-ui'
import { computed, ref } from 'vue'

const props = defineProps({
  deal: { type: String, required: true },
  // текущий этап сделки (status для нативной / nacifrah_funnel_stage для доп-воронки) —
  // прокидывается родителем для оптимистичной подсветки.
  currentStage: { type: String, default: '' },
})

const emit = defineEmits(['changed'])

// блокировка повторных кликов во время запроса (без гонок).
const busy = ref(false)

// Источник истины: get_funnels_for_move отдаёт ВСЕ воронки + этапы + флаг current.
const funnels = createResource({
  url: napi('crm_bridge.get_funnels_for_move'),
  params: { deal: props.deal },
  auto: true,
})

function loadFunnels() {
  // подтянуть актуальный список перед открытием выпадашки переноса.
  funnels.fetch({ deal: props.deal })
}

const allFunnels = computed(() => funnels.data?.funnels || [])

// текущая воронка — для рендера бара этапов.
const currentFunnel = computed(
  () => allFunnels.value.find((f) => f.current) || null,
)

// активный этап: оптимистичный prop имеет приоритет, иначе из бэкенд-ответа.
const activeStage = computed(
  () => props.currentStage || funnels.data?.current_stage || '',
)

function stageLabel(st) {
  // этапы нативной воронки = CRM Deal Status (переводимы); доп-воронки — как есть.
  if (isTranslatable('CRM Deal Status')) return __(st.stage)
  return st.stage
}

function isActive(st) {
  return st.stage === activeStage.value
}

// HEX-палитра этапов (по именам цветов из бэкенда). Инлайн-стиль вместо tailwind-класса —
// динамические bg-${color} вырезаются purge'ом (safelist только !text/!bg), поэтому цвет
// «шеврона» (треугольник) задаём напрямую цветом. Активный сегмент использует tailwind
// !bg/!text-классы (см. stageClass), они в safelist'е и переживают сборку.
const HEX = {
  gray: '#4b5563',
  red: '#dc2626',
  rose: '#e11d48',
  pink: '#db2777',
  fuchsia: '#c026d3',
  purple: '#9333ea',
  violet: '#7c3aed',
  indigo: '#4f46e5',
  blue: '#2563eb',
  sky: '#0284c7',
  cyan: '#0891b2',
  teal: '#0d9488',
  emerald: '#059669',
  green: '#16a34a',
  lime: '#65a30d',
  yellow: '#ca8a04',
  amber: '#d97706',
  orange: '#ea580c',
  slate: '#475569',
  black: '#1f2937',
}

// цвет этапа с учётом won/lost-семантики.
function stageColorName(st) {
  return st.is_won ? 'green' : st.is_lost ? 'red' : st.color || 'gray'
}

// фон активного сегмента — tailwind !bg/!text (как stagePillClass в Kanban; переживает purge).
function activeBgClass(st) {
  const c = stageColorName(st)
  if (c === 'black') return '!bg-gray-200 !text-ink-gray-9'
  return `!bg-${c}-100 !text-${c}-800`
}

// HEX-цвет «шеврона»: для активного — фон сегмента (-100 светлый), для неактивного — общий серый фон.
function segmentHex(st) {
  if (isActive(st)) {
    const c = stageColorName(st)
    return light100Hex(c)
  }
  return '#f1f5f9' // surface-gray-2 (slate-100)
}

// светлые HEX (-100) для шеврона активного сегмента, чтобы стрелка сливалась с -100 фоном.
const HEX_100 = {
  gray: '#f3f4f6',
  red: '#fee2e2',
  rose: '#ffe4e6',
  pink: '#fce7f3',
  fuchsia: '#fae8ff',
  purple: '#f3e8ff',
  violet: '#ede9fe',
  indigo: '#e0e7ff',
  blue: '#dbeafe',
  sky: '#e0f2fe',
  cyan: '#cffafe',
  teal: '#ccfbf1',
  emerald: '#d1fae5',
  green: '#dcfce7',
  lime: '#ecfccb',
  yellow: '#fef9c3',
  amber: '#fef3c7',
  orange: '#ffedd5',
  slate: '#f1f5f9',
  black: '#e5e7eb',
}
function light100Hex(c) {
  return HEX_100[c] || HEX_100.gray
}

// класс сегмента: активный — цветной (!bg/!text), остальные — серый pill.
function stageClass(st) {
  if (isActive(st)) {
    return [activeBgClass(st), 'font-medium']
  }
  return ['bg-surface-gray-2 text-ink-gray-7 hover:bg-surface-gray-3']
}

// ── клик по этапу: смена этапа в ТЕКУЩЕЙ воронке ──
async function onStageClick(st) {
  if (busy.value || isActive(st)) return
  busy.value = true
  try {
    const r = await call(napi('crm_bridge.set_deal_stage'), {
      deal: props.deal,
      stage: st.stage,
    })
    toast.success(__('Этап изменён'))
    // reload карточки + бара (won→project мог переключиться на бэке).
    funnels.fetch({ deal: props.deal })
    emit('changed', r)
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось сменить этап'))
  } finally {
    busy.value = false
  }
}

// ── клик по этапу другой воронки: перенос ──
async function onMoveClick(f, st, close) {
  if (busy.value) return
  busy.value = true
  try {
    const r = await call(napi('crm_bridge.move_deal_to_funnel'), {
      deal: props.deal,
      funnel: f.funnel,
      stage: st.stage,
    })
    toast.success(__('Сделка перенесена'))
    close?.()
    // перерисовать бар под новую воронку + reload карточки.
    funnels.fetch({ deal: props.deal })
    emit('changed', r)
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось перенести сделку'))
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
/* «Шеврон» — треугольный вырез справа у сегмента этапа (форма как в Bitrix).
   Цвет (border-left-color) задаётся инлайн через :style — НЕ tailwind-класс,
   чтобы не зависеть от safelist/purge. */
.dsb-chevron {
  position: absolute;
  right: -9px;
  top: 0;
  bottom: 0;
  width: 0;
  height: 0;
  z-index: 11;
  border-top: 16px solid transparent;
  border-bottom: 16px solid transparent;
  border-left: 9px solid transparent;
}
</style>
