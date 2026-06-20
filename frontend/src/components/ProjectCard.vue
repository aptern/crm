<!--
  M6(б): карточка проекта — выезжающая справа панель (slide-over) с тремя вкладками:
  • Чат — комментарии к проекту (сделке-проекту) + отправка;
  • Файлы — вложения проекта и его задач + загрузка;
  • Активность — агрегированная лента действий по ВСЕМ задачам проекта.
  Данные: nacifrah.tasks_api.get_project_overview. Триггер — из сайдбара «Проекты».
-->
<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div v-if="show" class="fixed inset-0 z-40 flex">
        <div class="flex-1 bg-black/30" @click="close" />
        <div class="flex h-full w-full flex-col bg-surface-white shadow-xl sm:w-[52%]">
          <!-- Шапка -->
          <div class="flex h-14 shrink-0 items-center justify-between border-b border-outline-gray-1 px-5">
            <div class="flex items-center gap-2 truncate">
              <FeatherIcon name="folder" class="h-5 w-5 shrink-0 text-ink-gray-6" />
              <span class="truncate text-lg font-semibold text-ink-gray-8">{{ title }}</span>
            </div>
            <Button variant="ghost" icon="x" @click="close" />
          </div>

          <!-- Вкладки -->
          <div class="flex shrink-0 items-center gap-1 border-b border-outline-gray-1 px-5 py-2">
            <button
              v-for="t in tabs"
              :key="t.key"
              class="rounded-md px-3 py-1 text-sm font-medium transition"
              :class="
                tab === t.key
                  ? 'bg-surface-gray-2 text-ink-gray-8'
                  : 'text-ink-gray-5 hover:text-ink-gray-7'
              "
              @click="tab = t.key"
            >
              {{ t.label }}
              <span v-if="t.count" class="ml-1 text-xs text-ink-gray-4">{{ t.count }}</span>
            </button>
          </div>

          <!-- Контент -->
          <div ref="scrollEl" class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div v-if="!data" class="text-sm text-ink-gray-5">{{ __('Загрузка…') }}</div>

            <!-- ЧАТ (P1: комменты + файлы вместе; тумблер «только файлы») -->
            <template v-else-if="tab === 'chat'">
              <div class="mb-3 flex justify-end">
                <button
                  class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition"
                  :class="
                    filesOnly
                      ? 'bg-surface-gray-3 text-ink-gray-8'
                      : 'text-ink-gray-5 hover:text-ink-gray-7'
                  "
                  @click="filesOnly = !filesOnly"
                >
                  <FeatherIcon name="paperclip" class="h-3.5 w-3.5" />
                  {{ __('Только файлы') }}
                  <span v-if="data.files.length" class="text-ink-gray-4">{{ data.files.length }}</span>
                </button>
              </div>
              <!-- режим «только файлы» -->
              <template v-if="filesOnly">
                <div v-if="data.files.length" class="flex flex-col gap-1.5">
                  <a
                    v-for="f in data.files"
                    :key="f.name"
                    :href="f.file_url"
                    target="_blank"
                    class="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-gray-1"
                  >
                    <FeatherIcon name="paperclip" class="h-4 w-4 shrink-0 text-ink-gray-5" />
                    <span class="flex-1 truncate text-ink-gray-8">{{ f.file_name }}</span>
                    <span class="shrink-0 text-xs text-ink-gray-4">
                      {{ f.doctype === 'CRM Task' ? __('задача') : __('проект') }}
                    </span>
                  </a>
                </div>
                <div v-else class="text-sm text-ink-gray-5">{{ __('Файлов пока нет') }}</div>
              </template>
              <!-- обычный чат (комменты; файлы-сообщения тоже здесь) -->
              <template v-else>
                <div v-if="data.comments.length" class="flex flex-col gap-3">
                  <FeedItem v-for="it in data.comments" :key="it.key" :item="it" />
                </div>
                <div v-else class="text-sm text-ink-gray-5">{{ __('Пока нет сообщений') }}</div>
              </template>
            </template>

            <!-- АКТИВНОСТЬ -->
            <template v-else>
              <div v-if="data.activity.length" class="flex flex-col gap-3">
                <FeedItem v-for="it in data.activity" :key="it.type + '-' + it.key" :item="it" showTask />
              </div>
              <div v-else class="text-sm text-ink-gray-5">{{ __('Пока нет активности по задачам') }}</div>
            </template>
          </div>

          <!-- Ввод чата: текст + прикрепить файл (P1: файлы кидаем прямо в чат) -->
          <div v-if="tab === 'chat'" class="shrink-0 border-t border-outline-gray-1 p-4">
            <textarea
              v-model="newComment"
              rows="2"
              class="w-full rounded-md border border-outline-gray-2 bg-surface-gray-1 px-2 py-1.5 text-sm"
              :placeholder="__('Написать сообщение по проекту…')"
              @keydown.enter.exact.prevent="send"
            />
            <div class="mt-2 flex items-center justify-between">
              <FileUploader
                :upload-args="{ doctype: 'CRM Deal', docname: project, private: true }"
                @success="onChatFileUpload"
              >
                <template #default="{ openFileSelector, uploading }">
                  <Button
                    variant="ghost"
                    icon="paperclip"
                    :loading="uploading"
                    :tooltip="__('Прикрепить файл')"
                    @click="openFileSelector()"
                  />
                </template>
              </FileUploader>
              <Button variant="solid" :label="__('Отправить')" :loading="sending" :disabled="!newComment.trim()" @click="send" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, h, nextTick } from 'vue'
import { napi } from '@/utils/api'
import { Avatar, Button, FeatherIcon, FileUploader, createResource, call, toast } from 'frappe-ui'
import { timeAgo } from '@/utils'
import { usersStore } from '@/stores/users'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  project: { type: String, default: '' },
  title: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const { getUser } = usersStore()
const show = computed(() => props.modelValue)
const tab = ref('chat')
const newComment = ref('')
const sending = ref(false)
const scrollEl = ref(null)

// Маленький рендерер элемента ленты (коммент или изменение), переиспользуется чат+активность
const FeedItem = (p) => {
  const it = p.item
  return h('div', { class: 'flex gap-2.5 text-sm' }, [
    h(Avatar, {
      image: getUser(it.owner)?.user_image,
      label: it.by,
      size: 'md',
      class: 'mt-0.5 shrink-0',
    }),
    h('div', { class: 'min-w-0 flex-1' }, [
      h('div', { class: 'flex items-center gap-2' }, [
        h('span', { class: 'font-medium text-ink-gray-8' }, it.by),
        h('span', { class: 'text-xs text-ink-gray-5' }, timeAgo(it.creation)),
        p.showTask && it.task
          ? h('span', { class: 'rounded bg-surface-gray-2 px-1 text-xs text-ink-gray-5' }, __('задача'))
          : null,
      ]),
      it.type === 'comment'
        ? h('div', { class: 'prose-sm max-w-none text-ink-gray-7', innerHTML: it.content })
        : h(
            'div',
            { class: 'text-ink-gray-6' },
            (it.changes || []).map((c) =>
              h('span', { class: 'block' }, `${c.field}: ${c.old || '—'} → ${c.new || '—'}`),
            ),
          ),
    ]),
  ])
}

const data = ref(null)
const overview = createResource({
  url: napi('tasks_api.get_project_overview'),
  makeParams: () => ({ project: props.project }),
  onSuccess(d) {
    data.value = d
    nextTick(scrollToBottom)
  },
})

// P1: «Файлы» больше не отдельная вкладка — файлы внутри «Чат» (тумблер «только файлы»).
const tabs = computed(() => [
  { key: 'chat', label: __('Чат'), count: data.value?.comments?.length || 0 },
  { key: 'activity', label: __('Активность'), count: data.value?.activity?.length || 0 },
])
const filesOnly = ref(false)

function scrollToBottom() {
  const el = scrollEl.value
  if (el && tab.value !== 'files') el.scrollTop = el.scrollHeight
}
watch(
  () => props.modelValue,
  (v) => {
    if (v && props.project) {
      data.value = null
      tab.value = 'chat'
      overview.reload()
    }
  },
)
watch(tab, () => nextTick(scrollToBottom))

function close() {
  emit('update:modelValue', false)
}

async function send() {
  const text = newComment.value.trim()
  if (!text || sending.value) return
  sending.value = true
  try {
    await call('crm.api.comment.add_comment', {
      reference_doctype: 'CRM Deal',
      reference_name: props.project,
      content: '<p>' + text.replace(/</g, '&lt;').replace(/\n/g, '<br>') + '</p>',
    })
    newComment.value = ''
    overview.reload()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось отправить'))
  } finally {
    sending.value = false
  }
}

// P1: загруженный в чате файл сразу появляется сообщением со ссылкой (и в «только файлы»)
async function onChatFileUpload(file) {
  const url = file?.file_url || ''
  const name = (file?.file_name || __('файл')).replace(/</g, '&lt;')
  try {
    await call('crm.api.comment.add_comment', {
      reference_doctype: 'CRM Deal',
      reference_name: props.project,
      content: `<p>📎 <a href="${url}" target="_blank">${name}</a></p>`,
    })
  } catch (e) {
    // файл уже прикреплён к проекту — будет виден в «только файлы» даже без коммента
  }
  toast.success(__('Файл загружен'))
  overview.reload()
}
</script>
