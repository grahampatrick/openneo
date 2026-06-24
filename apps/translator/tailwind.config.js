/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,svelte,ts}'],
  theme: { extend: {
    // CSS-variable tokens (see app.css) so the UI follows the cream/dark themes.
    colors: {
      bg: 'var(--bg)', panel: 'var(--panel)', fg: 'var(--fg)', muted: 'var(--muted)',
      accent: 'var(--accent)', border: 'var(--border)', green: 'var(--green)', gold: 'var(--gold)', red: 'var(--red)',
    },
    fontFamily: {
      mono: ['ui-monospace','SF Mono','Menlo','monospace'],
      sans: ['Inter','system-ui','sans-serif'],
      serif: ['"Iowan Old Style"','"Palatino Linotype"','Palatino','Charter','"Source Serif Pro"','Georgia','Cambria','"Times New Roman"','serif'],
    },
  } },
  plugins: [],
}
