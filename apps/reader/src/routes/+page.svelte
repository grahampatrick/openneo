<script lang="ts">
  import { onMount } from 'svelte'
  import { base } from '$app/paths'
  import { fetchCorpus, type Corpus, type Verse, type BookMeta } from '$lib/corpus'
  import { formatReference } from '$lib/reference'
  import { currentRef } from '$lib/stores'
  import { settings, type TextSize, type Theme } from '$lib/settings'
  import { anchorLabel, type Revision } from '$lib/history'
  import { createReaderPool, fetchVerseData, TRANSLATION_ID } from '$lib/relay-data'
  import { isCanon66, canon66Rank, neoosRank } from '$lib/canon'
  import type { RelayPool } from '@neoark/relay'

  let corpus: Corpus | null = null
  let error = ''
  let verses: Verse[] = []
  let books: BookMeta[] = []
  let pool: RelayPool | null = null
  let only66 = false

  // Overlays: which panel is open.
  type Panel = '' | 'settings' | 'search' | 'verify' | 'picker'
  let panel: Panel = ''

  // Verse detail (tap a verse).
  let selected: Verse | null = null
  let revisions: Revision[] = []
  let citationCount = 0
  let citationSources: string[] = []
  let loadingVerse = false

  // Search.
  let query = ''
  let results: Verse[] = []

  onMount(async () => {
    try {
      corpus = await fetchCorpus(base)
      books = corpus.loadedBooks()
      load()
      pool = createReaderPool()
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  })

  function load() {
    if (!corpus) return
    verses = corpus.chapter($currentRef.bookId, $currentRef.chapter)
    selected = null
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }

  function go(bookId: string, chapter: number) {
    currentRef.set({ bookId, chapter })
    load()
    panel = ''
  }
  function pickChapter(c: number) {
    currentRef.update((r) => ({ ...r, chapter: c }))
    load()
  }

  // Ordered list of currently-visible books (full NeoOS order, or the 66).
  $: ordered = only66
    ? books.filter((b) => isCanon66(b.id)).sort((a, b) => canon66Rank(a.id) - canon66Rank(b.id))
    : [...books].sort((a, b) => neoosRank(a.id) - neoosRank(b.id))

  function step(dir: 1 | -1) {
    if (!corpus) return
    const chs = corpus.chapters($currentRef.bookId)
    const ci = chs.indexOf($currentRef.chapter)
    const nextCh = chs[ci + dir]
    if (nextCh !== undefined) return go($currentRef.bookId, nextCh)
    // Cross a book boundary in the visible order.
    const bi = ordered.findIndex((b) => b.id === $currentRef.bookId)
    const nb = ordered[bi + dir]
    if (!nb) return
    const nbChs = corpus.chapters(nb.id)
    go(nb.id, dir === 1 ? (nbChs[0] ?? 1) : (nbChs[nbChs.length - 1] ?? 1))
  }

  function set66(value: boolean) {
    only66 = value
    if (only66 && !isCanon66($currentRef.bookId)) go('GEN', 1)
  }

  async function openVerse(v: Verse) {
    selected = v
    revisions = []
    citationCount = 0
    citationSources = []
    if (!pool) return
    loadingVerse = true
    try {
      const data = await fetchVerseData(pool, { bookId: v.bookId, chapter: v.chapter, verse: v.verse })
      if (selected === v) {
        revisions = data.revisions
        citationCount = data.citations.count
        citationSources = data.citations.sources
      }
    } catch {
      /* leave empty on relay failure */
    }
    loadingVerse = false
  }

  const SIZES: { id: TextSize; em: number }[] = [
    { id: 'sm', em: 0.85 },
    { id: 'md', em: 1.2 },
    { id: 'lg', em: 1.55 },
  ]
  const THEMES: { id: Theme; label: string }[] = [
    { id: 'cream', label: 'Cream' },
    { id: 'dark', label: 'Dark' },
    { id: 'auto', label: 'Auto' },
  ]
  const setSize = (id: TextSize) => settings.update((x) => ({ ...x, size: id }))
  const setTheme = (id: Theme) => settings.update((x) => ({ ...x, theme: id }))

  function runSearch() {
    if (!corpus || query.trim().length < 2) {
      results = []
      return
    }
    results = corpus.search(query.trim(), 60)
  }
  // Both names, e.g. "Bere'shiyth — Genesis".
  $: bookName = (id: string) => {
    const m = corpus?.bookMeta(id)
    return m ? `${m.hebrew} — ${m.english}` : id
  }

  $: refLabel = corpus ? formatReference($currentRef, corpus) : ''
  // Heading: "Bere'shiyth 1 — Genesis".
  $: curMeta = corpus?.bookMeta($currentRef.bookId)
  $: chapterTitle = curMeta ? `${curMeta.hebrew} ${$currentRef.chapter} — ${curMeta.english}` : refLabel
</script>

<svelte:head><title>{chapterTitle || 'OpenNeo Reader'}</title></svelte:head>

<!-- Top bar -->
<header class="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
  <div class="mx-auto max-w-5xl flex items-center justify-between px-4 h-14">
    <a href="./" class="font-serif text-xl tracking-tight" style="font-family:'Iowan Old Style',Palatino,Georgia,serif">Open<span class="text-accent">Neo</span></a>
    <nav class="flex items-center gap-1">
      <button on:click={() => (panel = panel === 'settings' ? '' : 'settings')} title="Text settings" class="px-2 py-1 rounded hover:bg-panel font-serif text-lg" aria-label="Text settings">A<span class="text-xs align-baseline">a</span></button>
      <a href="/translate" title="Propose a correction" aria-label="Translate" class="px-2 py-1 rounded hover:bg-panel">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
      </a>
      <button on:click={() => { panel = panel === 'search' ? '' : 'search' }} title="Search" aria-label="Search" class="px-2 py-1 rounded hover:bg-panel">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
      </button>
      <button on:click={() => (panel = panel === 'verify' ? '' : 'verify')} title="Verify this text" aria-label="Verify" class="px-2 py-1 rounded hover:bg-panel">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>
      </button>
    </nav>
  </div>
</header>

{#if error}
  <p class="text-red-500 font-mono max-w-3xl mx-auto px-4 py-8">Could not load corpus: {error}</p>
{:else if !corpus}
  <p class="text-muted max-w-3xl mx-auto px-4 py-8">Loading corpus…</p>
{:else}
  <!-- Chapter bar -->
  <div class="border-b border-border">
    <div class="mx-auto max-w-5xl flex items-center justify-between px-4 h-12">
      <button on:click={() => step(-1)} title="Previous chapter" class="text-muted hover:text-accent px-2">‹</button>
      <button on:click={() => (panel = panel === 'picker' ? '' : 'picker')} class="text-accent font-medium text-center">{chapterTitle} <span class="text-xs">▾</span></button>
      <div class="flex items-center gap-3">
        <div class="relative group">
          <div class="inline-flex rounded-md border border-border overflow-hidden text-xs">
            <button on:click={() => set66(true)} class="px-2 py-0.5" class:bg-accent={only66} class:text-bg={only66} class:text-muted={!only66}>66</button>
            <button on:click={() => set66(false)} class="px-2 py-0.5 border-l border-border" class:bg-accent={!only66} class:text-bg={!only66} class:text-muted={only66}>87</button>
          </div>
          <div class="pointer-events-none absolute right-0 top-full mt-2 w-64 rounded-md border border-border bg-panel p-3 text-xs leading-relaxed opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 z-30">
            <p class="mb-1"><span class="font-semibold text-fg">66</span> <span class="text-muted">— the Protestant canon (Genesis–Revelation), in the standard order.</span></p>
            <p><span class="font-semibold text-fg">87</span> <span class="text-muted">— the full NeoOS canon: adds the Apocrypha &amp; pseudepigrapha (Enoch, Jasher, Jubilees, 2 Baruch…) in their reading order.</span></p>
          </div>
        </div>
        <button on:click={() => step(1)} title="Next chapter" class="text-muted hover:text-accent px-2">›</button>
      </div>
    </div>
  </div>

  <!-- Reading -->
  <article class="reading mx-auto px-5 py-8">
    {#each verses as v, i (v.verse)}
      {#if i === 0}<span class="dropcap">{$currentRef.chapter}</span>{/if}<!--
      -->{#if $settings.verseNumbers}<button type="button" class="vnum" on:click={() => openVerse(v)}>{v.verse}</button>{/if}<span>{v.text} </span>
    {/each}
  </article>
{/if}

<!-- ── Text Settings panel ── -->
{#if panel === 'settings'}
  <div class="fixed inset-0 z-30" on:click|self={() => (panel = '')} role="presentation">
    <aside class="absolute right-3 top-16 w-72 rounded-lg border border-border bg-panel p-4 shadow-2xl">
      <h3 class="text-center font-medium mb-4">Text Settings</h3>
      <div class="flex gap-2 mb-4">
        {#each SIZES as s (s.id)}
          <button on:click={() => setSize(s.id)}
            class="flex-1 rounded border border-border py-2" class:bg-accent={$settings.size === s.id} class:text-bg={$settings.size === s.id}
            style="font-size:{s.em}rem" aria-label="Size {s.id}">A</button>
        {/each}
      </div>
      <p class="text-xs text-muted mb-1">Theme</p>
      <div class="flex gap-2 mb-4">
        {#each THEMES as t (t.id)}
          <button on:click={() => setTheme(t.id)}
            class="flex-1 rounded border border-border py-2 text-sm" class:bg-accent={$settings.theme === t.id} class:text-bg={$settings.theme === t.id}>{t.label}</button>
        {/each}
      </div>
      <label class="flex items-center justify-between text-sm">
        Verse numbers
        <input type="checkbox" bind:checked={$settings.verseNumbers} />
      </label>
    </aside>
  </div>
{/if}

<!-- ── Search panel ── -->
{#if panel === 'search'}
  <div class="fixed inset-0 z-30 bg-black/40 flex items-start justify-center p-4" on:click|self={() => (panel = '')} role="presentation">
    <div class="w-full max-w-xl mt-12 rounded-lg border border-border bg-panel p-4 shadow-2xl">
      <div class="flex items-center gap-2 mb-3">
        <!-- svelte-ignore a11y-autofocus -->
        <input bind:value={query} on:input={runSearch} placeholder="Search the corpus…" autofocus
          class="flex-1 bg-bg border border-border rounded px-3 py-2" />
        <button on:click={() => (panel = '')} class="text-muted text-sm">close ✕</button>
      </div>
      {#if query.trim().length >= 2}
        <p class="text-xs text-muted mb-2">{results.length} result(s)</p>
        <div class="max-h-[60vh] overflow-y-auto">
          {#each results as r (r.bookId + r.chapter + r.verse)}
            <button class="block w-full text-left py-1.5 border-b border-border" on:click={() => go(r.bookId, r.chapter)}>
              <span class="text-accent text-sm font-medium">{bookName(r.bookId)} {r.chapter}:{r.verse}</span>
              <span class="text-sm text-muted"> · {r.text.slice(0, 90)}…</span>
            </button>
          {/each}
        </div>
      {:else}
        <p class="text-muted text-sm">Type at least 2 characters.</p>
      {/if}
    </div>
  </div>
{/if}

<!-- ── Verify panel ── -->
{#if panel === 'verify'}
  <div class="fixed inset-0 z-30 bg-black/40 flex items-start justify-center p-4" on:click|self={() => (panel = '')} role="presentation">
    <div class="w-full max-w-md mt-16 rounded-lg border border-border bg-panel p-5 shadow-2xl">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-medium">Is this text authentic?</h3>
        <button on:click={() => (panel = '')} class="text-muted text-sm">close ✕</button>
      </div>
      <p class="text-sm mb-3">Yes — and you don't have to take our word for it. NeoOS is <strong>content-addressed</strong>: every verse is hashed with BLAKE3 into a single corpus root, so any change is detectable.</p>
      <p class="text-sm mb-3">Every accepted correction is <strong>timestamped to Bitcoin</strong> and recorded as a public, signed event. Tap any verse number to see its change history and anchor.</p>
      <p class="text-xs text-muted">Translation: <span class="font-mono">{TRANSLATION_ID}</span></p>
      <a href="https://github.com/grahampatrick/openneo" class="text-accent text-sm underline">Verify the corpus root + full history →</a>
    </div>
  </div>
{/if}

<!-- ── Book / chapter picker ── -->
{#if panel === 'picker' && corpus}
  <div class="fixed inset-0 z-30 bg-black/40 flex items-start justify-center p-4" on:click|self={() => (panel = '')} role="presentation">
    <div class="w-full max-w-md mt-12 rounded-lg border border-border bg-panel p-4 shadow-2xl max-h-[80vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-medium">{bookName($currentRef.bookId)}</h3>
        <button on:click={() => (panel = '')} class="text-muted text-sm">close ✕</button>
      </div>
      <div class="flex flex-wrap gap-1 mb-4">
        {#each corpus.chapters($currentRef.bookId) as c (c)}
          <button on:click={() => { pickChapter(c); panel = '' }} class="w-9 h-9 rounded border border-border text-sm"
            class:bg-accent={c === $currentRef.chapter} class:text-bg={c === $currentRef.chapter}>{c}</button>
        {/each}
      </div>
      <p class="text-xs text-muted mb-1">Books</p>
      <div class="flex flex-col gap-1">
        {#each ordered as b (b.id)}
          <button on:click={() => go(b.id, 1)} class="text-left text-sm px-2 py-1.5 rounded border border-border"
            class:bg-accent={b.id === $currentRef.bookId} class:text-bg={b.id === $currentRef.bookId}>
            <span>{b.hebrew}</span> <span class="text-muted" class:text-bg={b.id === $currentRef.bookId}>— {b.english}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<!-- ── Verse detail (change history + citations) ── -->
{#if selected && corpus}
  <div class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8" on:click|self={() => (selected = null)} role="presentation">
    <div class="w-full max-w-xl border border-border rounded-lg bg-panel p-5 shadow-2xl mt-8" role="dialog" aria-modal="true">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-accent font-medium">{corpus.bookMeta(selected.bookId)?.hebrew} {selected.chapter}:{selected.verse} <span class="text-muted font-normal">— {corpus.bookMeta(selected.bookId)?.english}</span></h2>
        <button class="text-muted text-sm" on:click={() => (selected = null)}>close ✕</button>
      </div>
      <p class="reading text-base mb-4" style="font-size:1.05rem">{selected.text}</p>
      {#if loadingVerse}<p class="text-muted text-xs mb-3">Loading from relays…</p>{/if}
      <section class="mb-4">
        <h3 class="text-sm text-muted mb-2">Change history</h3>
        {#if revisions.length}
          {#each revisions as rev (rev.mergeEventId)}
            {@const label = anchorLabel(rev.anchor)}
            <div class="text-sm mb-2">
              <span class="inline-block w-2 h-2 rounded-full mr-2" style="background:{label.color}"></span>
              <span class="text-xs" style="color:{label.color}">merged · {label.text}</span>
              <p class="mt-1">{rev.text}</p>
              <p class="text-muted text-xs mt-1">{rev.rationale} — by {rev.maintainer.slice(0, 8)}…</p>
            </div>
          {/each}
        {:else}
          <p class="text-muted text-sm">No merged revisions for this verse yet. Propose one in the <a class="text-accent underline" href="/translate">translator</a>.</p>
        {/if}
      </section>
      <section>
        <h3 class="text-sm text-muted mb-1">Where is this verse used?</h3>
        {#if citationCount}
          <p class="text-sm text-muted mb-1">{citationCount} citation(s) across the web — reading is always free.</p>
          {#each citationSources.slice(0, 8) as src (src)}<p class="font-mono text-xs text-muted">┌ {src}</p>{/each}
        {:else}
          <p class="text-sm text-muted">0 citations yet. Sites that embed this verse show up here — free, no payment to read.</p>
        {/if}
      </section>
    </div>
  </div>
{/if}
