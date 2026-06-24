<script lang="ts">
  import MinusIcon from '@lucide/svelte/icons/minus'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import { Label } from '$lib/components/ui/label/index.js'

  let {
    name,
    id,
    label,
    value = $bindable<number>(0),
  }: { name: string; id: string; label: string; value?: number } = $props()

  function dec() {
    value = Math.max(0, value - 1)
  }
  function inc() {
    value = value + 1
  }

  // Saisie directe : on ne garde que les chiffres, champ vidé = 0.
  function onInput(e: Event) {
    const raw = (e.currentTarget as HTMLInputElement).value.replace(/\D/g, '')
    value = raw === '' ? 0 : parseInt(raw, 10)
  }
</script>

<div class="stepper-field">
  <Label for={id}>{label}</Label>
  <div class="stepper">
    <button
      type="button"
      class="step step--minus"
      onclick={dec}
      aria-label="Diminuer {label}"
      disabled={value <= 0}
    >
      <MinusIcon aria-hidden="true" />
    </button>
    <input
      {id}
      {name}
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      value={String(value)}
      oninput={onInput}
      aria-label={label}
    />
    <button type="button" class="step step--plus" onclick={inc} aria-label="Augmenter {label}">
      <PlusIcon aria-hidden="true" />
    </button>
  </div>
</div>

<style>
  .stepper-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .stepper {
    display: flex;
    align-items: stretch;
    gap: var(--space-2);
  }
  .step {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    color: var(--text-main);
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out-strong),
      border-color var(--dur-fast) var(--ease-out-strong);
  }
  .step:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  /* Couleurs sémantiques pour la lisibilité : − retrait (rouge), + ajout (vert).
     Fond teinté très léger au repos, accentué au survol. */
  .step--minus {
    color: var(--danger);
    background: var(--danger-light);
    border-color: var(--danger-light);
  }
  .step--minus:hover:not(:disabled) {
    background: color-mix(in srgb, var(--danger) 14%, white);
    border-color: var(--danger);
  }
  .step--plus {
    color: var(--success);
    background: var(--success-light);
    border-color: var(--success-light);
  }
  .step--plus:hover:not(:disabled) {
    background: color-mix(in srgb, var(--success) 14%, white);
    border-color: var(--success);
  }
  .step :global(svg) {
    width: 1.1rem;
    height: 1.1rem;
  }
  input {
    flex: 1;
    min-width: 0;
    height: 2.75rem;
    text-align: center;
    font: inherit;
    font-size: var(--text-h3, var(--text-body));
    font-weight: var(--weight-semibold);
    color: var(--text-main);
    background: var(--bg-input, var(--bg-card));
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  input:focus-visible {
    outline: 2px solid var(--ring, var(--ludo-color));
    outline-offset: 1px;
  }
</style>
