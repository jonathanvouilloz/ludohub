<script lang="ts">
  import AppShell from '$lib/components/nav/AppShell.svelte'

  let { data, children } = $props()
</script>

<!-- Route globale : pas de slug dans l'URL, identité résolue via la session. -->
<div class="ludo-scope" style="--ludo-color: {data.ludo.color}">
  <AppShell ludo={data.ludo} member={data.currentMember} notifCount={data.notifCount}>
    {@render children()}
  </AppShell>
</div>

<style>
  .ludo-scope {
    min-height: 100dvh;
  }
</style>
