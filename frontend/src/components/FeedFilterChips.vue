<!--
  PB7/PB8/PB10 — переиспользуемые чипы фильтров ленты «только вложения» / «только ссылки».
  ЕДИНЫЙ UI для чата задачи, карточки проекта и «Активности/Комментариев».
  Состояние держит родитель через useFeedFilters() и пробрасывает v-model:filesOnly /
  v-model:linksOnly. Внешний вид взят из образца «Только файлы» в ProjectCard.vue.
-->
<template>
  <div class="flex items-center gap-1.5">
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition"
      :class="
        filesOnly
          ? 'bg-surface-gray-3 text-ink-gray-8'
          : 'text-ink-gray-5 hover:text-ink-gray-7'
      "
      @click="onFiles"
    >
      <FeatherIcon name="paperclip" class="h-3.5 w-3.5" />
      {{ __('Только вложения') }}
      <span v-if="filesCount" class="text-ink-gray-4">{{ filesCount }}</span>
    </button>
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition"
      :class="
        linksOnly
          ? 'bg-surface-gray-3 text-ink-gray-8'
          : 'text-ink-gray-5 hover:text-ink-gray-7'
      "
      @click="onLinks"
    >
      <FeatherIcon name="link" class="h-3.5 w-3.5" />
      {{ __('Только ссылки') }}
      <span v-if="linksCount" class="text-ink-gray-4">{{ linksCount }}</span>
    </button>
  </div>
</template>

<script setup>
import { FeatherIcon } from 'frappe-ui'

const props = defineProps({
  filesCount: { type: Number, default: 0 },
  linksCount: { type: Number, default: 0 },
})

const filesOnly = defineModel('filesOnly', { type: Boolean, default: false })
const linksOnly = defineModel('linksOnly', { type: Boolean, default: false })

// взаимоисключающие режимы — как в useFeedFilters()
function onFiles() {
  filesOnly.value = !filesOnly.value
  if (filesOnly.value) linksOnly.value = false
}
function onLinks() {
  linksOnly.value = !linksOnly.value
  if (linksOnly.value) filesOnly.value = false
}
</script>
