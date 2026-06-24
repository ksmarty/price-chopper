<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let status = $derived($page.status);
	let message = $derived($page.error?.message || 'Something went wrong');
</script>

<div class="flex min-h-screen flex-col items-center justify-center px-4">
	<div class="text-center">
		<div class="mb-6 text-6xl">{status === 404 ? '🔗' : '✂️'}</div>
		<h1 class="mb-2 text-3xl font-bold text-gray-900">
			{status === 404 ? 'Page Not Found' : 'Oops!'}
		</h1>
		<p class="mb-8 text-gray-500">{message}</p>
		<button onclick={() => goto('/')} class="btn-primary btn">
			Back Home
		</button>
	</div>
</div>
