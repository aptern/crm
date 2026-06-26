<!--
  Модуль «Почта» (заход 86) — Яндекс-стиль: слева переключатель ящиков (личный +
  общие/рассылочные по доступу) и РЕАЛЬНЫЕ IMAP-папки (Входящие/Отправленные/
  Черновики/Спам/Корзина/Архив); в центре список писем; справа полный текст.
  Данные — nacifrah.mail_imap (прямой IMAP к Mailcow под учёткой ящика): полные
  папки и вся история. Письмо рендерим в sandbox-iframe (без выполнения скриптов).
  Создание общих ящиков — nacifrah.mail_api.
-->
<template>
  <div class="flex h-full w-full flex-col">
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
        </button>
        <!-- NACIFRAH (ux-critique [d_mail] 58): подсказка при отсутствии ящиков. -->
        <div v-if="!mailboxes.length" class="px-2 py-1.5 text-sm text-ink-gray-5">
          {{ __('Нет подключённых ящиков') }}
        </div>

        <div class="mt-3 px-2 py-1 text-xs font-medium uppercase text-ink-gray-4">{{ __('Папки') }}</div>
        <!-- Псевдо-папка «Важное» (поиск по \Flagged, не IMAP-папка) -->
        <button
          class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition"
          :class="folder === FLAGGED_KEY ? 'bg-surface-gray-3 text-ink-gray-9' : 'text-ink-gray-7 hover:bg-surface-gray-1'"
          @click="selectFolder(FLAGGED_KEY)"
        >
          <FeatherIcon name="flag" class="h-4 w-4 shrink-0 text-amber-500" />
          <span class="flex-1 truncate">{{ __('Важное') }}</span>
        </button>
        <!-- Системные папки -->
        <button
          v-for="f in systemFolders"
          :key="f.key"
          class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition"
          :class="f.key === folder ? 'bg-surface-gray-3 text-ink-gray-9' : 'text-ink-gray-7 hover:bg-surface-gray-1'"
          @click="selectFolder(f.key)"
        >
          <FeatherIcon :name="f.icon" class="h-4 w-4 shrink-0" />
          <span class="flex-1 truncate">{{ f.label }}</span>
          <span v-if="f.unseen" class="rounded-full bg-surface-gray-5 px-1.5 text-xs text-ink-white">{{ f.unseen }}</span>
        </button>

        <!-- Пользовательские папки -->
        <div v-if="customFolders.length" class="mt-2 px-2 py-1 text-xs font-medium uppercase text-ink-gray-4">{{ __('Мои папки') }}</div>
        <button
          v-for="f in customFolders"
          :key="f.key"
          class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition"
          :class="f.key === folder ? 'bg-surface-gray-3 text-ink-gray-9' : 'text-ink-gray-7 hover:bg-surface-gray-1'"
          @click="selectFolder(f.key)"
        >
          <FeatherIcon :name="f.icon" class="h-4 w-4 shrink-0" />
          <span class="flex-1 truncate">{{ f.label }}</span>
          <span v-if="f.unseen" class="rounded-full bg-surface-gray-5 px-1.5 text-xs text-ink-white">{{ f.unseen }}</span>
        </button>

        <!-- Создать папку -->
        <div v-if="newFolder.show" class="mt-2 flex items-center gap-1 px-1">
          <input
            ref="newFolderInput"
            v-model="newFolder.name"
            :placeholder="__('Имя папки')"
            class="h-7 w-full rounded-md border border-outline-gray-2 bg-surface-gray-1 px-2 text-sm"
            @keyup.enter="createFolder"
            @keyup.esc="newFolder.show = false"
          />
          <Button variant="ghost" icon="check" :loading="newFolder.saving" @click="createFolder" />
          <Button variant="ghost" icon="x" @click="newFolder.show = false" />
        </div>
        <button
          v-else
          class="mt-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink-gray-6 transition hover:bg-surface-gray-1"
          @click="openNewFolder"
        >
          <FeatherIcon name="plus" class="h-4 w-4 shrink-0" />
          <span class="flex-1 truncate">{{ __('Папка') }}</span>
        </button>
      </aside>

      <!-- ЦЕНТР: список писем -->
      <section class="flex w-96 shrink-0 flex-col overflow-y-auto border-r border-outline-gray-1">
        <!-- Тулбар массовых действий (виден при выборе) -->
        <div
          v-if="selectedUids.length"
          class="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-outline-gray-1 bg-surface-white px-2 py-1.5"
        >
          <label class="flex items-center gap-1.5 pr-1 text-xs text-ink-gray-6">
            <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
            {{ __('Выбрано') }}: {{ selectedUids.length }}
          </label>
          <Button variant="ghost" icon="check" :tooltip="__('Прочитано')" @click="bulkAction('mark_seen', { seen: 1 })" />
          <Button variant="ghost" icon="mail" :tooltip="__('Непрочитано')" @click="bulkAction('mark_seen', { seen: 0 })" />
          <Button variant="ghost" icon="flag" :tooltip="__('Флажок')" @click="bulkAction('flag_email', { flagged: 1 })" />
          <Button variant="ghost" icon="x-circle" :tooltip="__('Снять флажок')" @click="bulkAction('flag_email', { flagged: 0 })" />
          <Button variant="ghost" icon="alert-octagon" :tooltip="__('Спам')" @click="bulkAction('mark_spam', {})" />
          <Button variant="ghost" icon="trash-2" :tooltip="__('Удалить')" @click="bulkAction('delete_email', {})" />
          <div class="relative">
            <Button variant="ghost" icon="folder" :tooltip="__('Переместить')" @click="moveMenu = !moveMenu" />
            <div
              v-if="moveMenu"
              class="absolute right-0 top-9 z-20 max-h-60 w-44 overflow-y-auto rounded-md border border-outline-gray-2 bg-surface-white py-1 shadow-md"
            >
              <button
                v-for="f in moveTargets"
                :key="f.key"
                class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink-gray-7 hover:bg-surface-gray-1"
                @click="bulkAction('move_email', { target: f.key }); moveMenu = false"
              >
                <FeatherIcon :name="f.icon" class="h-4 w-4 shrink-0" />
                <span class="flex-1 truncate">{{ f.label }}</span>
              </button>
              <div v-if="!moveTargets.length" class="px-3 py-1.5 text-xs text-ink-gray-4">{{ __('Нет папок') }}</div>
            </div>
          </div>
        </div>

        <div v-if="loadingList" class="p-4 text-sm text-ink-gray-5">{{ __('Загрузка…') }}</div>
        <!-- NACIFRAH (ux-critique [d_mail] 60): полноценный empty-state вместо холодного «Писем нет». -->
        <div
          v-else-if="!emails.length"
          class="flex flex-col items-center justify-center gap-2 py-20 text-center"
        >
          <FeatherIcon name="inbox" class="h-8 w-8 text-ink-gray-4" />
          <div class="text-base font-medium text-ink-gray-7">{{ __('В этой папке нет писем') }}</div>
          <div class="max-w-xs text-sm text-ink-gray-5">
            {{ __('Возможно, ящик ещё синхронизируется или выбранная папка пуста.') }}
          </div>
        </div>
        <div
          v-for="e in emails"
          :key="e.uid"
          class="flex items-center gap-2 border-b border-outline-gray-1 px-3 py-2 transition hover:bg-surface-gray-1"
          :class="{ 'bg-surface-gray-1': e.uid === current?.uid }"
        >
          <input
            type="checkbox"
            class="shrink-0"
            :checked="isSel(e.uid)"
            @click.stop="toggleSel(e.uid)"
          />
          <FeatherIcon
            name="flag"
            class="h-4 w-4 shrink-0 cursor-pointer"
            :class="e.flagged ? 'text-amber-500 fill-amber-500' : 'text-ink-gray-3'"
            @click.stop="toggleFlag(e)"
          />
          <button class="flex min-w-0 flex-1 flex-col gap-0.5 text-left" @click="openEmail(e)">
            <div class="flex items-center justify-between gap-2">
              <span class="truncate text-sm" :class="e.seen ? 'font-normal text-ink-gray-7' : 'font-semibold text-ink-gray-9'">
                {{ isSentFolder ? (e.recipients || '—') : (e.sender || '—') }}
              </span>
              <span class="shrink-0 text-xs text-ink-gray-4">{{ shortDate(e.date) }}</span>
            </div>
            <div class="flex items-center gap-1">
              <span v-if="!e.seen && !isSentFolder" class="h-1.5 w-1.5 shrink-0 rounded-full bg-surface-gray-7" />
              <span class="truncate text-sm" :class="e.seen ? 'text-ink-gray-6' : 'font-medium text-ink-gray-8'">{{ e.subject || __('(без темы)') }}</span>
              <FeatherIcon v-if="e.has_attachment" name="paperclip" class="ml-auto h-3.5 w-3.5 shrink-0 text-ink-gray-4" />
            </div>
          </button>
        </div>
      </section>

      <!-- ПРАВО: чтение -->
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
                <Button
                  variant="ghost"
                  icon="flag"
                  :tooltip="current.flagged ? __('Снять флажок') : __('Флажок')"
                  :class="current.flagged ? 'text-amber-500' : ''"
                  @click="toggleCurrentFlag"
                />
                <Button variant="ghost" icon="trash-2" :tooltip="__('Удалить')" @click="removeEmail" />
              </div>
            </div>
            <div class="text-sm text-ink-gray-7"><b>{{ __('От') }}:</b> {{ current.sender }}</div>
            <div class="text-sm text-ink-gray-7"><b>{{ __('Кому') }}:</b> {{ current.recipients }}</div>
            <div v-if="current.cc" class="text-sm text-ink-gray-6"><b>CC:</b> {{ current.cc }}</div>
            <div class="text-xs text-ink-gray-4">{{ fullDate(current.date) }}</div>
          </div>
          <iframe
            sandbox="allow-same-origin"
            class="min-h-0 w-full flex-1 border-0"
            :srcdoc="bodyHtml(current.content)"
          />
          <div v-if="current.attachments?.length" class="shrink-0 border-t border-outline-gray-1 p-3">
            <div class="mb-1 text-xs font-medium text-ink-gray-5">{{ __('Вложения') }}</div>
            <div class="flex flex-wrap gap-2">
              <a
                v-for="a in current.attachments"
                :key="a.index"
                :href="attachUrl(a)"
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
          <select multiple v-model="shared.members" class="h-32 w-full rounded-md border border-outline-gray-2 bg-surface-gray-1 p-1 text-sm">
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
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { Button, FeatherIcon, FormControl, ErrorMessage, call, toast } from 'frappe-ui'
import { napi } from '@/utils/api'
import SimpleModal from '@/components/SimpleModal.vue'
import { usersStore } from '@/stores/users'

const { isManager, crmUsers } = usersStore()
const mailDomain = ref('nacifrah.ru')

const FLAGGED_KEY = '__flagged__'

const mailboxes = ref([])
const currentBox = ref(null)
const folders = ref([])
const folder = ref('INBOX')
const emails = ref([])
const current = ref(null)
const search = ref('')
const loadingList = ref(false)

// Выбор писем (множество uid) + мини-меню «переместить» + создание папки
const selected = ref(new Set())
const moveMenu = ref(false)
const newFolderInput = ref(null)
const newFolder = reactive({ show: false, name: '', saving: false })

// Реальная IMAP-папка для операций: псевдо-папка «Важное» → INBOX
const effectiveFolder = computed(() => (folder.value === FLAGGED_KEY ? 'INBOX' : folder.value))
const isSentFolder = computed(() => ['Sent', 'Drafts'].includes(folder.value))
const systemFolders = computed(() => folders.value.filter((f) => f.system))
const customFolders = computed(() => folders.value.filter((f) => !f.system))
const selectedUids = computed(() => [...selected.value])
const allSelected = computed(() => emails.value.length > 0 && selected.value.size === emails.value.length)
// Папки-цели для перемещения: реальные IMAP-папки, кроме текущей (эффективной)
const moveTargets = computed(() => folders.value.filter((f) => f.key !== effectiveFolder.value))

function isSel(uid) {
  return selected.value.has(String(uid))
}
function toggleSel(uid) {
  const u = String(uid)
  const s = new Set(selected.value)
  if (s.has(u)) s.delete(u)
  else s.add(u)
  selected.value = s
}
function clearSel() {
  selected.value = new Set()
}
function toggleSelectAll() {
  if (allSelected.value) clearSel()
  else selected.value = new Set(emails.value.map((e) => String(e.uid)))
}
const userOptions = computed(() =>
  (crmUsers?.value || []).map((u) => ({ value: u.name, label: u.full_name || u.name })),
)
const composeFromOptions = computed(() =>
  mailboxes.value.filter((b) => b.can_send).map((b) => ({ value: b.email_account, label: b.address })),
)

function boxIcon(type) {
  return type === 'shared' ? 'users' : type === 'mailing' ? 'send' : 'mail'
}
function parseDate(d) {
  if (!d) return null
  const dt = new Date(d)
  return isNaN(dt) ? null : dt
}
function shortDate(d) {
  const dt = parseDate(d)
  if (!dt) return ''
  const now = new Date()
  if (dt.toDateString() === now.toDateString())
    return dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}
function fullDate(d) {
  const dt = parseDate(d)
  return dt ? dt.toLocaleString('ru-RU') : ''
}
function bodyHtml(content) {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
    <style>body{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#1f272e;margin:16px}
    img{max-width:100%}a{color:#2490ef}</style></head><body>${content || ''}</body></html>`
}
function attachUrl(a) {
  const p = new URLSearchParams({
    email_account: currentBox.value.email_account,
    folder: effectiveFolder.value,
    uid: current.value.uid,
    index: a.index,
  })
  return `/api/method/nacifrah.mail_imap.get_attachment?${p.toString()}`
}

async function loadMailboxes() {
  mailboxes.value = (await call(napi('mail_api.get_my_mailboxes'))) || []
  if (mailboxes.value.length && !currentBox.value) currentBox.value = mailboxes.value[0]
}
async function loadFolders() {
  if (!currentBox.value) return
  try {
    folders.value = (await call(napi('mail_imap.get_folders'), { email_account: currentBox.value.email_account })) || []
    if (folders.value.length && !folders.value.find((f) => f.key === folder.value))
      folder.value = folders.value[0].key
  } catch (e) {
    folders.value = []
    toast.error(e?.messages?.[0] || __('Не удалось получить папки'))
  }
}
async function loadEmails() {
  if (!currentBox.value) return
  loadingList.value = true
  current.value = null
  clearSel()
  const flaggedView = folder.value === FLAGGED_KEY
  try {
    emails.value =
      (await call(napi('mail_imap.get_emails'), {
        email_account: currentBox.value.email_account,
        // «Важное» — поиск по \Flagged в INBOX (бэк: only_flagged)
        folder: flaggedView ? 'INBOX' : folder.value,
        only_flagged: flaggedView ? 1 : 0,
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
    current.value = await call(napi('mail_imap.get_email'), {
      email_account: currentBox.value.email_account,
      folder: effectiveFolder.value,
      uid: e.uid,
    })
    // перенести флаг из строки списка в открытое письмо (для кнопки-флажка)
    current.value.flagged = e.flagged
    e.seen = 1
  } catch (err) {
    toast.error(err?.messages?.[0] || __('Не удалось открыть'))
  }
}
async function removeEmail() {
  if (!current.value) return
  // один путь кода: delete_email со списком из одного uid
  try {
    await call(napi('mail_imap.delete_email'), {
      email_account: currentBox.value.email_account,
      folder: effectiveFolder.value,
      uids: JSON.stringify([current.value.uid]),
    })
    current.value = null
    loadEmails()
    loadFolders()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось удалить'))
  }
}

// Общий хелпер массовых действий над выбранными письмами
async function bulkAction(method, extra = {}) {
  if (!selected.value.size) return
  try {
    await call(napi('mail_imap.' + method), {
      email_account: currentBox.value.email_account,
      folder: effectiveFolder.value,
      uids: JSON.stringify(selectedUids.value),
      ...extra,
    })
    clearSel()
    current.value = null
    loadEmails()
    loadFolders() // обновить счётчики непрочитанных
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось выполнить действие'))
  }
}

// Флажок в строке списка (оптимистично)
async function toggleFlag(e) {
  const next = e.flagged ? 0 : 1
  e.flagged = next
  if (current.value && current.value.uid === e.uid) current.value.flagged = next
  try {
    await call(napi('mail_imap.flag_email'), {
      email_account: currentBox.value.email_account,
      folder: effectiveFolder.value,
      uids: JSON.stringify([e.uid]),
      flagged: next,
    })
    loadFolders()
  } catch (err) {
    e.flagged = next ? 0 : 1 // откат
    toast.error(err?.messages?.[0] || __('Не удалось изменить флажок'))
  }
}
// Флажок в области чтения для открытого письма
async function toggleCurrentFlag() {
  if (!current.value) return
  const row = emails.value.find((e) => String(e.uid) === String(current.value.uid))
  if (row) await toggleFlag(row)
  else {
    const next = current.value.flagged ? 0 : 1
    current.value.flagged = next
    try {
      await call(napi('mail_imap.flag_email'), {
        email_account: currentBox.value.email_account,
        folder: effectiveFolder.value,
        uids: JSON.stringify([current.value.uid]),
        flagged: next,
      })
    } catch (err) {
      current.value.flagged = next ? 0 : 1
      toast.error(err?.messages?.[0] || __('Не удалось изменить флажок'))
    }
  }
}

// Создание папки
function openNewFolder() {
  newFolder.show = true
  newFolder.name = ''
  nextTick(() => newFolderInput.value?.focus())
}
async function createFolder() {
  const name = (newFolder.name || '').trim()
  if (!name) return
  newFolder.saving = true
  try {
    await call(napi('mail_imap.create_folder'), {
      email_account: currentBox.value.email_account,
      name,
    })
    newFolder.show = false
    newFolder.name = ''
    toast.success(__('Папка создана'))
    loadFolders()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось создать папку'))
  } finally {
    newFolder.saving = false
  }
}
async function selectBox(b) {
  currentBox.value = b
  folder.value = 'INBOX'
  await loadFolders()
  loadEmails()
}
function selectFolder(k) {
  folder.value = k
  moveMenu.value = false
  newFolder.show = false
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
    await call(napi('mail_imap.send_email'), {
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
  await loadFolders()
  loadEmails()
})
</script>
