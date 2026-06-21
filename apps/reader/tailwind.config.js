/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,svelte,ts}'],
  theme: {
    extend: {
      colors: { bg: '#0a0a0a', panel: '#121518', fg: '#e6e6e6', muted: '#8a949c', accent: '#6ee7ff', border: '#1e2429' },
      fontFamily: { mono: ['ui-monospace', 'SF Mono', 'Menlo', 'monospace'], sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
