<template>
  <LayoutHeader>
    <template #left-header>
      <div class="text-lg font-semibold text-ink-gray-8">{{ __('Отделы') }}</div>
    </template>
    <template #right-header>
      <div class="flex items-center gap-2">
        <!-- D4: переключатель Дерево / Граф -->
        <div class="flex rounded bg-surface-gray-2 p-0.5">
          <button
            class="rounded px-2 py-1 text-xs font-medium"
            :class="viewMode === 'tree' ? 'bg-surface-white text-ink-gray-8 shadow-sm' : 'text-ink-gray-5'"
            @click="viewMode = 'tree'"
          >
            {{ __('Дерево') }}
          </button>
          <button
            class="rounded px-2 py-1 text-xs font-medium"
            :class="viewMode === 'graph' ? 'bg-surface-white text-ink-gray-8 shadow-sm' : 'text-ink-gray-5'"
            @click="viewMode = 'graph'"
          >
            {{ __('Граф') }}
          </button>
        </div>
        <Button
          v-if="isManager()"
          variant="solid"
          :label="__('Создать отдел')"
          iconLeft="plus"
          @click="openCreate"
        />
      </div>
    </template>
  </LayoutHeader>

  <div class="flex-1 overflow-auto px-4 py-3">
    <p class="mb-3 max-w-2xl text-sm text-ink-gray-5">
      {{ __('Иерархия отделов сверху вниз. Руководитель наследуется на нижние уровни, если у отдела он не задан явно.') }}
    </p>

    <!-- ГРАФ (D4): org-chart сверху вниз, связи родитель→ребёнок -->
    <div v-if="viewMode === 'graph'">
      <div v-if="graph.nodes.length" class="overflow-auto rounded border border-outline-gray-1 bg-surface-gray-1 p-4">
        <svg
          :width="graph.width"
          :height="graph.height"
          :viewBox="`0 0 ${graph.width} ${graph.height}`"
          class="block"
        >
          <path
            v-for="(e, i) in graph.edges"
            :key="'e' + i"
            :d="edgePath(e[0], e[1])"
            fill="none"
            class="stroke-outline-gray-2"
            stroke-width="1.5"
          />
          <foreignObject
            v-for="n in graph.nodes"
            :key="n.name"
            :x="n._x"
            :y="n._y"
            :width="NODE_W"
            :height="NODE_H"
          >
            <div
              class="flex h-full flex-col justify-center rounded-lg border border-outline-gray-2 bg-surface-white px-2.5 py-1 shadow-sm"
            >
              <div class="truncate text-sm font-medium text-ink-gray-8">
                {{ n.department_name }}
              </div>
              <div class="truncate text-xs text-ink-gray-5">
                {{ n.members }} {{ __('чел.') }}
                <span v-if="n.effective_head_name" :class="n.inherited ? 'text-ink-gray-4' : ''">
                  · {{ n.effective_head_name }}{{ n.inherited ? ' (' + __('насл.') + ')' : '' }}
                </span>
              </div>
            </div>
          </foreignObject>
        </svg>
      </div>
      <div v-else class="p-8 text-center text-sm text-ink-gray-5">
        {{ __('Пока нет отделов. Создайте первый.') }}
      </div>
    </div>

    <div v-if="viewMode === 'tree' && flatTree.length" class="flex flex-col gap-1">
      <div
        v-for="d in flatTree"
        :key="d.name"
        class="flex items-center gap-2 rounded border border-outline-gray-1 px-2 py-1.5"
        :style="{ marginLeft: d.depth * 22 + 'px' }"
      >
        <FeatherIcon
          :name="d.hasChildren ? 'folder' : 'hash'"
          class="h-4 w-4 shrink-0 text-ink-gray-4"
        />
        <span class="font-medium text-ink-gray-8">{{ d.department_name }}</span>
        <span class="text-xs text-ink-gray-5">· {{ d.members }} {{ __('чел.') }}</span>
        <span
          v-if="d.effective_head_name"
          class="text-xs"
          :class="d.inherited ? 'text-ink-gray-4' : 'text-ink-gray-7'"
        >
          · {{ __('рук.') }}: {{ d.effective_head_name
          }}{{ d.inherited ? ' (' + __('наследуется') + ')' : '' }}
        </span>
        <div class="ml-auto flex items-center gap-1">
          <Popover v-if="isManager()">
            <template #target="{ togglePopover }">
              <Button
                variant="ghost"
                size="sm"
                icon="user-check"
                :tooltip="__('Назначить руководителя')"
                @click="togglePopover"
              />
            </template>
            <template #body="{ togglePopover }">
              <div
                class="max-h-60 w-56 overflow-y-auto rounded-lg bg-surface-modal p-1 shadow-xl ring-1 ring-black ring-opacity-5"
              >
                <button
                  class="flex w-full items-center rounded px-2 py-1 text-left text-sm text-ink-gray-5 hover:bg-surface-gray-2"
                  @click="(setHead(d.name, ''), togglePopover())"
                >
                  {{ __('— наследовать сверху —') }}
                </button>
                <button
                  v-for="u in users"
                  :key="u.value"
                  class="flex w-full items-center gap-2 truncate rounded px-2 py-1 text-left text-sm hover:bg-surface-gray-2"
                  @click="(setHead(d.name, u.value), togglePopover())"
                >
                  {{ u.label }}
                </button>
              </div>
            </template>
          </Popover>
        </div>
      </div>
    </div>
    <div
      v-else-if="viewMode === 'tree' && !flatTree.length"
      class="p-8 text-center text-sm text-ink-gray-5"
    >
      {{ __('Пока нет отделов. Создайте первый.') }}
    </div>
  </div>

  <Dialog v-model="showCreate" :options="{ title: __('Создать отдел') }">
    <template #body-content>
      <div class="flex flex-col gap-3">
        <FormControl
          :label="__('Название')"
          v-model="createForm.name"
          :placeholder="__('Например, Дизайн')"
        />
        <FormControl
          type="select"
          :label="__('Родительский отдел')"
          :options="parentOptions"
          v-model="createForm.parent"
        />
        <FormControl
          type="select"
          :label="__('Руководитель')"
          :options="headOptions"
          v-model="createForm.head"
        />
        <ErrorMessage v-if="createError" :message="createError" />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <Button :label="__('Отмена')" @click="showCreate = false" />
        <Button
          variant="solid"
          :label="__('Создать')"
          :loading="creating"
          @click="doCreate"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import {
  Button,
  Dialog,
  FormControl,
  ErrorMessage,
  Popover,
  FeatherIcon,
  call,
  toast,
} from 'frappe-ui'
import { reactive, ref, computed, onMounted } from 'vue'
import { usersStore } from '@/stores/users'

const { isManager, users: usersList } = usersStore()

const departments = ref([])
async function load() {
  try {
    const r = await call('nacifrah.hr.get_department_tree')
    departments.value = r?.departments || []
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось загрузить отделы'))
  }
}
onMounted(load)

const users = computed(
  () =>
    usersList.data?.crmUsers
      ?.filter((u) => u.enabled)
      .map((u) => ({ label: u.full_name?.trimEnd() || u.name, value: u.name })) || [],
)

// корневой ERPNext-отдел («Все отделы») не показываем — его дети = верхний уровень
function isErpRoot(d) {
  return (
    !d.parent ||
    d.department_name === 'Все отделы' ||
    d.department_name === 'All Departments'
  )
}
const flatTree = computed(() => {
  const all = (departments.value || []).filter((d) => !isErpRoot(d))
  const names = new Set(all.map((d) => d.name))
  const childrenOf = {}
  for (const d of all) {
    const key = names.has(d.parent) ? d.parent : '__root__'
    ;(childrenOf[key] = childrenOf[key] || []).push(d)
  }
  const out = []
  const walk = (key, depth) => {
    for (const d of childrenOf[key] || []) {
      out.push({ ...d, depth, hasChildren: !!(childrenOf[d.name] || []).length })
      walk(d.name, depth + 1)
    }
  }
  walk('__root__', 0)
  return out
})

// D4: граф отделов (org-chart). Раскладка сверху вниз без внешних библиотек:
// x листьев — по порядку, x родителя — по центру детей; y — по глубине.
const viewMode = ref('tree')
const NODE_W = 180
const NODE_H = 52
const H_GAP = 24
const V_GAP = 44
const graph = computed(() => {
  const all = (departments.value || []).filter((d) => !isErpRoot(d))
  const names = new Set(all.map((d) => d.name))
  const childrenOf = {}
  for (const d of all) {
    const key = names.has(d.parent) ? d.parent : '__root__'
    ;(childrenOf[key] = childrenOf[key] || []).push(d)
  }
  const build = (d, depth) => ({
    ...d,
    depth,
    children: (childrenOf[d.name] || []).map((c) => build(c, depth + 1)),
  })
  const roots = (childrenOf['__root__'] || []).map((d) => build(d, 0))

  const nodes = []
  const edges = []
  let leaf = 0
  const assign = (node) => {
    if (!node.children.length) {
      node._x = leaf * (NODE_W + H_GAP)
      leaf++
    } else {
      node.children.forEach(assign)
      const f = node.children[0]._x
      const l = node.children[node.children.length - 1]._x
      node._x = (f + l) / 2
    }
    node._y = node.depth * (NODE_H + V_GAP)
    nodes.push(node)
    for (const c of node.children) edges.push([node, c])
  }
  roots.forEach(assign)

  const width = nodes.length ? Math.max(...nodes.map((n) => n._x)) + NODE_W : 0
  const height = nodes.length ? Math.max(...nodes.map((n) => n._y)) + NODE_H : 0
  return { nodes, edges, width, height }
})
function edgePath(p, c) {
  const x1 = p._x + NODE_W / 2
  const y1 = p._y + NODE_H
  const x2 = c._x + NODE_W / 2
  const y2 = c._y
  const my = (y1 + y2) / 2
  return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`
}

const parentOptions = computed(() => [
  { label: __('— верхний уровень —'), value: '' },
  ...flatTree.value.map((d) => ({
    label: '— '.repeat(d.depth) + d.department_name,
    value: d.name,
  })),
])
const headOptions = computed(() => [
  { label: __('— наследовать сверху —'), value: '' },
  ...users.value,
])

async function setHead(department, head) {
  try {
    await call('nacifrah.hr.set_department_head', { department, head: head || null })
    await load()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось назначить руководителя'))
  }
}

const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = reactive({ name: '', parent: '', head: '' })
function openCreate() {
  createError.value = ''
  createForm.name = ''
  createForm.parent = ''
  createForm.head = ''
  showCreate.value = true
}
async function doCreate() {
  createError.value = ''
  if (!createForm.name.trim()) {
    createError.value = __('Укажите название отдела')
    return
  }
  creating.value = true
  try {
    await call('nacifrah.hr.create_department', {
      department_name: createForm.name.trim(),
      parent_department: createForm.parent || null,
      head: createForm.head || null,
    })
    showCreate.value = false
    await load()
    toast.success(__('Отдел создан'))
  } catch (e) {
    createError.value = e?.messages?.[0] || __('Не удалось создать отдел')
  } finally {
    creating.value = false
  }
}
</script>
