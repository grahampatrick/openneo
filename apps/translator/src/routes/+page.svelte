<script lang="ts">
  import { onMount } from 'svelte'
  import { PortalAuth, browserStore, type KeyValueStore } from '$lib/auth-client'
  import { browserSigner } from '$lib/signer'
  import { wordDiff, hasChange } from '$lib/diff'
  import { buildProposalEvent } from '$lib/proposal'
  import {
    generateSeckey,
    loadLocalSeckey,
    saveLocalSeckey,
    nsecEncode,
    nsecDecode,
    signerFor,
  } from '$lib/identity'
  import type { SessionClaims } from '@neoark/auth'

  let auth: PortalAuth
  let store: KeyValueStore
  let session: SessionClaims | null = null
  let loginError = ''

  // Shown once after creating a fresh key, so the user can back it up.
  let newKeyNsec = ''
  let showImport = false
  let nsecInput = ''

  // Demo verse (in production: loaded from the corpus, picked by the user).
  const ref = { translationId: 'neoos-en-2026', book: 'GEN', chapter: 1, verse: 6 }
  const currentText = 'And Elohiym said, “Let there be an expanse between the waters.”'
  let newText = currentText
  let rationale = ''
  let submitted = false

  onMount(() => {
    store = browserStore()
    auth = PortalAuth.create({ jwtSecret: localKey(), store })
    session = auth.currentSession()
  })

  function localKey(): string {
    let k = store.get('neoark.translator.localsecret')
    if (!k) {
      k = crypto.randomUUID()
      store.set('neoark.translator.localsecret', k)
    }
    return k
  }

  async function signInWith(seckeyHex: string) {
    const s = await auth.loginWithNip07(signerFor(seckeyHex))
    session = s.claims
  }

  /** Easiest path: generate (or reuse) a browser key and sign in — one click. */
  async function createKeyAndSignIn() {
    loginError = ''
    try {
      let hex = loadLocalSeckey(store)
      if (!hex) {
        hex = generateSeckey()
        saveLocalSeckey(store, hex)
        newKeyNsec = nsecEncode(hex) // prompt a backup
      }
      await signInWith(hex)
    } catch (e) {
      loginError = e instanceof Error ? e.message : String(e)
    }
  }

  async function importNsec() {
    loginError = ''
    try {
      const hex = nsecDecode(nsecInput)
      saveLocalSeckey(store, hex)
      await signInWith(hex)
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
      const s = await auth.loginWithNip07(signer)
      session = s.claims
    } catch (e) {
      loginError = e instanceof Error ? e.message : String(e)
    }
  }

  function dismissBackup() {
    newKeyNsec = ''
  }

  function copyNsec() {
    if (navigator.clipboard) void navigator.clipboard.writeText(newKeyNsec)
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
  <div class="text-center py-16 max-w-md mx-auto">
    <h1 class="font-mono text-2xl text-accent mb-2">Translator Portal</h1>
    <p class="text-muted mb-6">Propose corrections to NeoOS. No email, no account — your identity is a key.</p>

    <button on:click={createKeyAndSignIn} class="w-full px-5 py-3 rounded bg-accent text-bg font-mono font-bold mb-3">
      Create a key &amp; sign in
    </button>
    <p class="text-muted text-xs mb-6">One click. A Nostr key is generated and stored in this browser — back it up to keep it.</p>

    <div class="flex items-center gap-3 text-muted text-xs font-mono mb-4">
      <span class="flex-1 border-t border-border"></span>or<span class="flex-1 border-t border-border"></span>
    </div>

    <button on:click={loginWithExtension} class="w-full px-5 py-2 rounded border border-border font-mono text-sm mb-2">
      I have a Nostr extension (NIP-07)
    </button>
    <button on:click={() => (showImport = !showImport)} class="text-muted text-sm font-mono underline">
      Import an existing key (nsec)
    </button>

    {#if showImport}
      <div class="mt-3 flex gap-2">
        <input bind:value={nsecInput} placeholder="nsec1…" aria-label="nsec key"
          class="flex-1 bg-panel border border-border rounded p-2 font-mono text-sm" />
        <button on:click={importNsec} class="px-4 rounded border border-border font-mono text-sm">Import</button>
      </div>
    {/if}

    {#if loginError}<p class="text-red mt-4 font-mono text-sm">{loginError}</p>{/if}
  </div>
{:else}
  {#if newKeyNsec}
    <div class="border border-accent rounded-lg bg-panel p-4 mb-6">
      <p class="font-mono text-accent text-sm mb-1">⚠ Back up your key</p>
      <p class="text-muted text-xs mb-2">This is your identity — it lives only in this browser. Save it somewhere safe (or import it into a wallet like Alby). Without it you can't sign in elsewhere or recover this account.</p>
      <div class="flex gap-2 items-center">
        <code class="flex-1 bg-bg border border-border rounded p-2 font-mono text-xs break-all">{newKeyNsec}</code>
        <button on:click={copyNsec} class="px-3 py-2 rounded border border-border font-mono text-xs">copy</button>
        <button on:click={dismissBackup} class="px-3 py-2 rounded border border-border font-mono text-xs text-muted">I saved it</button>
      </div>
    </div>
  {/if}
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
