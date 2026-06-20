<template>
  <LayoutHeader>
    <template #left-header>
      <div class="text-lg font-semibold text-ink-gray-8">{{ __('Воронки') }}</div>
    </template>
    <template #right-header>
      <Button
        variant="solid"
        :label="__('Создать воронку')"
        iconLeft="plus"
        @click="openCreate"
      />
    </template>
  </LayoutHeader>

  <div class="flex-1 overflow-auto px-4 py-4">
    <p class="mb-4 max-w-2xl text-sm text-ink-gray-5">
      {{ __('Все воронки списком. Нажмите на воронку, чтобы развернуть редактор этапов (цвет, тип, порядок). Иконку можно выбрать кликом по ней.') }}
    </p>

    <div v-if="!funnels.length" class="text-sm text-ink-gray-5">{{ __('Загрузка…') }}</div>

    <!-- I1: единый список воронок в виде сворачиваемых подкатов (accordion) -->
    <div class="flex max-w-2xl flex-col gap-2">
      <div
        v-for="item in funnels"
        :key="item.key"
        class="rounded-lg border border-outline-gray-2"
      >
        <!-- свёрнутая шапка подката -->
        <div class="flex items-center gap-2 px-2.5 py-2">
          <FeatherIcon
            name="chevron-right"
            class="h-4 w-4 shrink-0 cursor-pointer text-ink-gray-5 transition-transform"
            :class="{ 'rotate-90': item.expanded }"
            @click="item.expanded = !item.expanded"
          />
          <!-- I2: визуальный пикер иконки (кастомные); нативные — фикс-иконка -->
          <Popover v-if="item.type === 'custom'">
            <template #target="{ togglePopover }">
              <button
                class="flex h-7 w-7 items-center justify-center rounded hover:bg-surface-gray-2"
                :title="__('Выбрать иконку')"
                @click.stop="togglePopover"
              >
                <FeatherIcon :name="item.icon || 'filter'" class="h-4 w-4 text-ink-gray-7" />
              </button>
            </template>
            <template #body="{ togglePopover }">
              <div class="grid grid-cols-6 gap-1 rounded-lg bg-surface-modal p-2 shadow-xl ring-1 ring-black ring-opacity-5">
                <button
                  v-for="ic in ICON_SET"
                  :key="ic"
                  class="flex h-7 w-7 items-center justify-center rounded hover:bg-surface-gray-2"
                  :class="item.icon === ic ? 'bg-surface-gray-3' : ''"
                  @click="(setIcon(item, ic), togglePopover())"
                >
                  <FeatherIcon :name="ic" class="h-4 w-4 text-ink-gray-7" />
                </button>
              </div>
            </template>
          </Popover>
          <span v-else class="flex h-7 w-7 items-center justify-center">
            <FeatherIcon :name="item.icon" class="h-4 w-4 text-ink-gray-6" />
          </span>

          <button
            class="flex-1 cursor-pointer text-left text-base font-medium text-ink-gray-8"
            @click="item.expanded = !item.expanded"
          >
            {{ item.title }}
          </button>
          <span class="text-xs text-ink-gray-5">{{ item.stages.length }} {{ __('этап.') }}</span>
          <!-- L1: защищённые воронки (Допродажа) удалять нельзя -->
          <Button
            v-if="item.type === 'custom' && !item.protected"
            variant="ghost"
            size="sm"
            icon="trash-2"
            :title="__('Удалить воронку')"
            @click.stop="deleteFunnel(item)"
          />
        </div>

        <!-- развёрнутый редактор этапов (как у Лидов/Сделок) -->
        <div v-if="item.expanded" class="border-t border-outline-gray-1 px-2.5 py-2">
          <Draggable
            :list="item.stages"
            item-key="_orig"
            handle=".drag-h"
            class="flex flex-col gap-1.5"
            @end="() => reorder(item)"
          >
            <template #item="{ element: st }">
              <div class="flex items-center gap-2 rounded border border-outline-gray-1 px-2 py-1.5">
                <span class="drag-h cursor-grab text-ink-gray-4 active:cursor-grabbing" :title="__('Перетащить')">
                  <FeatherIcon name="menu" class="h-4 w-4" />
                </span>
                <Popover>
                  <template #target="{ togglePopover }">
                    <button class="flex h-5 w-5 items-center justify-center rounded hover:bg-surface-gray-2" :title="__('Цвет')" @click="togglePopover">
                      <IndicatorIcon :class="parseColor(st.color)" />
                    </button>
                  </template>
                  <template #body="{ togglePopover }">
                    <div class="grid grid-cols-6 gap-1 rounded-lg bg-surface-modal p-2 shadow-xl ring-1 ring-black ring-opacity-5">
                      <button v-for="c in PALETTE" :key="c" class="flex h-6 w-6 items-center justify-center rounded hover:bg-surface-gray-2" @click="(setColor(item, st, c), togglePopover())">
                        <IndicatorIcon :class="parseColor(c)" />
                      </button>
                    </div>
                  </template>
                </Popover>
                <Popover>
                  <template #target="{ togglePopover }">
                    <button class="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium" :class="kindBadgeClass(st.kind)" :title="__('Тип этапа')" @click="togglePopover">
                      {{ kindLabel(st.kind) }}
                    </button>
                  </template>
                  <template #body="{ togglePopover }">
                    <div class="flex flex-col gap-0.5 rounded-lg bg-surface-modal p-1 shadow-xl ring-1 ring-black ring-opacity-5">
                      <button v-for="k in stageKinds" :key="k.value" class="flex items-center gap-2 whitespace-nowrap rounded px-2 py-1 text-left text-sm hover:bg-surface-gray-2" @click="(setKind(item, st, k.value), togglePopover())">
                        <span class="size-2 rounded-full" :class="k.dot" />
                        {{ k.label }}
                      </button>
                    </div>
                  </template>
                </Popover>
                <input
                  class="flex-1 rounded border-0 bg-transparent px-1 text-sm text-ink-gray-8 focus:outline-none focus:ring-1 focus:ring-outline-gray-3"
                  :value="st.label"
                  @keydown.enter="$event.target.blur()"
                  @blur="(e) => renameStage(item, st, e)"
                />
                <Button variant="ghost" size="sm" icon="trash-2" :disabled="busy" @click="delStage(item, st)" />
              </div>
            </template>
          </Draggable>
          <div class="mt-1.5 flex items-center gap-2">
            <input
              v-model="newStage[item.key]"
              class="flex-1 rounded border border-outline-gray-2 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-outline-gray-3"
              :placeholder="__('Новый этап…')"
              @keydown.enter="addStage(item)"
            />
            <Button variant="subtle" :label="__('Добавить')" iconLeft="plus" :disabled="busy" @click="addStage(item)" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <Dialog v-model="createDialog" :options="{ title: __('Создать воронку') }">
    <template #body-content>
      <div class="flex flex-col gap-3">
        <FormControl :label="__('Название воронки')" v-model="newFunnelName" :placeholder="__('Например, Партнёры')" />
        <ErrorMessage v-if="createErr" :message="createErr" />
        <p class="text-xs text-ink-gray-4">{{ __('После создания раскройте воронку и настройте этапы (цвет, тип, порядок).') }}</p>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <Button :label="__('Отмена')" @click="createDialog = false" />
        <Button variant="solid" :label="__('Создать')" :loading="creating" @click="doCreateFunnel" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import {
  Button,
  Popover,
  FeatherIcon,
  Dialog,
  FormControl,
  ErrorMessage,
  call,
  toast,
} from 'frappe-ui'
import { reactive, ref, onMounted } from 'vue'
import { parseColor } from '@/utils'
import { STAGE_COLOR_PALETTE } from '@/utils/colors'
import Draggable from 'vuedraggable'

const PALETTE = STAGE_COLOR_PALETTE
const ICON_SET = [
  'filter', 'briefcase', 'user-plus', 'users', 'target', 'trending-up',
  'dollar-sign', 'shopping-cart', 'phone', 'mail', 'star', 'flag',
  'award', 'zap', 'heart', 'package', 'clipboard', 'pie-chart',
  'layers', 'grid', 'compass', 'gift', 'bookmark', 'box',
]
const stageKinds = [
  { value: 'normal', label: 'В работе', dot: 'bg-gray-400' },
  { value: 'key_negative', label: 'Ключевой − (проигрыш)', dot: 'bg-red-500' },
  { value: 'key_positive', label: 'Ключевой + (успех)', dot: 'bg-green-500' },
]
function kindLabel(k) {
  if (k === 'key_positive') return 'Ключевой +'
  if (k === 'key_negative') return 'Ключевой −'
  return 'В работе'
}
function kindBadgeClass(k) {
  if (k === 'key_positive') return 'bg-green-100 text-green-700'
  if (k === 'key_negative') return 'bg-red-100 text-red-700'
  return 'bg-surface-gray-2 text-ink-gray-6'
}

const NATIVE = [
  { kind: 'lead', title: 'Воронка лидов', icon: 'user-plus' },
  { kind: 'deal', title: 'Воронка продаж (сделки)', icon: 'briefcase' },
]
const funnels = ref([])
const newStage = reactive({})
const busy = ref(false)

function _mapNative(stages) {
  return (stages || []).map((s) => ({
    label: s.name,
    color: s.color || 'gray',
    kind: s.stage_kind || 'normal',
    _orig: s.name,
  }))
}
function _mapCustom(stages) {
  return (stages || []).map((s) => ({
    label: s.stage_name,
    color: s.color || 'gray',
    kind: s.is_won ? 'key_positive' : s.is_lost ? 'key_negative' : 'normal',
    _orig: s.stage_name,
  }))
}

async function loadAll() {
  const items = []
  for (const n of NATIVE) {
    let stages = []
    try {
      const r = await call('nacifrah.funnels.get_funnel_stages', { kind: n.kind })
      stages = _mapNative(r.stages)
    } catch (e) {}
    items.push({ key: 'n:' + n.kind, type: 'native', kind: n.kind, title: n.title, icon: n.icon, stages, expanded: false })
  }
  try {
    const cf = (await call('nacifrah.api.list_funnels_admin')) || []
    for (const f of cf) {
      items.push({ key: 'c:' + f.name, type: 'custom', name: f.name, title: f.funnel_name, icon: f.icon || 'filter', protected: f.protected, existing_clients: f.existing_clients, stages: _mapCustom(f.stages), expanded: false })
    }
  } catch (e) {}
  // сохраняем развёрнутость по ключу
  const exp = new Set(funnels.value.filter((x) => x.expanded).map((x) => x.key))
  for (const it of items) if (exp.has(it.key)) it.expanded = true
  funnels.value = items
}
onMounted(loadAll)

async function reloadOne(item) {
  if (item.type === 'native') {
    const r = await call('nacifrah.funnels.get_funnel_stages', { kind: item.kind })
    item.stages = _mapNative(r.stages)
  } else {
    const cf = (await call('nacifrah.api.list_funnels_admin')) || []
    const f = cf.find((x) => x.name === item.name)
    if (f) item.stages = _mapCustom(f.stages)
  }
}
function _customPayload(item) {
  return item.stages.map((s, i) => ({
    stage_name: s.label,
    sequence: i + 1,
    color: s.color,
    is_won: s.kind === 'key_positive' ? 1 : 0,
    is_lost: s.kind === 'key_negative' ? 1 : 0,
  }))
}
async function _saveCustom(item) {
  await call('nacifrah.api.update_funnel', { funnel: item.name, stages: JSON.stringify(_customPayload(item)) })
}
async function run(fn) {
  busy.value = true
  try {
    await fn()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Ошибка'))
  } finally {
    busy.value = false
  }
}

function setColor(item, st, color) {
  st.color = color
  run(async () => {
    if (item.type === 'native') await call('nacifrah.funnels.set_funnel_stage_color', { kind: item.kind, stage_name: st._orig, color })
    else await _saveCustom(item)
  })
}
function setKind(item, st, kind) {
  st.kind = kind
  run(async () => {
    if (item.type === 'native') await call('nacifrah.funnels.set_funnel_stage_kind', { kind: item.kind, stage_name: st._orig, stage_kind: kind })
    else await _saveCustom(item)
    await reloadOne(item)
  })
}
function renameStage(item, st, ev) {
  const nn = (ev.target.value || '').trim()
  if (!nn || nn === st.label) {
    ev.target.value = st.label
    return
  }
  run(async () => {
    if (item.type === 'native') await call('nacifrah.funnels.rename_funnel_stage', { kind: item.kind, old_name: st._orig, new_name: nn })
    else {
      st.label = nn
      await _saveCustom(item)
    }
    await reloadOne(item)
  })
}
function reorder(item) {
  run(async () => {
    if (item.type === 'native') await call('nacifrah.funnels.set_funnel_order', { kind: item.kind, order: JSON.stringify(item.stages.map((s) => s._orig)) })
    else await _saveCustom(item)
    await reloadOne(item)
  })
}
function delStage(item, st) {
  run(async () => {
    if (item.type === 'native') await call('nacifrah.funnels.delete_funnel_stage', { kind: item.kind, stage_name: st._orig })
    else {
      item.stages = item.stages.filter((s) => s !== st)
      await _saveCustom(item)
    }
    await reloadOne(item)
  })
}
function addStage(item) {
  const name = (newStage[item.key] || '').trim()
  if (!name) return
  newStage[item.key] = ''
  run(async () => {
    if (item.type === 'native') await call('nacifrah.funnels.add_funnel_stage', { kind: item.kind, stage_name: name })
    else {
      item.stages.push({ label: name, color: 'gray', kind: 'normal', _orig: name })
      await _saveCustom(item)
    }
    await reloadOne(item)
  })
}
function setIcon(item, icon) {
  if (item.type !== 'custom') return
  item.icon = icon
  run(async () => {
    await call('nacifrah.api.update_funnel', { funnel: item.name, icon })
  })
}

// Создание / удаление воронки
const createDialog = ref(false)
const newFunnelName = ref('')
const creating = ref(false)
const createErr = ref('')
function openCreate() {
  createErr.value = ''
  newFunnelName.value = ''
  createDialog.value = true
}
async function doCreateFunnel() {
  const nm = newFunnelName.value.trim()
  if (!nm) {
    createErr.value = __('Введите название воронки')
    return
  }
  creating.value = true
  try {
    await call('nacifrah.api.create_funnel', {
      funnel_name: nm,
      icon: 'filter',
      stages: JSON.stringify([{ stage_name: 'Новый этап', color: 'blue', sequence: 1 }]),
    })
    createDialog.value = false
    newFunnelName.value = ''
    await loadAll()
    const it = funnels.value.find((f) => f.type === 'custom' && f.title === nm)
    if (it) it.expanded = true
    toast.success(__('Воронка создана'))
  } catch (e) {
    createErr.value = e?.messages?.[0] || __('Не удалось создать воронку')
  } finally {
    creating.value = false
  }
}
async function deleteFunnel(item) {
  if (!window.confirm(__('Удалить воронку «{0}»? Сделки будут отвязаны.', [item.title]))) return
  try {
    await call('nacifrah.api.delete_funnel', { funnel: item.name })
    await loadAll()
    toast.success(__('Воронка удалена'))
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось удалить воронку'))
  }
}
</script>
