<!--
  P-E1 + P-E2: блоки «Подзадачи» и «Связанные задачи» в карточке (детали) задачи.
  • Подзадачи — обычные CRM Task с заполненным nacifrah_parent_task (полный функционал).
    Список с чекбоксом статуса + инлайн-добавление.
  • Связанные задачи — строки Nacifrah Task Link (двусторонний рендер: прямые + инверсные
    с зеркальной меткой relation). Добавление: выбор задачи + типа связи.
  Открытие связанной/подзадачи по клику — через @open (родитель решает навигацию).
-->
<template>
  <div class="mt-6 flex flex-col gap-6 border-t border-outline-gray-1 pt-4">
    <!-- ── P-E1: Подзадачи ───────────────────────────────────────────── -->
    <section class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-base font-semibold text-ink-gray-8">
          <FeatherIcon name="git-branch" class="h-4 w-4 text-ink-gray-5" />
          {{ __('Подзадачи') }}
          <span v-if="subtasks.length" class="text-sm font-normal text-ink-gray-5">
            {{ subDone }}/{{ subtasks.length }}
          </span>
        </div>
      </div>

      <div v-if="subtasks.length" class="flex flex-col gap-1">
        <div
          v-for="s in subtasks"
          :key="s.name"
          class="flex items-center gap-2 rounded border border-outline-gray-1 px-2 py-1.5 hover:bg-surface-gray-1"
        >
          <input
            type="checkbox"
            class="shrink-0 cursor-pointer"
            :checked="!!s.is_done"
            :title="__('Отметить выполненной')"
            @change="toggleSubtask(s)"
          />
          <button
            class="flex-1 truncate text-left text-sm text-ink-gray-8 hover:underline"
            :class="s.is_done ? 'line-through text-ink-gray-4' : ''"
            @click="$emit('open', s.name)"
          >
            {{ s.title || s.name }}
          </button>
          <Avatar
            v-if="s.assigned_to"
            :label="s.assigned_to"
            size="sm"
            class="shrink-0"
          />
        </div>
      </div>
      <div v-else class="text-sm text-ink-gray-4">{{ __('Подзадач пока нет.') }}</div>

      <!-- инлайн-добавление подзадачи -->
      <div class="flex items-center gap-2">
        <FormControl
          class="flex-1"
          v-model="newSubtaskTitle"
          :placeholder="__('Новая подзадача…')"
          @keydown.enter="addSubtask"
        />
        <Button
          variant="subtle"
          icon="plus"
          :loading="subSaving"
          :title="__('Добавить подзадачу')"
          @click="addSubtask"
        />
      </div>
    </section>

    <!-- ── P-E2: Связанные задачи ────────────────────────────────────── -->
    <section class="flex flex-col gap-2">
      <div class="flex items-center gap-2 text-base font-semibold text-ink-gray-8">
        <FeatherIcon name="link" class="h-4 w-4 text-ink-gray-5" />
        {{ __('Связанные задачи') }}
        <span v-if="links.length" class="text-sm font-normal text-ink-gray-5">
          {{ links.length }}
        </span>
      </div>

      <div v-if="links.length" class="flex flex-col gap-1">
        <div
          v-for="l in links"
          :key="l.link_name"
          class="flex items-center gap-2 rounded border border-outline-gray-1 px-2 py-1.5 hover:bg-surface-gray-1"
        >
          <span
            class="shrink-0 rounded bg-surface-gray-2 px-1.5 py-0.5 text-xs text-ink-gray-6"
          >{{ l.relation }}</span>
          <button
            class="flex-1 truncate text-left text-sm text-ink-gray-8 hover:underline"
            @click="$emit('open', l.name)"
          >
            {{ l.title || l.name }}
          </button>
          <Button
            variant="ghost"
            size="sm"
            icon="x"
            :title="__('Убрать связь')"
            @click="removeLink(l.link_name)"
          />
        </div>
      </div>
      <div v-else class="text-sm text-ink-gray-4">{{ __('Связей пока нет.') }}</div>

      <!-- добавить связь: тип + выбор задачи -->
      <div class="flex items-end gap-2">
        <FormControl
          class="w-36"
          type="select"
          :label="__('Тип связи')"
          :options="relationOptions"
          v-model="newRelation"
        />
        <div class="flex-1">
          <Link
            :label="__('Задача')"
            doctype="CRM Task"
            :filters="taskLinkFilters"
            :value="newLinkedTask"
            @change="(v) => (newLinkedTask = v)"
          />
        </div>
        <Button
          variant="subtle"
          icon="plus"
          :loading="linkSaving"
          :title="__('Связать')"
          @click="addLink"
        />
      </div>
      <ErrorMessage v-if="linkErr" :message="linkErr" />
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { Avatar, Button, FeatherIcon, FormControl, ErrorMessage, call, toast } from 'frappe-ui'
import { napi } from '@/utils/api'
import Link from '@/components/Controls/Link.vue'

const props = defineProps({
  task: { type: [String, Number], required: true },
})
const emit = defineEmits(['open', 'changed'])

const subtasks = ref([])
const newSubtaskTitle = ref('')
const subSaving = ref(false)

const subDone = computed(() => subtasks.value.filter((s) => s.is_done).length)

// исключаем саму задачу из выбора связанной (защита от self-link на уровне UI)
const taskLinkFilters = computed(() => ({ name: ['!=', String(props.task)] }))

const links = ref([])
const newRelation = ref('связана')
const newLinkedTask = ref('')
const linkSaving = ref(false)
const linkErr = ref('')
const relationOptions = [
  { value: 'связана', label: __('связана') },
  { value: 'блокирует', label: __('блокирует') },
  { value: 'блокируется', label: __('блокируется') },
  { value: 'дублирует', label: __('дублирует') },
  { value: 'относится к', label: __('относится к') },
]

async function loadSubtasks() {
  try {
    subtasks.value = (await call(napi('tasks_api.get_subtasks'), { task: props.task })) || []
  } catch (e) {
    subtasks.value = []
  }
}
async function addSubtask() {
  const title = newSubtaskTitle.value.trim()
  if (!title) return
  subSaving.value = true
  try {
    await call(napi('tasks_api.create_subtask'), { parent: props.task, title })
    newSubtaskTitle.value = ''
    await loadSubtasks()
    emit('changed')
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось создать подзадачу'))
  } finally {
    subSaving.value = false
  }
}
async function toggleSubtask(s) {
  const done = !s.is_done
  try {
    await call('frappe.client.set_value', {
      doctype: 'CRM Task',
      name: s.name,
      fieldname: {
        status: done ? 'Done' : 'Todo',
        nacifrah_stage: done ? 'Выполнена' : 'Запланировано',
      },
    })
    await loadSubtasks()
    emit('changed')
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось обновить'))
  }
}

async function loadLinks() {
  try {
    links.value = (await call(napi('tasks_api.get_task_links'), { task: props.task })) || []
  } catch (e) {
    links.value = []
  }
}
async function addLink() {
  linkErr.value = ''
  if (!newLinkedTask.value) {
    linkErr.value = __('Выберите задачу для связи')
    return
  }
  linkSaving.value = true
  try {
    await call(napi('tasks_api.add_task_link'), {
      task: props.task,
      linked_task: newLinkedTask.value,
      relation: newRelation.value,
    })
    newLinkedTask.value = ''
    await loadLinks()
    emit('changed')
  } catch (e) {
    linkErr.value = e?.messages?.[0] || __('Не удалось связать')
  } finally {
    linkSaving.value = false
  }
}
async function removeLink(name) {
  try {
    await call(napi('tasks_api.remove_task_link'), { name })
    await loadLinks()
    emit('changed')
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось удалить связь'))
  }
}

function reload() {
  loadSubtasks()
  loadLinks()
}
watch(() => props.task, reload)
onMounted(reload)
</script>
