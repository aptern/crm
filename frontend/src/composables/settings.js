import { computed, ref } from 'vue'

export const mobileSidebarOpened = ref(false)

export const isMobileView = computed(() => window.innerWidth < 768)

// F1 (P-D1): единая ширина выезжающих карточек-деталей (сделка/лид/задача) на десктопе.
// Один источник истины — меняем здесь, применяется во ВСЕХ слайд-оверах (RecordSlideOver,
// DoctypeModal). Мобильный = 100%, режим «на весь экран» = calc(100% - 15rem) (до левого меню).
export const DETAIL_PANEL_WIDTH = '80%'

export const showSettings = ref(false)

export const disableSettingModalOutsideClick = ref(false)

export const activeSettingsPage = ref('')
