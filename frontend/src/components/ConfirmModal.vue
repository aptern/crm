<!--
  Переиспользуемое подтверждение на SimpleModal (frappe-ui Dialog рендерится невидимым,
  а window.confirm молча блокируется браузером — оба у заказчика «не показываются»).
  Управляется реактивным объектом-состоянием:
    const confirmState = ref({ show:false, message:'', onConfirm:null, danger:true, confirmLabel:'Удалить' })
    confirmState.value = { show:true, message:'…', danger:true, confirmLabel:'Удалить', onConfirm: async()=>{…} }
    <ConfirmModal :state="confirmState" />
-->
<template>
  <SimpleModal
    :modelValue="state.show"
    :title="state.title || __('Подтверждение')"
    @update:modelValue="state.show = $event"
  >
    <p class="text-base text-ink-gray-7">{{ state.message }}</p>
    <div class="mt-4 flex justify-end gap-2">
      <Button :label="__('Отмена')" @click="state.show = false" />
      <Button
        variant="solid"
        :theme="state.danger === false ? 'gray' : 'red'"
        :label="state.confirmLabel || __('Подтвердить')"
        :loading="busy"
        @click="run"
      />
    </div>
  </SimpleModal>
</template>

<script setup>
import { ref } from 'vue'
import { Button, toast } from 'frappe-ui'
import SimpleModal from '@/components/SimpleModal.vue'

const props = defineProps({ state: { type: Object, required: true } })
const busy = ref(false)
async function run() {
  busy.value = true
  try {
    await props.state.onConfirm?.()
    props.state.show = false
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось'))
  } finally {
    busy.value = false
  }
}
</script>
