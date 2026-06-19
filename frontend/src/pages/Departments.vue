<!--
  Отделы → оргструктура компании (I36). Корень — компания (руководитель = CEO),
  ветви — отделы, в узлах — сотрудники с фото/должностью; соединительные линии (CSS).
  Управление (менеджер): создать/удалить отдел, назначить руководителя/CEO, назначить/
  перенести сотрудника, загрузить фото (1:1). Заказчик: «структура компании иерархией
  с чёрточками и зависимостями, с отображением сотрудников; оформи с фото».
-->
<template>
  <LayoutHeader v-if="!embedded">
    <template #left-header>
      <div class="text-lg font-semibold text-ink-gray-8">
        {{ __('Оргструктура') }}
      </div>
    </template>
    <template #right-header>
      <Button
        v-if="isManager()"
        variant="solid"
        :label="__('Добавить отдел')"
        iconLeft="plus"
        @click="openCreate(null)"
      />
    </template>
  </LayoutHeader>

  <div class="flex-1 overflow-auto px-4 py-4">
    <p class="mb-4 max-w-2xl text-sm text-ink-gray-5">
      {{
        __(
          'Структура компании сверху вниз: компания и CEO, от них — отделы и сотрудники. Кнопки на карточках управляют структурой.',
        )
      }}
    </p>

    <!-- ОРГ-ЧАРТ -->
    <div v-if="chart" class="nac-org min-w-full overflow-x-auto pb-6">
      <ul>
        <OrgNode :node="chart" />
      </ul>
    </div>
    <div v-else class="p-8 text-center text-sm text-ink-gray-5">
      {{ __('Загрузка…') }}
    </div>

    <!-- БЕЗ ОТДЕЛА -->
    <div v-if="chart?.unassigned?.length" class="mt-6">
      <div class="mb-2 text-sm font-medium text-ink-gray-7">
        {{ __('Без отдела') }} · {{ chart.unassigned.length }}
      </div>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="e in chart.unassigned"
          :key="e.name"
          class="flex items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-white px-2 py-1.5"
        >
          <Avatar :image="e.image" :label="e.employee_name" size="sm" />
          <div class="min-w-0">
            <div class="truncate text-xs text-ink-gray-8">{{ e.employee_name }}</div>
            <div class="truncate text-[10px] text-ink-gray-4">{{ e.designation }}</div>
          </div>
          <Dropdown v-if="isManager()" :options="unassignedActions(e)">
            <Button variant="ghost" size="sm" icon="more-horizontal" @click.stop />
          </Dropdown>
        </div>
      </div>
    </div>
  </div>

  <!-- создание / подотдел -->
  <Dialog v-model="showCreate" :options="{ title: __('Создать отдел') }">
    <template #body-content>
      <div class="flex flex-col gap-3">
        <FormControl
          :label="__('Название')"
          v-model="createForm.name"
          :placeholder="__('Например, Дизайн')"
        />
        <FormControl
          type="select"
          :label="__('Родительский отдел')"
          :options="parentOptions"
          v-model="createForm.parent"
        />
        <FormControl
          type="select"
          :label="__('Руководитель')"
          :options="headOptions"
          v-model="createForm.head"
        />
        <ErrorMessage v-if="createError" :message="createError" />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <Button :label="__('Отмена')" @click="showCreate = false" />
        <Button
          variant="solid"
          :label="__('Создать')"
          :loading="creating"
          @click="doCreate"
        />
      </div>
    </template>
  </Dialog>

  <!-- выбор пользователя (руководитель отдела / CEO) -->
  <Dialog v-model="showUser" :options="{ title: userDlgTitle }">
    <template #body-content>
      <div class="flex flex-col gap-2">
        <FormControl
          type="select"
          :label="__('Пользователь')"
          :options="headOptions"
          v-model="userPick"
        />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <Button :label="__('Отмена')" @click="showUser = false" />
        <Button variant="solid" :label="__('Сохранить')" @click="doUser" />
      </div>
    </template>
  </Dialog>

  <!-- назначить/перенести сотрудника -->
  <Dialog v-model="showEmp" :options="{ title: empDlgTitle }">
    <template #body-content>
      <div class="flex flex-col gap-2">
        <FormControl
          v-if="empMode === 'assign'"
          type="select"
          :label="__('Сотрудник')"
          :options="employeeOptions"
          v-model="empPick"
        />
        <FormControl
          v-else
          type="select"
          :label="__('Отдел')"
          :options="deptOptions"
          v-model="deptPick"
        />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <Button :label="__('Отмена')" @click="showEmp = false" />
        <Button variant="solid" :label="__('Сохранить')" @click="doEmp" />
      </div>
    </template>
  </Dialog>

  <PhotoCropDialog
    v-model="showPhoto"
    :title="photoTarget ? photoTarget.employee_name : ''"
    @cropped="onCropped"
  />
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import OrgNode from '@/components/OrgNode.vue'
import PhotoCropDialog from '@/components/PhotoCropDialog.vue'
import {
  Avatar,
  Button,
  Dialog,
  Dropdown,
  FormControl,
  ErrorMessage,
  call,
  toast,
} from 'frappe-ui'
import { reactive, ref, computed, onMounted, provide } from 'vue'
import { usersStore } from '@/stores/users'

// K3: при встраивании во вкладку «Команда» прячем собственный LayoutHeader
defineProps({ embedded: { type: Boolean, default: false } })
// родитель (Team) вызывает создание отдела через кнопку в своём хедере
defineExpose({ openCreate: (p) => openCreate(p) })

const { isManager, users: usersList } = usersStore()

const chart = ref(null)
async function load() {
  try {
    chart.value = await call('nacifrah.hr.get_org_chart')
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось загрузить оргструктуру'))
  }
}
onMounted(load)

const users = computed(
  () =>
    usersList.data?.crmUsers
      ?.filter((u) => u.enabled)
      .map((u) => ({ label: u.full_name?.trimEnd() || u.name, value: u.name })) || [],
)
const headOptions = computed(() => [
  { label: __('— не назначен —'), value: '' },
  ...users.value,
])

// плоские списки для пикеров
function walk(node, depth, out) {
  if (!node) return
  for (const c of node.children || []) {
    out.push({ name: c.name, label: '— '.repeat(depth) + c.label, depth })
    walk(c, depth + 1, out)
  }
}
const deptFlat = computed(() => {
  const out = []
  walk(chart.value, 0, out)
  return out
})
const parentOptions = computed(() => [
  { label: __('— верхний уровень —'), value: '' },
  ...deptFlat.value.map((d) => ({ label: d.label, value: d.name })),
])
const deptOptions = computed(() => [
  { label: __('— без отдела —'), value: '' },
  ...deptFlat.value.map((d) => ({ label: d.label, value: d.name })),
])
const employeeOptions = computed(() =>
  (chart.value?.unassigned || []).map((e) => ({
    label: e.employee_name + (e.designation ? ' · ' + e.designation : ''),
    value: e.name,
  })),
)

// ── управление (provide в OrgNode) ───────────────────────────────────────────
const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = reactive({ name: '', parent: '', head: '' })
function openCreate(parent) {
  createError.value = ''
  createForm.name = ''
  createForm.parent = parent || ''
  createForm.head = ''
  showCreate.value = true
}
async function doCreate() {
  createError.value = ''
  if (!createForm.name.trim()) {
    createError.value = __('Укажите название отдела')
    return
  }
  creating.value = true
  try {
    await call('nacifrah.hr.create_department', {
      department_name: createForm.name.trim(),
      parent_department: createForm.parent || null,
      head: createForm.head || null,
    })
    showCreate.value = false
    await load()
    toast.success(__('Отдел создан'))
  } catch (e) {
    createError.value = e?.messages?.[0] || __('Не удалось создать отдел')
  } finally {
    creating.value = false
  }
}

// пользовательский пикер (head | ceo)
const showUser = ref(false)
const userMode = ref('head') // 'head' | 'ceo'
const userTargetDept = ref('')
const userPick = ref('')
const userDlgTitle = computed(() =>
  userMode.value === 'ceo' ? __('Назначить CEO') : __('Назначить руководителя'),
)
function openSetHead(deptName) {
  userMode.value = 'head'
  userTargetDept.value = deptName
  userPick.value = ''
  showUser.value = true
}
function openSetCEO() {
  userMode.value = 'ceo'
  userPick.value = chart.value?.head?.user || ''
  showUser.value = true
}
async function doUser() {
  try {
    if (userMode.value === 'ceo') {
      await call('nacifrah.hr.set_company_ceo', { user: userPick.value || null })
    } else {
      await call('nacifrah.hr.set_department_head', {
        department: userTargetDept.value,
        head: userPick.value || null,
      })
    }
    showUser.value = false
    await load()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось сохранить'))
  }
}

// сотрудник: assign (в отдел) | move (между отделами)
const showEmp = ref(false)
const empMode = ref('assign') // 'assign' | 'move'
const empTargetDept = ref('')
const empTarget = ref(null)
const empPick = ref('')
const deptPick = ref('')
const empDlgTitle = computed(() =>
  empMode.value === 'assign' ? __('Назначить сотрудника') : __('Перенести сотрудника'),
)
function openAssign(deptName) {
  empMode.value = 'assign'
  empTargetDept.value = deptName
  empPick.value = ''
  showEmp.value = true
}
function openMove(emp) {
  empMode.value = 'move'
  empTarget.value = emp
  deptPick.value = ''
  showEmp.value = true
}
async function doEmp() {
  try {
    if (empMode.value === 'assign') {
      if (!empPick.value) return
      await call('nacifrah.hr.set_employee_department', {
        employee: empPick.value,
        department: empTargetDept.value,
      })
    } else {
      await call('nacifrah.hr.set_employee_department', {
        employee: empTarget.value.name,
        department: deptPick.value || null,
      })
    }
    showEmp.value = false
    await load()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось сохранить'))
  }
}
async function detachEmp(emp) {
  try {
    await call('nacifrah.hr.set_employee_department', {
      employee: emp.name,
      department: null,
    })
    await load()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось'))
  }
}

async function removeDept(node) {
  if (!window.confirm(__('Удалить отдел «{0}»?').replace('{0}', node.label))) return
  try {
    await call('nacifrah.hr.delete_department', { department: node.name })
    await load()
    toast.success(__('Отдел удалён'))
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось удалить'))
  }
}
async function clearAll() {
  if (
    !window.confirm(
      __('Удалить ВСЕ отделы? Сотрудники останутся, но без отдела.'),
    )
  )
    return
  try {
    const r = await call('nacifrah.hr.clear_departments')
    await load()
    toast.success(__('Удалено отделов: {0}').replace('{0}', r?.count ?? 0))
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось'))
  }
}

// фото (1:1)
const showPhoto = ref(false)
const photoTarget = ref(null)
function openPhoto(emp) {
  photoTarget.value = emp
  showPhoto.value = true
}
async function onCropped({ blob, name }) {
  if (!photoTarget.value) return
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
    await load()
    toast.success(__('Фото обновлено'))
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось загрузить фото'))
  }
}

function unassignedActions(e) {
  return [
    { label: __('Загрузить фото'), icon: 'camera', onClick: () => openPhoto(e) },
    { label: __('Назначить в отдел'), icon: 'user-plus', onClick: () => openMove(e) },
  ]
}

provide('orgApi', {
  isManager: isManager(),
  setCEO: openSetCEO,
  setHead: openSetHead,
  addChild: openCreate,
  assign: openAssign,
  move: openMove,
  detach: detachEmp,
  remove: removeDept,
  clearAll,
  photo: openPhoto,
})
</script>

<!-- соединительные линии оргструктуры (CSS-дерево, без внешних библиотек) -->
<style>
.nac-org ul {
  position: relative;
  display: flex;
  justify-content: center;
  padding-top: 22px;
}
.nac-org > ul {
  padding-top: 0;
}
.nac-org li {
  list-style: none;
  position: relative;
  padding: 22px 12px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.nac-org li::before,
.nac-org li::after {
  content: '';
  position: absolute;
  top: 0;
  right: 50%;
  width: 50%;
  height: 22px;
  border-top: 1.5px solid var(--surface-gray-4, #d1d5db);
}
.nac-org li::after {
  right: auto;
  left: 50%;
  border-left: 1.5px solid var(--surface-gray-4, #d1d5db);
}
.nac-org li:only-child::before,
.nac-org li:only-child::after {
  display: none;
}
.nac-org li:only-child {
  padding-top: 0;
}
.nac-org li:first-child::before,
.nac-org li:last-child::after {
  border: 0 none;
}
.nac-org li:last-child::before {
  border-right: 1.5px solid var(--surface-gray-4, #d1d5db);
  border-radius: 0 6px 0 0;
}
.nac-org li:first-child::after {
  border-radius: 6px 0 0 0;
}
.nac-org ul ul::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 0;
  height: 22px;
  border-left: 1.5px solid var(--surface-gray-4, #d1d5db);
}
</style>
