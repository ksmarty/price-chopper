<script lang="ts">
	import { onMount } from 'svelte';

	let { url }: { url: string } = $props();

	let Viewer: any = $state();
	let zoomMode: any = $state();
	let ready = $state(false);

	onMount(async () => {
		try {
			const mod = await import('@embedpdf/svelte-pdf-viewer');
			Viewer = mod.PDFViewer;
			zoomMode = mod.ZoomMode;
		} catch (e) {
			console.error('Failed to load PDF viewer:', e);
		} finally {
			ready = true;
		}
	});
</script>

{#if ready && Viewer}
	<Viewer
		config={{
			src: url,
			theme: {
				preference: 'light',
				light: {
					accent: {
						primary: '#2563eb',
						primaryHover: '#1d4ed8',
						primaryActive: '#1e40af',
						primaryLight: '#eff6ff',
						primaryForeground: '#ffffff',
					},
					background: {
						app: '#f3f4f6',
						surface: '#ffffff',
					},
				},
			},
			zoom: {
				defaultZoomLevel: zoomMode?.FitWidth,
			},
			tabBar: 'never',
			disabledCategories: [
				'annotation',
				'form',
				'shapes',
				'redaction',
				'insert',
				'history',
				'security',
				'panel-sidebar',
				'panel-search',
				'panel-comment',
			],
		}}
		style="width: 100%; height: 100%;"
	/>
{:else}
	<div class="flex h-full items-center justify-center">
		<div class="flex items-center gap-2 text-gray-400">
			<svg class="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
			</svg>
			<span>Loading PDF viewer...</span>
		</div>
	</div>
{/if}
