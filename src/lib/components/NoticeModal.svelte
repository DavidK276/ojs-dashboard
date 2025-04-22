<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';

	let { show = $bindable(true), headerText, bodyText }: { show: boolean, headerText: string, bodyText: string } = $props();
</script>

<Modal bind:show={show} dismissible={true} hasCloseButton={true}>
    {#snippet header()}
        <h2 class="font-bold text-xl">{headerText}</h2>
    {/snippet}
    <div>
        {bodyText}
    </div>
</Modal>