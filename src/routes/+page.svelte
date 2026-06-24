<script lang="ts">
	import { goto } from '$app/navigation';
	import Settings from '$lib/components/Settings.svelte';
	import { getParam, isValidUrl, buildGoUrl } from '$lib/utils/url';

	let urlInput = $state(getParam('url') || '');
	let currency = $state(getParam('currency') || 'auto');
	let settingsOpen = $state(false);
	let error = $state('');
	let pdfUploading = $state(false);
	let currencyLabel = $derived(currency === 'auto' ? 'Auto-detect' : currency);

	function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		let input = urlInput.trim();
		if (!input) {
			error = 'Please enter a URL';
			return;
		}

		if (!input.startsWith('http://') && !input.startsWith('https://')) {
			input = 'https://' + input;
		}

		if (!isValidUrl(input)) {
			error = 'Please enter a valid URL';
			return;
		}

		goto(buildGoUrl(input, currency));
	}

	function handlePdfUpload() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.pdf,application/pdf';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;

			pdfUploading = true;
			const formData = new FormData();
			formData.append('file', file);
			formData.append('currency', currency);

			try {
				const res = await fetch('/api/clean-pdf', { method: 'POST', body: formData });
				const data = await res.json();
				if (data.error) {
					error = data.error;
					return;
				}
				goto(buildGoUrlForPdf(data));
			} catch {
				error = 'Failed to upload PDF';
			} finally {
				pdfUploading = false;
			}
		};
		input.click();
	}

	function handlePdfUrl() {
		const pdfUrl = prompt('Enter a PDF URL:');
		if (!pdfUrl) return;

		if (!pdfUrl.startsWith('http://') && !pdfUrl.startsWith('https://')) {
			error = 'Please enter a valid PDF URL';
			return;
		}

		error = '';

		const params = new URLSearchParams();
		params.set('pdf', pdfUrl);
		params.set('currency', currency);
		goto(`/go?${params.toString()}`);
	}

	function buildGoUrlForPdf(data: any): string {
		const params = new URLSearchParams();
		params.set('pdfData', encodeURIComponent(JSON.stringify(data)));
		params.set('currency', currency);
		return `/go?${params.toString()}`;
	}
</script>

<svelte:head>
	<title>Price Chopper — Remove Prices from Any Website</title>
	<meta name="description" content="Strip prices from web pages and PDFs. Focus on the content, not the cost." />
</svelte:head>

<div class="relative flex min-h-screen flex-col">
	<Settings bind:open={settingsOpen} bind:currency onClose={() => settingsOpen = false} />

	<!-- Header -->
	<header class="flex items-center justify-between px-4 py-4 sm:px-8">
		<a href="/" class="flex items-center gap-2 text-xl font-black text-gray-900 no-underline">
			<span>✂️</span>
			<span class="gradient-text">Price Chopper</span>
		</a>
		<button
			onclick={() => settingsOpen = !settingsOpen}
			class="btn-ghost btn h-10 w-10 rounded-lg p-0"
			aria-label="Open settings"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
			</svg>
		</button>
	</header>

	<!-- Hero -->
	<main class="flex flex-1 flex-col items-center justify-center px-4 pb-24 pt-12 sm:px-8">
		<div class="w-full max-w-2xl">
			<!-- Tagline -->
			<div class="mb-12 text-center">
				<h1 class="mb-4 text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl">
					Chop the
					<span class="gradient-text">prices</span>
					<br />Keep the content
				</h1>
				<p class="mx-auto max-w-md text-base text-gray-500">
					Strip pricing from any web page or PDF. See what the internet looks like without the price tags.
				</p>
			</div>

			<!-- Input Form -->
			<form onsubmit={handleSubmit} class="mb-4">
				<div class="flex flex-col gap-3 sm:flex-row">
					<div class="relative flex-1">
						<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400">
								<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
								<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
							</svg>
						</div>
						<input
							bind:value={urlInput}
							type="text"
							placeholder="https://example.com/page"
							class="input h-14 pl-12 pr-4 text-base"
							oninput={() => error = ''}
						/>
					</div>
					<button type="submit" class="btn-primary btn h-14 min-w-[120px] text-base">
						Chop It
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</button>
				</div>
				{#if error}
					<p class="mt-2 text-sm font-medium text-red-500">{error}</p>
				{/if}
			</form>

			<!-- Divider -->
			<div class="relative mb-4 mt-6">
				<div class="absolute inset-0 flex items-center">
					<div class="w-full border-t border-gray-200"></div>
				</div>
				<div class="relative flex justify-center">
					<span class="bg-gray-50 px-4 text-xs font-medium text-gray-400">or</span>
				</div>
			</div>

			<!-- PDF Buttons -->
			<div class="flex flex-col gap-3 sm:flex-row">
				<button
					onclick={handlePdfUpload}
					disabled={pdfUploading}
					class="btn-outline btn flex-1 h-14 text-base"
				>
					{#if pdfUploading}
						<svg class="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
						</svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
							<polyline points="14 2 14 8 20 8" />
							<line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
							<line x1="10" y1="9" x2="8" y2="9" />
						</svg>
					{/if}
					Upload PDF
				</button>
				<button
					onclick={handlePdfUrl}
					class="btn-outline btn flex-1 h-14 text-base"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
						<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
					</svg>
					PDF from URL
				</button>
			</div>

			<!-- Currency indicator -->
			<div class="mt-6 text-center">
				<button onclick={() => settingsOpen = true} class="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
					<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="8" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
					</svg>
					Currency: {currencyLabel}
				</button>
			</div>
		</div>
	</main>

	<!-- Footer -->
	<footer class="border-t border-gray-100 px-4 py-6 text-center text-xs text-gray-400">
		Price Chopper &mdash; Prices don't belong everywhere.
	</footer>
</div>
