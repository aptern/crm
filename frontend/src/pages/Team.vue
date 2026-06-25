<!--
  Команда (K3) — единый модуль вместо отдельных «Отделы»/«Сотрудники»/«Права».
  Вкладки: Оргструктура | Должности | Сотрудники | Права доступа. Один источник данных
  (Employee/Designation/Department) для всех вкладок.
-->
<template>
  <LayoutHeader>
    <template #left-header>
      <!-- MOBILE (П-MOBILE): заголовок «Команда» скрыт на телефоне (дублирует меню),
           ряд вкладок горизонтально прокручивается, кнопки не сжимаются — иначе
           вкладки уезжали за край экрана. -->
      <div class="flex min-w-0 items-center gap-3">
        <div class="hidden shrink-0 text-lg font-semibold text-ink-gray-8 sm:block">
          {{ __('Команда') }}
        </div>
        <div
          class="flex min-w-0 overflow-x-auto rounded-lg bg-surface-gray-2 p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            v-for="t in tabs"
            :key="t.key"
            class="shrink-0 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition"
            :class="
              tab === t.key
                ? 'bg-surface-white text-ink-gray-8 shadow-sm'
                : 'text-ink-gray-5 hover:text-ink-gray-7'
            "
            @click="setTab(t.key)"
          >
            {{ t.label }}
          </button>
        </div>
      </div>
    </template>
    <template #right-header>
      <Button
        v-if="isManager() && currentAction"
        variant="solid"
        :label="currentAction.label"
        iconLeft="plus"
        @click="currentAction.run()"
      />
    </template>
  </LayoutHeader>

  <Departments v-if="tab === 'org'" ref="orgRef" embedded />
  <DesignationsTab v-else-if="tab === 'desig'" ref="desigRef" />
  <Employees v-else-if="tab === 'emp'" ref="empRef" embedded />
  <Permissions v-else-if="tab === 'perms'" embedded />
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import { napi } from '@/utils/api'
import Departments from '@/pages/Departments.vue'
import Employees from '@/pages/Employees.vue'
import Permissions from '@/pages/Permissions.vue'
import DesignationsTab from '@/components/Team/DesignationsTab.vue'
import { Button, createResource } from 'frappe-ui'
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usersStore } from '@/stores/users'

const { isManager } = usersStore()
const route = useRoute()
const router = useRouter()

// K3.1: вкладка «Права доступа» видна только тем, кому разрешено политикой
const canManagePerms = ref(false)
createResource({
  url: napi('hr.can_manage_perms'),
  auto: true,
  onSuccess(v) {
    canManagePerms.value = !!v
    if (!v && tab.value === 'perms') setTab('org')
  },
})

const ALL_TABS = [
  { key: 'org', label: __('Оргструктура') },
  { key: 'desig', label: __('Должности') },
  { key: 'emp', label: __('Сотрудники') },
  { key: 'perms', label: __('Права доступа'), guard: 'perms' },
]
const tabs = computed(() =>
  ALL_TABS.filter((t) => t.guard !== 'perms' || canManagePerms.value),
)
const validTabs = ALL_TABS.map((t) => t.key)

const tab = ref(validTabs.includes(route.params.tab) ? route.params.tab : 'org')
function setTab(k) {
  tab.value = k
  router.replace({ name: 'Team', params: { tab: k } })
}
watch(
  () => route.params.tab,
  (v) => {
    if (v && validTabs.includes(v)) tab.value = v
  },
)

const orgRef = ref(null)
const desigRef = ref(null)
const empRef = ref(null)
const currentAction = computed(() => {
  if (tab.value === 'org')
    return { label: __('Добавить отдел'), run: () => orgRef.value?.openCreate?.(null) }
  if (tab.value === 'desig')
    return { label: __('Добавить должность'), run: () => desigRef.value?.openCreate?.() }
  if (tab.value === 'emp')
    return { label: __('Нанять'), run: () => empRef.value?.openHire?.() }
  return null
})
</script>
