<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { trackConnectivity } from '$lib/stores'
  import { settings, applySettings, resolveTheme, type Theme } from '$lib/settings'

  onMount(() => {
    const off = trackConnectivity()
    // Keep 'auto' in sync with the OS theme while open.
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onScheme = () => settings.update((s) => s)
    mq.addEventListener('change', onScheme)
    return () => {
      off()
      mq.removeEventListener('change', onScheme)
    }
  })

  // Apply theme + size to <html> whenever settings change.
  $: applySettings($settings)
  // Re-resolve when 'auto' (so the matchMedia change above re-applies).
  $: void resolveTheme($settings.theme as Theme)
</script>

<div class="min-h-screen flex flex-col">
  <main class="flex-1 w-full"><slot /></main>

  <footer class="border-t border-border text-muted text-xs">
    <div class="mx-auto max-w-3xl px-4 py-4">
      NeoOS · CC-BY-SA 4.0 · based on the Berean Standard Bible (public domain)
    </div>
  </footer>
</div>
