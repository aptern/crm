<template>
  <div
    class="relative flex h-full flex-col justify-between transition-all duration-300 ease-in-out"
    :class="isSidebarCollapsed ? 'w-12' : 'w-[220px]'"
  >
    <div class="p-2">
      <UserDropdown :isCollapsed="isSidebarCollapsed" />
    </div>
    <div class="flex-1 overflow-y-auto">
      <div class="flex flex-col">
        <SidebarLink
          id="notifications-btn"
          :label="__('Notifications')"
          :icon="NotificationsIcon"
          :isCollapsed="isSidebarCollapsed"
          class="relative mx-2 my-[1.5px]"
          @click="() => toggleNotificationPanel()"
        >
          <template #right>
            <Badge
              v-if="!isSidebarCollapsed && unreadNotificationsCount"
              :label="unreadNotificationsCount"
              variant="subtle"
            />
            <div
              v-else-if="unreadNotificationsCount"
              class="absolute -left-1.5 top-1 z-20 h-[5px] w-[5px] translate-x-6 translate-y-1 rounded-full bg-surface-gray-6 ring-1 ring-white"
            />
          </template>
        </SidebarLink>
      </div>
      <div class="flex flex-col">
        <!-- A1: кастом-пункты меню — перетаскивание за ручку (наведи), порядок сохраняется -->
        <Draggable
          :list="orderedCustomNav"
          item-key="id"
          handle=".nav-grip"
          :disabled="isSidebarCollapsed"
          class="flex flex-col"
          @end="onNavReorder"
        >
          <template #item="{ element: it }">
            <div class="group/nav relative flex items-center">
              <span
                v-if="!isSidebarCollapsed"
                class="nav-grip absolute -left-0.5 z-10 hidden cursor-grab text-ink-gray-4 group-hover/nav:block active:cursor-grabbing"
                :title="__('Перетащить')"
              >
                <FeatherIcon name="menu" class="h-3 w-3" />
              </span>
              <!-- A1.2: блок «Воронки» — перетаскивается ЦЕЛИКОМ как один элемент меню -->
              <div
                v-if="it.isFunnelsBlock"
                class="mx-2 my-1.5 w-full rounded-lg bg-surface-gray-2 p-1"
              >
                <div
                  v-if="!isSidebarCollapsed"
                  class="px-2 pb-0.5 pt-1 text-xs font-semibold uppercase text-ink-gray-5"
                >
                  {{ __('Воронки') }}
                </div>
                <!-- A1.3: порядок воронок меняется внутри блока (своя ручка) -->
                <Draggable
                  :list="orderedFunnels"
                  item-key="id"
                  handle=".funnel-grip"
                  :disabled="isSidebarCollapsed"
                  class="flex flex-col"
                  @end="onFunnelsReorder"
                >
                  <template #item="{ element: fn }">
                    <div class="group/fnl relative flex items-center">
                      <span
                        v-if="!isSidebarCollapsed"
                        class="funnel-grip absolute -left-0.5 z-10 hidden cursor-grab text-ink-gray-4 group-hover/fnl:block active:cursor-grabbing"
                        :title="__('Перетащить')"
                      >
                        <FeatherIcon name="menu" class="h-3 w-3" />
                      </span>
                      <SidebarLink
                        :label="__(fn.label)"
                        :to="fn.to"
                        :isCollapsed="isSidebarCollapsed"
                        class="my-[1.5px] w-full"
                      >
                        <template #icon>
                          <FeatherIcon
                            v-if="typeof fn.icon === 'string'"
                            :name="fn.icon"
                            class="h-4 w-4"
                          />
                          <component :is="fn.icon" v-else class="h-4 w-4" />
                        </template>
                      </SidebarLink>
                    </div>
                  </template>
                </Draggable>
                <!-- «Параметры воронок» — всегда внизу блока -->
                <SidebarLink
                  v-if="isManager()"
                  :label="__('Параметры воронок')"
                  :to="{ name: 'Funnels' }"
                  :isCollapsed="isSidebarCollapsed"
                  class="my-[1.5px] text-ink-gray-6"
                >
                  <template #icon>
                    <FeatherIcon name="sliders" class="h-4 w-4" />
                  </template>
                </SidebarLink>
              </div>
              <!-- обычный кастом-пункт -->
              <SidebarLink
                v-else
                :label="__(it.label)"
                :to="it.to"
                :isCollapsed="isSidebarCollapsed"
                class="mx-2 my-[1.5px] w-full"
              >
                <template #icon>
                  <FeatherIcon :name="it.icon" class="h-4 w-4" />
                </template>
              </SidebarLink>
            </div>
          </template>
        </Draggable>
        <button
          v-if="isManager() && !isSidebarCollapsed"
          class="mx-2 mb-0.5 self-start text-left text-[11px] text-ink-gray-4 hover:text-ink-gray-6"
          @click="applyMenuToAll"
        >
          {{ __('Применить порядок меню для всех') }}
        </button>
      </div>
      <div v-for="view in allViews" :key="view.label">
        <div class="mx-2 my-1.5" />
        <Section
          :label="view.name"
          :hideLabel="view.hideLabel"
          :opened="view.opened"
        >
          <template #header="{ opened, hide, toggle }">
            <div
              v-if="!hide"
              class="flex items-center cursor-pointer gap-1.5 text-base text-ink-gray-5 transition-all duration-300 ease-in-out"
              :class="
                isSidebarCollapsed
                  ? 'h-0 overflow-hidden opacity-0'
                  : 'px-4 pt-[11px] pb-2.5 w-auto opacity-100'
              "
              @click="toggle()"
            >
              <FeatherIcon
                name="chevron-right"
                class="h-4 text-ink-gray-9 transition-all duration-300 ease-in-out"
                :class="{ 'rotate-90': opened }"
              />
              <span>{{ __(view.name) }}</span>
            </div>
          </template>
          <nav class="flex flex-col">
            <!-- A1-остаток: стандартные разделы (Контакты/Заметки/Звонки/Дашборд…)
                 перетаскиваются за ручку, порядок сохраняется per-user. -->
            <Draggable
              v-if="view.name === 'All Views'"
              :list="orderedStdViews"
              item-key="label"
              handle=".nav-grip"
              :disabled="isSidebarCollapsed"
              class="flex flex-col"
              @end="onStdReorder"
            >
              <template #item="{ element: link }">
                <div class="group/nav relative flex items-center">
                  <span
                    v-if="!isSidebarCollapsed"
                    class="nav-grip absolute -left-0.5 z-10 hidden cursor-grab text-ink-gray-4 group-hover/nav:block active:cursor-grabbing"
                    :title="__('Перетащить')"
                  >
                    <FeatherIcon name="menu" class="h-3 w-3" />
                  </span>
                  <SidebarLink
                    :icon="link.icon"
                    :label="__(link.label)"
                    :to="link.to"
                    :isCollapsed="isSidebarCollapsed"
                    class="mx-2 my-[1.5px] w-full"
                  />
                </div>
              </template>
            </Draggable>
            <template v-else>
              <SidebarLink
                v-for="link in view.views"
                :key="link.label"
                :icon="link.icon"
                :label="__(link.label)"
                :to="link.to"
                :isCollapsed="isSidebarCollapsed"
                class="mx-2 my-[1.5px]"
              />
            </template>
          </nav>
        </Section>
      </div>
    </div>
    <div class="m-2 flex flex-col gap-1">
      <div class="flex flex-col gap-2 mb-1">
        <SalesHierarchyBanner
          v-if="showSalesHierarchyBanner"
          :isSidebarCollapsed="isSidebarCollapsed"
        />
        <SignupBanner
          v-if="isDemoSite"
          :isSidebarCollapsed="isSidebarCollapsed"
          :afterSignup="() => capture('signup_from_demo_site')"
        />
        <TrialBanner
          v-if="isFCSite"
          :isSidebarCollapsed="isSidebarCollapsed"
          :afterUpgrade="() => capture('upgrade_plan_from_trial_banner')"
        />
        <GettingStartedBanner
          v-if="!isOnboardingStepsCompleted"
          :isSidebarCollapsed="isSidebarCollapsed"
        />
      </div>
      <SidebarLink
        v-if="isManager() && isDemoDataCreated"
        class="text-ink-red-3 hover:bg-surface-red-2 focus:bg-surface-red-2"
        :label="__('Clear Demo Data')"
        :isCollapsed="isSidebarCollapsed"
        @click="() => clearDemoData()"
      >
        <template #icon>
          <BrushCleaningIcon class="h-4 w-4" />
        </template>
      </SidebarLink>
      <SidebarLink
        v-if="isManager()"
        :label="__('Настройки')"
        :isCollapsed="isSidebarCollapsed"
        @click="showSettings = true"
      >
        <template #icon>
          <FeatherIcon name="settings" class="h-4 w-4" />
        </template>
      </SidebarLink>
      <SidebarLink
        v-if="isOnboardingStepsCompleted"
        :label="__('Help')"
        :isCollapsed="isSidebarCollapsed"
        @click="
          () => {
            showHelpModal = minimize ? true : !showHelpModal
            minimize = !showHelpModal
          }
        "
      >
        <template #icon>
          <HelpIcon class="h-4 w-4" />
        </template>
      </SidebarLink>
      <SidebarLink
        :label="isSidebarCollapsed ? __('Expand') : __('Collapse')"
        :isCollapsed="isSidebarCollapsed"
        class=""
        @click="isSidebarCollapsed = !isSidebarCollapsed"
      >
        <template #icon>
          <span class="grid h-4 w-4 flex-shrink-0 place-items-center">
            <CollapseSidebar
              class="h-4 w-4 text-ink-gray-7 duration-300 ease-in-out"
              :class="{ '[transform:rotateY(180deg)]': isSidebarCollapsed }"
            />
          </span>
        </template>
      </SidebarLink>
    </div>
    <Notifications />
    <Settings />
    <HelpModal
      v-if="showHelpModal"
      v-model="showHelpModal"
      v-model:articles="articles"
      :logo="CRMLogo"
      :afterSkip="(step) => capture('onboarding_step_skipped_' + step)"
      :afterSkipAll="() => capture('onboarding_steps_skipped')"
      :afterReset="(step) => capture('onboarding_step_reset_' + step)"
      :afterResetAll="() => capture('onboarding_steps_reset')"
      docsLink="https://docs.frappe.io/crm"
    />
    <IntermediateStepModal
      v-model="showIntermediateModal"
      :currentStep="currentStep"
    />
  </div>
</template>

<script setup>
import BrushCleaningIcon from '~icons/lucide/brush-cleaning'
import LucideLayoutDashboard from '~icons/lucide/layout-dashboard'
import CRMLogo from '@/components/Icons/CRMLogo.vue'
import InviteIcon from '@/components/Icons/InviteIcon.vue'
import ConvertIcon from '@/components/Icons/ConvertIcon.vue'
import CommentIcon from '@/components/Icons/CommentIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import StepsIcon from '@/components/Icons/StepsIcon.vue'
import Section from '@/components/Section.vue'
import PinIcon from '@/components/Icons/PinIcon.vue'
import UserDropdown from '@/components/UserDropdown.vue'
import SquareAsterisk from '@/components/Icons/SquareAsterisk.vue'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import DealsIcon from '@/components/Icons/DealsIcon.vue'
import ContactsIcon from '@/components/Icons/ContactsIcon.vue'
import OrganizationsIcon from '@/components/Icons/OrganizationsIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import CollapseSidebar from '@/components/Icons/CollapseSidebar.vue'
import NotificationsIcon from '@/components/Icons/NotificationsIcon.vue'
import HelpIcon from '@/components/Icons/HelpIcon.vue'
import SidebarLink from '@/components/SidebarLink.vue'
import Notifications from '@/components/Notifications.vue'
import Settings from '@/components/Settings/Settings.vue'
import SalesHierarchyBanner from '@/components/SalesHierarchyBanner.vue'
import { viewsStore } from '@/stores/views'
import {
  unreadNotificationsCount,
  notificationsStore,
} from '@/stores/notifications'
import { usersStore } from '@/stores/users'
import { sessionStore } from '@/stores/session'
import { showSettings, activeSettingsPage } from '@/composables/settings'
import { showChangePasswordModal } from '@/composables/modals'
import { useBroadcast } from '@/composables/useBroadcast.js'
import { FeatherIcon, call, toast } from 'frappe-ui'
import Draggable from 'vuedraggable'
import {
  SignupBanner,
  TrialBanner,
  HelpModal,
  GettingStartedBanner,
  useOnboarding,
  showHelpModal,
  minimize,
  IntermediateStepModal,
  useTelemetry,
} from 'frappe-ui/frappe'
import router from '@/router'
import { useStorage } from '@vueuse/core'
import { useDemoData } from '@/composables/demoData'
import { ref, reactive, computed, markRaw, onMounted } from 'vue'

const { getPinnedViews, getPublicViews } = viewsStore()
const { toggle: toggleNotificationPanel } = notificationsStore()
const { capture } = useTelemetry()
const { clearDemoData, isDemoDataCreated } = useDemoData()
const { send } = useBroadcast()

const isSidebarCollapsed = useStorage('isSidebarCollapsed', false)

const isFCSite = ref(window.is_fc_site)
const isDemoSite = ref(window.is_demo_site)
const showSalesHierarchyBanner = ref(!!window.show_sales_hierarchy_banner)

const links = [
  {
    label: 'Dashboard',
    icon: LucideLayoutDashboard,
    to: 'Dashboard',
  },
  {
    label: 'Leads',
    icon: LeadsIcon,
    to: 'Leads',
  },
  {
    label: 'Deals',
    icon: DealsIcon,
    to: 'Deals',
  },
  {
    label: 'Contacts',
    icon: ContactsIcon,
    to: 'Contacts',
  },
  {
    label: 'Organizations',
    icon: OrganizationsIcon,
    to: 'Organizations',
  },
  {
    label: 'Notes',
    icon: NoteIcon,
    to: 'Notes',
  },
  {
    label: 'Tasks',
    icon: TaskIcon,
    to: 'Tasks',
  },
  {
    label: 'Call Logs',
    icon: PhoneIcon,
    to: 'Call Logs',
  },
]

const allViews = computed(() => {
  let _views = [
    {
      name: 'All Views',
      hideLabel: true,
      opened: true,
      views: links.filter((link) => {
        // E2: Лиды/Сделки вынесены в выделенный блок «Воронки» выше
        if (link.label === 'Leads' || link.label === 'Deals') return false
        if (link.condition) {
          return link.condition()
        }
        return true
      }),
    },
  ]
  if (getPublicViews().length) {
    _views.push({
      name: 'Public Views',
      opened: true,
      views: parseView(getPublicViews()),
    })
  }

  if (getPinnedViews().length) {
    _views.push({
      name: 'Pinned Views',
      opened: true,
      views: parseView(getPinnedViews()),
    })
  }
  return _views
})

function parseView(views) {
  return views.map((view) => {
    return {
      label: view.label,
      icon: getIcon(view.route_name, view.icon),
      to: {
        name: view.route_name,
        params: { viewType: view.type || 'list' },
        query: { view: view.name },
      },
    }
  })
}

function getIcon(routeName, icon) {
  if (icon) return icon

  switch (routeName) {
    case 'Leads':
      return LeadsIcon
    case 'Deals':
      return DealsIcon
    case 'Contacts':
      return ContactsIcon
    case 'Organizations':
      return OrganizationsIcon
    case 'Notes':
      return NoteIcon
    case 'Call Logs':
      return PhoneIcon
    default:
      return PinIcon
  }
}

// onboarding
const { user } = sessionStore()
const { users, isManager } = usersStore()

// A1: перетаскивание кастом-пунктов меню, порядок сохраняется per-user (+ админ для всех).
const _allCustomNav = [
  { id: 'Projects', label: 'Проекты', to: { name: 'Projects' }, icon: 'folder' },
  { id: 'KnowledgeBase', label: 'База знаний', to: { name: 'KnowledgeBase' }, icon: 'book-open' },
  // A1.2: блок «Воронки» — единый перетаскиваемый элемент среди пунктов меню
  { id: 'Funnels', isFunnelsBlock: true },
  { id: 'Employees', label: 'Сотрудники', to: { name: 'Employees' }, icon: 'users', managerOnly: true },
  { id: 'Departments', label: 'Отделы', to: { name: 'Departments' }, icon: 'git-merge', managerOnly: true },
  { id: 'Permissions', label: 'Права доступа', to: { name: 'Permissions' }, icon: 'shield', managerOnly: true },
]
// A1.3: порядок воронок внутри блока (Лиды/Сделки + будущие кастомные); «Параметры» закреплены внизу
const FUNNELS_ORDER_KEY = 'nacifrah_funnels_order'
const _nativeFunnels = [
  { id: 'Leads', label: 'Лиды', to: { name: 'Leads' }, icon: LeadsIcon },
  { id: 'Deals', label: 'Сделки', to: { name: 'Deals' }, icon: DealsIcon },
]
// E1: пользовательские воронки подгружаются и встают в этот же перетаскиваемый список
const customFunnelItems = ref([])
const funnelsOrder = ref([])
const orderedFunnels = ref([])
function _rebuildFunnels() {
  const all = [..._nativeFunnels, ...customFunnelItems.value]
  const pos = (id) => {
    const i = funnelsOrder.value.indexOf(id)
    return i === -1 ? 999 : i
  }
  orderedFunnels.value = all.sort((a, b) => pos(a.id) - pos(b.id))
}
async function _loadCustomFunnels() {
  try {
    const list = (await call('nacifrah.api.list_funnels_admin')) || []
    customFunnelItems.value = list.map((f) => ({
      id: 'F::' + f.name,
      label: f.funnel_name,
      to: { name: 'CustomFunnel', params: { name: f.name } },
      icon: f.icon || 'filter',
    }))
  } catch (e) {
    customFunnelItems.value = []
  }
}
_rebuildFunnels()
async function onFunnelsReorder() {
  const order = orderedFunnels.value.map((it) => it.id)
  funnelsOrder.value = order
  try {
    await call('nacifrah.menu.set_menu_order', {
      order: JSON.stringify(order),
      scope: 'me',
      key: FUNNELS_ORDER_KEY,
    })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось сохранить порядок воронок'))
  }
}
const menuOrder = ref([])
const orderedCustomNav = ref([])
function _rebuildNav() {
  const avail = _allCustomNav.filter((it) => !it.managerOnly || isManager())
  const pos = (id) => {
    const i = menuOrder.value.indexOf(id)
    return i === -1 ? 999 : i
  }
  orderedCustomNav.value = [...avail].sort((a, b) => pos(a.id) - pos(b.id))
}

// A1-остаток: перетаскивание СТАНДАРТНЫХ разделов (Контакты/Заметки/Звонки/Дашборд…)
// в секции «All Views». Порядок хранится отдельным ключом per-user.
const STD_VIEWS_ORDER_KEY = 'nacifrah_stdviews_order'
const stdOrder = ref([])
const orderedStdViews = ref([])
function _rebuildStdViews() {
  const avail = links.filter((link) => {
    // Лиды/Сделки живут в выделенном блоке «Воронки» — здесь их нет.
    if (link.label === 'Leads' || link.label === 'Deals') return false
    if (link.condition) return link.condition()
    return true
  })
  const pos = (label) => {
    const i = stdOrder.value.indexOf(label)
    return i === -1 ? 999 : i
  }
  orderedStdViews.value = [...avail].sort((a, b) => pos(a.label) - pos(b.label))
}
async function onStdReorder() {
  const order = orderedStdViews.value.map((it) => it.label)
  stdOrder.value = order
  try {
    await call('nacifrah.menu.set_menu_order', {
      order: JSON.stringify(order),
      scope: 'me',
      key: STD_VIEWS_ORDER_KEY,
    })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось сохранить порядок меню'))
  }
}

// Заполняем сразу (дефолтный порядок), чтобы не было мигания пустой навигации
// до загрузки сохранённого порядка в onMounted.
_rebuildStdViews()

onMounted(async () => {
  try {
    const r = await call('nacifrah.menu.get_menu_order')
    menuOrder.value = r?.order || []
  } catch (e) {
    menuOrder.value = []
  }
  _rebuildNav()
  try {
    const r2 = await call('nacifrah.menu.get_menu_order', { key: STD_VIEWS_ORDER_KEY })
    stdOrder.value = r2?.order || []
  } catch (e) {
    stdOrder.value = []
  }
  _rebuildStdViews()
  try {
    const r3 = await call('nacifrah.menu.get_menu_order', { key: FUNNELS_ORDER_KEY })
    funnelsOrder.value = r3?.order || []
  } catch (e) {
    funnelsOrder.value = []
  }
  await _loadCustomFunnels()
  _rebuildFunnels()
})
async function onNavReorder() {
  const order = orderedCustomNav.value.map((it) => it.id)
  menuOrder.value = order
  try {
    await call('nacifrah.menu.set_menu_order', { order: JSON.stringify(order), scope: 'me' })
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось сохранить порядок меню'))
  }
}
async function applyMenuToAll() {
  const order = orderedCustomNav.value.map((it) => it.id)
  try {
    await call('nacifrah.menu.set_menu_order', { order: JSON.stringify(order), scope: 'all' })
    toast.success(__('Порядок меню применён для всех'))
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Не удалось применить для всех'))
  }
}
const { isOnboardingStepsCompleted, setUp } = useOnboarding('frappecrm')

async function getFirstLead() {
  let firstLead = localStorage.getItem('firstLead' + user)
  if (firstLead) return firstLead
  return await call('crm.api.onboarding.get_first_lead')
}

async function getFirstDeal() {
  let firstDeal = localStorage.getItem('firstDeal' + user)
  if (firstDeal) return firstDeal
  return await call('crm.api.onboarding.get_first_deal')
}

const showIntermediateModal = ref(false)
const currentStep = ref({})

const steps = reactive([
  {
    name: 'setup_your_password',
    title: __('Setup your password'),
    icon: markRaw(SquareAsterisk),
    completed: false,
    onClick: () => {
      minimize.value = true
      showChangePasswordModal.value = true
      capture('onboarding_step_clicked_setup_password')
    },
  },
  {
    name: 'create_first_lead',
    title: __('Create your first lead'),
    icon: markRaw(LeadsIcon),
    completed: false,
    onClick: () => {
      minimize.value = true
      router.push({ name: 'Leads' })
      send('trigger_lead_create', true)
      capture('onboarding_step_clicked_create_first_lead')
    },
  },
  {
    name: 'invite_your_team',
    title: __('Invite your team'),
    icon: markRaw(InviteIcon),
    completed: false,
    onClick: () => {
      minimize.value = true
      showSettings.value = true
      activeSettingsPage.value = 'Invite User'
      capture('onboarding_step_clicked_invite_your_team')
    },
    condition: () => isManager(),
  },
  {
    name: 'convert_lead_to_deal',
    title: __('Convert lead to deal'),
    icon: markRaw(ConvertIcon),
    completed: false,
    dependsOn: 'create_first_lead',
    onClick: async () => {
      minimize.value = true
      capture('onboarding_step_clicked_convert_lead_to_deal')
      currentStep.value = {
        title: __('Convert lead to deal'),
        buttonLabel: __('Convert'),
        videoURL: '/assets/crm/videos/convertToDeal.mov',
        onClick: async () => {
          showIntermediateModal.value = false
          currentStep.value = {}

          let lead = await getFirstLead()
          if (lead) {
            router.push({ name: 'Lead', params: { leadId: lead } })
          } else {
            router.push({ name: 'Leads' })
          }
        },
      }
      showIntermediateModal.value = true
    },
  },
  {
    name: 'create_first_task',
    title: __('Create your first task'),
    icon: markRaw(TaskIcon),
    completed: false,
    onClick: async () => {
      minimize.value = true
      let deal = await getFirstDeal()
      capture('onboarding_step_clicked_create_first_task')

      if (deal) {
        router.push({
          name: 'Deal',
          params: { dealId: deal },
          hash: '#tasks',
        })
      } else {
        router.push({ name: 'Tasks' })
      }
    },
  },
  {
    name: 'create_first_note',
    title: __('Create your first note'),
    icon: markRaw(NoteIcon),
    completed: false,
    onClick: async () => {
      minimize.value = true
      let deal = await getFirstDeal()
      capture('onboarding_step_clicked_create_first_note')

      if (deal) {
        router.push({
          name: 'Deal',
          params: { dealId: deal },
          hash: '#notes',
        })
      } else {
        router.push({ name: 'Notes' })
      }
    },
  },
  {
    name: 'add_first_comment',
    title: __('Add your first comment'),
    icon: markRaw(CommentIcon),
    completed: false,
    dependsOn: 'create_first_lead',
    onClick: async () => {
      minimize.value = true
      let deal = await getFirstDeal()
      capture('onboarding_step_clicked_add_first_comment')

      if (deal) {
        router.push({
          name: 'Deal',
          params: { dealId: deal },
          hash: '#comments',
        })
      } else {
        router.push({ name: 'Leads' })
      }
    },
  },
  {
    name: 'send_first_email',
    title: __('Send email'),
    icon: markRaw(EmailIcon),
    completed: false,
    dependsOn: 'create_first_lead',
    onClick: async () => {
      minimize.value = true
      let deal = await getFirstDeal()
      capture('onboarding_step_clicked_send_first_email')

      if (deal) {
        router.push({
          name: 'Deal',
          params: { dealId: deal },
          hash: '#emails',
        })
      } else {
        router.push({ name: 'Leads' })
      }
    },
  },
  {
    name: 'change_deal_status',
    title: __('Change deal status'),
    icon: markRaw(StepsIcon),
    completed: false,
    dependsOn: 'convert_lead_to_deal',
    onClick: async () => {
      minimize.value = true
      capture('onboarding_step_clicked_change_deal_status')

      currentStep.value = {
        title: __('Change deal status'),
        buttonLabel: __('Change'),
        videoURL: '/assets/crm/videos/changeDealStatus.mov',
        onClick: async () => {
          showIntermediateModal.value = false
          currentStep.value = {}

          let deal = await getFirstDeal()
          if (deal) {
            router.push({
              name: 'Deal',
              params: { dealId: deal },
              hash: '#activity',
            })
          } else {
            router.push({ name: 'Leads' })
          }
        },
      }
      showIntermediateModal.value = true
    },
  },
])

onMounted(async () => {
  await users.promise

  const filteredSteps = steps.filter((step) => {
    if (step.condition) {
      return step.condition()
    }
    return true
  })

  setUp(filteredSteps)
})

// help center
const articles = ref([
  {
    title: __('Introduction'),
    opened: false,
    subArticles: [
      { name: 'introduction', title: __('Introduction') },
      { name: 'setting-up', title: __('Setting Up') },
    ],
  },
  {
    title: __('Settings'),
    opened: false,
    subArticles: [
      { name: 'profile', title: __('Profile') },
      { name: 'custom-branding', title: __('Custom Branding') },
      { name: 'home-actions', title: __('Home Actions') },
      { name: 'invite-users', title: __('Invite Users') },
    ],
  },
  {
    title: __('Masters'),
    opened: false,
    subArticles: [
      { name: 'lead', title: __('Lead') },
      { name: 'deal', title: __('Deal') },
      { name: 'contact', title: __('Contact') },
      { name: 'organization', title: __('Organization') },
      { name: 'note', title: __('Note') },
      { name: 'task', title: __('Task') },
      { name: 'call-log', title: __('Call Log') },
      { name: 'email-template', title: __('Email Template') },
    ],
  },
  {
    title: __('Capturing Leads'),
    opened: false,
    subArticles: [{ name: 'web-form', title: __('Web Form') }],
  },
  {
    title: __('Views'),
    opened: false,
    subArticles: [
      { name: 'view', title: __('Saved View') },
      { name: 'public-view', title: __('Public View') },
      { name: 'pinned-view', title: __('Pinned View') },
    ],
  },
  {
    title: __('Other Features'),
    opened: false,
    subArticles: [
      { name: 'email-communication', title: __('Email Communication') },
      { name: 'comment', title: __('Comment') },
      { name: 'data', title: __('Data') },
      { name: 'service-level-agreement', title: __('Service Level Agreement') },
      { name: 'assignment-rule', title: __('Assignment Rule') },
      { name: 'notification', title: __('Notification') },
    ],
  },
  {
    title: __('Customization'),
    opened: false,
    subArticles: [
      { name: 'custom-fields', title: __('Custom Fields') },
      { name: 'custom-actions', title: __('Custom Actions') },
      { name: 'custom-statuses', title: __('Custom Statuses') },
      { name: 'custom-list-actions', title: __('Custom List Actions') },
      { name: 'quick-entry-layout', title: __('Quick Entry Layout') },
    ],
  },
  {
    title: __('Integration'),
    opened: false,
    subArticles: [
      { name: 'twilio', title: __('Twilio') },
      { name: 'exotel', title: __('Exotel') },
      { name: 'whatsapp', title: __('WhatsApp') },
      { name: 'erpnext', title: __('ERPNext') },
    ],
  },
  {
    title: __('Frappe CRM mobile'),
    opened: false,
    subArticles: [
      { name: 'mobile-app-installation', title: __('Mobile App Installation') },
    ],
  },
])
</script>
