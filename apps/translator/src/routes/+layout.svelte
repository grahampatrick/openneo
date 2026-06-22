<script lang="ts">
  import '../app.css'
</script>

<div class="min-h-screen flex flex-col">
  <header class="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
    <div class="mx-auto max-w-4xl flex items-center justify-between px-4 h-14">
      <a href="./" class="font-mono text-lg">Neo<span class="text-accent font-bold">Ark</span> <span class="text-muted text-sm">· Translator</span></a>
      <a href="https://github.com/grahampatrick/openneo" class="text-muted text-xs font-mono">docs</a>
    </div>
  </header>
  <main class="flex-1 mx-auto w-full max-w-4xl px-4 py-6"><slot /></main>
  <footer class="border-t border-border text-muted text-xs">
    <div class="mx-auto max-w-4xl px-4 py-4 font-mono">Sign in with your Nostr key — no email, no vendor (@neoark/auth).</div>
  </footer>
</div>
