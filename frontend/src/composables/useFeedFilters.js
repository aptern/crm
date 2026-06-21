// PB7/PB8/PB10 — ЕДИНЫЙ источник фильтров ленты «только вложения / только ссылки».
// Применяется в чате задачи (TaskActivityFeed.vue), карточке проекта (ProjectCard.vue)
// и в «Активности/Комментариях» (Activities/Activities.vue). Один источник правды —
// здесь и состояние тумблеров, и общий детектор URL (regex), и хелперы признаков
// «есть файл» / «есть ссылка» у элемента ленты. UI чипов — FeedFilterChips.vue.
import { ref } from 'vue'

// Общий регэксп URL: http(s)://… ИЛИ www.… ИЛИ голый домен вида foo.bar/…
// 'i' — регистронезависимо, 'g' нужен для теста нескольких вхождений (lastIndex сбрасываем).
const URL_RE =
  /(https?:\/\/[^\s<>"')]+|www\.[^\s<>"')]+|\b[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s<>"')]*)?)/i

/**
 * Есть ли в произвольном тексте URL. Принимает как plain-текст, так и HTML
 * (HTML с <a href> тоже даст true — там присутствует http/домен в атрибуте/тексте).
 */
export function textHasLink(text) {
  if (!text) return false
  return URL_RE.test(String(text))
}

/**
 * Есть ли в HTML-контенте ссылка: либо явный тег <a href>, либо URL в тексте.
 */
export function htmlHasLink(html) {
  if (!html) return false
  const s = String(html)
  if (/<a\s[^>]*href\s*=/i.test(s)) return true
  return URL_RE.test(s)
}

/**
 * Признак «у элемента ленты есть вложение». Покрывает разные формы данных:
 * - server-side files (массив data.files);
 * - комментарий с attachments[] (CommentArea);
 * - сообщение-файл (📎 <a href> в content) — определяется через htmlHasLink при
 *   linksOnly, для filesOnly опираемся на явные attachments/файловые поля.
 */
export function itemHasAttachment(item) {
  if (!item) return false
  if (Array.isArray(item.attachments) && item.attachments.length) return true
  if (item.file_url || item.file_name) return true
  if (item.activity_type === 'attachment_log' && item.data?.file_url) return true
  return false
}

/**
 * Признак «у элемента ленты есть ссылка» (детект URL в тексте/HTML сообщения).
 */
export function itemHasLink(item) {
  if (!item) return false
  // комментарии хранят HTML в content; activity-changes — в data/value
  if (htmlHasLink(item.content)) return true
  if (textHasLink(item.value)) return true
  if (textHasLink(item.data?.value)) return true
  return false
}

/**
 * Фабрика состояния фильтров ленты. Тумблеры взаимоисключающие
 * (включил «ссылки» — «файлы» гаснет, и наоборот), чтобы режимы не конфликтовали.
 */
export function useFeedFilters() {
  const filesOnly = ref(false)
  const linksOnly = ref(false)

  function toggleFiles() {
    filesOnly.value = !filesOnly.value
    if (filesOnly.value) linksOnly.value = false
  }
  function toggleLinks() {
    linksOnly.value = !linksOnly.value
    if (linksOnly.value) filesOnly.value = false
  }
  function reset() {
    filesOnly.value = false
    linksOnly.value = false
  }

  return {
    filesOnly,
    linksOnly,
    toggleFiles,
    toggleLinks,
    reset,
    // хелперы-детекторы — чтобы потребитель тянул из одного источника
    itemHasAttachment,
    itemHasLink,
  }
}
