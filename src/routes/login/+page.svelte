<script lang="ts">
	import type { PageProps } from './$types';
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { base } from '$app/paths';

	let { form }: PageProps = $props();

	onMount(() => {
		if (form?.success) {
			goto(`${base}/participants`);
		}
	});
</script>

<div class="col hor-center">
	<div style="width: 100%; max-width: 768px">
		<form method="POST">
			<div class="col">
				<label for="apiKey">API Key</label>
				<input id="apiKey" name="apiKey" type="password">
				<button style="width: fit-content" type="submit">Submit</button>
				{#if form?.success === false}
					<span style="color: red">Login failed. Check your API key.</span>
				{/if}
			</div>
		</form>
	</div>
</div>