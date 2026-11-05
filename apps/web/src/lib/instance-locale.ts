import { defineCustomClientStrategy, toLocale, type Locale } from '$lib/paraglide/runtime';

// Paraglide runs this strategy after the saved choice (cookie) and before the
// browser language. vite.config.ts and the generate:i18n scripts name it in
// their strategy lists.
const INSTANCE_DEFAULT_LOCALE_STRATEGY = 'custom-instanceDefault';

// The server renders OPENPOST_DEFAULT_LOCALE into this tag; see
// renderDefaultLocaleMetadata in apps/server/cmd/openpost/web.go.
const DEFAULT_LOCALE_META_SELECTOR = 'meta[name="openpost-default-locale"]';

function instanceDefaultLocale(): Locale | undefined {
	const meta = globalThis.document?.querySelector<HTMLMetaElement>(DEFAULT_LOCALE_META_SELECTOR);
	return toLocale(meta?.content);
}

// Registered on import because Paraglide stores its first resolved locale in
// the cookie: hooks.client.ts imports this module before anything that can
// read the locale.
defineCustomClientStrategy(INSTANCE_DEFAULT_LOCALE_STRATEGY, {
	getLocale: instanceDefaultLocale,
	// The instance default is read-only. A language picked in the app persists
	// through the cookie strategy, which runs first.
	setLocale: () => undefined
});
