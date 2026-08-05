<script lang="ts">
  import { enhance } from '$app/forms'
  import { page } from '$app/state'
  import { toastEnhance } from '$lib/utils/enhance.js'

  let { data } = $props()
  const enabled = $derived(data.publicSiteState.enabled)
  let saving = $state(false)
</script>

<svelte:head>
  <title>Site public · LudoHub</title>
</svelte:head>

<main class="public-site-home">
  <header>
    <div>
      <p class="eyebrow">Module éditorial</p>
      <h1>Site public</h1>
      <p class="intro">Gérez ici les contenus qui seront publiés sur le site de la ludothèque.</p>
    </div>
    <span class:enabled class="status">{enabled ? 'Activé' : 'Désactivé'}</span>
  </header>

  {#if page.form?.error}
    <p class="error" role="alert">{page.form.error}</p>
  {/if}

  {#if enabled}
    <section class="foundation-card">
      <h2>Fondation prête</h2>
      <p>
        Les lieux, horaires, permissions et statuts de publication sont disponibles. Les annonces,
        actualités et activités seront ajoutées dans les prochains lots.
      </p>
    </section>
  {:else}
    <section class="foundation-card">
      <h2>Le module est inactif</h2>
      <p>
        L’activation est isolée à cette ludothèque et exige au moins un lieu actif ainsi qu’un lieu
        principal.
      </p>
    </section>
  {/if}

  {#if data.canConfigure}
    <form
      method="POST"
      action="?/toggle"
      use:enhance={toastEnhance({
        onPending: (pending) => (saving = pending),
        success: enabled ? 'Module désactivé.' : 'Module activé.',
      })}
    >
      <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />
      <button type="submit" class:danger={enabled} disabled={saving}>
        {saving ? 'Enregistrement…' : enabled ? 'Désactiver le module' : 'Activer le module'}
      </button>
    </form>
  {/if}
</main>

<style>
  .public-site-home {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-10) var(--space-6);
    display: grid;
    gap: var(--space-6);
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-5);
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  .eyebrow {
    color: var(--text-muted);
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  h1 {
    margin-top: var(--space-1);
    font-size: var(--text-h1);
    color: var(--text-main);
  }
  .intro {
    margin-top: var(--space-2);
    color: var(--text-muted);
  }
  .status {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--bg-muted);
    color: var(--text-muted);
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
  }
  .status.enabled {
    background: var(--success-light);
    color: var(--success);
  }
  .foundation-card {
    padding: var(--space-6);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
    display: grid;
    gap: var(--space-2);
  }
  .foundation-card p {
    color: var(--text-muted);
    line-height: 1.6;
  }
  form {
    display: flex;
    justify-content: flex-start;
  }
  button {
    min-height: 44px;
    padding: var(--space-3) var(--space-5);
    border: 0;
    border-radius: var(--radius-md);
    background: var(--ludo-color);
    color: var(--text-inverse);
    font: inherit;
    font-weight: var(--weight-semibold);
    cursor: pointer;
  }
  button.danger {
    background: var(--danger);
  }
  button:disabled {
    cursor: wait;
    opacity: 0.65;
  }
  .error {
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--danger-light);
    color: var(--danger);
  }
  @media (max-width: 640px) {
    header {
      flex-direction: column;
    }
  }
</style>
