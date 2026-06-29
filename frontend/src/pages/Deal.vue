<template>
  <LayoutHeader v-if="!embedded">
    <template #left-header>
      <Breadcrumbs :items="breadcrumbs">
        <template #prefix="{ item }">
          <Icon v-if="item.icon" :icon="item.icon" class="mr-2 h-4" />
        </template>
      </Breadcrumbs>
    </template>
    <template v-if="!errorTitle" #right-header>
      <CustomActions
        v-if="document._actions?.length"
        :actions="document._actions"
      />
      <CustomActions
        v-if="document.actions?.length"
        :actions="document.actions"
      />
      <AssignTo v-model="assignees.data" doctype="CRM Deal" :docname="dealId" />
      <!-- F6 (P-D13): действия сделки. «Объединить» → MergeDealModal (дубли). -->
      <Dropdown :options="dealActions" placement="bottom-end">
        <template #default>
          <Button :tooltip="__('Действия')" icon="more-horizontal" />
        </template>
      </Dropdown>
      <Dropdown
        v-if="doc && document.statuses"
        :options="statuses"
        placement="right"
      >
        <template #default="{ open }">
          <Button
            v-if="doc.status"
            :label="statusLabel(doc.status)"
            :iconRight="open ? 'chevron-up' : 'chevron-down'"
          >
            <template #prefix>
              <IndicatorIcon :class="getDealStatus(doc.status).color" />
            </template>
          </Button>
        </template>
      </Dropdown>
    </template>
  </LayoutHeader>
  <div v-if="doc.name" class="flex h-full overflow-hidden">
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- F4 (P-D11 + P-REF): бар этапов ТЕКУЩЕЙ воронки сверху + перенос в воронку.
           Клик по этапу → set_deal_stage; перенос → move_deal_to_funnel (nacifrah.crm_bridge).
           currentStage прокидываем для оптимистичной подсветки; @changed → reload карточки. -->
      <DealStageBar
        :deal="dealId"
        :current-stage="doc.nacifrah_funnel_stage || doc.status"
        @changed="onStageBarChanged"
      />
      <Tabs
        v-model="tabIndex"
        as="div"
        :tabs="tabs"
        class="flex flex-1 overflow-hidden flex-col [&_[role='tab']]:px-0 [&_[role='tab']]:shrink-0 [&_[role='tablist']]:px-5 [&_[role='tablist']::-webkit-scrollbar]:h-0 [&_[role='tablist']]:min-h-[45px] [&_[role='tablist']]:gap-7.5 [&_[role='tabpanel']:not([hidden])]:flex [&_[role='tabpanel']:not([hidden])]:grow"
      >
        <template #tab-panel>
          <Activities
            ref="activities"
            v-model:reload="reload"
            v-model:tabIndex="tabIndex"
            doctype="CRM Deal"
            :docname="dealId"
            :tabs="tabs"
            @beforeSave="beforeStatusChange"
            @afterSave="reloadResources"
          />
        </template>
      </Tabs>
    </div>
    <Resizer side="right" class="flex flex-col justify-between border-l">
      <div
        class="flex h-[45px] cursor-copy items-center border-b px-5 py-2.5 text-lg font-medium text-ink-gray-9"
        @click="copyToClipboard(dealId)"
      >
        {{ __(dealId) }}
      </div>
      <div class="flex items-center justify-start gap-5 border-b p-5">
        <Tooltip :text="__('Organization Logo')">
          <div class="group relative size-12">
            <Avatar
              size="3xl"
              class="size-12"
              :label="title"
              :image="organization?.organization_logo"
            />
          </div>
        </Tooltip>
        <div class="flex flex-col gap-2.5 truncate text-ink-gray-9">
          <Tooltip :text="organization?.name || __('Set an Organization')">
            <div class="truncate text-2xl font-medium">
              {{ title }}
            </div>
          </Tooltip>
          <div class="flex gap-1.5">
            <Button
              v-if="callEnabled"
              :tooltip="__('Make a Call')"
              :icon="PhoneIcon"
              @click="triggerCall"
            />

            <Button
              :tooltip="__('Send an Email')"
              :icon="Email2Icon"
              @click="
                doc.email
                  ? openEmailBox()
                  : toast.error(
                      __('Please set an email address to send emails'),
                    )
              "
            />

            <Button
              :tooltip="__('Go to Website')"
              :icon="LinkIcon"
              @click="
                doc.website
                  ? openWebsite(doc.website)
                  : toast.error(__('Please set a website to visit'))
              "
            />

            <Button
              :tooltip="__('Attach a File')"
              :icon="AttachmentIcon"
              @click="showFilesUploader = true"
            />

            <Button
              v-if="canDelete"
              :tooltip="__('Delete')"
              variant="subtle"
              icon="trash-2"
              theme="red"
              @click="deleteDeal"
            />
          </div>
        </div>
      </div>
      <SLASection
        v-if="doc.sla_status"
        v-model="doc"
        @updateField="updateField"
      />
      <!-- F5 (P-D14): организация — ИНН (editable) + Карта партнёра (Attach).
           Поля на CRM Organization (nacifrah_inn / nacifrah_partner_card).
           Показываем только когда у сделки задана организация. Запись ведём через
           organization.setValue (как в Organization.vue). -->
      <div
        v-if="doc.organization && organization?.name"
        class="flex flex-col gap-3 border-b px-5 py-4"
      >
        <div class="flex items-center justify-between">
          <div class="text-base font-medium text-ink-gray-8">
            {{ __('Организация') }}
          </div>
          <Button
            variant="ghost"
            :tooltip="__('Открыть организацию')"
            :icon="ArrowUpRightIcon"
            @click="
              router.push({
                name: 'Organization',
                params: { organizationId: organization.name },
              })
            "
          />
        </div>
        <!-- ИНН (редактируемый) -->
        <div class="flex flex-col gap-1">
          <div class="text-xs text-ink-gray-5">{{ __('ИНН') }}</div>
          <FormControl
            type="text"
            size="sm"
            :placeholder="__('10 или 12 цифр')"
            :modelValue="organization.nacifrah_inn || ''"
            @blur="(e) => saveOrgField('nacifrah_inn', e.target.value)"
            @keydown.enter="(e) => e.target.blur()"
          />
        </div>
        <!-- Карта партнёра (Attach) -->
        <div class="flex flex-col gap-1.5">
          <div class="text-xs text-ink-gray-5">{{ __('Карта партнёра') }}</div>
          <div
            v-if="organization.nacifrah_partner_card"
            class="flex items-center gap-2 text-base"
          >
            <AttachmentIcon class="h-4 w-4 shrink-0 text-ink-gray-5" />
            <a
              :href="organization.nacifrah_partner_card"
              target="_blank"
              rel="noopener"
              class="truncate text-ink-blue-link hover:underline"
              :title="__('Открыть / скачать')"
            >
              {{ partnerCardName }}
            </a>
            <Button
              variant="ghost"
              class="ml-auto shrink-0"
              :tooltip="__('Удалить')"
              icon="x"
              @click="saveOrgField('nacifrah_partner_card', '')"
            />
          </div>
          <FileUploader
            v-else
            :doctype="'CRM Organization'"
            :docname="organization.name"
            @success="(file) => saveOrgField('nacifrah_partner_card', file.file_url)"
          >
            <template #default="{ openFileSelector, uploading, error: upErr }">
              <div class="flex flex-col gap-1">
                <Button
                  variant="subtle"
                  iconLeft="upload"
                  :loading="uploading"
                  :label="__('Загрузить карту партнёра')"
                  @click="openFileSelector"
                />
                <ErrorMessage :message="upErr" />
              </div>
            </template>
          </FileUploader>
        </div>
      </div>
      <div
        v-if="sections.data"
        class="flex flex-1 flex-col justify-between overflow-hidden"
      >
        <SidePanelLayout
          :sections="sections.data"
          :addContact="addContact"
          doctype="CRM Deal"
          :docname="dealId"
          @reload="sections.reload"
          @beforeFieldChange="beforeStatusChange"
          @afterFieldChange="reloadResources"
        >
          <template #actions="{ section }">
            <div v-if="section.name == 'contacts_section'" class="pr-2">
              <Link
                value=""
                doctype="Contact"
                :onCreate="
                  (value, close) => {
                    _contact = {
                      first_name: value,
                      company_name: doc.organization,
                    }
                    showContactModal = true
                    close()
                  }
                "
                @change="(e) => addContact(e)"
              >
                <template #target="{ togglePopover }">
                  <Button
                    class="h-7 px-3"
                    variant="ghost"
                    icon="plus"
                    @click="togglePopover()"
                  />
                </template>
              </Link>
            </div>
          </template>
          <template #default="{ section }">
            <div
              v-if="section.name == 'contacts_section'"
              class="contacts-area"
            >
              <div
                v-if="dealContacts?.loading && dealContacts?.data?.length == 0"
                class="flex min-h-20 flex-1 items-center justify-center gap-3 text-base text-ink-gray-4"
              >
                <LoadingIndicator class="h-4 w-4" />
                <span>{{ __('Loading...') }}</span>
              </div>
              <div
                v-for="(contact, i) in dealContacts.data"
                v-else-if="dealContacts?.data?.length"
                :key="contact.name"
              >
                <div class="px-2 pb-2.5" :class="[i == 0 ? 'pt-5' : 'pt-2.5']">
                  <Section :opened="contact.opened">
                    <template #header="{ opened, toggle }">
                      <div
                        class="flex cursor-pointer items-center justify-between gap-2 pr-1 text-base leading-5 text-ink-gray-7"
                      >
                        <div
                          class="flex h-7 items-center gap-2 truncate"
                          @click="toggle()"
                        >
                          <Avatar
                            :label="contact.full_name"
                            :image="contact.image"
                            size="md"
                          />
                          <div class="truncate">
                            {{ contact.full_name }}
                          </div>
                          <Badge
                            v-if="contact.is_primary"
                            class="ml-2"
                            variant="outline"
                            :label="__('Primary')"
                            theme="green"
                          />
                        </div>
                        <div class="flex items-center">
                          <Dropdown :options="contactOptions(contact)">
                            <Button
                              icon="more-horizontal"
                              class="text-ink-gray-5"
                              variant="ghost"
                            />
                          </Dropdown>
                          <Button
                            variant="ghost"
                            :tooltip="__('View Contact')"
                            :icon="ArrowUpRightIcon"
                            @click="
                              router.push({
                                name: 'Contact',
                                params: { contactId: contact.name },
                              })
                            "
                          />
                          <Button
                            variant="ghost"
                            class="transition-all duration-300 ease-in-out"
                            :class="{ 'rotate-90': opened }"
                            icon="chevron-right"
                            @click="toggle()"
                          />
                        </div>
                      </div>
                    </template>
                    <!-- P-D10: кликабельные поля контакта по образцу карточки сотрудника.
                         Телефоны → makeCall (если включена телефония) либо tel:;
                         e-mail → openEmailBox(адрес) либо mailto:;
                         Telegram-логин → https://t.me/<login>;
                         MAX-номер → tel:/копирование (deep-link MAX не подтверждён). -->
                    <div class="flex flex-col gap-1.5 pt-2 text-base">
                      <!-- e-mail(ы): основной + все из Contact.email_ids -->
                      <div
                        v-for="email in contactEmails(contact)"
                        :key="'em-' + email"
                        class="group flex items-center gap-3 p-1 py-1.5 text-ink-gray-8"
                      >
                        <Email2Icon class="h-4 w-4 shrink-0" />
                        <button
                          type="button"
                          class="truncate text-left hover:text-ink-blue-link hover:underline"
                          :title="__('Написать письмо')"
                          @click="writeEmail(email)"
                        >
                          {{ email }}
                        </button>
                        <a
                          :href="`mailto:${email}`"
                          class="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
                          :title="__('Открыть в почтовом клиенте')"
                        >
                          <ArrowUpRightIcon class="h-3.5 w-3.5 text-ink-gray-5" />
                        </a>
                      </div>
                      <!-- телефон(ы): mobile_no + все из Contact.phone_nos -->
                      <div
                        v-for="phone in contactPhones(contact)"
                        :key="'ph-' + phone"
                        class="group flex items-center gap-3 p-1 py-1.5 text-ink-gray-8"
                      >
                        <PhoneIcon class="h-4 w-4 shrink-0" />
                        <button
                          type="button"
                          class="text-left hover:text-ink-blue-link hover:underline"
                          :title="__('Позвонить')"
                          @click="callNumber(phone)"
                        >
                          {{ formatPhoneDisplay(phone) }}
                        </button>
                        <button
                          type="button"
                          class="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
                          :title="__('Скопировать номер')"
                          @click="copyText(phone)"
                        >
                          <FeatherIcon name="copy" class="h-3.5 w-3.5 text-ink-gray-5" />
                        </button>
                      </div>
                      <!-- Telegram-логин → если по сделке уже есть чат, открыть его
                           ВНУТРИ карточки (вкладка «Мессенджеры»); иначе внешний t.me. -->
                      <div
                        v-if="contact.nacifrah_telegram"
                        class="flex items-center gap-3 p-1 py-1.5 text-ink-gray-8"
                      >
                        <TelegramIcon class="h-4 w-4 shrink-0" />
                        <button
                          v-if="hasTgChat"
                          type="button"
                          class="text-left hover:text-ink-blue-link hover:underline"
                          :title="__('Открыть переписку в карточке')"
                          @click="openMessengersTab"
                        >
                          {{ '@' + tgLogin(contact.nacifrah_telegram) }}
                        </button>
                        <a
                          v-else
                          :href="`https://t.me/${tgLogin(contact.nacifrah_telegram)}`"
                          target="_blank"
                          rel="noopener"
                          class="hover:text-ink-blue-link hover:underline"
                          :title="__('Открыть чат в Telegram')"
                        >
                          {{ '@' + tgLogin(contact.nacifrah_telegram) }}
                        </a>
                      </div>
                      <!-- MAX-номер → tel:/копирование (как в карточке сотрудника) -->
                      <div
                        v-if="contact.nacifrah_max"
                        class="group flex items-center gap-3 p-1 py-1.5 text-ink-gray-8"
                      >
                        <PhoneIcon class="h-4 w-4 shrink-0" />
                        <span class="text-ink-gray-8">
                          MAX: {{ formatPhoneDisplay(contact.nacifrah_max) }}
                        </span>
                        <a
                          :href="`tel:+${onlyDigits(contact.nacifrah_max)}`"
                          class="ml-auto"
                          :title="__('Позвонить')"
                        >
                          <PhoneIcon class="h-3.5 w-3.5 text-ink-gray-5" />
                        </a>
                        <button
                          type="button"
                          :title="__('Скопировать номер')"
                          @click="copyText(contact.nacifrah_max)"
                        >
                          <FeatherIcon name="copy" class="h-3.5 w-3.5 text-ink-gray-5" />
                        </button>
                      </div>
                      <div
                        v-if="
                          !contactEmails(contact).length &&
                          !contactPhones(contact).length &&
                          !contact.nacifrah_telegram &&
                          !contact.nacifrah_max
                        "
                        class="flex items-center justify-center py-4 text-sm text-ink-gray-4"
                      >
                        {{ __('No Details Added') }}
                      </div>
                    </div>
                  </Section>
                </div>
                <div
                  v-if="i != dealContacts.data.length - 1"
                  class="mx-2 h-px border-t border-outline-gray-modals"
                />
              </div>
              <div
                v-else
                class="flex h-20 items-center justify-center text-base text-ink-gray-5"
              >
                {{ __('No Contacts Added') }}
              </div>
            </div>
          </template>
        </SidePanelLayout>
      </div>
    </Resizer>
  </div>
  <ErrorPage
    v-else-if="errorTitle"
    :errorTitle="errorTitle"
    :errorMessage="errorMessage"
  />
  <OrganizationModal
    v-if="showOrganizationModal"
    v-model="showOrganizationModal"
    :data="_organization"
    :options="{
      redirect: false,
      afterInsert: (_doc) => updateField('organization', _doc.name),
    }"
  />
  <ContactModal
    v-if="showContactModal"
    v-model="showContactModal"
    :contact="_contact"
    :options="{
      redirect: false,
      afterInsert: (_doc) => addContact(_doc.name),
    }"
  />
  <FilesUploader
    v-model="showFilesUploader"
    doctype="CRM Deal"
    :docname="dealId"
    @after="
      () => {
        activities?.all_activities?.reload()
        changeTabTo('attachments')
      }
    "
  />
  <DeleteLinkedDocModal
    v-if="showDeleteLinkedDocModal"
    v-model="showDeleteLinkedDocModal"
    :doctype="'CRM Deal'"
    :docname="dealId"
    name="Deals"
  />
  <LostReasonModal
    v-if="showLostReasonModal"
    v-model="showLostReasonModal"
    doctype="CRM Deal"
    :document="document"
  />
  <!-- F6 (P-D13): модалка объединения дублей. -->
  <MergeDealModal
    v-if="showMergeModal"
    v-model="showMergeModal"
    :deal="dealId"
    :dealTitle="title"
    @merged="onDealsMerged"
  />
</template>
<script setup>
import DeleteLinkedDocModal from '@/components/DeleteLinkedDocModal.vue'
import ErrorPage from '@/components/ErrorPage.vue'
import Icon from '@/components/Icon.vue'
import Resizer from '@/components/Resizer.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import Email2Icon from '@/components/Icons/Email2Icon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import TelegramIcon from '@/components/Icons/TelegramIcon.vue'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import LinkIcon from '@/components/Icons/LinkIcon.vue'
import ArrowUpRightIcon from '@/components/Icons/ArrowUpRightIcon.vue'
import SuccessIcon from '@/components/Icons/SuccessIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import Activities from '@/components/Activities/Activities.vue'
import OrganizationModal from '@/components/Modals/OrganizationModal.vue'
import LostReasonModal from '@/components/Modals/LostReasonModal.vue'
import AssignTo from '@/components/AssignTo.vue'
import FilesUploader from '@/components/FilesUploader/FilesUploader.vue'
import ContactModal from '@/components/Modals/ContactModal.vue'
import MergeDealModal from '@/components/Modals/MergeDealModal.vue'
import Link from '@/components/Controls/Link.vue'
import Section from '@/components/Section.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import DealStageBar from '@/components/DealStageBar.vue'
import SLASection from '@/components/SLASection.vue'
import CustomActions from '@/components/CustomActions.vue'
import {
  openWebsite,
  setupCustomizations,
  copyToClipboard,
  isTranslatable,
} from '@/utils'
import { getView } from '@/utils/view'
import { formatPhoneDisplay, normalizePhoneToDigits } from '@/utils/ruFormat'
import { napi } from '@/utils/api'
import { getSettings } from '@/stores/settings'
import { globalStore } from '@/stores/global'
import { statusesStore } from '@/stores/statuses'
import { getMeta } from '@/stores/meta'
import { useDocument } from '@/data/document'
import { whatsappEnabled } from '@/composables/whatsapp'
import { callEnabled } from '@/composables/telephony'
import { useBroadcast } from '@/composables/useBroadcast'
import {
  createResource,
  Dropdown,
  Tooltip,
  Avatar,
  Tabs,
  Breadcrumbs,
  FeatherIcon,
  FileUploader,
  call,
  usePageMeta,
  toast,
} from 'frappe-ui'
import { useOnboarding } from 'frappe-ui/frappe'
import {
  ref,
  computed,
  h,
  onMounted,
  onBeforeUnmount,
  nextTick,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useActiveTabManager } from '@/composables/useActiveTabManager'

const { on } = useBroadcast()
const { brand } = getSettings()
const { $dialog, $socket, makeCall } = globalStore()
const { statusOptions, getDealStatus } = statusesStore()
const { doctypeMeta } = getMeta('CRM Deal')

const { updateOnboardingStep, isOnboardingStepsCompleted } =
  useOnboarding('frappecrm')

const route = useRoute()
const router = useRouter()

const props = defineProps({
  dealId: { type: String, required: true },
  // I10: карточка рендерится внутри right-slide-over (без перехода на страницу).
  embedded: { type: Boolean, default: false },
})

const errorTitle = ref('')
const errorMessage = ref('')
const showDeleteLinkedDocModal = ref(false)

const {
  triggerOnChange,
  triggerOnRender,
  assignees,
  permissions,
  document,
  scripts,
  error,
} = useDocument('CRM Deal', props.dealId)

const canDelete = computed(() => permissions.data?.permissions?.delete || false)

const doc = computed(() => document.doc || {})

watch(error, (err) => {
  if (err) {
    errorTitle.value = __(
      err.exc_type == 'DoesNotExistError'
        ? 'Document Not Found'
        : 'Error Occurred',
    )
    errorMessage.value = __(err.messages?.[0] || 'An Error Occurred')
  } else {
    errorTitle.value = ''
    errorMessage.value = ''
  }
})

watch(
  () => document.doc,
  async (_doc) => {
    if (scripts.data?.length) {
      let s = await setupCustomizations(scripts.data, {
        doc: _doc,
        $dialog,
        $socket,
        router,
        toast,
        updateField,
        createToast: toast.create,
        deleteDoc: deleteDeal,
        call,
      })
      document._actions = s.actions || []
      document._statuses = s.statuses || []
    }
  },
  { once: true },
)

const organizationDocument = ref(null)

watch(
  () => doc.value.organization,
  (org) => {
    if (org && !organizationDocument.value?.doc) {
      let { document: _organizationDocument } = useDocument(
        'CRM Organization',
        org,
      )
      organizationDocument.value = _organizationDocument
    }
  },
  { immediate: true },
)

const organization = computed(() => organizationDocument.value?.doc || {})

onMounted(async () => {
  $socket.on('crm_customer_created', () => {
    toast.success(__('Customer Created Successfully'))
  })
  if (document.doc) await triggerOnRender()
  checkTgChat()
})

onBeforeUnmount(() => {
  $socket.off('crm_customer_created')
})

const reload = ref(false)
// P-D8: есть ли по этой сделке переписка в мессенджерах (Telegram). Если да —
// клик по TG-логину контакта открывает чат ВНУТРИ карточки (вкладка «Мессенджеры»),
// иначе ведёт на внешний t.me. Проверяем лёгким get_messages при загрузке сделки.
const hasTgChat = ref(false)
const showOrganizationModal = ref(false)
const showFilesUploader = ref(false)
const showMergeModal = ref(false)
const _organization = ref({})

// F6 (P-D13): пункты меню действий сделки в шапке. Пока единственный — «Объединить».
const dealActions = computed(() => [
  {
    label: __('Объединить'),
    icon: 'git-merge',
    onClick: () => (showMergeModal.value = true),
  },
])

// после успешного merge: бэкенд перенёс связи на текущую (primary) сделку —
// перечитать документ, секции, контакты и активности, чтобы карточка обновилась.
function onDealsMerged() {
  document.reload?.()
  sections.reload()
  dealContacts.reload()
  reloadResources({})
  activities.value?.all_activities?.reload?.()
}

// F5 (P-D14): запись поля организации (ИНН / карта партнёра) через setValue
// (как в Organization.vue). После сохранения локально обновляем organization.doc.
function saveOrgField(field, value) {
  const orgDoc = organizationDocument.value
  if (!orgDoc?.doc) return
  if ((orgDoc.doc[field] || '') === (value || '')) return
  // оптимистично обновляем локальную копию (для мгновенной перерисовки ссылки/ИНН);
  // setValue.onSuccess/onError (default из useDocument) покажет toast «обновлено»/ошибку.
  orgDoc.doc[field] = value
  orgDoc.setValue.submit({ [field]: value })
}

// имя файла «Карта партнёра» из file_url (последний сегмент пути) для подписи ссылки.
const partnerCardName = computed(() => {
  const url = organization.value?.nacifrah_partner_card
  if (!url) return ''
  try {
    return decodeURIComponent(String(url).split('/').pop()) || url
  } catch {
    return url
  }
})

const breadcrumbs = computed(() => {
  let items = [{ label: __('Deals'), route: { name: 'Deals' } }]

  if (route.query.view || route.query.viewType) {
    let view = getView(route.query.view, route.query.viewType, 'CRM Deal')
    if (view) {
      items.push({
        label: __(view.label),
        icon: view.icon,
        route: {
          name: 'Deals',
          params: { viewType: route.query.viewType },
          query: { view: route.query.view },
        },
      })
    }
  }

  items.push({
    label: title.value,
    route: { name: 'Deal', params: { dealId: props.dealId } },
  })
  return items
})

const title = computed(() => {
  // NACIFRAH (заказчик, п.11): имя сделки = организация; если title_field/организация
  // пусты — показываем organization_name (Data), и лишь в крайнем случае тех.код.
  let t = doctypeMeta.value?.title_field || 'name'
  return (
    doc.value?.[t] ||
    doc.value?.organization ||
    doc.value?.organization_name ||
    props.dealId
  )
})

const statuses = computed(() => {
  let customStatuses = document.statuses?.length
    ? document.statuses
    : document._statuses || []
  return statusOptions('deal', customStatuses, triggerStatusChange)
})

usePageMeta(() => {
  return {
    title: title.value,
    icon: brand.favicon,
  }
})

const tabs = computed(() => {
  let tabOptions = [
    {
      name: 'Activity',
      label: __('Activity'),
      icon: ActivityIcon,
    },
    {
      name: 'Emails',
      label: __('Emails'),
      icon: EmailIcon,
    },
    {
      name: 'Comments',
      label: __('Comments'),
      icon: CommentIcon,
    },
    {
      name: 'Data',
      label: __('Data'),
      icon: DetailsIcon,
    },
    {
      name: 'Calls',
      label: __('Calls'),
      icon: PhoneIcon,
    },
    {
      name: 'Tasks',
      label: __('Tasks'),
      icon: TaskIcon,
    },
    {
      name: 'Notes',
      label: __('Notes'),
      icon: NoteIcon,
    },
    {
      name: 'Attachments',
      label: __('Attachments'),
      icon: AttachmentIcon,
    },
    {
      name: 'WhatsApp',
      label: __('WhatsApp'),
      icon: WhatsAppIcon,
      condition: () => whatsappEnabled.value,
    },
    {
      name: 'Telegram',
      label: __('Мессенджеры'),
      icon: TelegramIcon,
    },
  ]
  return tabOptions.filter((tab) => (tab.condition ? tab.condition() : true))
})

const { tabIndex } = useActiveTabManager(tabs, 'lastDealTab')

const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  params: { doctype: 'CRM Deal' },
  transform: (data) => getParsedSections(data),
})

on('reload-deal-sections', () => sections.reload())

if (!sections.data) sections.fetch()

function getParsedSections(_sections) {
  _sections.forEach((section) => {
    if (section.name == 'contacts_section') return
    section.columns[0].fields.forEach((field) => {
      if (field.fieldname == 'organization') {
        field.create = (value, close) => {
          _organization.value.organization_name = value
          showOrganizationModal.value = true
          close()
        }
        field.link = (org) =>
          router.push({
            name: 'Organization',
            params: { organizationId: org },
          })
      }
    })
  })
  return _sections
}

const showContactModal = ref(false)
const _contact = ref({})

function contactOptions(contact) {
  let options = [
    {
      label: __('Remove'),
      icon: 'trash-2',
      onClick: () => removeContact(contact.name),
    },
  ]

  if (!contact.is_primary) {
    options.push({
      label: __('Set as Primary Contact'),
      icon: h(SuccessIcon, { class: 'h-4 w-4' }),
      onClick: () => setPrimaryContact(contact.name),
    })
  }

  return options
}

async function addContact(contact) {
  if (dealContacts.data?.find((c) => c.name === contact)) {
    toast.error(__('Contact Already Added'))
    return
  }

  let d = await call('crm.fcrm.doctype.crm_deal.crm_deal.add_contact', {
    deal: props.dealId,
    contact,
  })
  if (d) {
    dealContacts.reload()
    toast.success(__('Contact Added'))
  }
}

async function removeContact(contact) {
  let d = await call('crm.fcrm.doctype.crm_deal.crm_deal.remove_contact', {
    deal: props.dealId,
    contact,
  })
  if (d) {
    dealContacts.reload()
    toast.success(__('Contact Removed'))
  }
}

async function setPrimaryContact(contact) {
  let d = await call('crm.fcrm.doctype.crm_deal.crm_deal.set_primary_contact', {
    deal: props.dealId,
    contact,
  })
  if (d) {
    dealContacts.reload()
    toast.success(__('Primary Contact Set'))
  }
}

const dealContacts = createResource({
  url: 'crm.fcrm.doctype.crm_deal.api.get_deal_contacts',
  params: { name: props.dealId },
  cache: ['deal_contacts', props.dealId],
  transform: (data) => {
    data.forEach((contact) => {
      contact.opened = false
    })
    return data
  },
})

if (!dealContacts.data) dealContacts.fetch()

function triggerCall() {
  let primaryContact = dealContacts.data?.find((c) => c.is_primary)
  let mobile_no = primaryContact.mobile_no || null

  if (!primaryContact) {
    toast.error(__('No Primary Contact Set'))
    return
  }

  if (!mobile_no) {
    toast.error(__('No Mobile Number Set'))
    return
  }

  makeCall(mobile_no)
}

// ── P-D10: кликабельные поля контакта ────────────────────────────────────
// Список телефонов контакта: mobile_no + все Contact.phone_nos (без дублей).
function contactPhones(contact) {
  let list = []
  if (contact.mobile_no) list.push(contact.mobile_no)
  ;(contact.phone_nos || []).forEach((p) => {
    if (p && !list.includes(p)) list.push(p)
  })
  return list
}

// Список e-mail контакта: основной email_id + все Contact.email_ids (без дублей).
function contactEmails(contact) {
  let list = []
  if (contact.email) list.push(contact.email)
  ;(contact.email_ids || []).forEach((e) => {
    if (e && !list.includes(e)) list.push(e)
  })
  return list
}

function onlyDigits(s) {
  return normalizePhoneToDigits(s)
}

// Telegram-логин без ведущего @ (хранится как «login» или «@login»).
function tgLogin(value) {
  return String(value || '').replace(/^@+/, '')
}

// P-D8: индекс вкладки «Мессенджеры» (name == 'Telegram', label «Мессенджеры»).
const messengersTabIndex = computed(() =>
  tabs.value.findIndex((t) => t.name === 'Telegram'),
)

// Переключить активную вкладку карточки на «Мессенджеры» (открыть переписку in-place).
function openMessengersTab() {
  const idx = messengersTabIndex.value
  if (idx >= 0) tabIndex.value = idx
}

// P-D8: тихо проверяем наличие переписки по сделке (та же сигнатура, что в
// TelegramChat.vue). Непустой список → hasTgChat=true. Любая ошибка/настройка не
// выполнена → false (не ломаем карточку).
async function checkTgChat() {
  try {
    const msgs = await call(napi('telegram.get_messages'), {
      reference_doctype: 'CRM Deal',
      reference_name: props.dealId,
    })
    hasTgChat.value = Array.isArray(msgs) && msgs.length > 0
  } catch (e) {
    hasTgChat.value = false
  }
}

// Звонок: если включена телефонная интеграция — через неё (makeCall),
// иначе системный tel: (как в карточке сотрудника).
function callNumber(number) {
  if (!number) return
  if (callEnabled.value) {
    makeCall(number)
  } else {
    window.location.href = `tel:+${onlyDigits(number)}`
  }
}

// Написать письмо конкретному адресату: открыть нативный email-box и подставить
// адрес; если box недоступен — fallback на mailto:.
function writeEmail(email) {
  if (!email) return
  try {
    openEmailBox()
    nextTick(() => {
      let editor = activities.value?.emailBox?.editor
      if (editor) {
        editor.toEmails = [email]
      } else {
        window.location.href = `mailto:${email}`
      }
    })
  } catch (e) {
    window.location.href = `mailto:${email}`
  }
}

function copyText(value) {
  if (!value) return
  copyToClipboard(value)
}

async function triggerStatusChange(value) {
  await triggerOnChange('status', value)
  setLostReason()
}

function updateField(name, value) {
  if (name == 'status' && !isOnboardingStepsCompleted.value) {
    updateOnboardingStep('change_deal_status')
  }

  value = Array.isArray(name) ? '' : value
  let oldValues = Array.isArray(name) ? {} : doc.value[name]

  if (Array.isArray(name)) {
    name.forEach((field) => (doc.value[field] = value))
  } else {
    doc.value[name] = value
  }

  document.save.submit(null, {
    onSuccess: () => (reload.value = true),
    onError: (err) => {
      if (Array.isArray(name)) {
        name.forEach((field) => (doc.value[field] = oldValues[field]))
      } else {
        doc.value[name] = oldValues
      }
      toast.error(err.messages?.[0] || __('Error updating field'))
    },
  })
}

function deleteDeal() {
  showDeleteLinkedDocModal.value = true
}

const activities = ref(null)

function openEmailBox() {
  let currentTab = tabs.value[tabIndex.value]
  if (!['Emails', 'Comments', 'Activities'].includes(currentTab.name)) {
    activities.value.changeTabTo('emails')
  }
  nextTick(() => (activities.value.emailBox.show = true))
}

function statusLabel(status) {
  if (isTranslatable('CRM Deal Status')) return __(status)
  return status
}

const showLostReasonModal = ref(false)

function setLostReason() {
  if (
    getDealStatus(document.doc.status).type !== 'Lost' ||
    (document.doc.lost_reason && document.doc.lost_reason !== 'Other') ||
    (document.doc.lost_reason === 'Other' && document.doc.lost_notes)
  ) {
    document.save.submit(null, {
      onSuccess: () => sections.reload(),
    })
    return
  }

  showLostReasonModal.value = true
}

function beforeStatusChange(data) {
  if (
    Object.hasOwn(data ?? {}, 'status') &&
    getDealStatus(data.status).type == 'Lost'
  ) {
    setLostReason()
  } else {
    document.save.submit(null, {
      onSuccess: () => reloadResources(data),
    })
  }
}

function reloadResources(data) {
  if (Object.hasOwn(data ?? {}, 'deal_owner')) {
    assignees.reload()
  }
  if (
    Object.hasOwn(data ?? {}, 'status') &&
    getDealStatus(data.status).type != 'Lost'
  ) {
    sections.reload()
  }
}

// F4: после смены этапа/переноса воронки (DealStageBar) — перечитать сам документ
// (бэкенд мог поменять status/nacifrah_funnel/nacifrah_funnel_stage + won→project)
// и боковые секции, чтобы шапка/поля карточки отразили новое состояние.
function onStageBarChanged() {
  document.reload?.()
  sections.reload()
}
</script>
