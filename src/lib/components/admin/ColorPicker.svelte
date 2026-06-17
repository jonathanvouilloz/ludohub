<script lang="ts">
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'

  let {
    value = $bindable(''),
    name,
    label = 'Couleur',
    id = 'color-picker',
    placeholder = '#0073e6',
    required = false,
  }: {
    value?: string
    name: string
    label?: string
    id?: string
    placeholder?: string
    required?: boolean
  } = $props()
</script>

<div class="field">
  <Label for={id}>{label}</Label>
  <div class="color-input">
    <input {id} type="color" bind:value aria-label="Sélecteur de couleur" />
    <Input {name} bind:value {placeholder} {required} />
  </div>
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .color-input {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .color-input input[type='color'] {
    width: 44px;
    height: 38px;
    padding: 2px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    cursor: pointer;
  }
</style>
