<template>
  <!-- I10: сделка/лид выезжают справа панелью поверх списка (как «Сотрудники»),
       внутри рендерится полная карточка (вкладки/активности), без ухода со списка.
       Топбар всегда содержит «Закрыть» и «Открыть на странице» — пользователь
       никогда не застрянет, даже если содержимое не отрисуется. -->
  <Teleport to="body">
    <Transition name="rso-overlay">
      <div v-if="show" class="fixed inset-0 z-40">
        <div class="absolute inset-0 bg-black/30" @click="close" />
        <Transition name="rso-panel">
          <div
            v-if="show"
            class="absolute right-0 top-0 flex h-full flex-col overflow-hidden bg-surface-white shadow-2xl transition-[width] duration-200"
            :style="{
              width: isMobileView
                ? '100%'
                : fullscreen
                  ? 'calc(100% - 15rem)'
                  : '50%',
            }"
          >
            <div
              class="flex shrink-0 items-center justify-between border-b border-outline-gray-1 px-3 py-2"
            >
              <div class="flex min-w-0 items-center gap-2">
                <Button
                  variant="ghost"
                  icon="x"
                  :tooltip="__('Закрыть')"
                  @click="close"
                />
                <span class="truncate text-sm text-ink-gray-5">{{ name }}</span>
              </div>
              <div class="flex items-center gap-1">
                <Button
                  v-if="!isMobileView"
                  variant="ghost"
                  :icon="fullscreen ? 'minimize-2' : 'maximize-2'"
                  :tooltip="fullscreen ? __('Свернуть') : __('На весь экран')"
                  @click="fullscreen = !fullscreen"
                />
                <Button
                  variant="ghost"
                  icon="external-link"
                  :tooltip="__('Открыть на странице')"
                  @click="openFull"
                />
              </div>
            </div>
            <div class="min-h-0 flex-1 overflow-hidden">
              <div
                v-if="renderError"
                class="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
              >
                <p class="text-ink-gray-6">
                  {{ __('Не удалось показать карточку здесь.') }}
                </p>
                <Button
                  variant="solid"
                  :label="__('Открыть на странице')"
                  @click="openFull"
                />
              </div>
              <component
                :is="comp"
                v-else-if="name"
                :key="doctype + ':' + name"
                v-bind="compProps"
                :embedded="true"
              />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, watch, onErrorCaptured } from 'vue'
import { Button } from 'frappe-ui'
import { useRoute, useRouter } from 'vue-router'
import { isMobileView } from '@/composables/settings'
import { recordSlideOverStore } from '@/stores/recordSlideOver'

const Deal = defineAsyncComponent(() => import('@/pages/Deal.vue'))
const Lead = defineAsyncComponent(() => import('@/pages/Lead.vue'))

const { show, doctype, name, close } = recordSlideOverStore()
const route = useRoute()
const router = useRouter()

const comp = computed(() => (doctype.value === 'CRM Deal' ? Deal : Lead))
const compProps = computed(() =>
  doctype.value === 'CRM Deal'
    ? { dealId: name.value }
    : { leadId: name.value },
)

// Защитный барьер: если встроенная карточка падает при рендере — показываем
// fallback с кнопкой «Открыть на странице», оверлей не ломает приложение.
const renderError = ref(false)
// I29(c): по умолчанию 50%, тоггл «на весь экран» (до левого меню). Сброс при закрытии.
const fullscreen = ref(false)
onErrorCaptured(() => {
  renderError.value = true
  return false
})
watch(show, (v) => {
  if (v) renderError.value = false
  else fullscreen.value = false
})

// Закрываем оверлей только при смене ПУТИ (уход в другой раздел),
// игнорируя смену hash — встроенная карточка двигает hash при переключении вкладок.
watch(
  () => route.path,
  () => {
    if (show.value) close()
  },
)

function openFull() {
  const n = name.value
  const dt = doctype.value
  close()
  if (!n) return
  if (dt === 'CRM Deal') {
    router.push({ name: 'Deal', params: { dealId: n }, query: { full: '1' } })
  } else {
    router.push({ name: 'Lead', params: { leadId: n }, query: { full: '1' } })
  }
}
</script>

<style scoped>
.rso-overlay-enter-active,
.rso-overlay-leave-active {
  transition: opacity 0.2s ease;
}
.rso-overlay-enter-from,
.rso-overlay-leave-to {
  opacity: 0;
}
.rso-panel-enter-active,
.rso-panel-leave-active {
  transition: transform 0.25s ease;
}
.rso-panel-enter-from,
.rso-panel-leave-to {
  transform: translateX(100%);
}
</style>
