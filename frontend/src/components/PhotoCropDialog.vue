<!--
  PhotoCropDialog — загрузка фото с обрезкой строго 1:1 (I37).
  Заказчик: «добавь возможность загрузки и скрипт, чтобы выбрать как обрезать фото
  (формат только 1:1), чтобы оно уменьшалось». Чистый canvas, без внешних библиотек:
  выбрать файл → подвигать/зум в квадратной рамке → «Применить» → отдаём JPEG-квадрат.
-->
<template>
  <!-- K1: собственный высокий z-[60] поверх слайд-панели сотрудника (z-40),
       чтобы попап обрезки не уходил ЗА модалку и был кликабелен. -->
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/40" @click="show = false" />
      <div
        class="relative z-[61] w-full max-w-sm rounded-xl bg-surface-modal p-4 shadow-2xl"
      >
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-base font-semibold text-ink-gray-9">
            {{ title || __('Фото сотрудника') }}
          </h3>
          <button
            class="text-ink-gray-5 hover:text-ink-gray-8"
            @click="show = false"
          >
            <FeatherIcon name="x" class="h-4 w-4" />
          </button>
        </div>
        <div class="flex flex-col items-center gap-3">
        <!-- выбор файла -->
        <label
          class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-outline-gray-2 px-3 py-2 text-sm text-ink-gray-6 hover:bg-surface-gray-2"
        >
          <FeatherIcon name="upload" class="h-4 w-4" />
          <span>{{ fileName || __('Выбрать изображение') }}</span>
          <input
            type="file"
            accept="image/*"
            class="hidden"
            @change="onFile"
          />
        </label>

        <!-- квадратная рамка обрезки 1:1 -->
        <div
          v-show="hasImage"
          ref="frame"
          class="relative touch-none overflow-hidden rounded-md bg-surface-gray-3 ring-1 ring-outline-gray-2"
          :style="{ width: VIEW + 'px', height: VIEW + 'px' }"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointerleave="onUp"
          @wheel.prevent="onWheel"
        >
          <canvas
            ref="canvas"
            :width="VIEW"
            :height="VIEW"
            class="block cursor-move select-none"
          />
          <!-- сетка-подсказка центра -->
          <div
            class="pointer-events-none absolute inset-0 border border-white/40"
            aria-hidden="true"
          />
        </div>

        <div v-show="hasImage" class="flex w-full items-center gap-2">
          <FeatherIcon name="zoom-out" class="h-4 w-4 text-ink-gray-5" />
          <input
            type="range"
            class="flex-1 accent-ink-gray-8"
            :min="1"
            :max="4"
            :step="0.01"
            v-model.number="zoom"
            @input="render"
          />
          <FeatherIcon name="zoom-in" class="h-4 w-4 text-ink-gray-5" />
        </div>
        <p v-show="hasImage" class="text-xs text-ink-gray-5">
          {{ __('Перетаскивайте фото и масштабируйте. Сохранится квадрат 1:1.') }}
        </p>
      </div>

      <div class="mt-4 flex justify-end gap-2">
        <Button :label="__('Отмена')" @click="show = false" />
        <Button
          variant="solid"
          :label="__('Применить')"
          :loading="busy"
          :disabled="!hasImage"
          @click="apply"
        />
      </div>
        </div>
      </div>
  </Teleport>
</template>

<script setup>
import { Button, FeatherIcon } from 'frappe-ui'
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  // целевой размер квадрата на выходе (px); фото уменьшается до него
  target: { type: Number, default: 512 },
})
const emit = defineEmits(['cropped'])
const show = defineModel({ type: Boolean, default: false })

const VIEW = 280 // размер рамки предпросмотра

const frame = ref(null)
const canvas = ref(null)
const fileName = ref('')
const hasImage = ref(false)
const busy = ref(false)
const zoom = ref(1)

let img = null // HTMLImageElement
let minScale = 1 // «cover» масштаб (фото покрывает рамку)
let offset = { x: 0, y: 0 } // левый-верх угол фото в координатах рамки
let drag = null

function reset() {
  img = null
  fileName.value = ''
  hasImage.value = false
  zoom.value = 1
  offset = { x: 0, y: 0 }
}

watch(show, (v) => {
  if (!v) reset()
})

function onFile(e) {
  const f = e.target.files && e.target.files[0]
  if (!f) return
  fileName.value = f.name
  const reader = new FileReader()
  reader.onload = () => {
    const im = new Image()
    im.onload = async () => {
      img = im
      // cover: рамка должна быть полностью закрыта фото
      minScale = Math.max(VIEW / im.naturalWidth, VIEW / im.naturalHeight)
      zoom.value = 1
      // отцентровать
      const dw = im.naturalWidth * minScale
      const dh = im.naturalHeight * minScale
      offset = { x: (VIEW - dw) / 2, y: (VIEW - dh) / 2 }
      hasImage.value = true
      await nextTick()
      render()
    }
    im.src = reader.result
  }
  reader.readAsDataURL(f)
}

function curScale() {
  return minScale * zoom.value
}

function clamp() {
  if (!img) return
  const dw = img.naturalWidth * curScale()
  const dh = img.naturalHeight * curScale()
  // фото всегда покрывает рамку
  offset.x = Math.min(0, Math.max(VIEW - dw, offset.x))
  offset.y = Math.min(0, Math.max(VIEW - dh, offset.y))
}

let prevZoom = 1
function render() {
  if (!img || !canvas.value) return
  // зум вокруг центра рамки
  if (zoom.value !== prevZoom) {
    const k = (minScale * zoom.value) / (minScale * prevZoom)
    const cx = VIEW / 2
    const cy = VIEW / 2
    offset.x = cx - (cx - offset.x) * k
    offset.y = cy - (cy - offset.y) * k
    prevZoom = zoom.value
  }
  clamp()
  const ctx = canvas.value.getContext('2d')
  ctx.clearRect(0, 0, VIEW, VIEW)
  const dw = img.naturalWidth * curScale()
  const dh = img.naturalHeight * curScale()
  ctx.drawImage(img, offset.x, offset.y, dw, dh)
}

function onDown(e) {
  if (!img) return
  drag = { x: e.clientX, y: e.clientY }
  canvas.value?.setPointerCapture?.(e.pointerId)
}
function onMove(e) {
  if (!drag) return
  offset.x += e.clientX - drag.x
  offset.y += e.clientY - drag.y
  drag = { x: e.clientX, y: e.clientY }
  render()
}
function onUp() {
  drag = null
}
function onWheel(e) {
  if (!img) return
  const next = Math.min(4, Math.max(1, zoom.value + (e.deltaY < 0 ? 0.12 : -0.12)))
  zoom.value = next
  render()
}

async function apply() {
  if (!img) return
  busy.value = true
  try {
    // экспорт квадрата target×target
    const T = props.target
    const out = document.createElement('canvas')
    out.width = T
    out.height = T
    const ctx = out.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, T, T)
    const r = T / VIEW
    const dw = img.naturalWidth * curScale() * r
    const dh = img.naturalHeight * curScale() * r
    ctx.drawImage(img, offset.x * r, offset.y * r, dw, dh)
    const blob = await new Promise((res) =>
      out.toBlob(res, 'image/jpeg', 0.9),
    )
    const dataUrl = out.toDataURL('image/jpeg', 0.9)
    emit('cropped', { blob, dataUrl, name: fileName.value })
    show.value = false
  } finally {
    busy.value = false
  }
}
</script>
