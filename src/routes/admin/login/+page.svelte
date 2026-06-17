<script lang="ts">
  import { enhance } from '$app/forms'

  let { form } = $props()

  let submitting = $state(false)
</script>

<svelte:head>
  <title>Administration — LudoHub</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="auth">
  <div class="card">
    <header class="brand">
      <span class="dot" aria-hidden="true"></span>
      <h1>Administration</h1>
      <p class="sub">Espace super-admin LudoHub</p>
    </header>

    <form
      method="POST"
      use:enhance={() => {
        submitting = true
        return async ({ update }) => {
          await update()
          submitting = false
        }
      }}
    >
      <label class="field">
        <span class="label">Mot de passe administrateur</span>
        <input
          type="password"
          name="password"
          autocomplete="current-password"
          required
          placeholder="••••••••"
        />
      </label>

      {#if form?.error}
        <p class="error" role="alert">{form.error}</p>
      {/if}

      <button type="submit" class="submit" disabled={submitting}>
        {submitting ? 'Vérification…' : 'Se connecter'}
      </button>
    </form>
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
    background: var(--color-primary);
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
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .label {
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
    color: var(--text-muted);
  }
  input {
    width: 100%;
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-body);
    color: var(--text-main);
    background: var(--bg-card);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    transition:
      box-shadow var(--dur-fast) var(--ease-out-strong),
      border-color var(--dur-fast) var(--ease-out-strong);
  }
  input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 25%, transparent);
  }
  .error {
    margin: 0;
    font-size: var(--text-small);
    color: var(--danger);
  }
  .submit {
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-body);
    font-weight: var(--weight-bold);
    color: var(--text-inverse);
    background: var(--color-primary);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: filter var(--dur-fast) var(--ease-out-strong);
  }
  .submit:hover:not(:disabled) {
    filter: brightness(1.05);
  }
  .submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
