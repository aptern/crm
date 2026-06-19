<template>
  <LayoutHeader v-if="!embedded">
    <template #left-header>
      <div class="text-lg font-semibold text-ink-gray-8">{{ __('Сотрудники') }}</div>
    </template>
    <template #right-header>
      <Button
        v-if="canManage"
        variant="solid"
        :label="__('Нанять')"
        iconLeft="plus"
        @click="openHire"
      />
    </template>
  </LayoutHeader>

  <div class="flex-1 overflow-auto px-4 py-3">
    <!-- D6: фильтры по статусу / отделу -->
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <FormControl
        type="select"
        :options="statusFilterOptions"
        v-model="filterStatus"
        class="w-44"
      />
      <FormControl
        type="select"
        :options="departmentFilterOptions"
        v-model="filterDept"
        class="w-52"
      />
      <!-- K3: поиск по всем полям карточки сотрудника -->
      <FormControl
        type="text"
        :placeholder="__('Поиск: имя, должность, телефон, логин…')"
        v-model="searchQuery"
        class="w-72"
      />
      <span class="text-xs text-ink-gray-4">{{ (employeeList || []).length }} {{ __('чел.') }}</span>
    </div>

    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-outline-gray-1 text-left text-ink-gray-5">
          <th class="px-3 py-2 font-medium">{{ __('Сотрудник') }}</th>
          <th class="px-3 py-2 font-medium">{{ __('Должность') }}</th>
          <th class="px-3 py-2 font-medium">{{ __('Отдел') }}</th>
          <th class="px-3 py-2 font-medium">{{ __('Логин') }}</th>
          <th class="px-3 py-2 font-medium">{{ __('Статус') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="e in employeeList || []"
          :key="e.name"
          class="cursor-pointer border-b border-outline-gray-1 hover:bg-surface-gray-1"
          @click="openCard(e)"
        >
          <td class="px-3 py-2 text-ink-gray-8">
            <div class="flex items-center gap-2">
              <Avatar :image="e.image" :label="e.employee_name" size="sm" />
              <span>{{ e.employee_name }}</span>
            </div>
          </td>
          <td class="px-3 py-2 text-ink-gray-7">{{ e.designation || '—' }}</td>
          <td class="px-3 py-2 text-ink-gray-7">{{ e.department || '—' }}</td>
          <td class="px-3 py-2 text-ink-gray-7">{{ e.user_id || '—' }}</td>
          <td class="px-3 py-2">
            <span
              class="rounded px-2 py-0.5 text-xs font-medium"
              :class="statusClass(e.status)"
            >
              {{ statusLabel(e.status) }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    <div
      v-if="employeeList && !employeeList.length"
      class="p-8 text-center text-sm text-ink-gray-5"
    >
      {{ __('Нет сотрудников по фильтру.') }}
    </div>
  </div>

  <!-- D1: карточка сотрудника — выезжает справа панелью -->
  <Teleport to="body">
    <Transition name="emp-overlay">
      <div v-if="card" class="fixed inset-0 z-40">
        <div class="absolute inset-0 bg-black/30" @click="card = null" />
        <Transition name="emp-panel">
          <div
            v-if="card"
            class="absolute right-0 top-0 flex h-full w-full flex-col bg-surface-modal shadow-2xl sm:w-1/2"
          >
            <div
              class="flex shrink-0 items-center justify-between border-b border-outline-gray-1 px-6 py-4"
            >
              <div class="flex items-center gap-3">
                <div class="relative">
                  <Avatar :image="card.image" :label="card.employee_name" size="2xl" />
                  <button
                    v-if="canManage"
                    class="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-surface-gray-7 text-ink-white shadow ring-2 ring-surface-modal"
                    :title="__('Загрузить фото')"
                    @click="openPhoto(card)"
                  >
                    <FeatherIcon name="camera" class="h-3 w-3" />
                  </button>
                </div>
                <h3 class="text-xl font-semibold text-ink-gray-9">{{ card.employee_name }}</h3>
              </div>
              <Button variant="ghost" icon="x" @click="card = null" />
            </div>
            <div class="flex-1 overflow-y-auto px-6 py-5">
              <!-- K3: должность — редактируемая (админ меняет в выпадающем списке) -->
              <div class="mb-3 flex items-start gap-2 text-sm">
                <div class="w-32 shrink-0 pt-1.5 text-ink-gray-5">
                  {{ __('Должность') }}
                </div>
                <div class="flex-1">
                  <template v-if="canManage">
                    <FormControl
                      type="select"
                      :options="designationSelectOptions"
                      :modelValue="cardDesignation"
                      @update:modelValue="onCardDesignationChange"
                    />
                    <div v-if="cardDesigNewMode" class="mt-1.5 flex gap-2">
                      <FormControl
                        type="text"
                        class="flex-1"
                        :placeholder="__('Название новой должности')"
                        v-model="cardDesigNew"
                        @keyup.enter="saveCardDesignation"
                      />
                      <Button
                        size="sm"
                        :label="__('OK')"
                        @click="saveCardDesignation"
                      />
                    </div>
                  </template>
                  <span v-else class="text-ink-gray-8">{{
                    card.designation || '—'
                  }}</span>
                </div>
              </div>
              <dl class="grid grid-cols-1 gap-3">
                <div v-for="row in cardRows" :key="row.label" class="flex gap-2 text-sm">
                  <dt class="w-32 shrink-0 text-ink-gray-5">{{ row.label }}</dt>
                  <dd class="text-ink-gray-8">{{ row.value || '—' }}</dd>
                </div>
              </dl>
              <!-- I32: телефон сотрудника (менеджер может задать/изменить) -->
              <div class="mt-3 flex items-start gap-2 text-sm">
                <div class="w-32 shrink-0 pt-1.5 text-ink-gray-5">
                  {{ __('Телефон') }}
                </div>
                <div class="flex-1">
                  <template v-if="canManage">
                    <PhoneInput
                      :value="card.cell_number"
                      @change="(v) => (phoneEdit = v)"
                    />
                    <Button
                      class="mt-1.5"
                      size="sm"
                      :label="__('Сохранить телефон')"
                      :loading="savingPhone"
                      @click="saveEmployeePhone"
                    />
                  </template>
                  <span v-else class="text-ink-gray-8">{{
                    formatPhoneDisplay(card.cell_number) || '—'
                  }}</span>
                </div>
              </div>
            </div>
            <div
              v-if="canManage"
              class="flex shrink-0 items-center gap-2 border-t border-outline-gray-1 px-6 py-4"
            >
              <Button
                v-if="card.status === 'Active' && card.user_id"
                variant="subtle"
                theme="red"
                :label="__('Уволить')"
                iconLeft="user-x"
                @click="openFire"
              />
              <!-- K8: полное удаление — ТОЛЬКО админ -->
              <Button
                v-if="isAdmin()"
                variant="ghost"
                theme="red"
                :label="__('Удалить')"
                iconLeft="trash-2"
                @click="doDelete"
              />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- D3: увольнение + перенос сделок/лидов/задач -->
  <Dialog v-model="showFire" :options="{ title: __('Уволить сотрудника') }">
    <template #body-content>
      <p class="text-sm text-ink-gray-7">
        {{ __('Уволить «{0}»? Вход в систему будет отключён. На кого перенести его работу?', [card?.employee_name]) }}
      </p>
      <div class="mt-3 flex flex-col gap-3">
        <FormControl
          type="select"
          :label="__('Лиды → перенести на')"
          :options="heirOptions"
          v-model="fireReassign.lead"
        />
        <FormControl
          type="select"
          :label="__('Сделки и проекты → перенести на')"
          :options="heirOptions"
          v-model="fireReassign.deal"
        />
        <FormControl
          type="select"
          :label="__('Задачи → перенести на')"
          :options="heirOptions"
          v-model="fireReassign.task"
        />
        <ErrorMessage v-if="fireError" :message="fireError" />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <Button :label="__('Отмена')" @click="showFire = false" />
        <Button
          variant="solid"
          theme="red"
          :label="__('Уволить и перенести')"
          :loading="firing"
          @click="doFire"
        />
      </div>
    </template>
  </Dialog>

  <PhotoCropDialog
    v-model="showPhoto"
    :title="photoTarget ? photoTarget.employee_name : ''"
    @cropped="onCropped"
  />

  <Dialog v-model="showHire" :options="{ size: 'lg' }">
    <template #body>
      <div class="bg-surface-modal px-4 pb-6 pt-5 sm:px-6">
        <h3 class="mb-4 text-xl font-semibold text-ink-gray-9">{{ __('Нанять сотрудника') }}</h3>
        <div class="flex flex-col gap-3">
          <FormControl :label="__('ФИО')" v-model="form.full_name" :placeholder="__('Иван Петров')" />
          <FormControl
            type="email"
            :label="__('Email (логин)')"
            v-model="form.email"
            placeholder="ivan@nacifrah.ru"
          />
          <FormControl type="password" :label="__('Пароль')" v-model="form.password" />
          <FormControl
            type="select"
            :label="__('Роль')"
            :options="roleOptions"
            v-model="form.role"
          />
          <!-- K4: должность с инлайн-созданием новой -->
          <FormControl
            type="select"
            :label="__('Должность')"
            :options="designationSelectOptions"
            v-model="form.designation"
          />
          <FormControl
            v-if="form.designation === '__new__'"
            type="text"
            :placeholder="__('Название новой должности')"
            v-model="form.designationNew"
            @keydown.enter.prevent
          />
          <FormControl
            type="select"
            :label="__('Отдел')"
            :options="departmentOptions"
            v-model="form.department"
          />
          <PhoneInput
            :label="__('Телефон')"
            :value="form.cell_number"
            @change="(v) => (form.cell_number = v)"
          />
          <ErrorMessage v-if="error" :message="error" />
        </div>
        <div class="mt-5 flex flex-row-reverse gap-2">
          <Button
            variant="solid"
            :label="__('Нанять')"
            :loading="hiring"
            @click="doHire"
          />
          <Button :label="__('Отмена')" @click="showHire = false" />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import PhoneInput from '@/components/Controls/PhoneInput.vue'
import PhotoCropDialog from '@/components/PhotoCropDialog.vue'
import { formatPhoneDisplay } from '@/utils/ruFormat'
import {
  Avatar,
  Button,
  Dialog,
  FormControl,
  ErrorMessage,
  FeatherIcon,
  createResource,
  call,
  toast,
} from 'frappe-ui'
import { reactive, ref, computed, watch, onMounted } from 'vue'
import { usersStore } from '@/stores/users'

const { isManager, isAdmin } = usersStore()

// K3: встраивание во вкладку «Команда» (прячем хедер; найм — кнопкой в хедере Team)
defineProps({ embedded: { type: Boolean, default: false } })
defineExpose({ openHire: () => openHire() })

// D2: право найма/увольнения по политике (а не просто роль менеджера)
const canManage = ref(false)

// ── список + D6 фильтры ──────────────────────────────────────────────
const employeeList = ref([])
const filterStatus = ref('Active')
const filterDept = ref('')
const searchQuery = ref('')

async function loadEmployees() {
  try {
    employeeList.value = await call('nacifrah.hr.list_employees', {
      status: filterStatus.value,
      department: filterDept.value || null,
      search: searchQuery.value || null,
    })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось загрузить сотрудников'))
  }
}
watch([filterStatus, filterDept, searchQuery], loadEmployees)
onMounted(async () => {
  loadEmployees()
  try {
    canManage.value = !!(await call('nacifrah.hr.can_manage_staff'))
  } catch (e) {
    canManage.value = false
  }
})

const statusFilterOptions = [
  { label: 'Активные', value: 'Active' },
  { label: 'Уволенные', value: 'Left' },
  { label: 'Все', value: 'All' },
]

function statusLabel(s) {
  if (s === 'Active') return 'Активный'
  if (s === 'Left' || s === 'Inactive') return 'Уволен'
  if (s === 'Suspended') return 'Приостановлен'
  return s || '—'
}
function statusClass(s) {
  if (s === 'Active') return 'bg-green-100 text-green-700'
  if (s === 'Left' || s === 'Inactive') return 'bg-red-100 text-red-700'
  return 'bg-surface-gray-2 text-ink-gray-6'
}

// ── D1 карточка сотрудника ───────────────────────────────────────────
const card = ref(null)
// K3: инлайн-смена должности прямо в карточке сотрудника
const cardDesignation = ref('')
const cardDesigNewMode = ref(false)
const cardDesigNew = ref('')
function openCard(e) {
  card.value = e
  phoneEdit.value = null
  cardDesignation.value = e.designation || ''
  cardDesigNewMode.value = false
  cardDesigNew.value = ''
}
async function onCardDesignationChange(val) {
  cardDesignation.value = val
  if (val === '__new__') {
    cardDesigNewMode.value = true
    return
  }
  cardDesigNewMode.value = false
  await applyCardDesignation(val || null)
}
async function saveCardDesignation() {
  const name = (cardDesigNew.value || '').trim()
  if (!name) return
  await applyCardDesignation(name)
  cardDesigNewMode.value = false
  cardDesigNew.value = ''
  cardDesignation.value = name
}
async function applyCardDesignation(val) {
  if (!card.value?.name) return
  try {
    await call('nacifrah.hr.set_employee_designation', {
      employee: card.value.name,
      designation: val,
    })
    if (card.value) card.value.designation = val
    designations.reload()
    await loadEmployees()
    toast.success(__('Должность обновлена'))
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось'))
  }
}

// I32: правка телефона существующего сотрудника
const phoneEdit = ref(null)
const savingPhone = ref(false)
async function saveEmployeePhone() {
  if (!card.value?.name) return
  savingPhone.value = true
  try {
    const val = phoneEdit.value ?? card.value.cell_number ?? ''
    await call('nacifrah.hr.set_employee_phone', {
      employee: card.value.name,
      user: card.value.user_id || null,
      cell_number: val,
    })
    card.value.cell_number = val
    await loadEmployees()
    toast.success(__('Телефон сохранён'))
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось сохранить телефон'))
  } finally {
    savingPhone.value = false
  }
}
const cardRows = computed(() => {
  const e = card.value || {}
  return [
    { label: __('Отдел'), value: e.department },
    { label: __('Логин'), value: e.user_id },
    { label: __('Статус'), value: statusLabel(e.status) },
  ]
})

// I37: загрузка фото сотрудника (обрезка 1:1 в PhotoCropDialog)
const showPhoto = ref(false)
const photoTarget = ref(null)
function openPhoto(e) {
  photoTarget.value = e
  showPhoto.value = true
}
async function onCropped({ blob, name }) {
  if (!photoTarget.value?.name) return
  try {
    const fd = new FormData()
    fd.append('file', blob, (name || 'photo').replace(/\.[^.]+$/, '') + '.jpg')
    fd.append('is_private', '0')
    fd.append('folder', 'Home')
    const res = await fetch('/api/method/upload_file', {
      method: 'POST',
      headers: { 'X-Frappe-CSRF-Token': window.csrf_token || '' },
      body: fd,
    })
    const j = await res.json()
    const fileUrl = j?.message?.file_url
    if (!fileUrl) throw new Error('upload failed')
    await call('nacifrah.hr.set_employee_photo', {
      employee: photoTarget.value.name,
      file_url: fileUrl,
    })
    if (card.value && card.value.name === photoTarget.value.name) card.value.image = fileUrl
    await loadEmployees()
    toast.success(__('Фото обновлено'))
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось загрузить фото'))
  }
}

// ── D3 увольнение + перенос ──────────────────────────────────────────
const showFire = ref(false)
const firing = ref(false)
const fireError = ref('')
const fireReassign = reactive({ lead: '', deal: '', task: '' })
const heirOptions = computed(() => [
  { label: __('— не переносить —'), value: '' },
  ...(employeeList.value || [])
    .filter((e) => e.user_id && e.user_id !== card.value?.user_id && e.status === 'Active')
    .map((e) => ({ label: e.employee_name, value: e.user_id })),
])
function openFire() {
  fireError.value = ''
  fireReassign.lead = ''
  fireReassign.deal = ''
  fireReassign.task = ''
  showFire.value = true
}

// K8: полное удаление сотрудника (карточка + логин) — только админ
async function doDelete() {
  if (!card.value?.name) return
  if (
    !window.confirm(
      __('Удалить сотрудника «{0}» полностью? Удалятся карточка и логин. Необратимо.').replace(
        '{0}',
        card.value.employee_name,
      ),
    )
  )
    return
  try {
    await call('nacifrah.hr.delete_employee', { employee: card.value.name })
    card.value = null
    await loadEmployees()
    toast.success(__('Сотрудник удалён'))
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось удалить'))
  }
}
async function doFire() {
  if (!card.value?.user_id) return
  firing.value = true
  fireError.value = ''
  try {
    const reassign = {}
    if (fireReassign.lead) reassign.lead = fireReassign.lead
    if (fireReassign.deal) reassign.deal = fireReassign.deal
    if (fireReassign.task) reassign.task = fireReassign.task
    const res = await call('nacifrah.hr.fire_employee', {
      user: card.value.user_id,
      reassign: JSON.stringify(reassign),
    })
    showFire.value = false
    card.value = null
    await loadEmployees()
    const c = res?.reassigned || {}
    toast.success(
      __('Сотрудник уволен. Перенесено: лиды {0}, сделки {1}, задачи {2}', [
        c.lead || 0,
        c.deal || 0,
        c.task || 0,
      ]),
    )
  } catch (e) {
    fireError.value = e?.messages?.[0] || __('Не удалось уволить сотрудника')
  } finally {
    firing.value = false
  }
}

// ── найм (как было) ──────────────────────────────────────────────────
const showHire = ref(false)
const hiring = ref(false)
const error = ref('')
const form = reactive({
  full_name: '',
  email: '',
  password: '',
  role: 'Specialist',
  designation: '',
  designationNew: '', // K4: имя новой должности (когда выбрано «завести новую»)
  department: '',
  cell_number: '', // I32: телефон сотрудника
})

const designations = createResource({
  url: 'frappe.client.get_list',
  params: { doctype: 'Designation', fields: ['name'], limit_page_length: 0 },
  auto: true,
})
const departments = createResource({
  url: 'frappe.client.get_list',
  params: { doctype: 'Department', fields: ['name'], limit_page_length: 0 },
  auto: true,
})

const roleOptions = [
  { label: 'Сотрудник (Specialist)', value: 'Specialist' },
  { label: 'Руководитель (Agency Head)', value: 'Agency Head' },
  { label: 'Администратор (Agency Admin)', value: 'Agency Admin' },
  { label: 'Наблюдатель (Observer)', value: 'Observer' },
]
const designationOptions = computed(() => [
  { label: '—', value: '' },
  ...((designations.data || []).map((d) => ({ label: d.name, value: d.name }))),
])
// K4: тот же список + пункт «завести новую» в самом низу
const designationSelectOptions = computed(() => [
  ...designationOptions.value,
  { label: __('＋ Завести новую должность…'), value: '__new__' },
])
// разрешить выбранную должность: если «новая» — создать и вернуть её имя
async function ensureDesignation(sel, typed) {
  if (sel !== '__new__') return sel || null
  const name = (typed || '').trim()
  if (!name) return null
  await call('nacifrah.hr.create_designation', { designation_name: name })
  designations.reload()
  return name
}
const departmentOptions = computed(() => [
  { label: '—', value: '' },
  ...((departments.data || []).map((d) => ({ label: d.name, value: d.name }))),
])
const departmentFilterOptions = computed(() => [
  { label: __('Все отделы'), value: '' },
  ...((departments.data || []).map((d) => ({ label: d.name, value: d.name }))),
])

function openHire() {
  error.value = ''
  Object.assign(form, {
    full_name: '',
    email: '',
    password: '',
    role: 'Specialist',
    designation: '',
    designationNew: '',
    department: '',
  })
  showHire.value = true
}

async function doHire() {
  error.value = ''
  if (!form.full_name || !form.email) {
    error.value = __('Укажите ФИО и email')
    return
  }
  hiring.value = true
  try {
    const designation = await ensureDesignation(form.designation, form.designationNew)
    await call('nacifrah.hr.hire_employee', {
      full_name: form.full_name,
      email: form.email,
      role: form.role,
      designation: designation,
      department: form.department || null,
      password: form.password || null,
      cell_number: form.cell_number || null,
    })
    showHire.value = false
    loadEmployees()
    toast.success(__('Сотрудник нанят'))
  } catch (e) {
    error.value = e?.messages?.[0] || __('Не удалось нанять сотрудника')
  } finally {
    hiring.value = false
  }
}
</script>

<style scoped>
.emp-overlay-enter-active,
.emp-overlay-leave-active {
  transition: opacity 0.2s ease;
}
.emp-overlay-enter-from,
.emp-overlay-leave-to {
  opacity: 0;
}
.emp-panel-enter-active,
.emp-panel-leave-active {
  transition: transform 0.25s ease;
}
.emp-panel-enter-from,
.emp-panel-leave-to {
  transform: translateX(100%);
}
</style>
