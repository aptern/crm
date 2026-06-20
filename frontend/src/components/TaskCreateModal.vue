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
  { value: 'Monthly', label: __('Ежемесячно') },
]
const weekdayOptions = [
  { value: 1, label: __('Понедельник') },
  { value: 2, label: __('Вторник') },
  { value: 3, label: __('Среда') },
  { value: 4, label: __('Четверг') },
  { value: 5, label: __('Пятница') },
]

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
