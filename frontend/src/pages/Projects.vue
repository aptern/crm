<template>
  <div class="flex h-full flex-col bg-surface-white">
    <header class="flex items-center justify-between border-b px-5 py-2.5">
      <div class="flex items-center gap-2">
        <FeatherIcon name="folder" class="h-4 w-4 text-ink-gray-7" />
        <span class="text-lg font-semibold text-ink-gray-9">Проекты</span>
      </div>
      <Button :loading="loading" label="Обновить" @click="load">
        <template #prefix><FeatherIcon name="refresh-cw" class="h-4 w-4" /></template>
      </Button>
    </header>

    <div class="flex-1 overflow-x-auto p-5">
      <div v-if="loading" class="text-sm text-ink-gray-5">Загрузка…</div>
      <div v-else-if="!columns.length" class="text-sm text-ink-gray-5">Проектов пока нет.</div>
      <div v-else class="flex h-full min-w-max items-start gap-4">
        <div v-for="col in columns" :key="col.stage" class="flex w-72 shrink-0 flex-col">
          <div class="mb-2 flex items-center justify-between px-1">
            <span class="text-sm font-medium text-ink-gray-8">{{ col.stage }}</span>
            <Badge :label="String(col.count)" variant="subtle" />
          </div>
          <div class="flex min-h-[120px] flex-col gap-2 rounded-lg bg-surface-gray-2 p-2">
            <button
              v-for="p in col.deals"
              :key="p.name"
              class="rounded-md border border-outline-gray-1 bg-surface-white p-3 text-left shadow-sm transition hover:border-outline-gray-3"
              @click="open(p)"
            >
              <div class="truncate text-sm font-medium text-ink-gray-9">{{ p.title }}</div>
              <div class="mt-1 text-xs text-ink-gray-5">{{ p.subtitle }}</div>
            </button>
            <div v-if="!col.deals.length" class="py-3 text-center text-xs text-ink-gray-4">пусто</div>
          </div>
        </div>
      </div>
    </div>

    <Dialog v-model="showDrawer" :options="{ title: current ? current.title : 'Проект', size: 'lg' }">
      <template #body-content>
        <div v-if="current" class="space-y-3">
          <div class="text-sm text-ink-gray-6">{{ current.status }} · {{ current.percent }}%</div>
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase text-ink-gray-5">Задачи</span>
            <Button variant="ghost" label="+ задача" @click="addTask" />
          </div>
          <div class="flex flex-col gap-2">
            <div
              v-for="t in current.tasks"
              :key="t.name"
              class="flex items-center justify-between rounded-md border border-outline-gray-1 p-2"
            >
              <span class="truncate text-sm text-ink-gray-8">{{ t.subject }}</span>
              <Badge :label="t.status" variant="subtle" />
            </div>
            <div v-if="!current.tasks.length" class="py-4 text-center text-sm text-ink-gray-4">Задач пока нет.</div>
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { call, Button, Badge, Dialog, FeatherIcon } from 'frappe-ui'

const loading = ref(true)
const columns = ref([])
const showDrawer = ref(false)
const current = ref(null)

async function load() {
  loading.value = true
  try {
    const data = await call('nacifrah.api.get_projects_board')
    columns.value = data.columns || []
  } finally {
    loading.value = false
  }
}

async function open(p) {
  current.value = await call('nacifrah.api.get_project', { name: p.name })
  showDrawer.value = true
}

async function addTask() {
  const subject = (window.prompt('Название задачи:') || '').trim()
  if (!subject) return
  await call('nacifrah.api.create_task', { project: current.value.name, subject })
  current.value = await call('nacifrah.api.get_project', { name: current.value.name })
}

onMounted(load)
</script>
