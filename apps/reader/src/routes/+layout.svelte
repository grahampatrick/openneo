<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { online, trackConnectivity } from '$lib/stores'

  onMount(() => trackConnectivity())
</script>

<div class="min-h-screen flex flex-col">
  <header class="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
    <div class="mx-auto max-w-5xl flex items-center justify-between px-4 h-14">
      <a href="./" class="font-mono text-lg">Neo<span class="text-accent font-bold">Ark</span></a>
      <span class="font-mono text-xs" class:text-accent={$online} class:text-muted={!$online}>
        {$online ? '● online' : '○ offline — reading from cache'}
      </span>
    </div>
  </header>

  <main class="flex-1 mx-auto w-full max-w-5xl px-4 py-6">
    <slot />
  </main>

  <footer class="border-t border-border text-muted text-xs">
    <div class="mx-auto max-w-5xl px-4 py-4 font-mono">
      NeoOS · CC-BY-SA 4.0 · based on the Berean Standard Bible (public domain)
    </div>
  </footer>
</div>
