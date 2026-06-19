<!--
  DesignationsTab — вкладка «Должности» модуля «Команда» (K3).
  Все сотрудники в группировке по должностям + управление должностями (создать/
  переименовать/удалить, назначить сотрудника). Источник — Designation + Employee
  (единая база, та же что в найме и оргструктуре).
-->
<template>
  <div class="flex-1 overflow-auto px-4 py-4">
    <p class="mb-3 max-w-2xl text-sm text-ink-gray-5">
      {{ __('Сотрудники сгруппированы по должностям. Должности — общий справочник: меняешь здесь, меняется везде (найм, карточка сотрудника).') }}
    </p>

    <div class="flex flex-col gap-2">
      <div
        v-for="d in groups"
        :key="d.name || '__none__'"
        class="rounded-lg border border-outline-gray-1 bg-surface-white"
      >
        <div
          class="flex items-center justify-between border-b border-outline-gray-1 px-3 py-2"
        >
          <div class="flex items-center gap-2">
            <FeatherIcon name="briefcase" class="h-4 w-4 text-ink-gray-5" />
            <span class="font-medium text-ink-gray-8">{{ d.label }}</span>
            <span class="text-xs text-ink-gray-4">· {{ d.employees.length }}</span>
          </div>
          <div v-if="isManager() && d.name" class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon="user-plus"
              :tooltip="__('Назначить сотрудника')"
              @click="openAssign(d.name)"
            />
            <Button
              variant="ghost"
              size="sm"
              icon="edit-2"
              :tooltip="__('Переименовать')"
              @click="openRename(d.name)"
            />
            <Button
              variant="ghost"
              size="sm"
              icon="trash-2"
              :tooltip="__('Удалить')"
              @click="removeDesig(d.name)"
            />
          </div>
        </div>
        <div v-if="d.employees.length" class="flex flex-wrap gap-2 px-3 py-2">
          <div
            v-for="e in d.employees"
            :key="e.name"
            class="group/e flex items-center gap-2 rounded-md border border-outline-gray-2 px-2 py-1"
          >
            <Avatar :image="e.image" :label="e.employee_name" size="sm" />
            <span class="text-xs text-ink-gray-8">{{ e.employee_name }}</span>
            <button
              v-if="isManager()"
              class="text-ink-gray-4 opacity-0 hover:text-ink-gray-7 group-hover/e:opacity-100"
              :title="__('Убрать должность')"
              @click="detach(e)"
            >
              <FeatherIcon name="x" class="h-3 w-3" />
            </button>
          </div>
        </div>
        <div v-else class="px-3 py-2 text-xs text-ink-gray-4">
          {{ __('Нет сотрудников') }}
        </div>
      </div>
    </div>

    <Dialog
      v-model="showEdit"
      :options="{ title: editMode === 'create' ? __('Новая должность') : __('Переименовать должность') }"
    >
      <template #body-content>
        <FormControl
          :label="__('Название')"
          v-model="editName"
          :placeholder="__('Например, Дизайнер')"
          @keyup.enter="saveEdit"
        />
        <div class="mt-4 flex justify-end gap-2">
          <Button :label="__('Отмена')" @click="showEdit = false" />
          <Button
            variant="solid"
            :label="__('Сохранить')"
            :loading="saving"
            @click="saveEdit"
          />
        </div>
      </template>
    </Dialog>

    <Dialog v-model="showAssign" :options="{ title: __('Назначить сотрудника на должность') }">
      <template #body-content>
        <FormControl
          type="select"
          :label="__('Сотрудник')"
          :options="employeeOptions"
          v-model="assignEmp"
        />
        <div class="mt-4 flex justify-end gap-2">
          <Button :label="__('Отмена')" @click="showAssign = false" />
          <Button variant="solid" :label="__('Назначить')" @click="doAssign" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import {
  Avatar,
  Button,
  Dialog,
  FormControl,
  FeatherIcon,
  call,
  toast,
} from 'frappe-ui'
import { ref, computed, onMounted } from 'vue'
import { usersStore } from '@/stores/users'

const { isManager } = usersStore()

const designations = ref([])
const employees = ref([])
async function load() {
  try {
    designations.value = await call('nacifrah.hr.list_designations')
    employees.value = await call('nacifrah.hr.list_employees', { status: 'Active' })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось загрузить'))
  }
}
onMounted(load)

const groups = computed(() => {
  const byDesig = {}
  for (const d of designations.value)
    byDesig[d.name] = { name: d.name, label: d.name, employees: [] }
  const noDesig = { name: '', label: __('Без должности'), employees: [] }
  for (const e of employees.value) {
    if (e.designation && byDesig[e.designation]) byDesig[e.designation].employees.push(e)
    else if (e.designation)
      byDesig[e.designation] = { name: e.designation, label: e.designation, employees: [e] }
    else noDesig.employees.push(e)
  }
  const arr = Object.values(byDesig)
  if (noDesig.employees.length) arr.push(noDesig)
  return arr
})
const employeeOptions = computed(() =>
  employees.value.map((e) => ({
    label: e.employee_name + (e.designation ? ' (' + e.designation + ')' : ''),
    value: e.name,
  })),
)

const showEdit = ref(false)
const editMode = ref('create')
const editName = ref('')
const editOld = ref('')
const saving = ref(false)
function openCreate() {
  editMode.value = 'create'
  editName.value = ''
  editOld.value = ''
  showEdit.value = true
}
function openRename(name) {
  editMode.value = 'rename'
  editName.value = name
  editOld.value = name
  showEdit.value = true
}
async function saveEdit() {
  const name = (editName.value || '').trim()
  if (!name) return
  saving.value = true
  try {
    if (editMode.value === 'create')
      await call('nacifrah.hr.create_designation', { designation_name: name })
    else
      await call('nacifrah.hr.rename_designation', {
        old_name: editOld.value,
        new_name: name,
      })
    showEdit.value = false
    await load()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось'))
  } finally {
    saving.value = false
  }
}
async function removeDesig(name) {
  if (
    !window.confirm(
      __('Удалить должность «{0}»? Сотрудники останутся без должности.').replace('{0}', name),
    )
  )
    return
  try {
    await call('nacifrah.hr.delete_designation', { designation: name })
    await load()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось'))
  }
}

const showAssign = ref(false)
const assignTarget = ref('')
const assignEmp = ref('')
function openAssign(name) {
  assignTarget.value = name
  assignEmp.value = ''
  showAssign.value = true
}
async function doAssign() {
  if (!assignEmp.value) return
  try {
    await call('nacifrah.hr.set_employee_designation', {
      employee: assignEmp.value,
      designation: assignTarget.value,
    })
    showAssign.value = false
    await load()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось'))
  }
}
async function detach(e) {
  try {
    await call('nacifrah.hr.set_employee_designation', {
      employee: e.name,
      designation: '',
    })
    await load()
  } catch (err) {
    toast.error(err?.messages?.[0] || __('Не удалось'))
  }
}

defineExpose({ openCreate })
</script>
