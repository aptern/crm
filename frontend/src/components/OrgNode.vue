<!--
  OrgNode — узел оргструктуры (компания или отдел) + рекурсивные дети (I36).
  Рисует карточку с руководителем (фото+имя), сотрудниками (фото+должность) и —
  для менеджера — действиями. Соединительные линии задаёт CSS-обёртка .nac-org
  в Departments.vue. Сам себя вызывает рекурсивно для подотделов.
-->
<template>
  <li>
    <div
      class="inline-flex min-w-[200px] max-w-[260px] flex-col gap-2 rounded-xl border bg-surface-white px-3 py-2.5 text-left shadow-sm"
      :class="
        isCompany
          ? 'border-ink-gray-8'
          : 'border-outline-gray-2'
      "
    >
      <!-- заголовок узла -->
      <div class="flex items-center gap-2">
        <div
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          :class="isCompany ? 'bg-surface-gray-7 text-ink-white' : 'bg-surface-gray-3 text-ink-gray-6'"
        >
          <FeatherIcon :name="isCompany ? 'home' : 'users'" class="h-3.5 w-3.5" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold text-ink-gray-8" :title="node.label">
            {{ node.label }}
          </div>
          <div class="text-[11px] text-ink-gray-4">
            {{ isCompany ? __('Компания') : __('Отдел') }}
          </div>
        </div>
        <Dropdown v-if="api.isManager && actionItems.length" :options="actionItems">
          <Button variant="ghost" size="sm" icon="more-vertical" @click.stop />
        </Dropdown>
      </div>

      <!-- руководитель / CEO -->
      <div
        class="flex items-center gap-2 rounded-lg px-1.5 py-1"
        :class="head ? 'bg-surface-gray-1' : ''"
      >
        <Avatar
          v-if="head"
          :image="head.image"
          :label="head.full_name"
          size="sm"
        />
        <div
          v-else
          class="flex h-6 w-6 items-center justify-center rounded-full bg-surface-gray-3 text-ink-gray-4"
        >
          <FeatherIcon name="user" class="h-3 w-3" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-xs font-medium text-ink-gray-7">
            {{ head ? head.full_name : __('Руководитель не назначен') }}
          </div>
          <div class="text-[10px] uppercase tracking-wide text-ink-gray-4">
            {{ isCompany ? 'CEO' : __('руководитель') }}
          </div>
        </div>
      </div>

      <!-- сотрудники отдела -->
      <div v-if="node.employees?.length" class="flex flex-col gap-1">
        <div
          v-for="e in node.employees"
          :key="e.name"
          class="group/emp flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-surface-gray-2"
        >
          <Avatar :image="e.image" :label="e.employee_name" size="sm" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-xs text-ink-gray-8">{{ e.employee_name }}</div>
            <div class="truncate text-[10px] text-ink-gray-4">{{ e.designation }}</div>
          </div>
          <Dropdown
            v-if="api.isManager"
            :options="employeeActions(e)"
          >
            <Button
              variant="ghost"
              size="sm"
              icon="more-horizontal"
              class="opacity-0 group-hover/emp:opacity-100"
              @click.stop
            />
          </Dropdown>
        </div>
      </div>
    </div>

    <!-- подотделы -->
    <ul v-if="node.children?.length">
      <OrgNode v-for="c in node.children" :key="c.name" :node="c" />
    </ul>
  </li>
</template>

<script setup>
import { Avatar, Button, Dropdown, FeatherIcon } from 'frappe-ui'
import { computed, inject } from 'vue'

const props = defineProps({
  node: { type: Object, required: true },
})

const api = inject('orgApi')
const isCompany = computed(() => props.node.type === 'company')
const head = computed(() => props.node.head)

const actionItems = computed(() => {
  if (isCompany.value) {
    return [
      { label: __('Назначить CEO'), icon: 'user-check', onClick: () => api.setCEO() },
      { label: __('Добавить отдел'), icon: 'plus', onClick: () => api.addChild(null) },
      {
        label: __('Удалить все отделы'),
        icon: 'trash-2',
        onClick: () => api.clearAll(),
      },
    ]
  }
  return [
    {
      label: __('Переименовать'),
      icon: 'pencil',
      onClick: () => api.rename(props.node),
    },
    {
      label: __('Добавить подотдел'),
      icon: 'plus',
      onClick: () => api.addChild(props.node.name),
    },
    {
      label: __('Назначить руководителя'),
      icon: 'user-check',
      onClick: () => api.setHead(props.node.name),
    },
    {
      label: __('Назначить сотрудника'),
      icon: 'user-plus',
      onClick: () => api.assign(props.node.name),
    },
    { label: __('Удалить отдел'), icon: 'trash-2', onClick: () => api.remove(props.node) },
  ]
})

function employeeActions(e) {
  return [
    { label: __('Загрузить фото'), icon: 'camera', onClick: () => api.photo(e) },
    { label: __('Перенести в отдел'), icon: 'move', onClick: () => api.move(e) },
    {
      label: __('Убрать из отдела'),
      icon: 'user-minus',
      onClick: () => api.detach(e),
    },
  ]
}
</script>
