<!--
  P3: единый попап создания задачи с галочкой «Регулярная задача».
  - Обычная задача: создаётся CRM Task (привязан к проекту).
  - Регулярная (галочка ON): создаётся шаблон Nacifrah Recurring Task (тоже к проекту).
  Поля регулярной = обычной + поля регулярности (появляются по галочке).
  На SimpleModal (frappe-ui Dialog у заказчика рендерится невидимым). Проект ОБЯЗАТЕЛЕН.
-->
<template>
  <SimpleModal v-model="open" :title="__('Новая задача')" size="md">
    <div class="flex flex-col gap-3">
      <FormControl
        :label="__('Заголовок')"
        v-model="f.title"
        :placeholder="__('Что нужно сделать')"
      />
      <div class="grid grid-cols-2 gap-3">
        <FormControl
          type="select"
          :label="__('Приоритет')"
          :options="priorityOptions"
          v-model="f.priority"
        />
        <FormControl
          v-if="!f.recurring"
          type="date"
          :label="__('Срок')"
          v-model="f.due_date"
        />
        <FormControl
          v-else
          type="number"
          :label="__('Срок, дней')"
          v-model="f.due_in_days"
        />
      </div>
      <FormControl
        type="select"
        :label="__('Исполнитель')"
        :options="assigneeOptions"
        v-model="f.assignee"
      />
      <FormControl
        type="textarea"
        :label="__('Описание')"
        v-model="f.description"
        :rows="2"
      />

      <!-- P3: галочка «Регулярная задача» -->
      <label class="mt-1 flex items-center gap-2 text-sm text-ink-gray-8">
        <input type="checkbox" v-model="f.recurring" />
        {{ __('Регулярная задача') }}
      </label>

      <!-- поля регулярности (по галочке) -->
      <div v-if="f.recurring" class="flex flex-col gap-3 rounded-lg bg-surface-gray-1 p-3">
        <FormControl
          type="select"
          :label="__('Повторять')"
          :options="freqOptions"
          v-model="f.frequency"
        />
        <FormControl
          v-if="f.frequency === 'Weekly'"
          type="select"
          :label="__('День недели')"
          :options="weekdayOptions"
          v-model="f.weekday"
        />
        <!-- PB5: мультивыбор конкретных дней недели Пн…Вс -->
        <div v-if="f.frequency === 'Weekly Multi'" class="flex flex-col gap-1.5">
          <div class="text-xs text-ink-gray-5">{{ __('Дни недели') }}</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="d in weekdayChips"
              :key="d.value"
              type="button"
              class="rounded-md border px-2.5 py-1 text-sm transition"
              :class="
                f.weekdays.includes(d.value)
                  ? 'border-outline-gray-3 bg-surface-gray-3 text-ink-gray-9 font-medium'
                  : 'border-outline-gray-2 text-ink-gray-6 hover:bg-surface-gray-2'
              "
              @click="toggleWeekday(d.value)"
            >
              {{ d.label }}
            </button>
          </div>
        </div>
        <FormControl
          v-if="f.frequency === 'Monthly'"
          type="number"
          :label="__('Число месяца')"
          v-model="f.day_of_month"
        />
      </div>

      <p class="text-xs text-ink-gray-4">
        {{ __('Задача привязывается к выбранному проекту.') }}
      </p>
      <ErrorMessage v-if="err" :message="err" />
    </div>
    <div class="mt-4 flex justify-end gap-2">
      <Button :label="__('Отмена')" @click="open = false" />
      <Button
        variant="solid"
        :label="f.recurring ? __('Создать регулярную') : __('Создать')"
        :loading="saving"
        @click="submit"
      />
    </div>
  </SimpleModal>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { Button, FormControl, ErrorMessage, call, toast } from 'frappe-ui'
import { napi } from '@/utils/api'
import SimpleModal from '@/components/SimpleModal.vue'
import { PRIORITY_ORDER, PRIORITY_LABELS } from '@/utils/taskPriority'
import { defaultDueDate } from '@/utils/dateUtils'
import { usersStore } from '@/stores/users'

const { crmUsers } = usersStore()
const assigneeOptions = computed(() => [
  { value: '', label: '—' },
  ...(crmUsers.value || []).map((u) => ({ value: u.name, label: u.full_name || u.name })),
])

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  project: { type: String, default: '' }, // обязателен
  stage: { type: String, default: '' }, // этап (если создаём в колонке)
})
const emit = defineEmits(['update:modelValue', 'created'])

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const priorityOptions = PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))
const freqOptions = [
  { value: 'Daily', label: __('Ежедневно') },
  { value: 'Weekdays', label: __('Только будни (Пн–Пт)') },
  { value: 'Weekly', label: __('Еженедельно') },
  { value: 'Weekly Multi', label: __('По дням недели (выбрать)') },
  { value: 'Monthly', label: __('Ежемесячно') },
]
const weekdayOptions = [
  { value: 1, label: __('Понедельник') },
  { value: 2, label: __('Вторник') },
  { value: 3, label: __('Среда') },
  { value: 4, label: __('Четверг') },
  { value: 5, label: __('Пятница') },
]
// PB5: чипы для мультивыбора дней (Пн=1 … Вс=7)
const weekdayChips = [
  { value: 1, label: __('Пн') },
  { value: 2, label: __('Вт') },
  { value: 3, label: __('Ср') },
  { value: 4, label: __('Чт') },
  { value: 5, label: __('Пт') },
  { value: 6, label: __('Сб') },
  { value: 7, label: __('Вс') },
]
function toggleWeekday(d) {
  const i = f.weekdays.indexOf(d)
  if (i === -1) f.weekdays.push(d)
  else f.weekdays.splice(i, 1)
}

function blank() {
  return {
    title: '',
    priority: 'Medium',
    due_date: defaultDueDate(),
    assignee: '',
    description: '',
    recurring: false,
    frequency: 'Weekdays',
    weekday: 1,
    weekdays: [],
    day_of_month: 1,
    due_in_days: 0,
  }
}
const f = reactive(blank())
const err = ref('')
const saving = ref(false)

watch(open, (v) => {
  if (v) {
    Object.assign(f, blank())
    err.value = ''
  }
})

async function submit() {
  err.value = ''
  if (!f.title.trim()) {
    err.value = __('Введите заголовок')
    return
  }
  if (!props.project) {
    err.value = __('Не выбран проект')
    return
  }
  // PB5: для режима «По дням недели» нужен хотя бы один выбранный день
  if (f.recurring && f.frequency === 'Weekly Multi' && !f.weekdays.length) {
    err.value = __('Выберите хотя бы один день недели')
    return
  }
  saving.value = true
  try {
    if (f.recurring) {
      await call(napi('automation.create_recurring_task'), {
        task_title: f.title.trim(),
        frequency: f.frequency,
        project: props.project,
        priority: f.priority,
        assigned_to: f.assignee || undefined,
        weekday: f.weekday,
        weekdays: JSON.stringify(f.weekdays),
        day_of_month: f.day_of_month,
        due_in_days: f.due_in_days,
      })
      toast.success(__('Регулярная задача создана'))
    } else {
      await call('frappe.client.insert', {
        doc: {
          doctype: 'CRM Task',
          title: f.title.trim(),
          status: 'Backlog',
          priority: f.priority,
          due_date: f.due_date || null,
          assigned_to: f.assignee || undefined,
          nacifrah_stage: props.stage || undefined,
          reference_doctype: 'CRM Deal',
          reference_docname: props.project,
          nacifrah_project: props.project,
          description: f.description || undefined,
        },
      })
      toast.success(__('Задача создана'))
    }
    open.value = false
    emit('created')
  } catch (e) {
    err.value = e?.messages?.[0] || __('Не удалось создать')
  } finally {
    saving.value = false
  }
}
</script>
