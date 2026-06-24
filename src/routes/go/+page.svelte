<script lang="ts">
	import { goto } from '$app/navigation';
	import Settings from '$lib/components/Settings.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import PdfViewer from '$lib/components/PdfViewer.svelte';

	let { data } = $props();

	let loading = $state(true);
	let loadError = $state('');
	let settingsOpen = $state(false);
	// svelte-ignore state_referenced_locally
	let currency = $state(data.currency);
	let iframeLoaded = $state(false);
	let pdfProcessing = $state(false);

	let iframeSrc = $derived.by(() => {
		if (data.targetUrl) {
			const params = new URLSearchParams();
			params.set('url', data.targetUrl);
			if (currency !== 'auto') params.set('currency', currency);
			return `/api/proxy?${params.toString()}`;
		}
		return null;
	});

	$effect(() => {
		if (iframeSrc) {
			loading = true;
			iframeLoaded = false;
		}
	});

	$effect(() => {
		if (isPdf && !pdfProcessing) {
			loading = false;
		}
	});

	// Re-process PDF URLs on load for fresh preview token (enables sharing)
	let freshPdfData = $state<any>(null);

	$effect(() => {
		if (data.pdfUrl) {
			refreshPdfFromUrl();
		}
	});

	async function refreshPdfFromUrl() {
		pdfProcessing = true;
		loading = true;
		try {
			const params = new URLSearchParams({ url: data.pdfUrl! });
			const res = await fetch(`/api/clean-pdf?${params.toString()}`);
			const result = await res.json();
			if (result.previewToken) {
				freshPdfData = result;
			} else if (result.error) {
				loadError = result.error;
			}
		} catch {
			loadError = 'Failed to process PDF. Try uploading again.';
		} finally {
			pdfProcessing = false;
			loading = false;
		}
	}

	function handleIframeLoad() {
		iframeLoaded = true;
		setTimeout(() => { loading = false; }, 300);
	}

	function handleIframeError() {
		loadError = 'Failed to load the cleaned page.';
		loading = false;
	}

	function goBack() {
		goto('/');
	}

	function copyUrl() {
		navigator.clipboard.writeText(window.location.href);
	}

	let displayUrl = $derived(data.targetUrl ? new URL(data.targetUrl).hostname : 'PDF Preview');

	let isPdf = $derived(!!data.pdfUrl || !!data.pdfData);
	let pdfContent = $derived(freshPdfData || data.pdfData || null);
	let previewUrl = $derived(
		isPdf && pdfContent?.previewToken
			? `/api/pdf-preview/${pdfContent.previewToken}`
			: null,
	);

	function downloadPdf() {
		if (!previewUrl) return;
		const a = document.createElement('a');
		a.href = previewUrl + '?download=true';
		a.download = (pdfContent?.fileName || 'document').replace(/\.pdf$/i, '') + '-chopped.pdf';
		a.click();
	}
</script>

<svelte:head>
	<title>{displayUrl} — Price Chopped</title>
</svelte:head>

<Settings bind:open={settingsOpen} bind:currency onClose={() => settingsOpen = false} />

<LoadingScreen show={loading} message={data.targetUrl ? 'Chopping prices...' : 'Processing PDF...'} />

<div class="flex h-screen flex-col bg-white">
	<!-- Toolbar -->
	<header class="flex items-center gap-2 border-b border-gray-100 bg-white px-3 py-2.5 sm:px-5">
		<button onclick={goBack} class="btn-ghost btn h-9 w-9 rounded-lg p-0" aria-label="Go back">
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
			</svg>
		</button>

		<div class="flex min-w-0 flex-1 items-center gap-2">
			<div class="h-2 w-2 rounded-full bg-brand-500"></div>
			<span class="truncate text-sm font-medium text-gray-700">{displayUrl}</span>
		</div>

		<div class="flex items-center gap-1">
			{#if isPdf}
				<button onclick={downloadPdf} class="btn-ghost btn h-9 rounded-lg px-2.5 text-xs font-medium text-brand-600 hover:text-brand-700" aria-label="Download cleaned PDF">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
					</svg>
					Download PDF
				</button>
			{/if}
			<button onclick={copyUrl} class="btn-ghost btn h-9 w-9 rounded-lg p-0" aria-label="Copy shareable URL">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
					<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
				</svg>
			</button>
			<button onclick={() => settingsOpen = true} class="btn-ghost btn h-9 w-9 rounded-lg p-0" aria-label="Open settings">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
				</svg>
			</button>
		</div>
	</header>

	<!-- Content -->
	<div class="flex flex-1 overflow-hidden">
		{#if data.targetUrl}
			<!-- Web proxy iframe -->
			<iframe
				src={iframeSrc}
				class="h-full w-full border-0"
				onload={handleIframeLoad}
				onerror={handleIframeError}
				sandbox="allow-scripts allow-forms allow-popups"
				title="Cleaned page"
			></iframe>
		{:else if isPdf}
			<!-- PDF Preview -->
			<div class="flex flex-1 flex-col">
				{#if previewUrl}
					<PdfViewer url={previewUrl} />
				{:else if pdfContent && pdfContent.pages}
					<div class="flex-1 overflow-y-auto">
						<div class="mx-auto max-w-3xl px-4 py-8">
							<div class="mb-6">
								<h1 class="text-xl font-bold text-gray-900">{pdfContent.metadata?.title || 'PDF Preview'}</h1>
								<p class="text-sm text-gray-500">
									{pdfContent.pageCount} page{pdfContent.pageCount !== 1 ? 's' : ''}
									&middot; {pdfContent.totalPriceCount} price{pdfContent.totalPriceCount !== 1 ? 's' : ''} removed
								</p>
							</div>

							<div class="space-y-6">
								{#each pdfContent.pages as pageData}
									<div class="card overflow-hidden">
										<div class="border-b border-gray-100 bg-gray-50 px-4 py-2">
											<span class="text-xs font-semibold text-gray-500">Page {pageData.pageNumber}</span>
										</div>
										<div class="whitespace-pre-wrap px-4 py-4 font-mono text-sm leading-relaxed text-gray-700">
											{pageData.text || '(No text content on this page)'}
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				{:else}
					<div class="flex h-full items-center justify-center">
						<div class="text-center">
							<p class="text-gray-400">No PDF data available</p>
							<button onclick={goBack} class="btn-primary btn mt-4">Try Again</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		{#if loadError}
			<div class="absolute inset-0 flex items-center justify-center bg-white/90">
				<div class="text-center">
					<p class="mb-2 text-lg font-semibold text-red-500">Something went wrong</p>
					<p class="mb-4 text-sm text-gray-500">{loadError}</p>
					<button onclick={goBack} class="btn-primary btn">Try Again</button>
				</div>
			</div>
		{/if}
	</div>
</div>
