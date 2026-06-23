<script lang="ts">
  import { onMount } from 'svelte'
  import { base } from '$app/paths'
  import { fetchCorpus, type Corpus, type Verse, type BookMeta } from '$lib/corpus'
  import { formatReference } from '$lib/reference'
  import { currentRef } from '$lib/stores'
  import { anchorLabel, type Revision } from '$lib/history'
  import { createReaderPool, fetchVerseData } from '$lib/relay-data'
  import { isCanon66, canon66Rank } from '$lib/canon'
  import type { RelayPool } from '@neoark/relay'

  let corpus: Corpus | null = null
  let error = ''
  let verses: Verse[] = []
  let books: BookMeta[] = []
  let selected: Verse | null = null
  let pool: RelayPool | null = null
  let only66 = false // one-click revert to the Protestant 66

  // Live verse data from the relays (queried when a verse is opened).
  let revisions: Revision[] = []
  let citationCount = 0
  let citationSources: string[] = []
  let loadingVerse = false

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
  }

  function pickBook(e: Event) {
    const id = (e.target as HTMLSelectElement).value
    currentRef.set({ bookId: id, chapter: 1 })
    load()
  }
  function pickChapter(c: number) {
    currentRef.update((r) => ({ ...r, chapter: c }))
    load()
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
      // Guard against a race if the user opened a different verse meanwhile.
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
  function closeVerse() {
    selected = null
  }

  // The book list shown in the picker: all 87, or the Protestant 66 (in standard order).
  $: visibleBooks = only66
    ? books.filter((b) => isCanon66(b.id)).sort((a, b) => canon66Rank(a.id) - canon66Rank(b.id))
    : books

  function set66(value: boolean) {
    only66 = value
    // If the current book isn't in the 66, jump to Genesis.
    if (only66 && !isCanon66($currentRef.bookId)) {
      currentRef.set({ bookId: 'GEN', chapter: 1 })
      load()
    }
  }

  $: chapters = corpus?.chapters($currentRef.bookId) ?? []
  $: refLabel = corpus ? formatReference($currentRef, corpus) : ''
</script>

<svelte:head><title>{refLabel || 'OpenNeo Reader'}</title></svelte:head>

{#if error}
  <p class="text-red-400 font-mono">Could not load corpus: {error}</p>
{:else if !corpus}
  <p class="text-muted font-mono">Loading corpus…</p>
{:else}
  <div class="flex flex-wrap items-center gap-3 mb-4">
    <select on:change={pickBook} value={$currentRef.bookId}
      class="bg-panel border border-border rounded px-2 py-1 font-mono text-sm">
      {#each visibleBooks as b (b.id)}
        <option value={b.id}>{b.hebrew} — {b.english}</option>
      {/each}
    </select>
    <div class="flex gap-1 flex-wrap">
      {#each chapters as c (c)}
        <button on:click={() => pickChapter(c)}
          class="px-2 py-1 rounded text-sm font-mono border border-border"
          class:bg-accent={c === $currentRef.chapter} class:text-bg={c === $currentRef.chapter}>{c}</button>
      {/each}
    </div>
    <div class="ml-auto flex items-center gap-2" title="Show the 66-book Protestant canon or the full 87-book set">
      <span class="text-xs text-muted font-mono">canon</span>
      <div class="inline-flex rounded-md border border-border overflow-hidden font-mono text-sm">
        <button on:click={() => set66(true)} class="px-3 py-1"
          class:bg-accent={only66} class:text-bg={only66} class:text-muted={!only66}>66</button>
        <button on:click={() => set66(false)} class="px-3 py-1 border-l border-border"
          class:bg-accent={!only66} class:text-bg={!only66} class:text-muted={only66}>87</button>
      </div>
    </div>
  </div>

  <h1 class="font-mono text-xl mb-3 text-accent">{refLabel}</h1>

  <div>
    {#each verses as v (v.verse)}
      <p class="mb-1 leading-relaxed">
        <button class="text-muted font-mono text-xs mr-1 align-top" on:click={() => openVerse(v)}>{v.verse}</button>
        <span>{v.text}</span>
      </p>
    {/each}
  </div>

  {#if selected}
    <!-- Verse detail as a modal pop-up, not appended at the bottom. -->
    <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8" on:click|self={closeVerse} role="presentation">
      <div class="w-full max-w-xl border border-border rounded-lg bg-panel p-5 shadow-2xl mt-8" role="dialog" aria-modal="true">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-mono text-accent">{corpus.bookMeta(selected.bookId)?.hebrew} {selected.chapter}:{selected.verse}</h2>
          <button class="text-muted text-sm" on:click={closeVerse}>close ✕</button>
        </div>

        <p class="text-sm mb-4">{selected.text}</p>

        {#if loadingVerse}<p class="text-muted font-mono text-xs mb-3">Loading from relays…</p>{/if}

        <section class="mb-4">
          <h3 class="font-mono text-sm text-muted mb-2">Change history</h3>
          {#if revisions.length}
            {#each revisions as rev (rev.mergeEventId)}
              {@const label = anchorLabel(rev.anchor)}
              <div class="text-sm mb-2">
                <span class="inline-block w-2 h-2 rounded-full mr-2" style="background:{label.color}"></span>
                <span class="font-mono text-xs" style="color:{label.color}">merged · {label.text}</span>
                <p class="mt-1">{rev.text}</p>
                <p class="text-muted text-xs mt-1">{rev.rationale} — by {rev.maintainer.slice(0, 8)}…</p>
              </div>
            {/each}
          {:else}
            <p class="text-muted text-sm">No merged revisions for this verse yet. Propose one in the <a class="text-accent underline" href="/translate">translator</a>.</p>
          {/if}
        </section>

        <section>
          <h3 class="font-mono text-sm text-muted mb-1">Where is this verse used?</h3>
          {#if citationCount}
            <p class="text-sm text-muted mb-1">{citationCount} citation(s) across the web — reading is always free.</p>
            {#each citationSources.slice(0, 8) as src (src)}
              <p class="font-mono text-xs text-muted">┌ {src}</p>
            {/each}
          {:else}
            <p class="text-sm text-muted">0 citations yet. Sites that embed this verse (via the cite SDK) show up here — free, no payment to read.</p>
          {/if}
        </section>
      </div>
    </div>
  {/if}
{/if}
