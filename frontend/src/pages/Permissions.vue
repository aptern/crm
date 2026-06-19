<template>
  <LayoutHeader v-if="!embedded">
    <template #left-header>
      <div class="text-lg font-semibold text-ink-gray-8">{{ __('Права доступа') }}</div>
    </template>
  </LayoutHeader>

  <div class="flex-1 overflow-auto px-4 py-3">
    <p class="mb-3 text-sm text-ink-gray-5">
      {{ __('Отметьте, что каждая роль может делать в модуле. Тонкая настройка («только свои» и пр.) — в системном Role Permission Manager.') }}
    </p>

    <table v-if="data" class="w-full text-sm">
      <thead>
        <tr class="border-b border-outline-gray-1 text-left text-ink-gray-5">
          <th class="px-3 py-2 font-medium">{{ __('Роль') }}</th>
          <th class="px-3 py-2 font-medium">{{ __('Модуль') }}</th>
          <th
            v-for="t in data.types"
            :key="t"
            class="px-3 py-2 text-center font-medium"
          >
            {{ typeLabel(t) }}
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="role in data.roles" :key="role">
          <tr
            v-for="(m, i) in data.modules"
            :key="role + '-' + m.key"
            class="border-b border-outline-gray-1 hover:bg-surface-gray-1"
          >
            <td class="px-3 py-2 text-ink-gray-8">{{ i === 0 ? roleLabel(role) : '' }}</td>
            <td class="px-3 py-2 text-ink-gray-7">{{ m.label }}</td>
            <td v-for="t in data.types" :key="t" class="px-3 py-2 text-center">
              <input
                type="checkbox"
                class="cursor-pointer"
                :checked="!!data.matrix[role][m.key][t]"
                :disabled="!m.exists || saving"
                @change="toggle(role, m.key, t, $event.target.checked)"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <div v-else class="p-6 text-sm text-ink-gray-5">{{ __('Загрузка…') }}</div>
  </div>
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import { createResource, call, toast } from 'frappe-ui'
import { ref } from 'vue'

// K3.1: встраивание во вкладку «Команда»
defineProps({ embedded: { type: Boolean, default: false } })

const data = ref(null)
const saving = ref(false)

const matrixResource = createResource({
  url: 'nacifrah.hr.get_permission_matrix',
  auto: true,
  onSuccess(d) {
    data.value = d
  },
})

const TYPE_LABELS = {
  read: 'Чтение',
  write: 'Запись',
  create: 'Создание',
  delete: 'Удаление',
}
const ROLE_LABELS = {
  'Agency Admin': 'Администратор',
  'Agency Head': 'Руководитель',
  Specialist: 'Сотрудник',
  Observer: 'Наблюдатель',
}
function typeLabel(t) {
  return TYPE_LABELS[t] || t
}
function roleLabel(r) {
  return ROLE_LABELS[r] || r
}

async function toggle(role, module, ptype, checked) {
  const prev = data.value.matrix[role][module][ptype]
  // оптимистично
  data.value.matrix[role][module][ptype] = checked ? 1 : 0
  if (checked && ['write', 'create', 'delete'].includes(ptype)) {
    data.value.matrix[role][module].read = 1
  }
  saving.value = true
  try {
    await call('nacifrah.hr.set_permission_cell', {
      role,
      module,
      ptype,
      value: checked ? 1 : 0,
    })
  } catch (e) {
    data.value.matrix[role][module][ptype] = prev // откат
    toast.error(e?.messages?.[0] || __('Не удалось изменить право'))
  } finally {
    saving.value = false
  }
}
</script>
