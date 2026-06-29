import { computed, ref } from 'vue'
import { useStorage } from '@vueuse/core'

export const mobileSidebarOpened = ref(false)

export const isMobileView = computed(() => window.innerWidth < 768)

// F1 (P-D1): единая ширина выезжающих карточек-деталей (сделка/лид/задача) на десктопе.
// Один источник истины — меняем здесь, применяется во ВСЕХ слайд-оверах (RecordSlideOver,
// DoctypeModal). Мобильный = 100%, обычный = DETAIL_PANEL_WIDTH.
export const DETAIL_PANEL_WIDTH = '80%'

// D (заказчик): ширины левого меню (= w-[220px]/w-12 в AppSidebar). Единый источник —
// слайд-оверы и канбан тянут отсюда, не копируют литералы (правило централизации).
export const SIDEBAR_WIDTH_EXPANDED = '220px'
export const SIDEBAR_WIDTH_COLLAPSED = '48px'
// ТОТ ЖЕ ключ, что в AppSidebar/KanbanView (useStorage шарит реактивно через localStorage):
export const isSidebarCollapsed = useStorage('isSidebarCollapsed', false)
// Ширина раскрытой («на весь экран») панели детали — ВПРИТЫК к меню, реактивно следует
// за сворачиванием меню. Заменяет прежний неверный фикс «calc(100% - 15rem)».
export const expandedPanelWidth = computed(
  () =>
    `calc(100% - ${isSidebarCollapsed.value ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED})`,
)

export const showSettings = ref(false)

export const disableSettingModalOutsideClick = ref(false)

export const activeSettingsPage = ref('')
