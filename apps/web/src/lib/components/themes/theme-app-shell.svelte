<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { mode } from 'mode-watcher';
	import { captureClientException, isUnsupportedBrowserError } from '@openpost/telemetry';

	import { resolvedThemeQueryOptions } from '@openpost/query-catalog';
	import { auth } from '$lib/stores/auth';
	import { workspaceCtx } from '$lib/stores/workspace.svelte';
	import { createThemeQueryAPI } from '$lib/query/themes';
	import { toWebResolvedTheme } from '$lib/themes/web-resolved';
	import type { ThemeManifest, ThemeScheme, WebResolvedTheme } from '$lib/themes';

	let { publicDefault = false }: { publicDefault?: boolean } = $props();
	// The default Roberto Music theme paints public pages, and signed-in pages
	// while their resolved theme loads.
	let defaultManifest = $state.raw<ThemeManifest | null>(null);
	$effect(() => {
		if (defaultManifest || !(publicDefault || ($auth.isAuthenticated && workspaceID))) return;
		void import('$lib/themes/builtins/roberto-music')
			.then(({ robertoMusicTheme }) => {
				defaultManifest = robertoMusicTheme;
			})
			.catch((error) =>
				captureClientException(error, {
					error_boundary: isUnsupportedBrowserError(error)
						? 'theme_unsupported_browser'
						: 'public_theme_startup'
				})
			);
	});

	const themeApi = createThemeQueryAPI();

	let authState = $derived($auth);
	let workspaceID = $derived(workspaceCtx.currentWorkspace?.id ?? '');

	// The API resolves light or dark only, so the user's system preference is
	// turned into an effective scheme here before it reaches the resolver.
	let systemDark = $state(false);
	$effect(() => {
		if (typeof window === 'undefined') return;
		const query = window.matchMedia('(prefers-color-scheme: dark)');
		systemDark = query.matches;
		const onChange = (event: MediaQueryListEvent) => (systemDark = event.matches);
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	});

	let preferredMode = $derived(mode.current ?? 'system');
	let effectiveScheme: ThemeScheme = $derived(
		preferredMode === 'dark' || (preferredMode === 'system' && systemDark) ? 'dark' : 'light'
	);

	const resolved = createQuery(() =>
		resolvedThemeQueryOptions(themeApi, workspaceID, effectiveScheme)
	);

	let active = $derived(
		typeof document !== 'undefined' &&
			(publicDefault || (authState.isAuthenticated && Boolean(workspaceID)))
	);
	let ThemeApplicationBoundary = $state<
		typeof import('./theme-application-boundary.svelte').default | null
	>(null);
	$effect(() => {
		if (!active || ThemeApplicationBoundary) return;
		let current = true;
		void import('./theme-application-boundary.svelte')
			.then((module) => {
				if (current) ThemeApplicationBoundary = module.default;
			})
			.catch((error) => {
				// The complete CSS fallback keeps the app usable if the theme download fails.
				// Engines without regex lookbehind (Safari below 16.4) cannot evaluate
				// the theme runtime at all. That is an expected unsupported-browser
				// path, not a stale chunk, and must never trigger reload recovery.
				captureClientException(error, {
					error_boundary: isUnsupportedBrowserError(error)
						? 'theme_unsupported_browser'
						: 'theme_startup'
				});
			});
		return () => {
			current = false;
		};
	});
	// Hold the last resolved theme across workspace or scheme changes so a
	// switch never flashes the Workshop fallback while the new query loads.
	// The boundary keeps the retained theme applied until fresh data arrives.
	let retainedTheme = $state<WebResolvedTheme | null>(null);
	$effect(() => {
		if (resolved.data) retainedTheme = toWebResolvedTheme(resolved.data);
	});
	let theme = $derived.by<WebResolvedTheme | null>(() => {
		const signedIn = authState.isAuthenticated && Boolean(workspaceID);
		if (signedIn && retainedTheme) return retainedTheme;
		// A failed load keeps the Workshop recovery theme; a pending one shows
		// the default theme instead of flashing Workshop first.
		const provisional = publicDefault || (signedIn && !resolved.isError);
		if (!provisional || !defaultManifest) return null;
		return {
			id: defaultManifest.id,
			revision: defaultManifest.revision,
			name: defaultManifest.name,
			iconPack: defaultManifest.iconPack,
			source: 'builtin',
			requestedScheme: effectiveScheme,
			scheme: effectiveScheme,
			manifest: structuredClone(defaultManifest.schemes[effectiveScheme]!),
			fonts: [],
			assets: structuredClone(defaultManifest.assets)
		};
	});
</script>

{#if active && ThemeApplicationBoundary}
	<ThemeApplicationBoundary {active} scheme={effectiveScheme} {theme} />
{/if}
