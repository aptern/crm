<template>
  <div class="grid place-items-center">
    <div
      class="h-3 w-3 rounded-full"
      :class="[
        {
          'bg-red-600': priority === 'Urgent',
          'bg-red-400': priority === 'High',
          'bg-green-500': priority === 'Medium',
          'bg-surface-gray-4': priority === 'Low',
        },
        $attrs.class,
      ]"
    />
  </div>
</template>
<script setup>
defineOptions({
  inheritAttrs: false,
})

defineProps({
  priority: { type: String, required: true },
})
</script>
