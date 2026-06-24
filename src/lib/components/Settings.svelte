<script lang="ts">
	import { currencies } from '$lib/utils/currencies';
	import { replaceStateParam } from '$lib/utils/url';

	let { open = $bindable(false), currency = $bindable('auto'), onClose = (() => {}) as () => void } = $props();

	const currencyOptions = Object.entries(currencies).map(([code, c]) => ({
		code,
		name: c.name,
		symbol: c.symbol,
	}));

	function selectCurrency(code: string) {
		currency = code;
		replaceStateParam('currency', code);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
{#if open}
	<div
		class="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300"
		role="presentation"
		onclick={onClose}
	></div>
{/if}

<!-- Drawer -->
<div
	class="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out {open ? 'translate-x-0' : 'translate-x-full'}"
	role="dialog"
	aria-modal="true"
	aria-label="Settings"
>
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
		<h2 class="text-lg font-bold text-gray-900">Settings</h2>
		<button onclick={onClose} class="btn-ghost btn h-10 w-10 rounded-lg p-0" aria-label="Close settings">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto px-6 py-6">
		<div class="space-y-8">
			<!-- Currency Section -->
			<div>
				<div class="mb-1 flex items-center gap-2">
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-brand-600">
						<circle cx="12" cy="12" r="8" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
					</svg>
					<h3 class="text-sm font-semibold text-gray-800">Preferred Currency</h3>
				</div>
				<p class="mb-4 text-xs text-gray-400">
					Select which currency prices to remove. "Auto-detect" will remove all currencies.
				</p>

				<div class="grid grid-cols-2 gap-2">
					{#each currencyOptions as opt}
						<button
							onclick={() => selectCurrency(opt.code)}
							class="rounded-xl border-2 px-4 py-3 text-left transition-all duration-200 {currency === opt.code ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'}"
						>
							<div class="text-sm font-semibold text-gray-900">{opt.name}</div>
							<div class="mt-0.5 text-xs text-gray-400">
								{opt.code === 'auto' ? 'Removes all price formats' : opt.symbol ? `Symbol: ${opt.symbol}` : ''}
							</div>
						</button>
					{/each}
				</div>
			</div>

			<!-- About Section -->
			<div class="rounded-xl bg-gray-50 p-4">
				<h3 class="mb-1 text-sm font-semibold text-gray-700">About Price Chopper</h3>
				<p class="text-xs leading-relaxed text-gray-500">
					Price Chopper removes prices from web pages and PDFs so you can focus on what matters.
					All processing happens server-side. Your settings are stored in the URL for easy sharing.
				</p>
			</div>
		</div>
	</div>

	<!-- Footer -->
	<div class="border-t border-gray-100 px-6 py-4">
		<button onclick={onClose} class="btn btn-primary w-full">Done</button>
	</div>
</div>
