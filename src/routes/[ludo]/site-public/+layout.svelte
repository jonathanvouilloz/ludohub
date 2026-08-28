<script lang="ts">
  import PublicSiteModuleNav from '$lib/components/public-site/PublicSiteModuleNav.svelte'
  let { data, children } = $props()
</script>

<PublicSiteModuleNav ludoSlug={data.ludo.slug} />
{@render children()}
