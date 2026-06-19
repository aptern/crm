<!-- Лиды — тонкая обёртка над единым шаблоном доски <SalesBoard> (I34 Stage B). -->
<template>
  <LayoutHeader>
    <template #left-header>
      <ViewBreadcrumbs v-model="viewControls" routeName="Leads" />
    </template>
    <template #right-header>
      <CustomActions
        v-if="board?.listView?.customListActions"
        :actions="board.listView.customListActions"
      />
      <Button
        variant="solid"
        :label="__('Create')"
        iconLeft="plus"
        @click="showLeadModal = true"
      />
    </template>
  </LayoutHeader>
  <SalesBoard
    ref="board"
    v-model="leads"
    v-model:viewControls="viewControls"
    doctype="CRM Lead"
    :filters="{ converted: 0 }"
    :boardFilters="{}"
    :kanbanFields="leadKanbanFields"
    :allowedViews="['list', 'group_by', 'kanban']"
    :getRoute="
      (row) => ({
        name: 'Lead',
        params: { leadId: row.name },
        query: { view: route.query.view, viewType: route.params.viewType },
      })
    "
    :onNewClick="onNewClick"
    :cardActions="actions"
    :listComponent="LeadsListView"
    emptyName="Leads"
    :emptyIcon="LeadsIcon"
  />
  <LeadModal
    v-if="showLeadModal"
    v-model="showLeadModal"
    :defaults="defaults"
    :openAfterCreate="false"
    @afterCreate="leads?.reload?.()"
  />
</template>

<script setup>
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import CustomActions from '@/components/CustomActions.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import LeadsListView from '@/components/ListViews/LeadsListView.vue'
import LeadModal from '@/components/Modals/LeadModal.vue'
import SalesBoard from '@/components/SalesBoard.vue'
import { useDoctypeModal } from '@/composables/doctypeModal'
import { globalStore } from '@/stores/global'
import { callEnabled } from '@/composables/telephony'
import { useBroadcast } from '@/composables/useBroadcast'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import { Button } from 'frappe-ui'
import { useRoute } from 'vue-router'
import { ref, reactive, h } from 'vue'

const { makeCall } = globalStore()
const { on } = useBroadcast()
const { updateOnboardingStep } = useOnboarding('frappecrm')
const { capture } = useTelemetry()
const { showModal } = useDoctypeModal()

const route = useRoute()

// I33: карточка лида унифицирована с карточкой сделки (поля по умолчанию)
const leadKanbanFields = JSON.stringify([
  'annual_revenue',
  'mobile_no',
  '_assign',
  'creation',
])

const board = ref(null)
const viewControls = ref(null)
const showLeadModal = ref(false)
const defaults = reactive({})

on('trigger_lead_create', (data) => {
  showLeadModal.value = Boolean(data)
})

// данные доски загружаются внутри SalesBoard (через ViewControls)
const leads = ref({})

function onNewClick(column) {
  let column_field = leads.value?.params?.column_field
  if (column_field) defaults[column_field] = column.column.name
  showLeadModal.value = true
}

function actions(itemName, getRow) {
  let mobile_no = getRow(itemName, 'mobile_no')?.label || ''
  let actions = [
    {
      icon: h(PhoneIcon, { class: 'h-4 w-4' }),
      label: __('Make a Call'),
      onClick: () => makeCall(mobile_no),
      condition: () => mobile_no && callEnabled.value,
    },
    {
      icon: h(NoteIcon, { class: 'h-4 w-4' }),
      label: __('New Note'),
      onClick: () => showNote(itemName),
    },
    {
      icon: h(TaskIcon, { class: 'h-4 w-4' }),
      label: __('New Task'),
      onClick: () => showTask(itemName),
    },
  ]
  return actions.filter((action) =>
    action.condition ? action.condition() : true,
  )
}

function showNote(name) {
  showModal({
    doctype: 'FCRM Note',
    title: 'Note',
    defaults: { reference_doctype: 'CRM Lead', reference_docname: name },
    callbacks: { afterInsert: (d) => after(d, true), afterUpdate: after },
  })
}

function showTask(name) {
  showModal({
    doctype: 'CRM Task',
    title: 'Task',
    defaults: { reference_doctype: 'CRM Lead', reference_docname: name },
    callbacks: { afterInsert: (d) => after(d, true), afterUpdate: after },
    popup: true, // I22: создание задачи — центральный попап
  })
}

function after(d, isNew = false) {
  let a = d.doctype == 'FCRM Note' ? 'note' : 'task'
  if (isNew) {
    updateOnboardingStep('create_first_' + a)
    capture(a + '_created')
  } else {
    capture(a + '_updated')
  }
}
</script>
