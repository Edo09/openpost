import type { Handle } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { defaultThemeStyle } from '$lib/themes/default-theme-style';

// Computed once: the SPA document is rendered at build time.
const defaultThemeCSS = defaultThemeStyle();

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
					.replace('</head>', `${defaultThemeCSS}</head>`)
		});
	});

export const handle: Handle = handleParaglide;
