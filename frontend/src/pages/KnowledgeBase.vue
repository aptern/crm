<template>
  <LayoutHeader>
    <template #left-header>
      <div class="text-lg font-semibold text-ink-gray-8">{{ __('База знаний') }}</div>
    </template>
    <template #right-header>
      <Button
        v-if="canEdit"
        variant="subtle"
        :label="__('Создать страницу')"
        iconLeft="plus"
        @click="openCreate"
      />
    </template>
  </LayoutHeader>

  <div class="flex flex-1 overflow-hidden">
    <!-- разделы и страницы -->
    <div
      class="w-64 shrink-0 overflow-y-auto border-r border-outline-gray-1 px-3 py-3"
    >
      <div v-for="s in tree.sections || []" :key="s.label" class="mb-3">
        <div class="mb-1 px-1 text-xs font-semibold uppercase text-ink-gray-5">
          {{ s.label }}
        </div>
        <button
          v-for="p in s.pages"
          :key="p.name"
          class="block w-full truncate rounded px-2 py-1 text-left text-sm"
          :class="
            current && current.name === p.name
              ? 'bg-surface-gray-3 font-medium text-ink-gray-9'
              : 'text-ink-gray-7 hover:bg-surface-gray-2'
          "
          @click="openPage(p.name)"
        >
          {{ p.title }}
        </button>
      </div>
      <div
        v-if="!(tree.sections || []).length"
        class="px-1 text-sm text-ink-gray-4"
      >
        {{ __('Пока пусто') }}
      </div>
    </div>

    <!-- содержимое страницы -->
    <div class="flex-1 overflow-y-auto px-8 py-6">
      <div v-if="current" class="mx-auto max-w-3xl">
        <div class="mb-4 flex items-center justify-between gap-2">
          <h1 class="text-2xl font-semibold text-ink-gray-9">{{ current.title }}</h1>
          <div class="flex shrink-0 gap-2">
            <Button
              v-if="canEdit && !editing"
              variant="subtle"
              iconLeft="edit"
              :label="__('Редактировать')"
              @click="startEdit"
            />
            <template v-if="editing">
              <Button :label="__('Отмена')" @click="editing = false" />
              <Button
                variant="solid"
                :label="__('Сохранить')"
                :loading="saving"
                @click="saveEdit"
              />
            </template>
          </div>
        </div>
        <textarea
          v-if="editing"
          v-model="editContent"
          rows="22"
          class="w-full resize-y rounded-md border border-outline-gray-2 bg-surface-gray-1 p-3 font-mono text-sm text-ink-gray-8 focus:outline-none focus:ring-1 focus:ring-outline-gray-3"
          :placeholder="__('Текст в формате Markdown…')"
        />
        <div
          v-else
          class="prose prose-sm max-w-none text-ink-gray-8"
          v-html="current.html"
        />
      </div>
      <div
        v-else
        class="flex h-full items-center justify-center text-sm text-ink-gray-5"
      >
        {{ __('Выберите страницу слева') }}
      </div>
    </div>
  </div>

  <Dialog v-model="showCreate" :options="{ title: __('Создать страницу') }">
    <template #body-content>
      <div class="flex flex-col gap-3">
        <FormControl
          :label="__('Заголовок')"
          v-model="createForm.title"
          :placeholder="__('Например, Регламент отпусков')"
        />
        <FormControl
          :label="__('Раздел')"
          v-model="createForm.section"
          :placeholder="__('Например, Регламенты')"
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
  call,
  toast,
} from 'frappe-ui'
import { reactive, ref, onMounted } from 'vue'
import { usersStore } from '@/stores/users'

const { isManager } = usersStore()
const canEdit = isManager()

const tree = reactive({ sections: [] })
const current = ref(null)

async function loadTree() {
  try {
    const r = await call('nacifrah.kb_api.get_kb_tree')
    tree.sections = r?.sections || []
    // открыть первую страницу первого непустого раздела
    if (!current.value) {
      for (const s of tree.sections) {
        if (s.pages && s.pages.length) {
          openPage(s.pages[0].name)
          break
        }
      }
    }
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось загрузить базу знаний'))
  }
}
onMounted(loadTree)

const editing = ref(false)
const editContent = ref('')
const saving = ref(false)

async function openPage(name) {
  editing.value = false
  try {
    current.value = await call('nacifrah.kb_api.get_kb_page', { name })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось открыть страницу'))
  }
}
function startEdit() {
  editContent.value = current.value?.content || ''
  editing.value = true
}
async function saveEdit() {
  if (!current.value) return
  saving.value = true
  try {
    const r = await call('nacifrah.kb_api.save_kb_page', {
      name: current.value.name,
      content: editContent.value,
    })
    current.value.content = editContent.value
    current.value.html = r?.html || current.value.html
    editing.value = false
    toast.success(__('Сохранено'))
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось сохранить'))
  } finally {
    saving.value = false
  }
}

const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = reactive({ title: '', section: '' })
function openCreate() {
  createError.value = ''
  createForm.title = ''
  createForm.section = ''
  showCreate.value = true
}
async function doCreate() {
  createError.value = ''
  if (!createForm.title.trim()) {
    createError.value = __('Укажите заголовок')
    return
  }
  creating.value = true
  try {
    const r = await call('nacifrah.kb_api.create_kb_page', {
      title: createForm.title.trim(),
      section: createForm.section.trim() || 'Без раздела',
    })
    showCreate.value = false
    await loadTree()
    if (r?.name) await openPage(r.name)
    toast.success(__('Страница создана'))
  } catch (e) {
    createError.value = e?.messages?.[0] || __('Не удалось создать страницу')
  } finally {
    creating.value = false
  }
}
</script>
