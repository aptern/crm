<!--
  Модуль «Почта» (заход 86) — Яндекс-стиль: слева переключатель ящиков (личный +
  общие/рассылочные, к которым есть доступ) и папки; в центре список писем; справа
  полный текст письма. Данные — nacifrah.mail_api (на нативных Communication).
  Compose и «Создать общий ящик» — на SimpleModal (frappe-ui Dialog у заказчика
  рендерился невидимым). Письмо рендерим в sandbox-iframe (без выполнения скриптов).
-->
<template>
  <div class="flex h-full w-full flex-col">
    <!-- Шапка -->
    <header class="flex h-12 shrink-0 items-center justify-between border-b border-outline-gray-1 px-4">
      <div class="flex items-center gap-2">
        <FeatherIcon name="mail" class="h-5 w-5 text-ink-gray-7" />
        <span class="text-lg font-semibold text-ink-gray-8">{{ __('Почта') }}</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="relative">
          <FeatherIcon name="search" class="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-gray-4" />
          <input
            v-model="search"
            :placeholder="__('Поиск писем')"
            class="h-8 w-56 rounded-md border border-outline-gray-2 bg-surface-gray-1 pl-8 pr-2 text-sm"
            @keyup.enter="loadEmails"
          />
        </div>
        <Button v-if="isManager()" :label="__('Создать общий ящик')" icon-left="plus" @click="openCreateShared" />
        <Button variant="solid" :label="__('Написать')" icon-left="edit-2" @click="openCompose()" />
      </div>
    </header>

    <div class="flex min-h-0 flex-1">
      <!-- ЛЕВО: ящики + папки -->
      <aside class="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-outline-gray-1 p-2">
        <div class="px-2 py-1 text-xs font-medium uppercase text-ink-gray-4">{{ __('Ящики') }}</div>
        <button
          v-for="b in mailboxes"
          :key="b.email_account"
          class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition"
          :class="b.email_account === currentBox?.email_account ? 'bg-surface-gray-3 text-ink-gray-9' : 'text-ink-gray-7 hover:bg-surface-gray-1'"
          @click="selectBox(b)"
        >
          <FeatherIcon :name="boxIcon(b.type)" class="h-4 w-4 shrink-0" />
          <span class="flex-1 truncate">{{ b.label }}</span>
          <span v-if="unread[b.email_account]" class="rounded-full bg-surface-gray-5 px-1.5 text-xs text-ink-white">
            {{ unread[b.email_account] }}
          </span>
        </button>

        <div class="mt-3 px-2 py-1 text-xs font-medium uppercase text-ink-gray-4">{{ __('Папки') }}</div>
        <button
          v-for="f in folders"
          :key="f.key"
          class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition"
          :class="f.key === folder ? 'bg-surface-gray-3 text-ink-gray-9' : 'text-ink-gray-7 hover:bg-surface-gray-1'"
          @click="selectFolder(f.key)"
        >
          <FeatherIcon :name="f.icon" class="h-4 w-4 shrink-0" />
          {{ f.label }}
        </button>
      </aside>

      <!-- ЦЕНТР: список писем -->
      <section class="flex w-96 shrink-0 flex-col overflow-y-auto border-r border-outline-gray-1">
        <div v-if="loadingList" class="p-4 text-sm text-ink-gray-5">{{ __('Загрузка…') }}</div>
        <div v-else-if="!emails.length" class="p-4 text-sm text-ink-gray-5">{{ __('Писем нет') }}</div>
        <button
          v-for="e in emails"
          :key="e.name"
          class="flex flex-col gap-0.5 border-b border-outline-gray-1 px-3 py-2 text-left transition hover:bg-surface-gray-1"
          :class="{ 'bg-surface-gray-1': e.name === current?.name }"
          @click="openEmail(e)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="truncate text-sm" :class="e.seen ? 'font-normal text-ink-gray-7' : 'font-semibold text-ink-gray-9'">
              {{ folder === 'Sent' ? (e.recipients || '—') : (e.sender_full_name || e.sender) }}
            </span>
            <span class="shrink-0 text-xs text-ink-gray-4">{{ shortDate(e.communication_date) }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span v-if="!e.seen && folder !== 'Sent'" class="h-1.5 w-1.5 shrink-0 rounded-full bg-surface-gray-7" />
            <span class="truncate text-sm" :class="e.seen ? 'text-ink-gray-6' : 'font-medium text-ink-gray-8'">{{ e.subject || __('(без темы)') }}</span>
            <FeatherIcon v-if="e.has_attachment" name="paperclip" class="ml-auto h-3.5 w-3.5 shrink-0 text-ink-gray-4" />
          </div>
          <div class="truncate text-xs text-ink-gray-4">{{ e.preview }}</div>
        </button>
      </section>

      <!-- ПРАВО: чтение письма -->
      <section class="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div v-if="!current" class="flex flex-1 items-center justify-center text-sm text-ink-gray-4">
          {{ __('Выберите письмо') }}
        </div>
        <template v-else>
          <div class="border-b border-outline-gray-1 p-4">
            <div class="mb-2 flex items-start justify-between gap-2">
              <h2 class="text-lg font-semibold text-ink-gray-9">{{ current.subject || __('(без темы)') }}</h2>
              <div class="flex shrink-0 gap-1">
                <Button variant="ghost" icon="corner-up-left" :tooltip="__('Ответить')" @click="reply" />
                <Button variant="ghost" icon="corner-up-right" :tooltip="__('Переслать')" @click="forward" />
              </div>
            </div>
            <div class="text-sm text-ink-gray-7"><b>{{ __('От') }}:</b> {{ current.sender_full_name || current.sender }} &lt;{{ current.sender }}&gt;</div>
            <div class="text-sm text-ink-gray-7"><b>{{ __('Кому') }}:</b> {{ current.recipients }}</div>
            <div v-if="current.cc" class="text-sm text-ink-gray-6"><b>CC:</b> {{ current.cc }}</div>
            <div class="text-xs text-ink-gray-4">{{ current.communication_date }}</div>
            <RouterLink
              v-if="current.reference_doctype && current.reference_name"
              :to="refLink(current)"
              class="mt-1 inline-flex items-center gap-1 text-xs text-ink-blue-link hover:underline"
            >
              <FeatherIcon name="link" class="h-3 w-3" />
              {{ refLabel(current.reference_doctype) }}: {{ current.reference_name }}
            </RouterLink>
          </div>
          <iframe
            ref="bodyFrame"
            sandbox="allow-same-origin"
            class="min-h-0 w-full flex-1 border-0"
            :srcdoc="bodyHtml(current.content)"
          />
          <div v-if="current.attachments?.length" class="shrink-0 border-t border-outline-gray-1 p-3">
            <div class="mb-1 text-xs font-medium text-ink-gray-5">{{ __('Вложения') }}</div>
            <div class="flex flex-wrap gap-2">
              <a
                v-for="a in current.attachments"
                :key="a.file_url"
                :href="a.file_url"
                target="_blank"
                class="flex items-center gap-1.5 rounded-md border border-outline-gray-2 px-2 py-1 text-xs text-ink-gray-7 hover:bg-surface-gray-1"
              >
                <FeatherIcon name="paperclip" class="h-3.5 w-3.5" />{{ a.file_name }}
              </a>
            </div>
          </div>
        </template>
      </section>
    </div>

    <!-- Compose -->
    <SimpleModal v-model="compose.show" :title="__('Новое письмо')" size="lg">
      <div class="flex flex-col gap-3">
        <FormControl type="select" :label="__('От кого')" :options="composeFromOptions" v-model="compose.from" />
        <FormControl :label="__('Кому')" v-model="compose.to" :placeholder="__('email1@.., email2@..')" />
        <FormControl :label="'CC'" v-model="compose.cc" />
        <FormControl :label="__('Тема')" v-model="compose.subject" />
        <FormControl type="textarea" :label="__('Сообщение')" v-model="compose.body" :rows="8" />
        <ErrorMessage v-if="compose.err" :message="compose.err" />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <Button :label="__('Отмена')" @click="compose.show = false" />
        <Button variant="solid" :label="__('Отправить')" :loading="compose.sending" @click="sendMail" />
      </div>
    </SimpleModal>

    <!-- Создать общий/рассылочный ящик -->
    <SimpleModal v-model="shared.show" :title="__('Создать общий ящик')" size="md">
      <div class="flex flex-col gap-3">
        <FormControl :label="__('Название')" v-model="shared.label" :placeholder="__('Напр. Поддержка')" />
        <div class="flex items-end gap-2">
          <FormControl class="flex-1" :label="__('Адрес (до @)')" v-model="shared.local_part" :placeholder="'support'" />
          <span class="pb-2 text-sm text-ink-gray-5">@{{ mailDomain }}</span>
        </div>
        <FormControl type="select" :label="__('Тип')" :options="[{value:'Общий',label:__('Общий')},{value:'Рассылочный',label:__('Рассылочный')}]" v-model="shared.type" />
        <div>
          <label class="mb-1 block text-xs text-ink-gray-5">{{ __('Доступ (сотрудники)') }}</label>
          <select
            multiple
            v-model="shared.members"
            class="h-32 w-full rounded-md border border-outline-gray-2 bg-surface-gray-1 p-1 text-sm"
          >
            <option v-for="u in userOptions" :key="u.value" :value="u.value">{{ u.label }}</option>
          </select>
        </div>
        <ErrorMessage v-if="shared.err" :message="shared.err" />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <Button :label="__('Отмена')" @click="shared.show = false" />
        <Button variant="solid" :label="__('Создать')" :loading="shared.saving" @click="saveShared" />
      </div>
    </SimpleModal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Button, FeatherIcon, FormControl, ErrorMessage, call, toast } from 'frappe-ui'
import { napi } from '@/utils/api'
import SimpleModal from '@/components/SimpleModal.vue'
import { usersStore } from '@/stores/users'

const { isManager, crmUsers } = usersStore()
const mailDomain = ref('nacifrah.ru')

const mailboxes = ref([])
const currentBox = ref(null)
const unread = ref({})
const folders = [
  { key: 'Inbox', label: __('Входящие'), icon: 'inbox' },
  { key: 'Sent', label: __('Отправленные'), icon: 'send' },
]
const folder = ref('Inbox')
const emails = ref([])
const current = ref(null)
const search = ref('')
const loadingList = ref(false)

const userOptions = computed(() =>
  (crmUsers?.value || []).map((u) => ({ value: u.name, label: u.full_name || u.name })),
)
const composeFromOptions = computed(() =>
  mailboxes.value.filter((b) => b.can_send).map((b) => ({ value: b.email_account, label: b.address })),
)

function boxIcon(type) {
  return type === 'shared' ? 'users' : type === 'mailing' ? 'send' : 'mail'
}
function refLabel(dt) {
  return dt === 'CRM Lead' ? __('Лид') : dt === 'CRM Deal' ? __('Сделка') : dt
}
function refLink(c) {
  if (c.reference_doctype === 'CRM Lead') return { name: 'Lead', params: { leadId: c.reference_name } }
  if (c.reference_doctype === 'CRM Deal') return { name: 'Deal', params: { dealId: c.reference_name } }
  return {}
}
function shortDate(d) {
  if (!d) return ''
  const dt = new Date(d.replace(' ', 'T'))
  const now = new Date()
  if (dt.toDateString() === now.toDateString())
    return dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}
function bodyHtml(content) {
  // sandbox-iframe без скриптов; базовые стили для читабельности
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
    <style>body{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#1f272e;margin:16px}
    img{max-width:100%}a{color:#2490ef}</style></head><body>${content || ''}</body></html>`
}

async function loadMailboxes() {
  mailboxes.value = (await call(napi('mail_api.get_my_mailboxes'))) || []
  if (mailboxes.value.length && !currentBox.value) currentBox.value = mailboxes.value[0]
  loadUnread()
}
async function loadUnread() {
  try {
    unread.value = (await call(napi('mail_api.unread_counts'))) || {}
  } catch (e) {}
}
async function loadEmails() {
  if (!currentBox.value) return
  loadingList.value = true
  current.value = null
  try {
    emails.value =
      (await call(napi('mail_api.get_emails'), {
        email_account: currentBox.value.email_account,
        folder: folder.value,
        search: search.value || undefined,
      })) || []
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось загрузить'))
  } finally {
    loadingList.value = false
  }
}
async function openEmail(e) {
  try {
    current.value = await call(napi('mail_api.get_email'), { name: e.name })
    e.seen = 1
    loadUnread()
  } catch (err) {
    toast.error(err?.messages?.[0] || __('Не удалось открыть'))
  }
}
function selectBox(b) {
  currentBox.value = b
  loadEmails()
}
function selectFolder(k) {
  folder.value = k
  loadEmails()
}

// Compose
const compose = reactive({ show: false, from: '', to: '', cc: '', subject: '', body: '', sending: false, err: '' })
function openCompose(prefill = {}) {
  Object.assign(compose, {
    show: true, err: '', sending: false,
    from: currentBox.value?.email_account || composeFromOptions.value[0]?.value || '',
    to: prefill.to || '', cc: '', subject: prefill.subject || '', body: prefill.body || '',
  })
}
function reply() {
  if (!current.value) return
  openCompose({ to: current.value.sender, subject: 'Re: ' + (current.value.subject || ''), body: `\n\n----\n${current.value.content || ''}` })
}
function forward() {
  if (!current.value) return
  openCompose({ subject: 'Fwd: ' + (current.value.subject || ''), body: `\n\n----\n${current.value.content || ''}` })
}
async function sendMail() {
  compose.err = ''
  if (!compose.from) return (compose.err = __('Выберите ящик отправителя'))
  if (!compose.to.trim()) return (compose.err = __('Укажите получателя'))
  compose.sending = true
  try {
    await call(napi('mail_api.send_email'), {
      email_account: compose.from,
      recipients: compose.to,
      cc: compose.cc || undefined,
      subject: compose.subject,
      content: (compose.body || '').replace(/\n/g, '<br>'),
    })
    toast.success(__('Письмо отправлено'))
    compose.show = false
    if (folder.value === 'Sent') loadEmails()
  } catch (e) {
    compose.err = e?.messages?.[0] || __('Не удалось отправить')
  } finally {
    compose.sending = false
  }
}

// Создать общий ящик
const shared = reactive({ show: false, label: '', local_part: '', type: 'Общий', members: [], saving: false, err: '' })
function openCreateShared() {
  Object.assign(shared, { show: true, label: '', local_part: '', type: 'Общий', members: [], saving: false, err: '' })
}
async function saveShared() {
  shared.err = ''
  if (!shared.label.trim() || !shared.local_part.trim()) return (shared.err = __('Укажите название и адрес'))
  shared.saving = true
  try {
    await call(napi('mail_api.create_shared_mailbox'), {
      label: shared.label.trim(),
      local_part: shared.local_part.trim(),
      mailbox_type: shared.type,
      members: JSON.stringify(shared.members || []),
    })
    toast.success(__('Общий ящик создан'))
    shared.show = false
    loadMailboxes()
  } catch (e) {
    shared.err = e?.messages?.[0] || __('Не удалось создать')
  } finally {
    shared.saving = false
  }
}

onMounted(async () => {
  await loadMailboxes()
  loadEmails()
})
</script>
