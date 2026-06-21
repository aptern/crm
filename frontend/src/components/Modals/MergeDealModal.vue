<template>
  <!-- F6 (P-D13): объединение сделок-дублей.
       Шаг 1: список кандидатов из nacifrah.crm_bridge.get_merge_candidates (совпадение
       телефон/email/организация) ИЛИ ручной выбор любой сделки через Link-пикер.
       Шаг 2: подтверждение → nacifrah.crm_bridge.merge_deals(primary=текущая, duplicate=выбранная)
       → toast + emit('merged', primary) (родитель делает reload/редирект).
       Бэкенд переносит контакты/активности/чаты на primary и помечает duplicate. -->
  <Dialog
    v-model="show"
    :options="{ title: __('Объединить дубли'), size: 'lg' }"
  >
    <template #body-content>
      <!-- ШАГ ПОДТВЕРЖДЕНИЯ -->
      <div v-if="selected" class="flex flex-col gap-4">
        <div class="rounded-md bg-surface-gray-2 p-3 text-base text-ink-gray-8">
          <div class="mb-2 font-medium text-ink-gray-9">
            {{ __('Будет выполнено объединение') }}
          </div>
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-2">
              <Badge variant="subtle" theme="green" :label="__('Основная')" />
              <span class="truncate">{{ primaryLabel }}</span>
            </div>
            <FeatherIcon
              name="arrow-up"
              class="mx-1 h-4 w-4 rotate-180 text-ink-gray-5"
            />
            <div class="flex items-center gap-2">
              <Badge variant="subtle" theme="red" :label="__('Дубль')" />
              <span class="truncate">{{ selectedLabel }}</span>
            </div>
          </div>
        </div>
        <div class="text-p-sm text-ink-gray-6">
          {{
            __(
              'Контакты, переписка, задачи и вложения дубля будут перенесены в основную сделку. Дубль будет помечен как объединённый. Действие необратимо.',
            )
          }}
        </div>
        <ErrorMessage :message="error" />
      </div>

      <!-- ШАГ ВЫБОРА -->
      <div v-else class="flex flex-col gap-4">
        <!-- кандидаты по совпадению -->
        <div>
          <div class="mb-2 text-sm font-medium text-ink-gray-7">
            {{ __('Похожие сделки') }}
          </div>
          <div
            v-if="candidates.loading"
            class="flex items-center justify-center gap-2 py-6 text-base text-ink-gray-5"
          >
            <LoadingIndicator class="h-4 w-4" />
            <span>{{ __('Loading...') }}</span>
          </div>
          <div
            v-else-if="candidateList.length"
            class="flex flex-col gap-1.5"
          >
            <button
              v-for="c in candidateList"
              :key="c.name"
              type="button"
              class="flex items-center justify-between gap-2 rounded-md border border-outline-gray-1 px-3 py-2 text-left text-base text-ink-gray-8 hover:border-outline-gray-2 hover:bg-surface-gray-2"
              @click="pick(c.name, c.title || c.name)"
            >
              <div class="min-w-0">
                <div class="truncate font-medium text-ink-gray-9">
                  {{ c.title || c.name }}
                </div>
                <div class="truncate text-p-sm text-ink-gray-5">
                  <span v-if="c.contact">{{ c.contact }}</span>
                  <span v-if="c.phone"> · {{ c.phone }}</span>
                  <span v-if="c.status"> · {{ c.status }}</span>
                </div>
              </div>
              <FeatherIcon
                name="chevron-right"
                class="h-4 w-4 shrink-0 text-ink-gray-5"
              />
            </button>
          </div>
          <div
            v-else
            class="rounded-md bg-surface-gray-2 py-4 text-center text-p-sm text-ink-gray-5"
          >
            {{ __('Похожих сделок не найдено') }}
          </div>
        </div>

        <!-- ручной выбор любой сделки -->
        <div>
          <div class="mb-2 text-sm font-medium text-ink-gray-7">
            {{ __('Или выбрать сделку вручную') }}
          </div>
          <Link
            class="form-control"
            value=""
            doctype="CRM Deal"
            :filters="{ name: ['!=', deal] }"
            :placeholder="__('Поиск сделки…')"
            @change="(v) => v && pick(v, v)"
          />
        </div>
      </div>
    </template>

    <template #actions>
      <div class="flex items-center justify-between gap-2">
        <Button
          v-if="selected"
          :label="__('Назад')"
          @click="reset"
        />
        <span v-else />
        <div class="flex gap-2">
          <Button :label="__('Cancel')" @click="show = false" />
          <Button
            v-if="selected"
            variant="solid"
            theme="red"
            :label="__('Объединить')"
            :loading="busy"
            @click="confirmMerge"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import Link from '@/components/Controls/Link.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import { napi } from '@/utils/api'
import {
  createResource,
  Dialog,
  Button,
  Badge,
  FeatherIcon,
  ErrorMessage,
  call,
  toast,
} from 'frappe-ui'
import { ref, computed, watch } from 'vue'

const props = defineProps({
  // текущая сделка = primary (в неё объединяем).
  deal: { type: String, required: true },
  // заголовок текущей сделки для шага подтверждения.
  dealTitle: { type: String, default: '' },
})

const emit = defineEmits(['merged'])

const show = defineModel({ type: Boolean })

const busy = ref(false)
const error = ref('')
// выбранный дубль (duplicate) + его подпись для подтверждения.
const selected = ref('')
const selectedLabel = ref('')

const primaryLabel = computed(() => props.dealTitle || props.deal)

// кандидаты-дубли по совпадению телефон/email/организация (бэкенд).
const candidates = createResource({
  url: napi('crm_bridge.get_merge_candidates'),
  params: { deal: props.deal },
})

const candidateList = computed(() => candidates.data?.candidates || [])

// подгружать кандидатов при каждом открытии модалки и сбрасывать выбор.
watch(
  show,
  (open) => {
    if (open) {
      reset()
      candidates.fetch({ deal: props.deal })
    }
  },
  { immediate: true },
)

function pick(name, label) {
  if (!name || name === props.deal) return
  selected.value = name
  selectedLabel.value = label || name
  error.value = ''
}

function reset() {
  selected.value = ''
  selectedLabel.value = ''
  error.value = ''
}

async function confirmMerge() {
  if (!selected.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const r = await call(napi('crm_bridge.merge_deals'), {
      primary: props.deal,
      duplicate: selected.value,
    })
    toast.success(__('Сделки объединены'))
    show.value = false
    emit('merged', props.deal, r)
  } catch (e) {
    error.value = e?.messages?.[0] || __('Не удалось объединить сделки')
  } finally {
    busy.value = false
  }
}
</script>
