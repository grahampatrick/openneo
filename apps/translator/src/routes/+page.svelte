<script lang="ts">
  import { onMount } from 'svelte'
  import { PortalAuth, browserStore, type KeyValueStore } from '$lib/auth-client'
  import { browserSigner } from '$lib/signer'
  import { wordDiff, hasChange } from '$lib/diff'
  import { submitProposal } from '$lib/proposal'
  import {
    generateSeckey,
    loadLocalSeckey,
    saveLocalSeckey,
    nsecEncode,
    nsecDecode,
    signerFor,
  } from '$lib/identity'
  import { createRelayPool } from '$lib/relays'
  import { activeSigner, activeSeckey, recordAuthSource } from '$lib/active-signer'
  import { fetchReviewQueue, castVote, maybeMerge, buildWithdrawal, type ReviewableProposal } from '@neoark/review'
  import { statusBadge } from '$lib/status'
  import { fetchBookList, fetchBook, chaptersOf, versesOf, verseText, type BookMeta, type BookData } from '$lib/corpus'
  import { fetchProfile, publishProfile, isLightningAddress, type Profile } from '$lib/profile'
  import { fetchGovernance, publishGovernance, defaultQuorumFor } from '$lib/governance'
  import type { Governance } from '@neoark/translation-protocol'
  import type { RelayPool } from '@neoark/relay'
  import type { SessionClaims } from '@neoark/auth'

  let auth: PortalAuth
  let store: KeyValueStore
  let pool: RelayPool
  let session: SessionClaims | null = null
  let loginError = ''
  let newKeyNsec = ''
  let showImport = false
  let nsecInput = ''

  type Tab = 'propose' | 'mine' | 'review' | 'profile'
  let tab: Tab = 'propose'

  // Profile (kind:0 lud16) — the payout target.
  let profile: Profile | null = null
  let profileName = ''
  let profileLud16 = ''
  let profileSaved = false

  // The verse being worked on — chosen via the picker over the full 85-book corpus.
  const translationId = 'neoos-en-2026'
  let pickBook = 'GEN'
  let pickChapter = 1
  let pickVerse = 6
  $: ref = { translationId, book: pickBook, chapter: pickChapter, verse: pickVerse }

  let books: BookMeta[] = []
  let book: BookData | null = null // the currently-selected book's verses
  let corpusError = ''
  let currentText = ''
  let newText = ''
  let rationale = ''

  // Load the small book list, then the default book.
  async function ensureCorpus() {
    if (books.length || corpusError) return
    try {
      books = await fetchBookList()
      if (!books.some((b) => b.id === pickBook)) pickBook = books[0]?.id ?? 'GEN'
      await loadBook()
    } catch (e) {
      corpusError = e instanceof Error ? e.message : String(e)
    }
  }
  async function loadBook() {
    corpusError = ''
    try {
      book = await fetchBook(pickBook)
      const chs = chaptersOf(book)
      if (!chs.includes(pickChapter)) pickChapter = chs[0] ?? 1
      const vs = versesOf(book, pickChapter)
      if (!vs.includes(pickVerse)) pickVerse = vs[0] ?? 1
      loadVerse()
    } catch (e) {
      corpusError = e instanceof Error ? e.message : String(e)
    }
  }
  function loadVerse() {
    if (!book) return
    currentText = verseText(book, pickChapter, pickVerse)
    newText = currentText
  }
  async function onBook() {
    await loadBook()
  }
  function onChapter() {
    if (!book) return
    pickVerse = versesOf(book, pickChapter)[0] ?? 1
    loadVerse()
  }
  $: chapterOpts = book ? chaptersOf(book) : []
  $: verseOpts = book ? versesOf(book, pickChapter) : []

  let busy = ''
  let notice = ''
  let queue: ReviewableProposal[] = []
  let governance: Governance | null = null

  const now = () => Math.floor(Date.now() / 1000)
  $: maintainers = governance?.maintainers ?? []
  $: isMaintainer = !!session && maintainers.includes(session.pubkey.toLowerCase())
  $: governed = maintainers.length > 0

  onMount(() => {
    store = browserStore()
    auth = PortalAuth.create({ jwtSecret: localKey(), store })
    session = auth.currentSession()
    pool = createRelayPool()
    if (session) {
      void refresh()
      void ensureCorpus()
      void loadProfile()
    }
  })

  async function loadProfile() {
    if (!session) return
    try {
      profile = await fetchProfile(pool, session.pubkey)
      profileName = profile?.name ?? ''
      profileLud16 = profile?.lud16 ?? ''
    } catch {
      /* relays unreachable — leave editable */
    }
  }

  async function saveProfile() {
    notice = ''
    if (profileLud16.trim() && !isLightningAddress(profileLud16)) {
      notice = 'Lightning address must look like name@domain.'
      return
    }
    const signer = activeSigner(store)
    if (!signer) {
      notice = 'Your signer is unavailable — please sign in again.'
      return
    }
    busy = 'Publishing your profile…'
    try {
      const next: Profile = {}
      if (profileName.trim()) next.name = profileName.trim()
      if (profileLud16.trim()) next.lud16 = profileLud16.trim()
      await publishProfile(next, signer, pool, now())
      profile = next
      profileSaved = true
    } catch (e) {
      notice = 'Save failed: ' + (e instanceof Error ? e.message : String(e))
    }
    busy = ''
  }

  $: hasPayoutAddress = !!profile?.lud16
  // Safety net: ensure the corpus loads whenever a signed-in user views Propose.
  $: if (session && tab === 'propose' && books.length === 0 && !corpusError) void ensureCorpus()

  function localKey(): string {
    let k = store.get('neoark.translator.localsecret')
    if (!k) {
      k = crypto.randomUUID()
      store.set('neoark.translator.localsecret', k)
    }
    return k
  }

  // --- auth ---
  /** Side effects to run after any successful sign-in. */
  async function afterLogin() {
    void ensureCorpus()
    void loadProfile()
    await refresh()
  }

  async function signInWith(hex: string, source: 'extension' | 'local') {
    recordAuthSource(store, source)
    const s = await auth.loginWithNip07(signerFor(hex))
    session = s.claims
    await afterLogin()
  }
  async function createKeyAndSignIn() {
    loginError = ''
    try {
      let hex = loadLocalSeckey(store)
      if (!hex) {
        hex = generateSeckey()
        saveLocalSeckey(store, hex)
        newKeyNsec = nsecEncode(hex)
      }
      await signInWith(hex, 'local')
    } catch (e) {
      loginError = e instanceof Error ? e.message : String(e)
    }
  }
  async function importNsec() {
    loginError = ''
    try {
      const hex = nsecDecode(nsecInput)
      saveLocalSeckey(store, hex)
      await signInWith(hex, 'local')
    } catch (e) {
      loginError = e instanceof Error ? e.message : String(e)
    }
  }
  async function loginWithExtension() {
    loginError = ''
    const signer = browserSigner()
    if (!signer) {
      loginError = 'No Nostr extension found. Install Alby or nos2x — or just use “Create a key”.'
      return
    }
    try {
      recordAuthSource(store, 'extension')
      const s = await auth.loginWithNip07(signer)
      session = s.claims
      await afterLogin()
    } catch (e) {
      loginError = e instanceof Error ? e.message : String(e)
    }
  }
  function logout() {
    auth.logout()
    session = null
    queue = []
  }
  function copyNsec() {
    if (navigator.clipboard) void navigator.clipboard.writeText(newKeyNsec)
  }

  // --- proposals + reviews (real, against relays) ---
  async function refresh() {
    busy = 'Loading from relays…'
    try {
      governance = await fetchGovernance(pool, ref.translationId)
      const gov = governance ? { maintainers: governance.maintainers } : {}
      queue = await fetchReviewQueue(pool, ref.translationId, governance?.quorum, gov)
    } catch (e) {
      notice = 'Could not reach relays: ' + (e instanceof Error ? e.message : String(e))
    }
    busy = ''
  }

  // Council editor (founding bootstrap + amendments). One pubkey per line.
  let councilText = ''
  let councilQuorum = 1

  function openCouncilEditor() {
    councilText = (maintainers.length ? maintainers : session ? [session.pubkey] : []).join('\n')
    councilQuorum = governance?.quorum.minReviewers ?? 1
  }

  /** Publish/amend the council + quorum. Bootstraps to the signed-in user if empty. */
  async function saveCouncil() {
    if (!session) return
    const list = councilText
      .split('\n')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[0-9a-f]{64}$/.test(s))
    if (list.length === 0) list.push(session.pubkey.toLowerCase())
    const q = Math.max(1, Math.min(councilQuorum || 1, list.length))
    busy = 'Publishing the council…'
    try {
      const signer = activeSigner(store)
      if (!signer) throw new Error('signer unavailable')
      await publishGovernance(pool, signer, ref.translationId, list, now(), { minReviewers: q, approvalThreshold: 0.67 })
      await refresh()
      notice = `✓ Council of ${list.length} published — quorum ${q}. Only these maintainers' votes merge.`
    } catch (e) {
      notice = 'Could not set governance: ' + (e instanceof Error ? e.message : String(e))
    }
    busy = ''
  }

  /** One-click bootstrap: just the signed-in user, quorum 1. */
  async function becomeFoundingMaintainer() {
    if (!session) return
    busy = 'Publishing the founding council…'
    try {
      const signer = activeSigner(store)
      if (!signer) throw new Error('signer unavailable')
      await publishGovernance(pool, signer, ref.translationId, [session.pubkey], now(), defaultQuorumFor(1))
      await refresh()
      notice = '✓ You are the founding maintainer (quorum 1). Add more maintainers anytime via "Edit council".'
    } catch (e) {
      notice = 'Could not set governance: ' + (e instanceof Error ? e.message : String(e))
    }
    busy = ''
  }

  async function submit() {
    notice = ''
    const signer = activeSigner(store)
    if (!signer) {
      notice = 'Your signer is unavailable — please sign in again.'
      return
    }
    busy = 'Signing & publishing to relays…'
    try {
      const r = await submitProposal({ ref, newText, rationale, createdAt: now() }, signer, pool)
      notice = `✓ Published proposal ${r.proposal.id.slice(0, 12)}… to ${r.relaysAccepted} relay(s). Now pending peer review.`
      rationale = ''
      tab = 'mine'
      await refresh()
    } catch (e) {
      notice = 'Publish failed: ' + (e instanceof Error ? e.message : String(e))
    }
    busy = ''
  }

  async function vote(q: ReviewableProposal, v: 'approve' | 'reject') {
    const signer = activeSigner(store)
    if (!signer) {
      notice = 'Your signer is unavailable — please sign in again.'
      return
    }
    busy = 'Publishing your review…'
    try {
      const r = await castVote({ proposalId: q.proposal.id, vote: v, comment: '', createdAt: now() }, signer, pool)
      notice = r.relaysAccepted
        ? `✓ ${v === 'approve' ? 'Approved' : 'Rejected'} — published to ${r.relaysAccepted} relay(s).`
        : `⚠ Your ${v} was signed but NO relay accepted it. Check your connection and try again.`
      await refresh()
    } catch (e) {
      notice = 'Review failed: ' + (e instanceof Error ? e.message : String(e))
    }
    busy = ''
  }

  /** Withdraw your own proposal (NIP-09 deletion). It leaves the review queue. */
  async function withdraw(q: ReviewableProposal) {
    const signer = activeSigner(store)
    if (!signer) {
      notice = 'Your signer is unavailable — please sign in again.'
      return
    }
    busy = 'Withdrawing…'
    try {
      const event = await signer.signEvent(buildWithdrawal(q.proposal.id, now()))
      const acks = await pool.publish(event)
      const ok = acks.filter((a) => a.ok).length
      notice = ok
        ? `✓ Withdrew ${q.proposal.id.slice(0, 12)}… (${ok} relay(s)) — it drops from the review queue.`
        : `⚠ Withdrawal signed but NO relay accepted it — try again.`
      await refresh()
    } catch (e) {
      notice = 'Withdraw failed: ' + (e instanceof Error ? e.message : String(e))
    }
    busy = ''
  }

  async function merge(q: ReviewableProposal) {
    if (governed && !isMaintainer) {
      notice = 'Only a council maintainer can merge this translation.'
      return
    }
    // A raw local key OR the NIP-07 extension can sign the merge.
    const merger = activeSeckey(store) ?? activeSigner(store)
    if (!merger) {
      notice = 'Your signer is unavailable — please sign in again.'
      return
    }
    busy = 'Merging…'
    try {
      const gov = governed ? { maintainers, mergerPubkey: session?.pubkey } : {}
      const r = await maybeMerge(q.proposal, q.reviews, merger, now(), pool, governance?.quorum, gov)
      if (!r.merged) {
        notice = `Not merged: ${r.reason}`
      } else if (!r.relaysAccepted) {
        notice = `⚠ Merge was signed but NO relay accepted it — nothing persisted. Check your connection and try Merge again.`
      } else {
        notice = `✓ Merged — published to ${r.relaysAccepted} relay(s), anchored to the day’s Bitcoin batch.`
      }
      await refresh()
    } catch (e) {
      notice = 'Merge failed: ' + (e instanceof Error ? e.message : String(e))
    }
    busy = ''
  }

  $: pubkey = session?.pubkey ?? ''
  $: mine = queue.filter((q) => q.proposal.author === pubkey)
  const myVoteOn = (q: ReviewableProposal): 'approve' | 'reject' | null =>
    q.reviews.find((r) => r.reviewer === pubkey)?.vote ?? null
  // To review: others' proposals, not merged, and not ones I've already voted on
  // (unless I approved and it's now ready for me to merge).
  $: reviewable = queue.filter(
    (q) => q.proposal.author !== pubkey && !q.merged && (myVoteOn(q) === null || (myVoteOn(q) === 'approve' && q.mergeReady)),
  )
  $: tabs = [
    { id: 'propose' as Tab, label: 'Propose' },
    { id: 'mine' as Tab, label: mine.length ? `My proposals (${mine.length})` : 'My proposals' },
    { id: 'review' as Tab, label: reviewable.length ? `Review (${reviewable.length})` : 'Review' },
    { id: 'profile' as Tab, label: hasPayoutAddress ? 'Profile' : 'Profile ⚠' },
  ]
  $: diff = wordDiff(currentText, newText)
  $: changed = hasChange(currentText, newText)
</script>

<svelte:head><title>OpenNeo · Translator Portal</title></svelte:head>

{#if !session}
  <div class="text-center py-16 max-w-md mx-auto">
    <h1 class="font-mono text-2xl text-accent mb-2">Translator Portal</h1>
    <p class="text-muted mb-6">Propose corrections to NeoOS. No email, no account — your identity is a key.</p>
    <button on:click={createKeyAndSignIn} class="w-full px-5 py-3 rounded bg-accent text-bg font-mono font-bold mb-3">Create a key &amp; sign in</button>
    <p class="text-muted text-xs mb-6">One click. A Nostr key is generated and stored in this browser — back it up to keep it.</p>
    <div class="flex items-center gap-3 text-muted text-xs font-mono mb-4"><span class="flex-1 border-t border-border"></span>or<span class="flex-1 border-t border-border"></span></div>
    <button on:click={loginWithExtension} class="w-full px-5 py-2 rounded border border-border font-mono text-sm mb-2">I have a Nostr extension (NIP-07)</button>
    <button on:click={() => (showImport = !showImport)} class="text-muted text-sm font-mono underline">Import an existing key (nsec)</button>
    {#if showImport}
      <div class="mt-3 flex gap-2">
        <input bind:value={nsecInput} placeholder="nsec1…" aria-label="nsec key" class="flex-1 bg-panel border border-border rounded p-2 font-mono text-sm" />
        <button on:click={importNsec} class="px-4 rounded border border-border font-mono text-sm">Import</button>
      </div>
    {/if}
    {#if loginError}<p class="text-red mt-4 font-mono text-sm">{loginError}</p>{/if}
  </div>
{:else}
  {#if newKeyNsec}
    <div class="border border-accent rounded-lg bg-panel p-4 mb-6">
      <p class="font-mono text-accent text-sm mb-1">⚠ Back up your key</p>
      <p class="text-muted text-xs mb-2">This is your identity — it lives only in this browser. Save it (or import into a wallet). Without it you can't sign in elsewhere or recover this account.</p>
      <div class="flex gap-2 items-center">
        <code class="flex-1 bg-bg border border-border rounded p-2 font-mono text-xs break-all">{newKeyNsec}</code>
        <button on:click={copyNsec} class="px-3 py-2 rounded border border-border font-mono text-xs">copy</button>
        <button on:click={() => (newKeyNsec = '')} class="px-3 py-2 rounded border border-border font-mono text-xs text-muted">I saved it</button>
      </div>
    </div>
  {/if}

  <div class="flex items-center justify-between mb-4">
    <p class="font-mono text-sm">Signed in as <span class="text-accent">{session.sub.slice(0, 18)}…</span> <span class="text-muted">({session.method})</span></p>
    <button on:click={logout} class="text-muted text-sm font-mono">log out</button>
  </div>

  <div class="flex gap-1 mb-5 font-mono text-sm">
    {#each tabs as t (t.id)}
      <button on:click={() => (tab = t.id)} class="px-3 py-1.5 rounded border border-border" class:bg-accent={tab === t.id} class:text-bg={tab === t.id}>{t.label}</button>
    {/each}
    <button on:click={refresh} class="ml-auto text-muted text-xs">↻ refresh</button>
  </div>

  {#if !hasPayoutAddress && tab !== 'profile'}
    <div class="border border-gold rounded-lg bg-panel p-3 mb-3 flex items-center justify-between gap-3">
      <span class="text-gold font-mono text-xs">⚠ Set a Lightning address to get paid when your work is merged.</span>
      <button on:click={() => (tab = 'profile')} class="px-3 py-1 rounded border border-border font-mono text-xs text-accent whitespace-nowrap">Set it up</button>
    </div>
  {/if}

  {#if tab === 'review'}
    {#if governed}
      <div class="flex items-center justify-between gap-3 mb-3">
        <p class="font-mono text-xs text-muted">Council of {maintainers.length} · quorum {governance?.quorum.minReviewers}{isMaintainer ? ' · you are a maintainer' : ' · your votes are a community signal'}.</p>
        {#if isMaintainer}<button on:click={openCouncilEditor} class="px-3 py-1 rounded border border-border font-mono text-xs text-accent whitespace-nowrap">Edit council</button>{/if}
      </div>
    {:else}
      <div class="border border-gold rounded-lg bg-panel p-3 mb-3 flex items-center justify-between gap-3">
        <span class="text-gold font-mono text-xs">⚠ No council set — anyone's votes can merge (ungoverned). Establish a council to gate merges.</span>
        <button disabled={!!busy} on:click={becomeFoundingMaintainer} class="px-3 py-1 rounded border border-border font-mono text-xs text-accent whitespace-nowrap">Become founding maintainer</button>
      </div>
    {/if}

    {#if councilText !== '' || (governed && isMaintainer)}
      <details class="border border-border rounded-lg bg-panel p-3 mb-3" open={councilText !== ''}>
        <!-- svelte-ignore a11y-no-redundant-roles -->
        <summary class="font-mono text-xs text-muted cursor-pointer" on:click={openCouncilEditor}>Edit council &amp; quorum</summary>
        <label for="councilText" class="block font-mono text-xs text-muted mt-3 mb-1">Maintainer pubkeys (hex, one per line)</label>
        <textarea id="councilText" bind:value={councilText} rows="3" class="w-full bg-bg border border-border rounded p-2 mb-2 font-mono text-xs"></textarea>
        <label for="councilQ" class="block font-mono text-xs text-muted mb-1">Quorum (maintainer approvals needed to merge)</label>
        <input id="councilQ" type="number" min="1" bind:value={councilQuorum} class="w-24 bg-bg border border-border rounded p-2 mb-3 font-mono text-xs" />
        <div><button disabled={!!busy} on:click={saveCouncil} class="px-4 py-1.5 rounded bg-accent text-bg font-mono text-xs font-bold">Publish council</button></div>
        <p class="text-muted text-xs mt-2">Tip: to merge solo, keep quorum 1 and have a second identity propose (you can't approve your own proposal).</p>
      </details>
    {/if}
  {/if}

  {#if busy}<p class="text-accent font-mono text-xs mb-3">{busy}</p>{/if}
  {#if notice}<p class="font-mono text-xs mb-3 text-muted">{notice}</p>{/if}

  {#if tab === 'propose'}
    {#if corpusError}
      <p class="text-red font-mono text-xs mb-2">Couldn't load the book list ({corpusError}). <button class="underline text-accent" on:click={ensureCorpus}>Retry</button> — or pick a book once it loads.</p>
    {:else if books.length === 0}
      <p class="text-muted font-mono text-xs mb-3">Loading books…</p>
    {/if}

    <div class="flex flex-wrap gap-2 mb-3 items-end">
      <div>
        <label for="pBook" class="block font-mono text-xs text-muted mb-1">Book</label>
        <select id="pBook" bind:value={pickBook} on:change={onBook} disabled={books.length === 0} class="bg-panel border border-border rounded px-2 py-1 font-mono text-sm">
          {#each books as b (b.id)}<option value={b.id}>{b.hebrew} — {b.english}</option>{/each}
        </select>
      </div>
      <div>
        <label for="pChap" class="block font-mono text-xs text-muted mb-1">Chapter</label>
        <select id="pChap" bind:value={pickChapter} on:change={onChapter} disabled={!book} class="bg-panel border border-border rounded px-2 py-1 font-mono text-sm">
          {#each chapterOpts as c (c)}<option value={c}>{c}</option>{/each}
        </select>
      </div>
      <div>
        <label for="pVerse" class="block font-mono text-xs text-muted mb-1">Verse</label>
        <select id="pVerse" bind:value={pickVerse} on:change={loadVerse} disabled={!book} class="bg-panel border border-border rounded px-2 py-1 font-mono text-sm">
          {#each verseOpts as v (v)}<option value={v}>{v}</option>{/each}
        </select>
      </div>
    </div>

    <h2 class="font-mono text-accent mb-1">{ref.book} {ref.chapter}:{ref.verse}</h2>
    {#if currentText}<p class="text-muted text-sm mb-1 italic">Current: {currentText}</p>{/if}
    <p class="text-muted text-sm mb-4">Edit the verse, give a rationale, and publish a signed proposal to the relays.</p>
    <label for="newText" class="block font-mono text-xs text-muted mb-1">Proposed text</label>
    <textarea id="newText" bind:value={newText} rows="3" class="w-full bg-panel border border-border rounded p-2 mb-4 font-sans"></textarea>
    <div class="mb-4">
      <p class="font-mono text-xs text-muted mb-1">Diff</p>
      <p class="leading-relaxed">{#each diff as t}<span class:line-through={t.op === 'remove'} class:text-red={t.op === 'remove'} class:text-green={t.op === 'add'}>{t.text}</span>{/each}</p>
    </div>
    <label for="rationale" class="block font-mono text-xs text-muted mb-1">Rationale</label>
    <input id="rationale" bind:value={rationale} placeholder="Hebrew raqia = a solid surface…" class="w-full bg-panel border border-border rounded p-2 mb-4 font-sans" />
    <button disabled={!changed || !rationale.trim() || !!busy} on:click={submit} class="px-5 py-2 rounded font-mono font-bold disabled:opacity-40" class:bg-accent={changed && rationale.trim()} class:text-bg={changed && rationale.trim()}>
      Sign &amp; publish proposal
    </button>
  {:else if tab === 'mine'}
    {#if mine.length === 0}
      <p class="text-muted text-sm">You haven't published any proposals yet. Go to <button class="text-accent underline" on:click={() => (tab = 'propose')}>Propose</button>.</p>
    {:else}
      {#each mine as q (q.proposal.id)}
        {@const badge = statusBadge({ state: q.merged ? 'merged' : q.mergeReady ? 'approved' : 'pending', approvals: q.approvals, rejections: q.rejections, reviewers: q.reviewers, needed: q.needed })}
        <div class="border border-border rounded-lg bg-panel p-4 mb-3">
          <div class="flex justify-between items-center mb-1">
            <span class="font-mono text-accent text-sm">{q.proposal.ref.book} {q.proposal.ref.chapter}:{q.proposal.ref.verse}</span>
            <span class="font-mono text-xs" style="color:{badge.color}">● {badge.text}</span>
          </div>
          <p class="text-sm mb-1">{q.proposal.newText}</p>
          <p class="text-muted text-xs mb-2">{q.proposal.rationale}</p>
          {#if !q.merged}
            <button disabled={!!busy} on:click={() => withdraw(q)} class="px-3 py-1 rounded border border-border font-mono text-xs text-muted">Withdraw</button>
          {/if}
        </div>
      {/each}
    {/if}
  {:else if tab === 'review'}
    {#if reviewable.length === 0}
      <p class="text-muted text-sm">No proposals from other translators to review right now. (You can't review your own.)</p>
    {:else}
      {#each reviewable as q (q.proposal.id)}
        <div class="border border-border rounded-lg bg-panel p-4 mb-3">
          <div class="flex justify-between items-center mb-1">
            <span class="font-mono text-accent text-sm">{q.proposal.ref.book} {q.proposal.ref.chapter}:{q.proposal.ref.verse}</span>
            <span class="font-mono text-xs text-muted">by {q.proposal.author.slice(0, 10)}… · {q.governed ? 'council' : ''} {q.approvals}/{q.reviewers} approvals{q.needed ? `, ${q.needed} more` : ''}{q.governed && q.communityApprovals ? ` · +${q.communityApprovals} community` : ''}</span>
          </div>
          <p class="text-sm mb-1">{q.proposal.newText}</p>
          <p class="text-muted text-xs mb-3">{q.proposal.rationale}</p>
          <div class="flex gap-2">
            <button disabled={!!busy} on:click={() => vote(q, 'approve')} class="px-3 py-1.5 rounded border border-border font-mono text-xs text-green">Approve</button>
            <button disabled={!!busy} on:click={() => vote(q, 'reject')} class="px-3 py-1.5 rounded border border-border font-mono text-xs text-red">Reject</button>
            {#if q.mergeReady && (!governed || isMaintainer)}
              <button disabled={!!busy} on:click={() => merge(q)} class="px-3 py-1.5 rounded bg-accent text-bg font-mono text-xs font-bold ml-auto">Merge (quorum met)</button>
            {:else if q.mergeReady && governed}
              <span class="ml-auto font-mono text-xs text-muted">awaiting a maintainer to merge</span>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  {:else}
    <h2 class="font-mono text-accent mb-1">Your profile</h2>
    <p class="text-muted text-sm mb-4">Set a Lightning address to receive payouts when your work is merged. Published as a signed Nostr profile (kind:0) — no email, no account.</p>
    <label for="pName" class="block font-mono text-xs text-muted mb-1">Display name (optional)</label>
    <input id="pName" bind:value={profileName} placeholder="Sha'ul" class="w-full bg-panel border border-border rounded p-2 mb-4 font-sans" />
    <label for="pLud16" class="block font-mono text-xs text-muted mb-1">Lightning address (where you get paid)</label>
    <input id="pLud16" bind:value={profileLud16} placeholder="you@walletofsatoshi.com" class="w-full bg-panel border border-border rounded p-2 mb-2 font-mono" />
    <p class="text-muted text-xs mb-4">A Lightning Address looks like <code>name@domain</code> (from Alby, Wallet of Satoshi, Strike, etc.).</p>
    <button disabled={!!busy} on:click={saveProfile} class="px-5 py-2 rounded bg-accent text-bg font-mono font-bold disabled:opacity-40">Sign &amp; publish profile</button>
    {#if profileSaved}<p class="text-green font-mono text-sm mt-3">✓ Profile published. You'll be paid at {profileLud16} when your merges land.</p>{/if}
  {/if}
{/if}
