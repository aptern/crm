import frappeUIPreset from 'frappe-ui/tailwind'
import twColors from 'tailwindcss/colors'

export default {
  presets: [frappeUIPreset],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
    './node_modules/frappe-ui/src/**/*.{vue,js,ts,jsx,tsx}',
    '../node_modules/frappe-ui/src/**/*.{vue,js,ts,jsx,tsx}',
    './node_modules/frappe-ui/frappe/**/*.{vue,js,ts,jsx,tsx}',
    '../node_modules/frappe-ui/frappe/**/*.{vue,js,ts,jsx,tsx}',
  ],
  safelist: [{ pattern: /!(text|bg)-/, variants: ['hover', 'active'] }],
  theme: {
    extend: {
      // nacifrah: дополнительные цветовые семейства для палитры этапов канбана —
      // тема frappe-ui несёт только базовый набор, добавляем шкалы из tailwind.
      colors: {
        slate: twColors.slate,
        zinc: twColors.zinc,
        stone: twColors.stone,
        neutral: twColors.neutral,
        rose: twColors.rose,
        lime: twColors.lime,
        emerald: twColors.emerald,
        sky: twColors.sky,
        indigo: twColors.indigo,
        fuchsia: twColors.fuchsia,
      },
    },
  },
  plugins: [],
}
