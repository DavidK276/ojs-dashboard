<script lang="ts">
	import { onMount } from "svelte";

	let { userCount, callback }: {
		userCount: number,
		callback: (e: Event) => void
	} = $props();

	let dialog: HTMLDialogElement;
	let userInput: string = $state("");

	onMount(() => dialog.showModal());
</script>

<dialog bind:this={dialog}
        onclick={() => dialog.close()}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div onclick={e => e.stopPropagation()} onkeydown={e => e.stopPropagation()}>
		<h2 class="font-bold text-xl">Confirmation</h2>
		<hr>
		<p>You are about to delete {userCount} user{userCount ? 's' : ''}. To confirm, please type the number of users you
			are about to delete below.</p>
		<div class="col">
			<input bind:value={userInput} type="text">
			<div class="row ver-center" style="justify-content: space-between">
				<button disabled={userInput !== userCount.toString()} onclick={(e) => {dialog.close(); callback(e)}}
				        style="background: var(--danger)">Confirm
				</button>
				<button onclick={() => dialog.close()}>Cancel</button>
			</div>
		</div>
	</div>
</dialog>

<style>
	dialog {
		border-radius: var(--xs);
		border: none;

		position: fixed;
		inset: 0;
		width: 24rem;
		max-width: 100vw;
		max-height: 100dvh;
		margin: auto;
		padding: var(--md);
	}

	dialog::backdrop {
		background: rgba(0, 0, 0, 0.3);
	}

	dialog[open] {
		animation: zoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes zoom {
		from {
			transform: scale(0.95);
		}
		to {
			transform: scale(1);
		}
	}

	dialog[open]::backdrop {
		animation: fade 0.2s ease-out;
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
