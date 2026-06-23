<script lang="ts">
  import { onMount } from 'svelte'
  import { base } from '$app/paths'
  import { fetchCorpus, type Corpus, type Verse, type BookMeta } from '$lib/corpus'
  import { formatReference } from '$lib/reference'
  import { currentRef, showNotes } from '$lib/stores'
  import { anchorLabel, sortRevisions, type Revision } from '$lib/history'
  import { notesForVerse, groupByVerse, type CommunityNote } from '$lib/notes'

  let corpus: Corpus | null = null
  let error = ''
  let verses: Verse[] = []
  let books: BookMeta[] = []
  let selected: Verse | null = null

  // Demo data sources (real wiring is @neoark/translation-protocol + @neoark/relay).
  let revisions: Revision[] = []
  let notes = groupByVerse([] as CommunityNote[])
  let usageCount = 0

  onMount(async () => {
    try {
      corpus = await fetchCorpus(base)
      books = corpus.loadedBooks()
      load()
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
  function openVerse(v: Verse) {
    selected = v
    // Live revision history, use-proofs, and notes are queried from relays in the
    // translator portal; wiring them into the reader is in progress. Until then
    // this panel shows honest empty state rather than placeholder data.
    revisions = sortRevisions([])
    usageCount = 0
  }

  $: chapters = corpus?.chapters($currentRef.bookId) ?? []
  $: refLabel = corpus ? formatReference($currentRef, corpus) : ''
  $: verseNotes = selected ? notesForVerse(notes, selected.bookId, selected.chapter, selected.verse) : []
</script>

<svelte:head><title>{refLabel || 'NeoArk Reader'}</title></svelte:head>

{#if error}
  <p class="text-red-400 font-mono">Could not load corpus: {error}</p>
{:else if !corpus}
  <p class="text-muted font-mono">Loading corpus…</p>
{:else}
  <div class="flex flex-wrap items-center gap-3 mb-4">
    <select on:change={pickBook} value={$currentRef.bookId}
      class="bg-panel border border-border rounded px-2 py-1 font-mono text-sm">
      {#each books as b (b.id)}
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
    <label class="ml-auto text-sm font-mono flex items-center gap-1">
      <input type="checkbox" bind:checked={$showNotes} /> notes
    </label>
  </div>

  <h1 class="font-mono text-xl mb-3 text-accent">{refLabel}</h1>

  <div>
    {#each verses as v (v.verse)}
      <p class="mb-1 leading-relaxed">
        <button class="text-muted font-mono text-xs mr-1 align-top" on:click={() => openVerse(v)}>{v.verse}</button>
        <span>{v.text}</span>
        {#if $showNotes && notesForVerse(notes, v.bookId, v.chapter, v.verse).length}
          <span class="text-accent text-xs">({notesForVerse(notes, v.bookId, v.chapter, v.verse).length} notes)</span>
        {/if}
      </p>
    {/each}
  </div>

  {#if selected}
    <aside class="mt-6 border border-border rounded-lg bg-panel p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-mono text-accent">{corpus.bookMeta(selected.bookId)?.hebrew} {selected.chapter}:{selected.verse}</h2>
        <button class="text-muted text-sm" on:click={() => (selected = null)}>close ✕</button>
      </div>

      <section class="mb-4">
        <h3 class="font-mono text-sm text-muted mb-2">Change history</h3>
        {#if revisions.length}
          {#each revisions as rev (rev.mergeEventId)}
            {@const label = anchorLabel(rev.anchor)}
            <div class="text-sm mb-2">
              <span class="inline-block w-2 h-2 rounded-full mr-2" style="background:{label.color}"></span>
              <span class="font-mono text-xs" style="color:{label.color}">{label.text}</span>
              <p class="text-muted text-xs mt-1">{rev.rationale}</p>
            </div>
          {/each}
        {:else}
          <p class="text-muted text-sm">No merged revisions indexed for this verse yet. Propose one in the <a class="text-accent underline" href="/translate">translator</a>.</p>
        {/if}
      </section>

      <section class="mb-4">
        <h3 class="font-mono text-sm text-muted mb-2">Community notes</h3>
        {#if verseNotes.length}
          {#each verseNotes as n (n.id)}
            <p class="text-sm mb-1"><span class="font-mono text-xs text-muted">{n.author.slice(0, 8)}…</span> {n.content}</p>
          {/each}
        {:else}
          <p class="text-muted text-sm">No notes yet. Be the first to sign one.</p>
        {/if}
      </section>

      <section>
        <h3 class="font-mono text-sm text-muted mb-1">Where is this verse used?</h3>
        <p class="text-sm text-muted">{usageCount} use-proof(s) on connected relays.</p>
      </section>
    </aside>
  {/if}
{/if}
