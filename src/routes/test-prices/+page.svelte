<script lang="ts">
	import { onMount } from 'svelte';

	let pricesRendered = $state(false);

	onMount(() => {
		setTimeout(() => {
			const container = document.getElementById('dynamic-container');
			if (container) {
				const items = [
					{ name: 'Grilled Salmon', price: '$32.00' },
					{ name: 'Steak Frites', price: '$45.00' },
					{ name: 'Lobster Risotto', price: '$38.00' },
				];
				let html = '<ul class="dynamic-menu">';
				for (const item of items) {
					html += `<li class="dynamic-item"><span class="d-name">${item.name}</span><span class="d-price">${item.price}</span></li>`;
				}
				html += '</ul>';
				container.innerHTML = html;
			}
			pricesRendered = true;
		}, 500);
	});
</script>

<h1>Dinner Menu</h1>
<ul class="menu-items">
	<li class="item">
		<span class="name">Spaghetti Carbonara</span>
		<span class="price" data-testid="price-carbonara">$18.95</span>
	</li>
	<li class="item">
		<span class="name">Margherita Pizza</span>
		<span class="price" data-testid="price-pizza">$16.99</span>
	</li>
	<li class="item">
		<span class="name">Caesar Salad</span>
		<span class="price" data-testid="price-salad">$12.50</span>
	</li>
	<li class="item">
		<span class="name">Tiramisu</span>
		<span class="price" data-testid="price-tiramisu">$9.00</span>
	</li>
</ul>

<h2>Sale Items</h2>
<div class="sale-item">
	<span class="product">Winter Jacket</span>
	<span class="old-price">Was $129.99</span>
	<span class="new-price">Now $79.99</span>
</div>
<div class="sale-item">
	<span class="product">Running Shoes</span>
	<span class="price">$89.99</span>
</div>

<h2>Dynamic Content (JS-loaded)</h2>
<div id="dynamic-container">
	{#if pricesRendered}
		<!-- Content loaded by JS -->
	{/if}
</div>
