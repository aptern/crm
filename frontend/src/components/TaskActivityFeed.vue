<template>
  <div class="mt-6 border-t border-outline-gray-1 pt-4">
    <div class="mb-3 text-base font-semibold text-ink-gray-8">
      {{ __('Активность работы') }}
    </div>

    <div
      v-if="activity.data && activity.data.length"
      class="flex max-h-72 flex-col gap-3 overflow-y-auto pr-1"
    >
      <div
        v-for="item in activity.data"
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
          <div class="flex items-center gap-2">
            <span class="font-medium text-ink-gray-8">{{ item.by }}</span>
            <span class="text-xs text-ink-gray-5">{{ timeAgo(item.creation) }}</span>
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
    <div v-else-if="activity.data" class="mb-2 text-sm text-ink-gray-5">
      {{ __('Пока нет активности по работе') }}
    </div>

    <div class="mt-3 flex flex-col gap-2">
      <textarea
        v-model="newComment"
        rows="2"
        :placeholder="__('Написать комментарий о работе…')"
        class="w-full resize-none rounded-md border border-outline-gray-2 bg-surface-gray-1 p-2 text-sm text-ink-gray-8 focus:outline-none focus:ring-1 focus:ring-outline-gray-3"
        @keydown.meta.enter="send"
        @keydown.ctrl.enter="send"
      />
      <div class="flex justify-end">
        <Button
          variant="solid"
          :label="__('Отправить')"
          :loading="sending"
          :disabled="!newComment.trim()"
          @click="send"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Avatar, Button, createResource, call, toast } from 'frappe-ui'
import { timeAgo } from '@/utils'
import { usersStore } from '@/stores/users'

const props = defineProps({
  task: { type: String, required: true },
})

const { getUser } = usersStore()
const newComment = ref('')
const sending = ref(false)

const activity = createResource({
  url: 'nacifrah.tasks_api.get_task_activity',
  params: { task: props.task },
  auto: true,
})

function userImage(owner) {
  return getUser(owner)?.user_image
}

async function send() {
  const content = newComment.value.trim()
  if (!content) return
  sending.value = true
  try {
    await call('crm.api.comment.add_comment', {
      reference_doctype: 'CRM Task',
      reference_name: props.task,
      content: content,
    })
    newComment.value = ''
    activity.reload()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось отправить комментарий'))
  } finally {
    sending.value = false
  }
}
</script>
