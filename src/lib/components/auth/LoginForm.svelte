<script lang="ts">
  import { enhance } from '$app/forms'

  let { error = '' }: { error?: string } = $props()

  let submitting = $state(false)
</script>

<form
  method="POST"
  action="?/checkPassword"
  use:enhance={() => {
    submitting = true
    return async ({ update }) => {
      await update()
      submitting = false
    }
  }}
>
  <label class="field">
    <span class="label">Mot de passe de la ludothèque</span>
    <input
      type="password"
      name="password"
      autocomplete="current-password"
      required
      placeholder="••••••••"
    />
  </label>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  <button type="submit" class="submit" disabled={submitting}>
    {submitting ? 'Vérification…' : 'Continuer'}
  </button>
</form>

<style>
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
    border-color: var(--ludo-color);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ludo-color) 25%, transparent);
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
    background: var(--ludo-color);
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
