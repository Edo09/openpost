import { afterEach, describe, expect, it, vi } from 'vitest';

interface BrowserState {
	cookie?: string;
	defaultLocale?: string;
}

function stubDocument({ cookie = '', defaultLocale }: BrowserState) {
	const meta = defaultLocale === undefined ? null : { content: defaultLocale };
	vi.stubGlobal('document', {
		cookie,
		querySelector: (selector: string) =>
			selector === 'meta[name="openpost-default-locale"]' ? meta : null
	});
}

// Paraglide keeps the first resolved locale for the page, so each case loads
// a fresh runtime the way a new page load would.
async function loadFreshRuntime() {
	vi.resetModules();
	await import('./instance-locale');
	return import('$lib/paraglide/runtime');
}

async function resolveFirstLocale(state: BrowserState) {
	stubDocument(state);
	const runtime = await loadFreshRuntime();
	return runtime.getLocale();
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('instance default locale', () => {
	it('runs after the saved choice and before the browser language', async () => {
		const runtime = await loadFreshRuntime();

		expect(runtime.strategy).toEqual([
			'cookie',
			'globalVariable',
			'custom-instanceDefault',
			'preferredLanguage',
			'baseLocale'
		]);
	});

	it('opens a browser without a saved language in the instance default', async () => {
		expect(await resolveFirstLocale({ defaultLocale: 'es' })).toBe('es');
		expect(await resolveFirstLocale({ defaultLocale: 'PT-br' })).toBe('pt-BR');
	});

	it('keeps the language a person saved', async () => {
		expect(await resolveFirstLocale({ cookie: 'PARAGLIDE_LOCALE=fr', defaultLocale: 'es' })).toBe(
			'fr'
		);
	});

	it('ignores a missing or unsupported instance default', async () => {
		expect(await resolveFirstLocale({})).toBe('en');
		expect(await resolveFirstLocale({ defaultLocale: 'klingon' })).toBe('en');
	});
});
