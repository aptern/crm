<template>
  <DoctypeModal
    v-if="doctypeModal.show.value"
    v-model="doctypeModal.show.value"
    :doctypeTitle="doctypeModal.title.value"
    :doctype="doctypeModal.doctype.value"
    :docname="doctypeModal.name.value"
    :defaults="doctypeModal.defaults.value"
    :popup="doctypeModal.popup.value"
    @afterInsert="(d) => doctypeModal.triggerCallback('afterInsert', d)"
    @afterUpdate="(d) => doctypeModal.triggerCallback('afterUpdate', d)"
    @openTask="openTask"
  />
</template>
<script setup>
import DoctypeModal from '@/components/Modals/DoctypeModal.vue'
import { useDoctypeModal } from '@/composables/doctypeModal'

const doctypeModal = useDoctypeModal()

// P-E1/P-E2: переход по клику в подзадачу/связанную задачу — переоткрываем модалку
// задачи с её именем, сохраняя коллбэки (обновление доски и т.п.).
function openTask(name) {
  if (!name) return
  doctypeModal.showModal({
    name,
    doctype: 'CRM Task',
    title: 'Task',
    callbacks: doctypeModal.callbacks?.value || {},
  })
}
</script>
