<!--
  Чат Telegram в карточке сделки/лида (заход 87). Самодостаточный: лента сообщений
  (входящие слева, исходящие справа) + поле ввода. Данные — nacifrah.telegram
  (get_messages / send_message). Сообщения хранятся в Communication
  (nacifrah_channel='Telegram'), привязаны к лиду/сделке.
-->
<template>
  <div class="flex h-full flex-col px-3 sm:px-10">
    <div class="min-h-0 flex-1 overflow-y-auto py-4">
      <div v-if="loading" class="text-sm text-ink-gray-5">{{ __('Загрузка…') }}</div>
      <div v-else-if="!messages.length" class="py-10 text-center text-sm text-ink-gray-4">
        {{ __('Переписки в мессенджерах пока нет') }}
      </div>
      <div v-else class="flex flex-col gap-2">
        <div
          v-for="m in messages"
          :key="m.name"
          class="flex"
          :class="m.sent_or_received === 'Sent' ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
            :class="m.sent_or_received === 'Sent' ? 'bg-surface-gray-4 text-ink-gray-9' : 'bg-surface-gray-2 text-ink-gray-8'"
          >
            <div class="prose-sm max-w-none" v-html="m.content" />
            <div class="mt-0.5 flex items-center justify-end gap-1.5 text-xs text-ink-gray-4">
              <span v-if="m.nacifrah_channel" class="rounded bg-surface-gray-3 px-1 text-[10px] uppercase">{{ m.nacifrah_channel }}</span>
              {{ timeAgo(m.creation) }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="shrink-0 border-t border-outline-gray-1 py-3">
      <div class="flex items-end gap-2">
        <textarea
          v-model="draft"
          rows="1"
          :placeholder="__('Сообщение клиенту…')"
          class="max-h-32 min-h-[38px] flex-1 resize-none rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-3 py-2 text-sm"
          @keydown.enter.exact.prevent="send"
        />
        <Button variant="solid" icon="send" :loading="sending" :disabled="!draft.trim()" @click="send" />
      </div>
      <ErrorMessage v-if="err" :message="err" class="mt-1" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { Button, ErrorMessage, call, toast } from 'frappe-ui'
import { napi } from '@/utils/api'
import { timeAgo } from '@/utils'

const props = defineProps({
  doctype: { type: String, required: true },
  docname: { type: String, required: true },
})

const messages = ref([])
const loading = ref(false)
const draft = ref('')
const sending = ref(false)
const err = ref('')

async function load() {
  if (!props.docname) return
  loading.value = true
  try {
    messages.value =
      (await call(napi('telegram.get_messages'), {
        reference_doctype: props.doctype,
        reference_name: props.docname,
      })) || []
  } catch (e) {
    // вкладка может быть открыта до настройки Telegram — тихо
    messages.value = []
  } finally {
    loading.value = false
  }
}
async function send() {
  const text = draft.value.trim()
  if (!text || sending.value) return
  err.value = ''
  sending.value = true
  try {
    await call(napi('telegram.send_any_message'), {
      reference_doctype: props.doctype,
      reference_name: props.docname,
      text,
    })
    draft.value = ''
    await load()
  } catch (e) {
    err.value = e?.messages?.[0] || __('Не удалось отправить (проверь подключение мессенджера)')
    toast.error(err.value)
  } finally {
    sending.value = false
  }
}

onMounted(load)
watch(() => props.docname, load)
</script>
