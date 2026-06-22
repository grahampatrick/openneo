<script lang="ts">
  import { onMount } from 'svelte'
  import { PortalAuth, browserStore } from '$lib/auth-client'
  import { browserSigner } from '$lib/signer'
  import { wordDiff, hasChange } from '$lib/diff'
  import { buildProposalEvent } from '$lib/proposal'
  import type { SessionClaims } from '@neoark/auth'

  let auth: PortalAuth
  let session: SessionClaims | null = null
  let loginError = ''

  // Demo verse (in production: loaded from the corpus, picked by the user).
  const ref = { translationId: 'neoos-en-2026', book: 'GEN', chapter: 1, verse: 6 }
  const currentText = 'And Elohiym said, “Let there be an expanse between the waters.”'
  let newText = currentText
  let rationale = ''
  let submitted = false

  onMount(() => {
    auth = PortalAuth.create({ jwtSecret: localKey(), store: browserStore() })
    session = auth.currentSession()
  })

  function localKey(): string {
    const store = browserStore()
    let k = store.get('neoark.translator.localsecret')
    if (!k) {
      k = crypto.randomUUID()
      store.set('neoark.translator.localsecret', k)
    }
    return k
  }

  async function login() {
    loginError = ''
    const signer = browserSigner()
    if (!signer) {
      loginError = 'No Nostr extension found. Install Alby or nos2x (NIP-07).'
      return
    }
    try {
      const s = await auth.loginWithNip07(signer)
      session = s.claims
    } catch (e) {
      loginError = e instanceof Error ? e.message : String(e)
    }
  }

  function logout() {
    auth.logout()
    session = null
  }

  $: diff = wordDiff(currentText, newText)
  $: changed = hasChange(currentText, newText)
  $: preview = buildProposalEvent({ ref, newText, rationale, createdAt: 0 })
</script>

<svelte:head><title>NeoArk · Translator Portal</title></svelte:head>

{#if !session}
  <div class="text-center py-16">
    <h1 class="font-mono text-2xl text-accent mb-2">Translator Portal</h1>
    <p class="text-muted mb-6">Propose corrections to NeoOS. Sign in with your Nostr key.</p>
    <button on:click={login} class="px-5 py-2 rounded bg-accent text-bg font-mono font-bold">Connect Nostr (NIP-07)</button>
    {#if loginError}<p class="text-red mt-4 font-mono text-sm">{loginError}</p>{/if}
  </div>
{:else}
  <div class="flex items-center justify-between mb-6">
    <p class="font-mono text-sm">Signed in as <span class="text-accent">{session.sub.slice(0, 20)}…</span> <span class="text-muted">({session.method})</span></p>
    <button on:click={logout} class="text-muted text-sm font-mono">log out</button>
  </div>

  <h2 class="font-mono text-accent mb-1">{ref.book} {ref.chapter}:{ref.verse}</h2>
  <p class="text-muted text-sm mb-4">Edit the verse text, give a rationale, and submit a signed proposal.</p>

  <label for="newText" class="block font-mono text-xs text-muted mb-1">Proposed text</label>
  <textarea id="newText" bind:value={newText} rows="3" class="w-full bg-panel border border-border rounded p-2 mb-4 font-sans"></textarea>

  <div class="mb-4">
    <p class="font-mono text-xs text-muted mb-1">Diff</p>
    <p class="leading-relaxed">
      {#each diff as t}<span class:line-through={t.op === 'remove'} class:text-red={t.op === 'remove'} class:text-green={t.op === 'add'}>{t.text}</span>{/each}
    </p>
  </div>

  <label for="rationale" class="block font-mono text-xs text-muted mb-1">Rationale</label>
  <input id="rationale" bind:value={rationale} placeholder="Hebrew raqia = a solid surface…" class="w-full bg-panel border border-border rounded p-2 mb-4 font-sans" />

  <button disabled={!changed || !rationale.trim()} on:click={() => (submitted = true)}
    class="px-5 py-2 rounded font-mono font-bold disabled:opacity-40"
    class:bg-accent={changed && rationale.trim()} class:text-bg={changed && rationale.trim()}>
    Submit proposal (kind:{preview.kind})
  </button>

  {#if submitted}
    <p class="text-green font-mono text-sm mt-4">✓ Proposal prepared — signs via your Nostr extension and publishes to relays. Status: pending review.</p>
  {/if}
{/if}
