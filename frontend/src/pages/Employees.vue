<template>
  <LayoutHeader>
    <template #left-header>
      <div class="text-lg font-semibold text-ink-gray-8">{{ __('Сотрудники') }}</div>
    </template>
    <template #right-header>
      <Button
        v-if="isManager()"
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
          <td class="px-3 py-2 text-ink-gray-8">{{ e.employee_name }}</td>
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
              <h3 class="text-xl font-semibold text-ink-gray-9">{{ card.employee_name }}</h3>
              <Button variant="ghost" icon="x" @click="card = null" />
            </div>
            <div class="flex-1 overflow-y-auto px-6 py-5">
              <dl class="grid grid-cols-1 gap-3">
                <div v-for="row in cardRows" :key="row.label" class="flex gap-2 text-sm">
                  <dt class="w-32 shrink-0 text-ink-gray-5">{{ row.label }}</dt>
                  <dd class="text-ink-gray-8">{{ row.value || '—' }}</dd>
                </div>
              </dl>
            </div>
            <div
              v-if="isManager() && card.status === 'Active' && card.user_id"
              class="shrink-0 border-t border-outline-gray-1 px-6 py-4"
            >
              <Button
                variant="subtle"
                theme="red"
                :label="__('Уволить')"
                iconLeft="user-x"
                @click="openFire"
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
          <FormControl
            type="select"
            :label="__('Должность')"
            :options="designationOptions"
            v-model="form.designation"
          />
          <FormControl
            type="select"
            :label="__('Отдел')"
            :options="departmentOptions"
            v-model="form.department"
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
import {
  Button,
  Dialog,
  FormControl,
  ErrorMessage,
  createResource,
  call,
  toast,
} from 'frappe-ui'
import { reactive, ref, computed, watch, onMounted } from 'vue'
import { usersStore } from '@/stores/users'

const { isManager } = usersStore()

// ── список + D6 фильтры ──────────────────────────────────────────────
const employeeList = ref([])
const filterStatus = ref('Active')
const filterDept = ref('')

async function loadEmployees() {
  try {
    employeeList.value = await call('nacifrah.hr.list_employees', {
      status: filterStatus.value,
      department: filterDept.value || null,
    })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось загрузить сотрудников'))
  }
}
watch([filterStatus, filterDept], loadEmployees)
onMounted(loadEmployees)

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
function openCard(e) {
  card.value = e
}
const cardRows = computed(() => {
  const e = card.value || {}
  return [
    { label: __('Должность'), value: e.designation },
    { label: __('Отдел'), value: e.department },
    { label: __('Логин'), value: e.user_id },
    { label: __('Статус'), value: statusLabel(e.status) },
  ]
})

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
  department: '',
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
    await call('nacifrah.hr.hire_employee', {
      full_name: form.full_name,
      email: form.email,
      role: form.role,
      designation: form.designation || null,
      department: form.department || null,
      password: form.password || null,
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
