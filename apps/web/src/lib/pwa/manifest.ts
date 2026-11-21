import type { ManifestOptions } from 'vite-plugin-pwa';

export const appManifest = {
	id: '/',
	scope: '/',
	name: 'Roberto Music',
	short_name: 'Roberto Music',
	description: 'Schedule and publish content across multiple social platforms.',
	theme_color: '#0a0c12',
	background_color: '#0a0c12',
	display: 'standalone',
	start_url: '/',
	icons: [
		{
			src: '/roberto-music/pwa-192.png',
			sizes: '192x192',
			type: 'image/png',
			purpose: 'any'
		},
		{
			src: '/roberto-music/pwa-512.png',
			sizes: '512x512',
			type: 'image/png',
			purpose: 'any'
		},
		{
			src: '/roberto-music/pwa-maskable-512.png',
			sizes: '512x512',
			type: 'image/png',
			purpose: 'maskable'
		},
		{
			src: '/roberto-music/icon.svg',
			sizes: 'any',
			type: 'image/svg+xml',
			purpose: 'any'
		}
	]
} satisfies Partial<ManifestOptions>;
