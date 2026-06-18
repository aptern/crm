<template>
  <!-- A4/B11: крупные сущности (создание/деталь задачи и др.) выезжают справа панелью,
       50% ширины, на всю высоту, скролл внутри, тоггл «на весь экран» (до левого меню),
       клик по фону — закрыть. -->
  <Teleport to="body">
    <Transition name="so-overlay">
      <div v-if="show" class="fixed inset-0 z-40">
        <div class="absolute inset-0 bg-black/30" @click="show = false" />
        <Transition :name="asPopup ? 'so-pop' : 'so-panel'">
          <div
            v-if="show"
            :class="
              asPopup
                ? 'absolute left-1/2 top-1/2 flex max-h-[88vh] w-[min(640px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-surface-modal shadow-2xl'
                : 'absolute right-0 top-0 flex h-full flex-col bg-surface-modal shadow-2xl transition-[width] duration-200'
            "
            :style="
              asPopup
                ? {}
                : {
                    width: isMobileView
                      ? '100%'
                      : fullscreen
                        ? 'calc(100% - 15rem)'
                        : '50%',
                  }
            "
          >
            <div
              class="flex shrink-0 items-center justify-between border-b border-outline-gray-1 px-6 py-4"
            >
              <h3 class="text-xl font-semibold leading-6 text-ink-gray-9">
                {{
                  editMode
                    ? __('Edit ' + (doctypeTitle || doctype))
                    : __('Create ' + (doctypeTitle || doctype))
                }}
              </h3>
              <div class="flex items-center gap-1">
                <CustomActions
                  v-if="document.actions?.length"
                  :actions="document.actions"
                  :close="() => (show = false)"
                />
                <Button
                  v-if="isManager() && !isMobileView"
                  variant="ghost"
                  class="w-7"
                  :tooltip="__('Edit Fields Layout')"
                  :icon="EditIcon"
                  @click="openQuickEntryModal"
                />
                <Button
                  v-if="!isMobileView && !asPopup"
                  variant="ghost"
                  class="w-7"
                  :icon="fullscreen ? 'minimize-2' : 'maximize-2'"
                  :tooltip="fullscreen ? __('Свернуть') : __('На весь экран')"
                  @click="fullscreen = !fullscreen"
                />
                <Button variant="ghost" class="w-7" icon="x" @click="show = false" />
              </div>
            </div>
            <!-- B16: задача открывается в две части (детали слева | чат справа).
                 Остальные сущности — обычный вертикальный скролл. -->
            <div
              v-if="isTaskDetail && !isMobileView"
              class="flex flex-1 overflow-hidden"
            >
              <div
                class="flex-1 overflow-y-auto border-r border-outline-gray-1 px-6 py-5"
              >
                <FieldLayout
                  v-if="layout.data"
                  :tabs="layout.data"
                  :data="doc"
                  :doctype="doctype"
                />
                <ErrorMessage v-if="error" class="mt-4" :message="__(error)" />
              </div>
              <div
                class="w-2/5 min-w-80 shrink-0 overflow-y-auto bg-surface-gray-1 px-5 py-4"
              >
                <TaskActivityFeed :task="doc.name" :embedded="true" />
              </div>
            </div>
            <div v-else class="flex-1 overflow-y-auto px-6 py-5">
              <FieldLayout
                v-if="layout.data"
                :tabs="layout.data"
                :data="doc"
                :doctype="doctype"
              />
              <ErrorMessage v-if="error" class="mt-4" :message="__(error)" />
              <TaskActivityFeed v-if="isTaskDetail" :task="doc.name" />
            </div>
            <div class="shrink-0 border-t border-outline-gray-1 px-6 py-4">
              <div class="flex flex-row-reverse gap-2">
                <Button
                  variant="solid"
                  :label="editMode ? __('Update') : __('Create')"
                  :loading="editMode ? document.save.loading : create.loading"
                  @click="editMode ? update() : create()"
                />
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import EditIcon from '@/components/Icons/EditIcon.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import CustomActions from '@/components/CustomActions.vue'
import TaskActivityFeed from '@/components/TaskActivityFeed.vue'
import { useDocument } from '@/data/document'
import { globalStore } from '@/stores/global'
import { usersStore } from '@/stores/users'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import { isMobileView } from '@/composables/settings'
import { setupCustomizations } from '@/utils'
import { call, createResource, toast } from 'frappe-ui'
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  doctypeTitle: { type: String, default: '' },
  doctype: { type: String, default: '' },
  docname: { type: String, default: '' },
  defaults: { type: Object, default: () => ({}) },
  // I22: центральный попап (используется при создании задачи)
  popup: { type: Boolean, default: false },
})

const show = defineModel({ type: Boolean })

// B11: «на весь экран» (до левого меню) ↔ 50%. Сбрасываем при закрытии.
const fullscreen = ref(false)
watch(show, (v) => {
  if (!v) fullscreen.value = false
})

const emit = defineEmits(['afterInsert', 'afterUpdate'])

const router = useRouter()

const { isManager } = usersStore()
const { $dialog, $socket } = globalStore()

const { document, scripts, triggerOnRender, triggerOnBeforeCreate } =
  useDocument(props.doctype, props.docname || null)

const doc = computed(() => document.doc || {})

const layout = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['Quick Entry', props.doctype],
  params: { doctype: props.doctype, type: 'Quick Entry' },
  auto: true,
})

const error = ref(null)
const editMode = computed(() => Boolean(document.doc?.name))

// I22: попап показываем только в режиме создания; открытие/детали остаются slide-over.
const asPopup = computed(() => props.popup && !editMode.value)

// B16: открытая (сохранённая) задача показывает чат рядом с деталями
const isTaskDetail = computed(
  () => props.doctype === 'CRM Task' && editMode.value && Boolean(doc.value?.name),
)

const _create = createResource({
  url: 'frappe.client.insert',
  onSuccess: (d) => {
    document.doc = {}
    emit('afterInsert', d)
    show.value = false
  },
  onError: (err) => {
    if (err.exc_type == 'MandatoryError') {
      const fieldName = err.messages
        .map((msg) => {
          let arr = msg.split(': ')
          return arr[arr.length - 1].trim()
        })
        .join(', ')
      error.value = __('Mandatory field error: {0}', [fieldName])
      return
    }
    error.value = err.messages?.[0] || 'Could not create document'
  },
})

async function create() {
  await triggerOnBeforeCreate?.()

  _create.submit({
    doc: {
      doctype: props.doctype,
      ...document.doc,
    },
  })
}

function update() {
  document.save.submit(null, {
    onSuccess: (d) => {
      emit('afterUpdate', d)
      show.value = false
    },
    onError: (err) => {
      error.value = err.messages?.[0] || 'Could not update document'
    },
  })
}

function openQuickEntryModal() {
  showQuickEntryModal.value = true
  quickEntryProps.value = { doctype: props.doctype }
  nextTick(() => (show.value = false))
}

watch(
  () => document.doc,
  async (_doc) => {
    if (scripts.data?.length) {
      setupCustomizations(scripts.data, {
        doc: _doc,
        $dialog,
        $socket,
        router,
        toast,
        call,
      })
    }
  },
  { once: true },
)

onMounted(async () => {
  document.doc = {
    ...document.doc,
    ...props.defaults,
  }
  await triggerOnRender()
})
</script>

<style scoped>
.so-overlay-enter-active,
.so-overlay-leave-active {
  transition: opacity 0.2s ease;
}
.so-overlay-enter-from,
.so-overlay-leave-to {
  opacity: 0;
}
.so-panel-enter-active,
.so-panel-leave-active {
  transition: transform 0.25s ease;
}
.so-panel-enter-from,
.so-panel-leave-to {
  transform: translateX(100%);
}
/* I22: попап — плавное появление по центру (transform занят центровкой, анимируем opacity) */
.so-pop-enter-active,
.so-pop-leave-active {
  transition: opacity 0.18s ease;
}
.so-pop-enter-from,
.so-pop-leave-to {
  opacity: 0;
}
</style>
