<script lang="ts">
    import { type Snippet } from "svelte";

    let { show = $bindable(true), hasCloseButton = true, dismissible = true, header, children }: {
        show: boolean,
        hasCloseButton: boolean,
        dismissible: boolean,
        header: Snippet,
        children: Snippet
    } = $props();

    let dialog: HTMLDialogElement;

    $effect(() => {
        if (dialog && show) {
            dialog.showModal();
        } else if (!show) {
            dialog.close();
        }
    });
</script>

<dialog bind:this={dialog} oncancel={(e) => {if(!dismissible) e.preventDefault()}}
        onclick={() => {if (dismissible) dialog.close()}} onclose={() => (show = false)}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div onclick={e => e.stopPropagation()} onkeydown={e => e.stopPropagation()}>
        {@render header?.()}
        <hr>
        {@render children?.()}

        <!-- svelte-ignore a11y_autofocus -->
        {#if dismissible && hasCloseButton}
            <hr>
            <button autofocus onclick={() => dialog.close()}>Dismiss</button>
        {/if}
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
