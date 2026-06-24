<script lang="ts">
	let { show = $bindable(false), message = 'Chopping prices...' } = $props();
</script>

{#if show}
	<div class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm transition-opacity duration-300">
		<div class="flex flex-col items-center gap-6">
			<div class="relative flex items-center justify-center">
				<div class="h-20 w-20 animate-spin rounded-full border-4 border-gray-100 border-t-brand-500"></div>
				
				<div class="absolute flex items-center justify-center">
					<span class="animate-chopping text-3xl">✂️</span>
				</div>
			</div>
			
			<div class="flex flex-col items-center gap-1">
				<p class="text-lg font-semibold text-gray-800">{message}</p>
				<p class="text-sm text-gray-400">This should only take a moment</p>
			</div>
		</div>
	</div>
{/if}
