<!--
  Простой модал БЕЗ frappe-ui Dialog/Reka-портала. У заказчика frappe-ui <Dialog>
  рендерился невидимым (backdrop есть, контент скрыт — M5). Этот модал: fixed inset-0,
  явный z-[9999], сплошной фон — гарантированно виден в любом контексте. Reka не задействован.
-->
<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-12"
    @click.self="$emit('update:modelValue', false)"
  >
    <div class="w-full rounded-xl bg-surface-white p-5 shadow-2xl" :class="sizeClass">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-ink-gray-9">{{ title }}</h3>
        <button
          class="text-ink-gray-5 hover:text-ink-gray-8"
          @click="$emit('update:modelValue', false)"
        >
          <FeatherIcon name="x" class="h-4 w-4" />
        </button>
      </div>
      <slot />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { FeatherIcon } from 'frappe-ui'
const props = defineProps({
  modelValue: Boolean,
  title: { type: String, default: '' },
  size: { type: String, default: 'sm' }, // sm | md | lg | xl | 2xl
})
defineEmits(['update:modelValue'])
const sizeClass = computed(
  () =>
    ({ sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl' }[
      props.size
    ] || 'max-w-sm'),
)
</script>
