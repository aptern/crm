<template>
  <!-- I31: маска телефона +7 (XXX) XXX-XX-XX. Внутри показываем маску, наружу
       отдаём нормализованные цифры (поиск/интеграции работают как раньше). -->
  <TextInput
    type="text"
    inputmode="tel"
    :value="display"
    :placeholder="placeholder || '+7 (***) ***-**-**'"
    :disabled="disabled"
    @input="onInput"
  />
</template>

<script setup>
import { ref, watch } from 'vue'
import { TextInput } from 'frappe-ui'
import { formatPhoneInput, normalizePhoneToDigits } from '@/utils/ruFormat'

const props = defineProps({
  value: { type: [String, Number], default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['change', 'update:modelValue'])

const display = ref(formatPhoneInput(props.value))

watch(
  () => props.value,
  (v) => {
    // внешнее изменение (загрузка записи) → пересчёт маски, если цифры отличаются
    if (normalizePhoneToDigits(v) !== normalizePhoneToDigits(display.value)) {
      display.value = formatPhoneInput(v)
    }
  },
)

function onInput(e) {
  const raw = e && e.target ? e.target.value : e
  const formatted = formatPhoneInput(raw)
  display.value = formatted
  const digits = normalizePhoneToDigits(formatted)
  emit('change', digits)
  emit('update:modelValue', digits)
}
</script>
