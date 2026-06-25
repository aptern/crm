<template>
  <div class="flex h-full flex-col gap-6 py-8 px-6 text-ink-gray-8">
    <!-- Заголовок раздела -->
    <div class="flex justify-between px-2 text-ink-gray-8">
      <div class="flex flex-col gap-1">
        <h2 class="flex gap-2 text-xl font-semibold leading-none h-5">
          {{ __('Lead Intake Sources') }}
        </h2>
        <p class="text-p-base text-ink-gray-6">
          {{
            __(
              'Reference map of how leads are created automatically and which source is assigned to each channel. This is read-only; to edit the actual source list use the Lead Source directory.',
            )
          }}
        </p>
      </div>
      <div class="flex item-center space-x-2 justify-end shrink-0">
        <Button
          :label="__('Manage sources')"
          variant="subtle"
          @click="openSourcesDirectory"
        >
          <template #suffix>
            <ExternalLinkIcon class="h-4 w-4 text-ink-gray-5" />
          </template>
        </Button>
      </div>
    </div>

    <div class="flex-1 flex flex-col gap-8 overflow-y-auto px-2">
      <!-- Таблица «канал → источник» -->
      <div class="flex flex-col gap-3">
        <div class="text-base font-semibold text-ink-gray-8">
          {{ __('Auto-creation channels') }}
        </div>
        <div
          class="rounded-lg border border-outline-gray-modals overflow-hidden"
        >
          <div
            class="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.4fr)] bg-surface-gray-2 text-p-sm font-medium text-ink-gray-6"
          >
            <div class="px-3 py-2.5">{{ __('Channel') }}</div>
            <div class="px-3 py-2.5">{{ __('Lead Source') }}</div>
            <div class="px-3 py-2.5">{{ __('How it works') }}</div>
          </div>
          <div
            v-for="(row, i) in channels"
            :key="row.channel"
            class="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.4fr)] text-p-sm"
            :class="
              i !== channels.length - 1
                ? 'border-b border-outline-gray-modals'
                : ''
            "
          >
            <div class="px-3 py-3 font-medium text-ink-gray-8">
              <div class="flex flex-wrap items-center gap-1.5">
                <span>{{ __(row.channel) }}</span>
                <Badge
                  :theme="row.status === 'live' ? 'green' : 'orange'"
                  size="sm"
                  :label="
                    row.status === 'live' ? __('Live') : __('Планируется')
                  "
                />
              </div>
            </div>
            <div class="px-3 py-3">
              <Badge
                v-for="src in row.sources"
                :key="src"
                theme="gray"
                size="sm"
                class="mr-1 mb-1"
                :label="src"
              />
            </div>
            <div class="px-3 py-3 text-ink-gray-6">
              {{ __(row.note) }}
            </div>
          </div>
        </div>
        <p class="text-p-sm text-ink-gray-5">
          {{
            __(
              'Website form requests (nacifrah.site_intake.create_lead, live in production) are auto-tagged by referrer/UTM: paid traffic → Advertising, search engines → SEO, messengers hint → Messengers. Messenger leads (Telegram / MAX) are deduplicated by phone number.',
            )
          }}
        </p>
      </div>

      <!-- Действующий справочник источников (live) -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <div class="text-base font-semibold text-ink-gray-8">
            {{ __('Configured lead sources') }}
          </div>
          <Badge
            v-if="leadSources.data"
            theme="gray"
            size="sm"
            :label="String(leadSources.data.length)"
          />
        </div>
        <div
          v-if="leadSources.data && leadSources.data.length"
          class="flex flex-wrap gap-1.5"
        >
          <Badge
            v-for="src in leadSources.data"
            :key="src.name"
            theme="blue"
            size="md"
            :label="src.name"
          />
        </div>
        <div
          v-else-if="leadSources.loading"
          class="text-p-sm text-ink-gray-5"
        >
          {{ __('Loading...') }}
        </div>
        <div v-else class="text-p-sm text-ink-gray-5">
          {{ __('No lead sources found.') }}
        </div>
        <p class="text-p-sm text-ink-gray-5">
          {{
            __(
              'Sources are stored in the CRM Lead Source directory. Add or edit them there; the mapping above reflects how the intake channels assign these sources.',
            )
          }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import ExternalLinkIcon from '@/components/Icons/ExternalLinkIcon.vue'
import { Badge, Button, createListResource } from 'frappe-ui'

// Справочная карта «канал автозаведения → источник» (P-D4).
// Соответствует backend-картам: site_intake.resolve_source (HINT_MAP/MEDIUM_MAP/SEO_REFERRERS)
// и сид-списку deals_fields.RU_LEAD_SOURCES. Read-only — редактирование источников
// идёт через CRM Lead Source.
// status: 'live' — канал реально создаёт лиды в текущей сборке; 'planned' — заявлен
// в плане (P-D4), но создание лида ещё НЕ реализовано. Теги источников совпадают с
// реальными: telegram.py lead.source='Telegram', max_messenger.py 'MAX', site_intake
// SOURCE_HINT_MAP. Email→hello@ сейчас НЕ конвертится в лид (create_lead_from_incoming_email=0).
const channels = [
  {
    channel: 'Website form (advertising)',
    sources: ['Реклама'],
    status: 'live',
    note: 'Form requests via nacifrah.site_intake.create_lead; paid traffic detected by referrer/UTM (cpc, ppc, paid, ads).',
  },
  {
    channel: 'Website form (SEO)',
    sources: ['SEO'],
    status: 'live',
    note: 'Same intake endpoint; organic traffic detected by search-engine referrer (Yandex, Google, etc.) or utm_medium=organic.',
  },
  {
    channel: 'Telegram (бот)',
    sources: ['Telegram'],
    status: 'live',
    note: 'Лиды из Telegram-бота (@nacifrah_ru_bot); lead.source = "Telegram"; дедуп по номеру телефона.',
  },
  {
    channel: 'MAX (бот)',
    sources: ['MAX'],
    status: 'live',
    note: 'Лиды из мессенджера MAX; lead.source = "MAX"; дедуп по номеру телефона.',
  },
  {
    channel: 'Website form (messenger hint)',
    sources: ['Мессенджеры'],
    status: 'live',
    note: 'Заявка с сайта с признаком source_hint=«мессенджеры» → источник «Мессенджеры».',
  },
  {
    channel: 'Email to hello@ (Mail module)',
    sources: ['Электронная почта'],
    status: 'planned',
    note: 'Планируется: создание лида из входящего письма. Сейчас Mail-модуль письма в лиды НЕ конвертирует (create_lead_from_incoming_email отключён).',
  },
  {
    channel: 'Email campaign',
    sources: ['e-mail рассылка'],
    status: 'planned',
    note: 'Планируется: лиды из исходящих e-mail рассылок / новостных писем (пока не реализовано).',
  },
  {
    channel: 'Auto-dialer',
    sources: ['Автообзвон'],
    status: 'planned',
    note: 'Планируется: лиды из автоматического обзвона (пока не реализовано).',
  },
  {
    channel: 'Call center',
    sources: ['Call Center'],
    status: 'planned',
    note: 'Планируется: лиды от операторов call-центра (пока не реализовано).',
  },
]

const leadSources = createListResource({
  type: 'list',
  doctype: 'CRM Lead Source',
  cache: 'crm_lead_sources_intake',
  fields: ['name'],
  auto: true,
  orderBy: 'name asc',
  pageLength: 99,
})

function openSourcesDirectory() {
  window.open(`${window.location.origin}/app/crm-lead-source`, '_blank')
}
</script>
