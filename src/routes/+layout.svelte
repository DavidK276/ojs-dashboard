<script lang="ts">
    import '$lib/styles/styles.css';

    let {children} = $props();
</script>

<div style="margin: 8px 16px">
    {@render children()}
</div>
