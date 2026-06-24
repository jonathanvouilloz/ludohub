<script lang="ts">
  // Rendu d'un texte avec gras Markdown léger : `**mot**` → <strong>mot</strong>.
  // Pas de `{@html}` (on découpe en segments), donc sûr par construction.
  let { text }: { text: string } = $props()

  const parts = $derived(text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean))
</script>

{#each parts as part, i (i)}{#if part.startsWith('**') && part.endsWith('**')}<strong
      >{part.slice(2, -2)}</strong
    >{:else}{part}{/if}{/each}
