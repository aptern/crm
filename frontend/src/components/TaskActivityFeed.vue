<template>
  <!-- M4: в встроенном режиме — колонка на всю высоту: шапка липнет сверху, лента
       скроллится сама (свежие снизу), ввод снизу. -->
  <div
    :class="
      embedded
        ? 'flex h-full min-h-0 flex-col'
        : 'mt-6 border-t border-outline-gray-1 pt-4'
    "
  >
    <!-- ШАПКА (sticky): заголовок + вкладки + наблюдатели -->
    <div :class="embedded ? 'shrink-0' : ''">
      <div class="mb-3 flex items-center justify-between gap-2">
        <div class="text-base font-semibold text-ink-gray-8">
          {{ __('Активность работы') }}
        </div>
        <!-- M2: чат отдельной вкладкой -->
        <div class="flex rounded-lg bg-surface-gray-2 p-0.5 text-sm">
          <button
            v-for="t in tabs"
            :key="t.key"
            class="rounded-md px-2.5 py-1 font-medium transition"
            :class="
              tab === t.key
                ? 'bg-surface-white text-ink-gray-8 shadow-sm'
                : 'text-ink-gray-5 hover:text-ink-gray-7'
            "
            @click="setTab(t.key)"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <!-- B16: наблюдатели задачи — получают уведомления о новых сообщениях -->
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="text-xs text-ink-gray-5">{{ __('Наблюдатели:') }}</span>
        <button
          v-for="w in watchers.data || []"
          :key="w.name"
          class="group/w relative rounded-full hover:opacity-80"
          :title="w.full_name + ' — ' + __('убрать из наблюдателей')"
          @click="removeWatcher(w.name)"
        >
          <Avatar :image="w.image" :label="w.full_name" size="sm" />
          <span
            class="absolute -right-0.5 -top-0.5 hidden h-3 w-3 place-items-center rounded-full bg-surface-gray-7 text-[8px] text-ink-white group-hover/w:grid"
          >
            ×
          </span>
        </button>
        <span v-if="!(watchers.data || []).length" class="text-xs text-ink-gray-4">
          {{ __('нет') }}
        </span>
        <Popover>
          <template #target="{ togglePopover }">
            <Button
              variant="subtle"
              size="sm"
              icon="plus"
              :tooltip="__('Добавить наблюдателя')"
              @click="togglePopover"
            />
          </template>
          <template #body="{ togglePopover }">
            <div
              class="max-h-60 w-56 overflow-y-auto rounded-lg bg-surface-modal p-1 shadow-xl ring-1 ring-black ring-opacity-5"
            >
              <button
                v-for="u in addableUsers"
                :key="u.value"
                class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-surface-gray-2"
                @click="(addWatcher(u.value), togglePopover())"
              >
                <Avatar :image="u.image" :label="u.label" size="xs" />
                <span class="truncate">{{ u.label }}</span>
              </button>
              <div
                v-if="!addableUsers.length"
                class="px-2 py-1 text-xs text-ink-gray-4"
              >
                {{ __('Все уже добавлены') }}
              </div>
            </div>
          </template>
        </Popover>
      </div>
    </div>

    <!-- ЛЕНТА (скролл; свежие снизу) -->
    <div
      ref="feedEl"
      class="flex flex-col gap-3 pr-1"
      :class="embedded ? 'min-h-0 flex-1 overflow-y-auto' : 'max-h-72 overflow-y-auto'"
    >
      <template v-if="displayedItems.length">
        <div
          v-for="item in displayedItems"
          :key="item.type + '-' + item.key"
          class="flex gap-2.5 text-sm"
        >
          <Avatar
            :image="userImage(item.owner)"
            :label="item.by"
            size="md"
            class="mt-0.5 shrink-0"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-medium text-ink-gray-8">{{ item.by }}</span>
              <span class="text-xs text-ink-gray-5">{{ timeAgo(item.creation) }}</span>
            </div>
            <div
              v-if="item.type === 'comment'"
              class="prose-sm max-w-none text-ink-gray-7"
              v-html="item.content"
            />
            <div v-else class="text-ink-gray-6">
              <span v-for="(c, i) in item.changes" :key="i" class="block">
                {{ c.field }}:
                <span class="text-ink-gray-5">{{ c.old || '—' }}</span>
                →
                <span class="text-ink-gray-8">{{ c.new || '—' }}</span>
              </span>
            </div>
          </div>
        </div>
      </template>
      <div v-else-if="activity.data" class="text-sm text-ink-gray-5">
        {{ tab === 'chat' ? __('Пока нет сообщений') : __('Пока нет активности по работе') }}
      </div>
    </div>

    <!-- ВВОД (только на вкладке «Чат» — «писать отдельно») -->
    <div v-if="tab === 'chat'" class="mt-3 flex shrink-0 flex-col gap-2">
      <!-- B16: чат задачи — расширенный ввод с @упоминанием участников.
           I24: Enter — отправить, Shift+Enter — перенос строки (capture до редактора). -->
      <div
        class="rounded-md border border-outline-gray-2 bg-surface-gray-1 px-2 py-1.5"
        @keydown.enter.capture="onEnterKey"
      >
        <TextEditor
          ref="commentEditor"
          :content="newComment"
          :editor-class="['prose-sm max-w-none min-h-[2.5rem] text-sm text-ink-gray-8']"
          :placeholder="__('Написать сообщение… (@ — упомянуть участника)')"
          :mentions="users"
          @change="newComment = $event"
        />
      </div>
      <div class="flex justify-end">
        <Button
          variant="solid"
          :label="__('Отправить')"
          :loading="sending"
          :disabled="!hasContent"
          @click="send"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import {
  Avatar,
  Button,
  Popover,
  TextEditor,
  createResource,
  call,
  toast,
} from 'frappe-ui'
import { timeAgo } from '@/utils'
import { usersStore } from '@/stores/users'

const props = defineProps({
  task: { type: String, required: true },
  embedded: { type: Boolean, default: false },
})

const { getUser, users: usersList } = usersStore()
const newComment = ref('')
const sending = ref(false)
const commentEditor = ref(null)
const feedEl = ref(null)

// M2: вкладки зоны активности — «Активность» (весь лог) и «Чат» (только сообщения)
const tabs = [
  { key: 'activity', label: __('Активность') },
  { key: 'chat', label: __('Чат') },
]
const tab = ref('activity')
function setTab(k) {
  tab.value = k
  scrollFeedToBottom()
}

// B16: список участников для @упоминания + добавления в наблюдатели
const users = computed(
  () =>
    usersList.data?.crmUsers
      ?.filter((u) => u.enabled)
      .map((u) => ({
        label: u.full_name?.trimEnd() || u.name,
        value: u.name,
        image: u.user_image,
      })) || [],
)

// B16: наблюдатели задачи
const watchers = createResource({
  url: 'nacifrah.tasks_api.get_task_watchers',
  params: { task: props.task },
  auto: true,
})
const addableUsers = computed(() => {
  const have = new Set((watchers.data || []).map((w) => w.name))
  return users.value.filter((u) => !have.has(u.value))
})
async function addWatcher(user) {
  try {
    watchers.data = await call('nacifrah.tasks_api.add_task_watcher', {
      task: props.task,
      user,
    })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось добавить наблюдателя'))
  }
}
async function removeWatcher(user) {
  try {
    watchers.data = await call('nacifrah.tasks_api.remove_task_watcher', {
      task: props.task,
      user,
    })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось убрать наблюдателя'))
  }
}

// контент TextEditor — HTML; пустой <p></p> за текст не считаем
const hasContent = computed(() => {
  const t = (newComment.value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, '')
    .trim()
  return !!t
})

const activity = createResource({
  url: 'nacifrah.tasks_api.get_task_activity',
  params: { task: props.task },
  auto: true,
  onSuccess() {
    scrollFeedToBottom()
  },
})

// M4: свежие снизу — сортируем по времени по возрастанию; «Чат» = только комментарии
const displayedItems = computed(() => {
  const items = [...(activity.data || [])]
  const filtered = tab.value === 'chat' ? items.filter((i) => i.type === 'comment') : items
  return filtered.sort((a, b) => (a.creation < b.creation ? -1 : a.creation > b.creation ? 1 : 0))
})

// M4: автоскролл ленты вниз (к свежим)
function scrollFeedToBottom() {
  nextTick(() => {
    const el = feedEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}
watch(displayedItems, scrollFeedToBottom)
onMounted(scrollFeedToBottom)

function userImage(owner) {
  return getUser(owner)?.user_image
}

// I24: Enter → отправить; Shift+Enter → перенос строки (дефолт редактора).
function onEnterKey(e) {
  if (e.shiftKey) return // Shift+Enter — обычный перенос строки
  e.preventDefault()
  e.stopPropagation()
  if (hasContent.value && !sending.value) send()
}

async function send() {
  if (!hasContent.value) return
  sending.value = true
  try {
    await call('crm.api.comment.add_comment', {
      reference_doctype: 'CRM Task',
      reference_name: props.task,
      content: newComment.value,
    })
    newComment.value = ''
    commentEditor.value?.editor?.commands?.clearContent(true)
    activity.reload()
    watchers.reload()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось отправить сообщение'))
  } finally {
    sending.value = false
  }
}
</script>
