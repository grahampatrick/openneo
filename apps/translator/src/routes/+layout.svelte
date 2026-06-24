<script lang="ts">
  import '../app.css'
  import { theme, applyTheme } from '$lib/theme'
  $: applyTheme($theme)
  const toggle = () => theme.update((t) => (t === 'dark' ? 'cream' : 'dark'))
</script>

<div class="min-h-screen flex flex-col">
  <header class="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
    <div class="mx-auto max-w-4xl flex items-center justify-between px-4 h-14">
      <a href="./" class="font-serif text-xl tracking-tight">Open<span class="text-accent">Neo</span> <span class="text-muted text-sm font-sans">· Translator</span></a>
      <div class="flex items-center gap-3">
        <a href="https://github.com/grahampatrick/openneo" class="text-muted text-xs">docs</a>
        <button on:click={toggle} aria-label="Toggle dark / light" class="w-8 h-8 rounded-md border border-border text-muted hover:text-fg hover:border-accent">
          {$theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </div>
  </header>
  <main class="flex-1 mx-auto w-full max-w-4xl px-4 py-6"><slot /></main>
  <footer class="border-t border-border text-muted text-xs">
    <div class="mx-auto max-w-4xl px-4 py-4">Sign in with your Nostr key — no email, no vendor.</div>
  </footer>
</div>
