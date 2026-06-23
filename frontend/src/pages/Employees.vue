<template>
  <LayoutHeader v-if="!embedded">
    <template #left-header>
      <div class="text-lg font-semibold text-ink-gray-8">{{ __('Сотрудники') }}</div>
    </template>
    <template #right-header>
      <Button
        v-if="canManage"
        variant="solid"
        :label="__('Нанять')"
        iconLeft="plus"
        @click="openHire"
      />
    </template>
  </LayoutHeader>

  <div class="flex-1 overflow-auto px-4 py-3">
    <!-- D6: фильтры по статусу / отделу -->
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <FormControl
        type="select"
        :options="statusFilterOptions"
        v-model="filterStatus"
        class="w-44"
      />
      <FormControl
        type="select"
        :options="departmentFilterOptions"
        v-model="filterDept"
        class="w-52"
      />
      <!-- K3: поиск по всем полям карточки сотрудника -->
      <FormControl
        type="text"
        :placeholder="__('Поиск: имя, должность, телефон, логин…')"
        v-model="searchQuery"
        class="w-72"
      />
      <span class="text-xs text-ink-gray-4">{{ (employeeList || []).length }} {{ __('чел.') }}</span>
    </div>

    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-outline-gray-1 text-left text-ink-gray-5">
          <th class="px-3 py-2 font-medium">{{ __('Сотрудник') }}</th>
          <th class="px-3 py-2 font-medium">{{ __('Должность') }}</th>
          <th class="px-3 py-2 font-medium">{{ __('Отдел') }}</th>
          <th class="px-3 py-2 font-medium">{{ __('Логин') }}</th>
          <!-- ДОСТУПЫ: пароль входа — ТОЛЬКО для администратора -->
          <th v-if="isAdmin()" class="px-3 py-2 font-medium">{{ __('Пароль') }}</th>
          <th class="px-3 py-2 font-medium">{{ __('Статус') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="e in employeeList || []"
          :key="e.name"
          class="cursor-pointer border-b border-outline-gray-1 hover:bg-surface-gray-1"
          @click="openCard(e)"
        >
          <td class="px-3 py-2 text-ink-gray-8">
            <div class="flex items-center gap-2">
              <Avatar :image="e.image" :label="e.employee_name" size="sm" />
              <span>{{ e.employee_name }}</span>
            </div>
          </td>
          <td class="px-3 py-2 text-ink-gray-7">{{ e.designation || '—' }}</td>
          <td class="px-3 py-2 text-ink-gray-7">{{ e.department || '—' }}</td>
          <td class="px-3 py-2 text-ink-gray-7">{{ e.user_id || '—' }}</td>
          <!-- ДОСТУПЫ: пароль + показать/скрыть + копировать + сброс — ТОЛЬКО админ -->
          <td v-if="isAdmin()" class="px-3 py-2 text-ink-gray-7" @click.stop>
            <div class="flex items-center gap-1.5">
              <span class="min-w-[7rem] font-mono text-xs text-ink-gray-8">
                {{ credDisplay(e) }}
              </span>
              <button
                v-if="credPassword(e)"
                type="button"
                class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2"
                :title="shownPw[e.name] ? __('Скрыть') : __('Показать')"
                @click.stop="togglePw(e)"
              >
                <FeatherIcon :name="shownPw[e.name] ? 'eye-off' : 'eye'" class="h-3.5 w-3.5" />
              </button>
              <button
                v-if="credPassword(e)"
                type="button"
                class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2"
                :title="__('Копировать')"
                @click.stop="copyPassword(e)"
              >
                <FeatherIcon name="copy" class="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2"
                :title="__('Сбросить пароль')"
                :disabled="resettingPw[e.name]"
                @click.stop="resetPassword(e)"
              >
                <FeatherIcon name="refresh-cw" class="h-3.5 w-3.5" />
              </button>
            </div>
          </td>
          <td class="px-3 py-2">
            <span
              class="rounded px-2 py-0.5 text-xs font-medium"
              :class="statusClass(e.status)"
            >
              {{ statusLabel(e.status) }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    <div
      v-if="employeeList && !employeeList.length"
      class="p-8 text-center text-sm text-ink-gray-5"
    >
      {{ __('Нет сотрудников по фильтру.') }}
    </div>
  </div>

  <!-- D1: карточка сотрудника — выезжает справа панелью -->
  <Teleport to="body">
    <Transition name="emp-overlay">
      <div v-if="card" class="fixed inset-0 z-40">
        <div class="absolute inset-0 bg-black/30" @click="card = null" />
        <Transition name="emp-panel">
          <div
            v-if="card"
            class="absolute right-0 top-0 flex h-full w-full flex-col bg-surface-modal shadow-2xl sm:w-1/2"
          >
            <!-- M10: слим-шапка (закрыть) + P-B5 карандаш режима правки -->
            <div class="flex shrink-0 items-center justify-end gap-1 border-b border-outline-gray-1 px-4 py-2">
              <Button
                v-if="canManage && !editMode"
                variant="ghost"
                :title="__('Редактировать контакты')"
                @click="startEdit"
              >
                <template #icon><FeatherIcon name="edit-2" class="h-4 w-4" /></template>
              </Button>
              <Button variant="ghost" icon="x" @click="card = null" />
            </div>
            <!-- M10 (по уточнению заказчика): слева БОЛЬШОЕ КВАДРАТНОЕ ФОТО,
                 справа «Контент» = имя + ВСЕ поля (должность/отдел/логин/статус/телефон) -->
            <div class="flex min-h-0 flex-1 flex-col overflow-y-auto sm:flex-row sm:overflow-hidden">
              <!-- ЛЕВО: большое квадратное фото -->
              <div class="shrink-0 p-6 sm:w-2/5">
                <div class="relative aspect-square w-full overflow-hidden rounded-xl bg-surface-gray-2">
                  <img
                    v-if="card.image"
                    :src="card.image"
                    :alt="card.employee_name"
                    class="h-full w-full object-cover"
                  />
                  <div
                    v-else
                    class="flex h-full w-full items-center justify-center text-5xl font-semibold text-ink-gray-4"
                  >
                    {{ (card.employee_name || '?').slice(0, 1) }}
                  </div>
                  <button
                    v-if="canManage"
                    class="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface-gray-7 text-ink-white shadow ring-2 ring-surface-modal hover:opacity-90"
                    :title="__('Загрузить фото')"
                    @click="openPhoto(card)"
                  >
                    <FeatherIcon name="camera" class="h-4 w-4" />
                  </button>
                </div>
              </div>
              <!-- ПРАВО: «Контент» = имя + все поля -->
              <div class="flex-1 overflow-y-auto px-6 py-5 sm:border-l sm:border-outline-gray-1">
                <h3 class="mb-4 text-xl font-semibold text-ink-gray-9">{{ card.employee_name }}</h3>
                <!-- K3: должность — редактируемая (админ меняет в выпадающем списке) -->
                <div class="mb-3 flex items-start gap-2 text-sm">
                  <div class="w-32 shrink-0 pt-1.5 text-ink-gray-5">
                    {{ __('Должность') }}
                  </div>
                  <div class="flex-1">
                    <template v-if="canManage">
                      <FormControl
                        type="select"
                        :options="designationSelectOptions"
                        :modelValue="cardDesignation"
                        @update:modelValue="onCardDesignationChange"
                      />
                      <div v-if="cardDesigNewMode" class="mt-1.5 flex gap-2">
                        <FormControl
                          type="text"
                          class="flex-1"
                          :placeholder="__('Название новой должности')"
                          v-model="cardDesigNew"
                          @keyup.enter="saveCardDesignation"
                        />
                        <Button size="sm" :label="__('OK')" @click="saveCardDesignation" />
                      </div>
                    </template>
                    <span v-else class="text-ink-gray-8">{{ card.designation || '—' }}</span>
                  </div>
                </div>
                <dl class="grid grid-cols-1 gap-3">
                  <div v-for="row in cardRows" :key="row.label" class="flex gap-2 text-sm">
                    <dt class="w-32 shrink-0 text-ink-gray-5">{{ row.label }}</dt>
                    <dd class="text-ink-gray-8">{{ row.value || '—' }}</dd>
                  </div>
                </dl>
                <!-- I32: основной телефон сотрудника -->
                <div class="mt-3 flex items-start gap-2 text-sm">
                  <div class="w-32 shrink-0 pt-1.5 text-ink-gray-5">
                    {{ __('Телефон') }}
                  </div>
                  <div class="flex-1">
                    <PhoneInput
                      v-if="editMode"
                      :value="edit.cell_number"
                      @change="(v) => (edit.cell_number = v)"
                    />
                    <span v-else class="pt-1.5 text-ink-gray-8 block">{{
                      formatPhoneDisplay(card.cell_number) || '—'
                    }}</span>
                  </div>
                </div>

                <!-- P-B1: рабочая почта (read-only, заполняется провижинингом B2) -->
                <div class="mt-3 flex items-start gap-2 text-sm">
                  <div class="w-32 shrink-0 pt-1.5 text-ink-gray-5">
                    {{ __('Рабочая почта') }}
                  </div>
                  <div class="flex-1 pt-1.5">
                    <a
                      v-if="card.nacifrah_company_email"
                      :href="`mailto:${card.nacifrah_company_email}`"
                      class="text-ink-blue-link hover:underline"
                      >{{ card.nacifrah_company_email }}</a
                    >
                    <template v-else>
                      <span class="text-ink-gray-5">{{ __('нет ящика') }}</span>
                      <Button
                        v-if="canManage"
                        class="ml-2"
                        size="sm"
                        variant="subtle"
                        :label="__('Создать почту')"
                        :loading="provisioning"
                        @click="provisionMailbox"
                      />
                    </template>
                  </div>
                </div>

                <!-- P-B3: доп. телефон -->
                <div class="mt-3 flex items-start gap-2 text-sm">
                  <div class="w-32 shrink-0 pt-1.5 text-ink-gray-5">
                    {{ __('Доп. телефон') }}
                  </div>
                  <div class="flex-1">
                    <PhoneInput
                      v-if="editMode"
                      :value="edit.phone2"
                      @change="(v) => (edit.phone2 = v)"
                    />
                    <span v-else class="pt-1.5 text-ink-gray-8 block">{{
                      formatPhoneDisplay(card.nacifrah_phone2) || '—'
                    }}</span>
                  </div>
                </div>

                <!-- P-B4/B6: Telegram (логин + deep-link в чат) -->
                <div class="mt-3 flex items-start gap-2 text-sm">
                  <div class="w-32 shrink-0 pt-1.5 text-ink-gray-5">{{ __('Telegram') }}</div>
                  <div class="flex-1">
                    <FormControl
                      v-if="editMode"
                      type="text"
                      :placeholder="__('@login')"
                      v-model="edit.telegram"
                    />
                    <div v-else class="flex items-center gap-2 pt-1.5">
                      <span class="text-ink-gray-8">{{
                        card.nacifrah_telegram ? '@' + card.nacifrah_telegram : '—'
                      }}</span>
                      <a
                        v-if="card.nacifrah_telegram"
                        :href="`https://t.me/${card.nacifrah_telegram}`"
                        target="_blank"
                        rel="noopener"
                        :title="__('Открыть чат в Telegram')"
                        class="inline-flex h-6 w-6 items-center justify-center rounded bg-surface-gray-2 text-ink-gray-7 hover:bg-surface-gray-3"
                      >
                        <FeatherIcon name="send" class="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </div>

                <!-- P-B4/B6: MAX (номер; deep-link не подтверждён → tel:/копирование, Q1) -->
                <div class="mt-3 flex items-start gap-2 text-sm">
                  <div class="w-32 shrink-0 pt-1.5 text-ink-gray-5">{{ __('MAX') }}</div>
                  <div class="flex-1">
                    <PhoneInput
                      v-if="editMode"
                      :value="edit.max_phone"
                      @change="(v) => (edit.max_phone = v)"
                    />
                    <div v-else class="flex items-center gap-2 pt-1.5">
                      <span class="text-ink-gray-8">{{
                        formatPhoneDisplay(card.nacifrah_max_phone) || '—'
                      }}</span>
                      <a
                        v-if="card.nacifrah_max_phone"
                        :href="`tel:+${onlyDigits(card.nacifrah_max_phone)}`"
                        :title="__('Позвонить')"
                        class="inline-flex h-6 w-6 items-center justify-center rounded bg-surface-gray-2 text-ink-gray-7 hover:bg-surface-gray-3"
                      >
                        <FeatherIcon name="phone" class="h-3.5 w-3.5" />
                      </a>
                      <button
                        v-if="card.nacifrah_max_phone"
                        type="button"
                        :title="__('Скопировать номер')"
                        class="inline-flex h-6 w-6 items-center justify-center rounded bg-surface-gray-2 text-ink-gray-7 hover:bg-surface-gray-3"
                        @click="copyMax"
                      >
                        <FeatherIcon name="copy" class="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- ДОСТУПЫ (логин/пароль входа в CRM) — ТОЛЬКО админ.
                     Заказчик: получить/сменить/сбросить/скопировать пароль учётки сотрудника.
                     Бэкенд сам гейтит _require_admin; пароль — зеркало в Employee.nacifrah_login_password. -->
                <div v-if="isAdmin() && card.user_id" class="mt-4 border-t border-outline-gray-1 pt-3">
                  <div class="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-gray-5">
                    <FeatherIcon name="lock" class="h-3.5 w-3.5" />
                    {{ __('Доступы (только админ)') }}
                  </div>
                  <div class="flex items-start gap-2 text-sm">
                    <div class="w-32 shrink-0 pt-1.5 text-ink-gray-5">{{ __('Логин') }}</div>
                    <div class="flex flex-1 items-center gap-2 pt-1.5">
                      <span class="font-mono text-xs text-ink-gray-8">{{ card.user_id }}</span>
                      <button
                        type="button"
                        class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2"
                        :title="__('Скопировать логин')"
                        @click="copyLogin(card)"
                      >
                        <FeatherIcon name="copy" class="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div class="mt-2 flex items-start gap-2 text-sm">
                    <div class="w-32 shrink-0 pt-1.5 text-ink-gray-5">{{ __('Пароль') }}</div>
                    <div class="flex flex-1 flex-wrap items-center gap-1.5 pt-1.5">
                      <span class="min-w-[7rem] font-mono text-xs text-ink-gray-8">{{ credDisplay(card) }}</span>
                      <button
                        v-if="credPassword(card)"
                        type="button"
                        class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2"
                        :title="shownPw[card.name] ? __('Скрыть') : __('Показать')"
                        @click="togglePw(card)"
                      >
                        <FeatherIcon :name="shownPw[card.name] ? 'eye-off' : 'eye'" class="h-3.5 w-3.5" />
                      </button>
                      <button
                        v-if="credPassword(card)"
                        type="button"
                        class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2"
                        :title="__('Копировать пароль')"
                        @click="copyPassword(card)"
                      >
                        <FeatherIcon name="copy" class="h-3.5 w-3.5" />
                      </button>
                      <Button
                        size="sm"
                        variant="subtle"
                        :loading="resettingPw[card.name]"
                        :label="credPassword(card) ? __('Сбросить') : __('Задать пароль')"
                        @click="resetPassword(card)"
                      />
                    </div>
                  </div>
                  <div v-if="!credPassword(card)" class="mt-1 pl-[8.5rem] text-xs text-ink-gray-5">
                    {{ __('Пароль не сохранён (ставился вне CRM). «Задать пароль» — сгенерируется новый и сохранится.') }}
                  </div>
                </div>

                <!-- P-B5: панель «Сохранить»/«Отмена» в режиме правки -->
                <div v-if="editMode" class="mt-4 flex gap-2">
                  <Button
                    variant="solid"
                    :label="__('Сохранить')"
                    :loading="savingContacts"
                    @click="saveContacts"
                  />
                  <Button :label="__('Отмена')" @click="cancelEdit" />
                </div>
              </div>
            </div>
            <div
              v-if="canManage"
              class="flex shrink-0 items-center gap-2 border-t border-outline-gray-1 px-6 py-4"
            >
              <Button
                v-if="card.status === 'Active' && card.user_id"
                variant="subtle"
                theme="red"
                :label="__('Уволить')"
                iconLeft="user-x"
                @click="openFire"
              />
              <!-- K8: полное удаление — ТОЛЬКО админ -->
              <Button
                v-if="isAdmin()"
                variant="ghost"
                theme="red"
                :label="__('Удалить')"
                iconLeft="trash-2"
                @click="doDelete"
              />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- D3: увольнение + перенос сделок/лидов/задач -->
  <SimpleModal v-model="showFire" :title="__('Уволить сотрудника')">
    <p class="text-sm text-ink-gray-7">
      {{ __('Уволить «{0}»? Вход в систему будет отключён. На кого перенести его работу?', [card?.employee_name]) }}
    </p>
    <div class="mt-3 flex flex-col gap-3">
      <FormControl
        type="select"
        :label="__('Лиды → перенести на')"
        :options="heirOptions"
        v-model="fireReassign.lead"
      />
      <FormControl
        type="select"
        :label="__('Сделки и проекты → перенести на')"
        :options="heirOptions"
        v-model="fireReassign.deal"
      />
      <FormControl
        type="select"
        :label="__('Задачи → перенести на')"
        :options="heirOptions"
        v-model="fireReassign.task"
      />
      <ErrorMessage v-if="fireError" :message="fireError" />
    </div>
    <div class="mt-4 flex justify-end gap-2">
      <Button :label="__('Отмена')" @click="showFire = false" />
      <Button
        variant="solid"
        theme="red"
        :label="__('Уволить и перенести')"
        :loading="firing"
        @click="doFire"
      />
    </div>
  </SimpleModal>

  <PhotoCropDialog
    v-model="showPhoto"
    :title="photoTarget ? photoTarget.employee_name : ''"
    @cropped="onCropped"
  />

  <SimpleModal v-model="showHire" :title="__('Нанять сотрудника')" size="lg">
    <!-- M3: Enter нанимает (кроме textarea) -->
    <div @keydown.enter="onEnterHire">
      <div class="flex flex-col gap-3">
          <!-- M9: ФИО тремя полями; в системе показываем «Имя Фамилия» -->
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormControl :label="__('Фамилия')" v-model="form.last_name" :placeholder="__('Петров')" />
            <FormControl :label="__('Имя')" v-model="form.first_name" :placeholder="__('Иван')" />
            <FormControl :label="__('Отчество')" v-model="form.middle_name" :placeholder="__('Иванович')" />
          </div>
          <!-- Email НЕ спрашиваем: корпоративная почта создаётся автоматически по имени/фамилии
               и она же = логин (заказчик). -->
          <p class="rounded-md bg-surface-gray-2 px-3 py-2 text-xs text-ink-gray-6">
            {{ __('Логин и рабочая почта (имя.фамилия@nacifrah.ru) создадутся автоматически.') }}
          </p>
          <FormControl type="password" :label="__('Пароль (необязательно)')" v-model="form.password" />
          <FormControl
            type="select"
            :label="__('Роль')"
            :options="roleOptions"
            v-model="form.role"
          />
          <!-- K4: должность с инлайн-созданием новой -->
          <FormControl
            type="select"
            :label="__('Должность')"
            :options="designationSelectOptions"
            v-model="form.designation"
          />
          <FormControl
            v-if="form.designation === '__new__'"
            type="text"
            :placeholder="__('Название новой должности')"
            v-model="form.designationNew"
            @keydown.enter.prevent
          />
          <FormControl
            type="select"
            :label="__('Отдел')"
            :options="departmentOptions"
            v-model="form.department"
          />
          <PhoneInput
            :label="__('Телефон')"
            :value="form.cell_number"
            @change="(v) => (form.cell_number = v)"
          />
          <ErrorMessage v-if="error" :message="error" />
        </div>
        <div class="mt-5 flex flex-row-reverse gap-2">
          <Button
            variant="solid"
            :label="__('Нанять')"
            :loading="hiring"
            @click="doHire"
          />
          <Button :label="__('Отмена')" @click="showHire = false" />
        </div>
    </div>
  </SimpleModal>

  <ConfirmModal :state="confirmState" />
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import { napi } from '@/utils/api'
import PhoneInput from '@/components/Controls/PhoneInput.vue'
import PhotoCropDialog from '@/components/PhotoCropDialog.vue'
import { formatPhoneDisplay } from '@/utils/ruFormat'
import {
  Avatar,
  Button,
  FormControl,
  ErrorMessage,
  FeatherIcon,
  createResource,
  call,
  toast,
} from 'frappe-ui'
import { reactive, ref, computed, watch, onMounted } from 'vue'
import { usersStore } from '@/stores/users'
import { useRealtimeRefresh } from '@/composables/useRealtimeRefresh'
import SimpleModal from '@/components/SimpleModal.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'

const { isManager, isAdmin } = usersStore()

// K3: встраивание во вкладку «Команда» (прячем хедер; найм — кнопкой в хедере Team)
defineProps({ embedded: { type: Boolean, default: false } })
defineExpose({ openHire: () => openHire() })

// D2: право найма/увольнения по политике (а не просто роль менеджера)
const canManage = ref(false)

// ── список + D6 фильтры ──────────────────────────────────────────────
const employeeList = ref([])
const filterStatus = ref('Active')
const filterDept = ref('')
const searchQuery = ref('')

async function loadEmployees() {
  try {
    employeeList.value = await call(napi('hr.list_employees'), {
      status: filterStatus.value,
      department: filterDept.value || null,
      search: searchQuery.value || null,
    })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось загрузить сотрудников'))
  }
}
watch([filterStatus, filterDept, searchQuery], loadEmployees)
onMounted(async () => {
  loadEmployees()
  try {
    canManage.value = !!(await call(napi('hr.can_manage_staff')))
  } catch (e) {
    canManage.value = false
  }
  loadCredentials()
})

// ── ДОСТУПЫ: логины/пароли входа — ТОЛЬКО админ ──────────────────────
// creds[employee] = { login, password }; backend сам проверяет _require_admin (403 не-админу)
const creds = ref({})
const shownPw = reactive({})
const resettingPw = reactive({})
async function loadCredentials() {
  if (!isAdmin()) return
  try {
    const rows = await call(napi('hr.get_employee_credentials'))
    const map = {}
    for (const r of rows || []) {
      map[r.employee] = { login: r.login || '', password: r.password || '' }
    }
    creds.value = map
  } catch (e) {
    // 403 у не-админа / любая ошибка — просто скрываем доступы
    creds.value = {}
  }
}
function credPassword(e) {
  return creds.value[e.name]?.password || ''
}
function credDisplay(e) {
  const pw = credPassword(e)
  if (!pw) return '—'
  return shownPw[e.name] ? pw : '••••••••'
}
function togglePw(e) {
  shownPw[e.name] = !shownPw[e.name]
}
async function copyPassword(e) {
  const pw = credPassword(e)
  if (!pw) return
  try {
    await navigator.clipboard.writeText(pw)
    toast.success(__('Пароль скопирован'))
  } catch (err) {
    toast.error(__('Не удалось скопировать'))
  }
}
async function copyLogin(e) {
  const login = e.user_id || creds.value[e.name]?.login || ''
  if (!login) return
  try {
    await navigator.clipboard.writeText(login)
    toast.success(__('Логин скопирован'))
  } catch (err) {
    toast.error(__('Не удалось скопировать'))
  }
}
function resetPassword(e) {
  confirmState.value = {
    show: true,
    danger: true,
    confirmLabel: __('Сбросить'),
    message: __('Сбросить пароль входа для «{0}»? Старый пароль перестанет работать.', [
      e.employee_name,
    ]),
    onConfirm: async () => {
      resettingPw[e.name] = true
      try {
        const res = await call(napi('hr.set_employee_password'), { employee: e.name })
        if (res?.ok) {
          creds.value = {
            ...creds.value,
            [e.name]: { login: res.login || creds.value[e.name]?.login || '', password: res.password || '' },
          }
          shownPw[e.name] = true
          toast.success(__('Новый пароль: {0}', [res.password || '']))
        } else {
          toast.error(__('Не удалось сбросить пароль'))
        }
      } catch (err) {
        toast.error(err?.messages?.[0] || __('Не удалось сбросить пароль'))
      } finally {
        resettingPw[e.name] = false
      }
    },
  }
}

const statusFilterOptions = [
  { label: 'Активные', value: 'Active' },
  { label: 'Уволенные', value: 'Left' },
  { label: 'Все', value: 'All' },
]

function statusLabel(s) {
  if (s === 'Active') return 'Активный'
  if (s === 'Left' || s === 'Inactive') return 'Уволен'
  if (s === 'Suspended') return 'Приостановлен'
  return s || '—'
}
function statusClass(s) {
  if (s === 'Active') return 'bg-green-100 text-green-700'
  if (s === 'Left' || s === 'Inactive') return 'bg-red-100 text-red-700'
  return 'bg-surface-gray-2 text-ink-gray-6'
}

// ── D1 карточка сотрудника ───────────────────────────────────────────
const card = ref(null)
const confirmState = ref({ show: false })
// K3: инлайн-смена должности прямо в карточке сотрудника
const cardDesignation = ref('')
const cardDesigNewMode = ref(false)
const cardDesigNew = ref('')
function openCard(e) {
  card.value = e
  editMode.value = false
  cardDesignation.value = e.designation || ''
  cardDesigNewMode.value = false
  cardDesigNew.value = ''
}

// P-B5: режим правки контактов (карандаш) + локальная копия (не мутируем card до save)
const editMode = ref(false)
const savingContacts = ref(false)
const edit = reactive({ cell_number: '', phone2: '', telegram: '', max_phone: '' })
function startEdit() {
  const c = card.value || {}
  edit.cell_number = c.cell_number || ''
  edit.phone2 = c.nacifrah_phone2 || ''
  edit.telegram = c.nacifrah_telegram || ''
  // MAX по умолчанию = основной телефон, если ещё не задан (спека 3.2)
  edit.max_phone = c.nacifrah_max_phone || c.cell_number || ''
  editMode.value = true
}
function cancelEdit() {
  editMode.value = false
}
function onlyDigits(s) {
  return (s || '').toString().replace(/\D/g, '')
}
async function copyMax() {
  try {
    await navigator.clipboard.writeText('+' + onlyDigits(card.value?.nacifrah_max_phone))
    toast.success(__('Номер скопирован'))
  } catch (e) {
    toast.error(__('Не удалось скопировать'))
  }
}
async function saveContacts() {
  if (!card.value?.name) return
  savingContacts.value = true
  try {
    // основной телефон менялся — отдельный метод (как I32, обновляет и User.mobile_no)
    if ((edit.cell_number || '') !== (card.value.cell_number || '')) {
      await call(napi('hr.set_employee_phone'), {
        employee: card.value.name,
        user: card.value.user_id || null,
        cell_number: edit.cell_number || '',
      })
    }
    // P-B5: один батч-вызов для доп. контактов
    await call(napi('hr.save_employee_contacts'), {
      employee: card.value.name,
      phone2: edit.phone2 || '',
      telegram: edit.telegram || '',
      max_phone: edit.max_phone || '',
    })
    editMode.value = false
    await loadEmployees()
    reopenCardByName(card.value.name)
    toast.success(__('Контакты сохранены'))
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось сохранить контакты'))
  } finally {
    savingContacts.value = false
  }
}

// P-B2: создать корпоративный ящик (read-only поле company_email пишет провижининг)
const provisioning = ref(false)
async function provisionMailbox() {
  if (!card.value?.name) return
  provisioning.value = true
  try {
    const res = await call(napi('hr.provision_employee_mailbox'), {
      employee: card.value.name,
    })
    await loadEmployees()
    reopenCardByName(card.value.name)
    toast.success(__('Почта создана: {0}', [res?.address || '']))
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось создать почту'))
  } finally {
    provisioning.value = false
  }
}

// после loadEmployees карточка держит старый объект — переоткрываем свежей строкой
function reopenCardByName(name) {
  const fresh = (employeeList.value || []).find((x) => x.name === name)
  if (fresh) card.value = fresh
}
async function onCardDesignationChange(val) {
  cardDesignation.value = val
  if (val === '__new__') {
    cardDesigNewMode.value = true
    return
  }
  cardDesigNewMode.value = false
  await applyCardDesignation(val || null)
}
async function saveCardDesignation() {
  const name = (cardDesigNew.value || '').trim()
  if (!name) return
  await applyCardDesignation(name)
  cardDesigNewMode.value = false
  cardDesigNew.value = ''
  cardDesignation.value = name
}
async function applyCardDesignation(val) {
  if (!card.value?.name) return
  try {
    await call(napi('hr.set_employee_designation'), {
      employee: card.value.name,
      designation: val,
    })
    if (card.value) card.value.designation = val
    designations.reload()
    await loadEmployees()
    toast.success(__('Должность обновлена'))
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось'))
  }
}

const cardRows = computed(() => {
  const e = card.value || {}
  return [
    { label: __('Отдел'), value: e.department },
    { label: __('Логин'), value: e.user_id },
    { label: __('Статус'), value: statusLabel(e.status) },
  ]
})

// I37: загрузка фото сотрудника (обрезка 1:1 в PhotoCropDialog)
const showPhoto = ref(false)
const photoTarget = ref(null)
function openPhoto(e) {
  photoTarget.value = e
  showPhoto.value = true
}
async function onCropped({ blob, name }) {
  if (!photoTarget.value?.name) return
  try {
    const fd = new FormData()
    fd.append('file', blob, (name || 'photo').replace(/\.[^.]+$/, '') + '.jpg')
    fd.append('is_private', '0')
    fd.append('folder', 'Home')
    const res = await fetch('/api/method/upload_file', {
      method: 'POST',
      headers: { 'X-Frappe-CSRF-Token': window.csrf_token || '' },
      body: fd,
    })
    const j = await res.json()
    const fileUrl = j?.message?.file_url
    if (!fileUrl) throw new Error('upload failed')
    await call(napi('hr.set_employee_photo'), {
      employee: photoTarget.value.name,
      file_url: fileUrl,
    })
    if (card.value && card.value.name === photoTarget.value.name) card.value.image = fileUrl
    await loadEmployees()
    toast.success(__('Фото обновлено'))
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось загрузить фото'))
  }
}

// ── D3 увольнение + перенос ──────────────────────────────────────────
const showFire = ref(false)
const firing = ref(false)
const fireError = ref('')
const fireReassign = reactive({ lead: '', deal: '', task: '' })
const heirOptions = computed(() => [
  { label: __('— не переносить —'), value: '' },
  ...(employeeList.value || [])
    .filter((e) => e.user_id && e.user_id !== card.value?.user_id && e.status === 'Active')
    .map((e) => ({ label: e.employee_name, value: e.user_id })),
])
function openFire() {
  fireError.value = ''
  fireReassign.lead = ''
  fireReassign.deal = ''
  fireReassign.task = ''
  showFire.value = true
}

// K8: полное удаление сотрудника (карточка + логин) — только админ
function doDelete() {
  if (!card.value?.name) return
  const emp = card.value
  confirmState.value = {
    show: true,
    danger: true,
    confirmLabel: __('Удалить'),
    message: __('Удалить сотрудника «{0}» полностью? Удалятся карточка и логин. Необратимо.', [
      emp.employee_name,
    ]),
    onConfirm: async () => {
      await call(napi('hr.delete_employee'), { employee: emp.name })
      card.value = null
      await loadEmployees()
      toast.success(__('Сотрудник удалён'))
    },
  }
}
async function doFire() {
  if (!card.value?.user_id) return
  firing.value = true
  fireError.value = ''
  try {
    const reassign = {}
    if (fireReassign.lead) reassign.lead = fireReassign.lead
    if (fireReassign.deal) reassign.deal = fireReassign.deal
    if (fireReassign.task) reassign.task = fireReassign.task
    const res = await call(napi('hr.fire_employee'), {
      user: card.value.user_id,
      reassign: JSON.stringify(reassign),
    })
    showFire.value = false
    card.value = null
    await loadEmployees()
    const c = res?.reassigned || {}
    toast.success(
      __('Сотрудник уволен. Перенесено: лиды {0}, сделки {1}, задачи {2}', [
        c.lead || 0,
        c.deal || 0,
        c.task || 0,
      ]),
    )
  } catch (e) {
    fireError.value = e?.messages?.[0] || __('Не удалось уволить сотрудника')
  } finally {
    firing.value = false
  }
}

// ── найм (как было) ──────────────────────────────────────────────────
const showHire = ref(false)
const hiring = ref(false)
const error = ref('')
const form = reactive({
  last_name: '', // M9: ФИО тремя полями
  first_name: '',
  middle_name: '',
  email: '',
  password: '',
  role: 'Specialist',
  designation: '',
  designationNew: '', // K4: имя новой должности (когда выбрано «завести новую»)
  department: '',
  cell_number: '', // I32: телефон сотрудника
})

const designations = createResource({
  url: 'frappe.client.get_list',
  params: { doctype: 'Designation', fields: ['name'], limit_page_length: 0 },
  auto: true,
})
const departments = createResource({
  url: 'frappe.client.get_list',
  params: { doctype: 'Department', fields: ['name'], limit_page_length: 0 },
  auto: true,
})
// live: сотрудник/должность/отдел изменены где-угодно → обновляем список и справочники
useRealtimeRefresh(['Employee', 'Designation', 'Department'], async () => {
  await loadEmployees()
  // карточка открыта и не в режиме правки → подтянуть свежие контакты
  if (card.value?.name && !editMode.value) reopenCardByName(card.value.name)
  designations.reload()
  departments.reload()
})

// Единый источник ролей — бэкенд nacifrah.hr.get_agency_roles (правило централизации).
// «Наблюдатель» убран по требованию заказчика («непонятная роль»).
const roleOptions = ref([
  { label: 'Сотрудник', value: 'Specialist' },
  { label: 'Руководитель', value: 'Agency Head' },
  { label: 'Администратор', value: 'Agency Admin' },
])
createResource({
  url: napi('hr.get_agency_roles'),
  auto: true,
  onSuccess(rows) {
    if (Array.isArray(rows) && rows.length)
      roleOptions.value = rows.map((r) => ({ label: r.label, value: r.value }))
  },
})
const designationOptions = computed(() => [
  { label: '—', value: '' },
  ...((designations.data || []).map((d) => ({ label: d.name, value: d.name }))),
])
// K4: тот же список + пункт «завести новую» в самом низу
const designationSelectOptions = computed(() => [
  ...designationOptions.value,
  { label: __('＋ Завести новую должность…'), value: '__new__' },
])
// разрешить выбранную должность: если «новая» — создать и вернуть её имя
async function ensureDesignation(sel, typed) {
  if (sel !== '__new__') return sel || null
  const name = (typed || '').trim()
  if (!name) return null
  await call(napi('hr.create_designation'), { designation_name: name })
  designations.reload()
  return name
}
const departmentOptions = computed(() => [
  { label: '—', value: '' },
  ...((departments.data || []).map((d) => ({ label: d.name, value: d.name }))),
])
const departmentFilterOptions = computed(() => [
  { label: __('Все отделы'), value: '' },
  ...((departments.data || []).map((d) => ({ label: d.name, value: d.name }))),
])

function openHire() {
  error.value = ''
  Object.assign(form, {
    last_name: '',
    first_name: '',
    middle_name: '',
    email: '',
    password: '',
    role: 'Specialist',
    designation: '',
    designationNew: '',
    department: '',
    cell_number: '',
  })
  showHire.value = true
}

// M3: Enter нанимает (кроме textarea/rich-редактора)
function onEnterHire(e) {
  const t = e.target
  if (
    e.shiftKey ||
    t?.tagName === 'TEXTAREA' ||
    t?.isContentEditable ||
    t?.closest?.('[contenteditable], textarea')
  )
    return
  if (hiring.value) return
  e.preventDefault()
  doHire()
}

async function doHire() {
  error.value = ''
  // M9: имя и фамилия обязательны (отображаем «Имя Фамилия»). Email НЕ спрашиваем —
  // бэкенд сам сгенерирует корпоративную почту = логин по имени/фамилии.
  if (!form.first_name || !form.last_name) {
    error.value = __('Укажите Фамилию и Имя')
    return
  }
  hiring.value = true
  try {
    const designation = await ensureDesignation(form.designation, form.designationNew)
    await call(napi('hr.hire_employee'), {
      first_name: form.first_name,
      last_name: form.last_name,
      middle_name: form.middle_name || null,
      role: form.role,
      designation: designation,
      department: form.department || null,
      password: form.password || null,
      cell_number: form.cell_number || null,
    })
    showHire.value = false
    loadEmployees()
    toast.success(__('Сотрудник нанят'))
  } catch (e) {
    error.value = e?.messages?.[0] || __('Не удалось нанять сотрудника')
  } finally {
    hiring.value = false
  }
}
</script>

<style scoped>
.emp-overlay-enter-active,
.emp-overlay-leave-active {
  transition: opacity 0.2s ease;
}
.emp-overlay-enter-from,
.emp-overlay-leave-to {
  opacity: 0;
}
.emp-panel-enter-active,
.emp-panel-leave-active {
  transition: transform 0.25s ease;
}
.emp-panel-enter-from,
.emp-panel-leave-to {
  transform: translateX(100%);
}
</style>
