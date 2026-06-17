<template>
  <LayoutHeader>
    <template #left-header>
      <div class="text-lg font-semibold text-ink-gray-8">{{ __('Воронки') }}</div>
    </template>
  </LayoutHeader>

  <div class="flex-1 overflow-auto px-4 py-4">
    <p class="mb-4 max-w-2xl text-sm text-ink-gray-5">
      {{ __('Этапы воронок = колонки канбана Лидов и Сделок. Добавляйте, переименовывайте, меняйте порядок и цвет прямо здесь.') }}
    </p>

    <div v-for="s in sections" :key="s.kind" class="mb-8 max-w-2xl">
      <h3 class="mb-2 text-base font-semibold text-ink-gray-8">{{ s.title }}</h3>
      <div v-if="state[s.kind]" class="flex flex-col gap-1.5">
        <div
          v-for="(st, i) in state[s.kind].stages"
          :key="st.name"
          class="flex items-center gap-2 rounded border border-outline-gray-1 px-2 py-1.5"
        >
          <Popover>
            <template #target="{ togglePopover }">
              <button
                class="flex h-5 w-5 items-center justify-center rounded hover:bg-surface-gray-2"
                :title="__('Цвет')"
                @click="togglePopover"
              >
                <IndicatorIcon :class="parseColor(st.color)" />
              </button>
            </template>
            <template #body>
              <div class="grid grid-cols-6 gap-1 rounded-lg bg-surface-modal p-2 shadow-xl ring-1 ring-black ring-opacity-5">
                <button
                  v-for="c in state[s.kind].palette"
                  :key="c"
                  class="flex h-6 w-6 items-center justify-center rounded hover:bg-surface-gray-2"
                  @click="setColor(s.kind, st.name, c)"
                >
                  <IndicatorIcon :class="parseColor(c)" />
                </button>
              </div>
            </template>
          </Popover>

          <input
            class="flex-1 rounded border-0 bg-transparent px-1 text-sm text-ink-gray-8 focus:outline-none focus:ring-1 focus:ring-outline-gray-3"
            :value="st.name"
            @keydown.enter="$event.target.blur()"
            @blur="(e) => rename(s.kind, st.name, e)"
          />

          <Button
            variant="ghost"
            size="sm"
            icon="chevron-up"
            :disabled="i === 0 || busy"
            @click="move(s.kind, st.name, 'up')"
          />
          <Button
            variant="ghost"
            size="sm"
            icon="chevron-down"
            :disabled="i === state[s.kind].stages.length - 1 || busy"
            @click="move(s.kind, st.name, 'down')"
          />
          <Button variant="ghost" size="sm" icon="trash-2" :disabled="busy" @click="del(s.kind, st.name)" />
        </div>

        <div class="mt-1 flex items-center gap-2">
          <input
            v-model="newStage[s.kind]"
            class="flex-1 rounded border border-outline-gray-2 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-outline-gray-3"
            :placeholder="__('Новый этап…')"
            @keydown.enter="addStage(s.kind)"
          />
          <Button variant="subtle" :label="__('Добавить')" iconLeft="plus" :disabled="busy" @click="addStage(s.kind)" />
        </div>
      </div>
      <div v-else class="text-sm text-ink-gray-5">{{ __('Загрузка…') }}</div>
    </div>
  </div>
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import { Button, Popover, call, toast } from 'frappe-ui'
import { reactive, ref, onMounted } from 'vue'
import { parseColor } from '@/utils'

const sections = [
  { kind: 'lead', title: 'Воронка лидов' },
  { kind: 'deal', title: 'Воронка продаж (сделки)' },
]
const state = reactive({})
const newStage = reactive({ lead: '', deal: '' })
const busy = ref(false)

async function load(kind) {
  const r = await call('nacifrah.funnels.get_funnel_stages', { kind })
  state[kind] = r
}
onMounted(() => sections.forEach((s) => load(s.kind)))

async function act(fn, params, kind) {
  busy.value = true
  try {
    await call(fn, params)
    await load(kind)
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Ошибка'))
  } finally {
    busy.value = false
  }
}
function addStage(kind) {
  const name = (newStage[kind] || '').trim()
  if (!name) return
  newStage[kind] = ''
  act('nacifrah.funnels.add_funnel_stage', { kind, stage_name: name }, kind)
}
function rename(kind, oldName, ev) {
  const nn = (ev.target.value || '').trim()
  if (!nn || nn === oldName) {
    ev.target.value = oldName
    return
  }
  act('nacifrah.funnels.rename_funnel_stage', { kind, old_name: oldName, new_name: nn }, kind)
}
function setColor(kind, name, color) {
  act('nacifrah.funnels.set_funnel_stage_color', { kind, stage_name: name, color }, kind)
}
function move(kind, name, direction) {
  act('nacifrah.funnels.reorder_funnel_stage', { kind, stage_name: name, direction }, kind)
}
function del(kind, name) {
  act('nacifrah.funnels.delete_funnel_stage', { kind, stage_name: name }, kind)
}
</script>
