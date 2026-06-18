<template>
  <div :class="embedded ? '' : 'mt-6 border-t border-outline-gray-1 pt-4'">
    <div class="mb-3 text-base font-semibold text-ink-gray-8">
      {{ __('Активность работы') }}
    </div>

    <div
      v-if="activity.data && activity.data.length"
      class="flex flex-col gap-3 pr-1"
      :class="embedded ? '' : 'max-h-72 overflow-y-auto'"
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
      <!-- B16: чат задачи — расширенный ввод с @упоминанием участников -->
      <div
        class="rounded-md border border-outline-gray-2 bg-surface-gray-1 px-2 py-1.5"
      >
        <TextEditor
          ref="commentEditor"
          :content="newComment"
          :editor-class="['prose-sm max-w-none min-h-[2.5rem] text-sm text-ink-gray-8']"
          :placeholder="__('Написать комментарий… (@ — упомянуть участника)')"
          :mentions="users"
          @change="newComment = $event"
        />
      </div>
      <div class="flex justify-end">
        <Button
          variant="solid"
          :label="__('Отправить')"
          :loading="sending"
          :disabled="!hasContent"
          @click="send"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Avatar, Button, TextEditor, createResource, call, toast } from 'frappe-ui'
import { timeAgo } from '@/utils'
import { usersStore } from '@/stores/users'

const props = defineProps({
  task: { type: String, required: true },
  embedded: { type: Boolean, default: false },
})

const { getUser, users: usersList } = usersStore()
const newComment = ref('')
const sending = ref(false)
const commentEditor = ref(null)

// B16: список участников для @упоминания (как в комментариях сделок/лидов)
const users = computed(
  () =>
    usersList.data?.crmUsers
      ?.filter((u) => u.enabled)
      .map((u) => ({ label: u.full_name?.trimEnd() || u.name, value: u.name })) ||
    [],
)

// контент TextEditor — HTML; пустой <p></p> за текст не считаем
const hasContent = computed(() => {
  const t = (newComment.value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, '')
    .trim()
  return !!t
})

const activity = createResource({
  url: 'nacifrah.tasks_api.get_task_activity',
  params: { task: props.task },
  auto: true,
})

function userImage(owner) {
  return getUser(owner)?.user_image
}

async function send() {
  if (!hasContent.value) return
  sending.value = true
  try {
    await call('crm.api.comment.add_comment', {
      reference_doctype: 'CRM Task',
      reference_name: props.task,
      content: newComment.value,
    })
    newComment.value = ''
    commentEditor.value?.editor?.commands?.clearContent(true)
    activity.reload()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось отправить комментарий'))
  } finally {
    sending.value = false
  }
}
</script>
