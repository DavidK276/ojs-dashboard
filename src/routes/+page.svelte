<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { base } from '$app/paths';

	onMount(() => {
		goto(`${base}/participants`);
	});
</script>
<h1>Welcome to OJS Dashboard</h1>
<p>Click <a href="/participants">here</a> to go to the list of participants.</p>

