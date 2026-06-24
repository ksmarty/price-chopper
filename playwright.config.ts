import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	retries: 0,
	workers: 1,
	timeout: 30000,
	expect: {
		timeout: 10000,
	},
	use: {
		baseURL: 'http://localhost:5173',
		headless: true,
		screenshot: 'only-on-failure',
	},
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: true,
		timeout: 15000,
	},
});
