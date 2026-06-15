<script lang="ts">
  import LoginForm from '$lib/components/auth/LoginForm.svelte'
  import MemberPicker from '$lib/components/auth/MemberPicker.svelte'

  let { data, form } = $props()

  // Étape « pick » dès que checkPassword/login renvoie la liste des membres
  let showPicker = $derived(form?.step === 'pick')
</script>

<svelte:head>
  <title>Connexion — {data.ludoName}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="auth" style="--ludo-color: {data.ludoColor}">
  <div class="card">
    <header class="brand">
      <span class="dot" aria-hidden="true"></span>
      <h1>{data.ludoName}</h1>
      <p class="sub">Espace ludothèque</p>
    </header>

    {#if showPicker}
      <MemberPicker
        members={form?.members ?? []}
        password={form?.password ?? ''}
        error={form?.error ?? ''}
      />
    {:else}
      <LoginForm error={form?.error ?? ''} />
    {/if}
  </div>
</main>

<style>
  .auth {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: var(--space-6);
    background: var(--bg-base);
  }
  .card {
    width: 100%;
    max-width: 380px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    padding: var(--space-8);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
  .brand {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  .dot {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-pill);
    background: var(--ludo-color);
    box-shadow: var(--shadow-sm);
  }
  h1 {
    margin: 0;
    font-size: var(--text-h1);
    color: var(--text-main);
  }
  .sub {
    margin: 0;
    font-size: var(--text-small);
    color: var(--text-muted);
  }
</style>
