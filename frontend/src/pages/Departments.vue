<template>
  <LayoutHeader>
    <template #left-header>
      <div class="text-lg font-semibold text-ink-gray-8">{{ __('Отделы') }}</div>
    </template>
    <template #right-header>
      <Button
        v-if="isManager()"
        variant="solid"
        :label="__('Создать отдел')"
        iconLeft="plus"
        @click="openCreate"
      />
    </template>
  </LayoutHeader>

  <div class="flex-1 overflow-auto px-4 py-3">
    <p class="mb-3 max-w-2xl text-sm text-ink-gray-5">
      {{ __('Иерархия отделов сверху вниз. Руководитель наследуется на нижние уровни, если у отдела он не задан явно.') }}
    </p>

    <div v-if="flatTree.length" class="flex flex-col gap-1">
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
    <div v-else class="p-8 text-center text-sm text-ink-gray-5">
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
