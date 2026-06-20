<template>
  <Dialog v-model="show" :options="{ size: '2xl' }">
    <template #body>
      <div class="bg-surface-modal px-4 pb-6 pt-5 sm:px-6">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-xl font-semibold text-ink-gray-9">{{ __('История проекта') }}</h3>
          <Button variant="ghost" icon="x" @click="show = false" />
        </div>

        <div
          v-if="history.data && history.data.length"
          class="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1"
        >
          <div
            v-for="item in history.data"
            :key="item.type + '-' + item.key"
            class="flex gap-2.5 text-sm"
          >
            <Avatar
              :image="userImage(item.owner)"
              :label="item.by"
              size="md"
              class="mt-0.5 shrink-0"
            />
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium text-ink-gray-8">{{ item.by }}</span>
                <span class="text-xs text-ink-gray-5">{{ timeAgo(item.creation) }}</span>
                <span
                  v-if="item.task_title"
                  class="truncate rounded bg-surface-gray-2 px-1.5 py-0.5 text-xs text-ink-gray-6"
                  >{{ item.task_title }}</span
                >
              </div>
              <div
                v-if="item.type === 'comment'"
                class="prose-sm max-w-none text-ink-gray-7"
                v-html="item.content"
              />
              <div v-else class="text-ink-gray-6">
                <span v-for="(c, i) in item.changes" :key="i" class="block">
                  {{ c.field }}:
                  <span class="text-ink-gray-5">{{ c.old || '—' }}</span>
                  →
                  <span class="text-ink-gray-8">{{ c.new || '—' }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-else-if="history.data" class="py-8 text-center text-sm text-ink-gray-5">
          {{ __('Пока нет активности по проекту') }}
        </div>
        <div v-else class="py-8 text-center text-sm text-ink-gray-5">{{ __('Загрузка…') }}</div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { Dialog, Avatar, Button, createResource } from 'frappe-ui'
import { napi } from '@/utils/api'
import { timeAgo } from '@/utils'
import { usersStore } from '@/stores/users'
import { watch } from 'vue'

const props = defineProps({
  project: { type: String, default: '' },
})
const show = defineModel({ type: Boolean })

const { getUser } = usersStore()

const history = createResource({
  url: napi('tasks_api.get_project_history'),
  makeParams: () => ({ project: props.project }),
})

watch(show, (v) => {
  if (v && props.project) history.reload()
})

function userImage(owner) {
  return getUser(owner)?.user_image
}
</script>
