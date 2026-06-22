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
  import { fetchReviewQueue, castVote, maybeMerge, type ReviewableProposal } from '@neoark/review'
  import { statusBadge } from '$lib/status'
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

  type Tab = 'propose' | 'mine' | 'review'
  let tab: Tab = 'propose'

  // The verse being worked on (demo: GEN 1:6; a corpus picker is a later add).
  const ref = { translationId: 'neoos-en-2026', book: 'GEN', chapter: 1, verse: 6 }
  const currentText = 'And Elohiym said, “Let there be an expanse between the waters.”'
  let newText = currentText
  let rationale = ''

  let busy = ''
  let notice = ''
  let queue: ReviewableProposal[] = []

  const now = () => Math.floor(Date.now() / 1000)

  onMount(() => {
    store = browserStore()
    auth = PortalAuth.create({ jwtSecret: localKey(), store })
    session = auth.currentSession()
    pool = createRelayPool()
    if (session) void refresh()
  })

  function localKey(): string {
    let k = store.get('neoark.translator.localsecret')
    if (!k) {
      k = crypto.randomUUID()
      store.set('neoark.translator.localsecret', k)
    }
    return k
  }

  // --- auth ---
  async function signInWith(hex: string, source: 'extension' | 'local') {
    recordAuthSource(store, source)
    const s = await auth.loginWithNip07(signerFor(hex))
    session = s.claims
    await refresh()
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
      await refresh()
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
      queue = await fetchReviewQueue(pool, ref.translationId)
    } catch (e) {
      notice = 'Could not reach relays: ' + (e instanceof Error ? e.message : String(e))
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
      await castVote({ proposalId: q.proposal.id, vote: v, comment: '', createdAt: now() }, signer, pool)
      notice = `✓ ${v === 'approve' ? 'Approved' : 'Rejected'} ${q.proposal.id.slice(0, 12)}…`
      await refresh()
    } catch (e) {
      notice = 'Review failed: ' + (e instanceof Error ? e.message : String(e))
    }
    busy = ''
  }

  async function merge(q: ReviewableProposal) {
    const key = activeSeckey(store)
    if (!key) {
      notice = 'Merging signs a maintainer event — available when you hold a local key (Create a key). NIP-07 merge support is coming.'
      return
    }
    busy = 'Merging…'
    try {
      const r = await maybeMerge(q.proposal, q.reviews, key, now(), pool)
      notice = r.merged ? `✓ Merged — anchored to the day’s Bitcoin batch.` : `Not merged: ${r.reason}`
      await refresh()
    } catch (e) {
      notice = 'Merge failed: ' + (e instanceof Error ? e.message : String(e))
    }
    busy = ''
  }

  $: pubkey = session?.pubkey ?? ''
  $: mine = queue.filter((q) => q.proposal.author === pubkey)
  $: reviewable = queue.filter((q) => q.proposal.author !== pubkey && !q.merged)
  $: tabs = [
    { id: 'propose' as Tab, label: 'Propose' },
    { id: 'mine' as Tab, label: mine.length ? `My proposals (${mine.length})` : 'My proposals' },
    { id: 'review' as Tab, label: reviewable.length ? `Review (${reviewable.length})` : 'Review' },
  ]
  $: diff = wordDiff(currentText, newText)
  $: changed = hasChange(currentText, newText)
</script>

<svelte:head><title>NeoArk · Translator Portal</title></svelte:head>

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

  {#if busy}<p class="text-accent font-mono text-xs mb-3">{busy}</p>{/if}
  {#if notice}<p class="font-mono text-xs mb-3 text-muted">{notice}</p>{/if}

  {#if tab === 'propose'}
    <h2 class="font-mono text-accent mb-1">{ref.book} {ref.chapter}:{ref.verse}</h2>
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
          <p class="text-muted text-xs">{q.proposal.rationale}</p>
        </div>
      {/each}
    {/if}
  {:else}
    {#if reviewable.length === 0}
      <p class="text-muted text-sm">No proposals from other translators to review right now. (You can't review your own.)</p>
    {:else}
      {#each reviewable as q (q.proposal.id)}
        <div class="border border-border rounded-lg bg-panel p-4 mb-3">
          <div class="flex justify-between items-center mb-1">
            <span class="font-mono text-accent text-sm">{q.proposal.ref.book} {q.proposal.ref.chapter}:{q.proposal.ref.verse}</span>
            <span class="font-mono text-xs text-muted">by {q.proposal.author.slice(0, 10)}… · {q.approvals}/{q.reviewers} approvals, {q.needed} more needed</span>
          </div>
          <p class="text-sm mb-1">{q.proposal.newText}</p>
          <p class="text-muted text-xs mb-3">{q.proposal.rationale}</p>
          <div class="flex gap-2">
            <button disabled={!!busy} on:click={() => vote(q, 'approve')} class="px-3 py-1.5 rounded border border-border font-mono text-xs text-green">Approve</button>
            <button disabled={!!busy} on:click={() => vote(q, 'reject')} class="px-3 py-1.5 rounded border border-border font-mono text-xs text-red">Reject</button>
            {#if q.mergeReady}
              <button disabled={!!busy} on:click={() => merge(q)} class="px-3 py-1.5 rounded bg-accent text-bg font-mono text-xs font-bold ml-auto">Merge (quorum met)</button>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  {/if}
{/if}
