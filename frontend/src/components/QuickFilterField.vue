<template>
  <FormControl
    v-if="filter.fieldtype == 'Check'"
    v-model="filter.value"
    :label="__(filter.label)"
    type="checkbox"
    @change.stop="updateFilter(filter, $event.target.checked)"
  />
  <FormControl
    v-else-if="filter.fieldtype === 'Select'"
    v-model="filter.value"
    class="form-control cursor-pointer [&_select]:cursor-pointer"
    type="select"
    :options="selectOptions"
    :placeholder="__(filter.label)"
    @update:modelValue="updateFilter(filter, $event)"
  />
  <Link
    v-else-if="filter.fieldtype === 'Link'"
    :value="filter.value"
    :doctype="filter.options"
    :placeholder="__(filter.label)"
    @change="(data) => updateFilter(filter, data)"
  />
  <component
    :is="filter.fieldtype === 'Date' ? DatePicker : DateTimePicker"
    v-else-if="['Date', 'Datetime'].includes(filter.fieldtype)"
    class="border-none"
    :value="filter.value"
    :placeholder="__(filter.label)"
    @change="(v) => updateFilter(filter, v)"
  />
  <FormControl
    v-else
    v-model="filter.value"
    type="text"
    :placeholder="__(filter.label)"
    @input.stop="debouncedFn(filter, $event.target.value)"
  />
</template>
<script setup>
import Link from '@/components/Controls/Link.vue'
import { FormControl, DatePicker, DateTimePicker } from 'frappe-ui'
import { useDebounceFn } from '@vueuse/core'
import { reactive, watch, computed } from 'vue'

const props = defineProps({
  filter: { type: Object, required: true },
})

const filter = reactive(props.filter)

// NACIFRAH (заказчик, п.15): пустой вариант select-фильтра показываем как «{Лейбл}: любой»
// вместо пустой строки (раньше «Приоритет» выглядел как незаполненный «Select option»).
const selectOptions = computed(() => {
  const lbl = __(filter.label || '')
  const blank = lbl ? `${lbl}: ${__('любой')}` : __('любой')
  return (filter.options || []).map((o) =>
    o && typeof o === 'object' && o.value === '' && !o.label ? { ...o, label: blank } : o,
  )
})

const emit = defineEmits(['applyQuickFilter'])

watch(
  () => props.filter,
  (newFilter) => Object.assign(filter, newFilter),
  { deep: true },
)

const debouncedFn = useDebounceFn((f, value) => {
  emit('applyQuickFilter', f, value)
}, 500)

function updateFilter(f, value) {
  emit('applyQuickFilter', f, value)
}
</script>
