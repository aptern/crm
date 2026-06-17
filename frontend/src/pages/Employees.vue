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
          v-for="e in employees.data || []"
          :key="e.name"
          class="border-b border-outline-gray-1 hover:bg-surface-gray-1"
        >
          <td class="px-3 py-2 text-ink-gray-8">{{ e.employee_name }}</td>
          <td class="px-3 py-2 text-ink-gray-7">{{ e.designation || '—' }}</td>
          <td class="px-3 py-2 text-ink-gray-7">{{ e.department || '—' }}</td>
          <td class="px-3 py-2 text-ink-gray-7">{{ e.user_id || '—' }}</td>
          <td class="px-3 py-2 text-ink-gray-7">{{ e.status }}</td>
        </tr>
      </tbody>
    </table>
    <div
      v-if="employees.data && !employees.data.length"
      class="p-8 text-center text-sm text-ink-gray-5"
    >
      {{ __('Пока нет сотрудников. Нажмите «Нанять».') }}
    </div>
  </div>

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
import { reactive, ref, computed } from 'vue'
import { usersStore } from '@/stores/users'

const { isManager } = usersStore()

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

const employees = createResource({ url: 'nacifrah.hr.list_employees', auto: true })
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
    employees.reload()
    toast.success(__('Сотрудник нанят'))
  } catch (e) {
    error.value = e?.messages?.[0] || __('Не удалось нанять сотрудника')
  } finally {
    hiring.value = false
  }
}
</script>
