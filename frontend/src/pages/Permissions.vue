<template>
  <LayoutHeader v-if="!embedded">
    <template #left-header>
      <div class="text-lg font-semibold text-ink-gray-8">{{ __('Права доступа') }}</div>
    </template>
  </LayoutHeader>

  <div class="flex-1 overflow-auto px-4 py-3">
    <p class="mb-4 max-w-3xl text-sm text-ink-gray-5">
      {{
        __(
          'Доступ задаётся по оргструктуре: руководители и сотрудники отделов. Администратор — полный доступ. Отметьте, что каждая группа может делать в модуле.',
        )
      }}
    </p>

    <table v-if="data" class="w-full text-sm">
      <thead>
        <tr class="border-b border-outline-gray-1 text-left text-ink-gray-5">
          <th class="px-3 py-2 font-medium">{{ __('Группа (оргструктура)') }}</th>
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
        <template v-for="s in data.subjects" :key="s.value">
          <tr
            v-for="(m, i) in data.modules"
            :key="s.value + '-' + m.key"
            class="border-b border-outline-gray-1 hover:bg-surface-gray-1"
            :class="i === 0 ? 'border-t-2 border-t-outline-gray-2' : ''"
          >
            <td class="px-3 py-2 align-top text-ink-gray-8">
              <div v-if="i === 0">
                <div class="flex items-center gap-2 font-medium">
                  {{ s.label }}
                  <span class="rounded bg-surface-gray-2 px-1.5 py-0.5 text-xs text-ink-gray-6">
                    {{ s.members }} {{ __('чел.') }}
                  </span>
                </div>
                <div class="mt-0.5 max-w-xs text-xs text-ink-gray-5">{{ s.desc }}</div>
              </div>
            </td>
            <td class="px-3 py-2 text-ink-gray-7">{{ m.label }}</td>
            <td v-for="t in data.types" :key="t" class="px-3 py-2 text-center">
              <input
                type="checkbox"
                class="cursor-pointer"
                :checked="!!data.matrix[s.value][m.key][t]"
                :disabled="s.fixed || !m.exists || saving"
                :title="s.fixed ? __('У администратора всегда полный доступ') : ''"
                @change="toggle(s.value, m.key, t, $event.target.checked)"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <div v-else class="p-6 text-sm text-ink-gray-5">{{ __('Загрузка…') }}</div>

    <!-- K3.1: кому доступна сама страница прав (настраивает только администратор) -->
    <div
      v-if="data && data.can_set_policy"
      class="mt-6 max-w-2xl rounded-lg border border-outline-gray-1 bg-surface-white p-4"
    >
      <div class="text-sm font-medium text-ink-gray-8">{{ __('Кому доступна эта страница прав') }}</div>
      <p class="mt-1 text-xs text-ink-gray-5">
        {{ __('По умолчанию права настраивает только администратор. Можно расширить доступ.') }}
      </p>
      <div class="mt-3 flex flex-col gap-2">
        <label
          v-for="p in policyOptions"
          :key="p.value"
          class="flex items-start gap-2 text-sm text-ink-gray-7"
        >
          <input
            type="radio"
            class="mt-0.5 cursor-pointer"
            :value="p.value"
            :checked="policy === p.value"
            @change="setPolicy(p.value)"
          />
          <span>
            {{ p.label }}
            <span v-if="p.hint" class="text-ink-gray-5">— {{ p.hint }}</span>
          </span>
        </label>
        <div v-if="policy === 'custom'" class="ml-6 mt-1">
          <textarea
            v-model="customEmails"
            rows="2"
            class="w-full rounded border border-outline-gray-2 px-2 py-1 text-sm"
            :placeholder="__('Логины (email) через запятую')"
            @blur="setPolicy('custom')"
          />
        </div>
      </div>
    </div>
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
const policy = ref('admin')
const customEmails = ref('')

const policyOptions = [
  { value: 'admin', label: __('Только администратор'), hint: __('по умолчанию') },
  { value: 'heads', label: __('Администратор и руководители') },
  { value: 'custom', label: __('Выбранные сотрудники') },
]

const matrixResource = createResource({
  url: 'nacifrah.hr.get_permission_matrix',
  auto: true,
  onSuccess(d) {
    data.value = d
    if (d.can_set_policy) policyResource.fetch()
  },
})

const policyResource = createResource({
  url: 'nacifrah.hr.get_perms_policy',
  auto: false,
  onSuccess(p) {
    policy.value = p.policy || 'admin'
    customEmails.value = (p.users || []).join(', ')
  },
})

const TYPE_LABELS = {
  read: 'Чтение',
  write: 'Запись',
  create: 'Создание',
  delete: 'Удаление',
}
function typeLabel(t) {
  return TYPE_LABELS[t] || t
}

async function setPolicy(value) {
  const prev = policy.value
  policy.value = value
  const users =
    value === 'custom'
      ? customEmails.value.split(',').map((s) => s.trim()).filter(Boolean)
      : []
  try {
    await call('nacifrah.hr.set_perms_policy', { policy: value, users })
    toast.success(__('Сохранено'))
  } catch (e) {
    policy.value = prev
    toast.error(e?.messages?.[0] || __('Не удалось сохранить'))
  }
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
