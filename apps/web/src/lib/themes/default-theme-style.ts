import { resolveBuiltInTheme } from '@openpost/ui/themes/builtins.js';
import { themeSchemeToCssVariables } from '@openpost/ui/themes/runtime.js';

/** The built-in theme that paints the app before the theme runtime loads. */
export const defaultThemeID = 'roberto-music';

function variablesBlock(selector: string, scheme: 'light' | 'dark'): string {
	const variables = themeSchemeToCssVariables(resolveBuiltInTheme(defaultThemeID, scheme));
	const declarations = Object.entries(variables).map(([property, value]) => `${property}:${value}`);
	return `${selector}{${declarations.join(';')}}`;
}

/**
 * tokens.css embeds Workshop, the complete recovery theme. The SPA document
 * adds this block after it so the first paint uses the default theme instead
 * of flashing Workshop; the runtime's inline variables replace it as soon as
 * the Workspace theme resolves.
 */
export function defaultThemeStyle(): string {
	return `<style data-openpost-default-theme>${variablesBlock(':root', 'light')}${variablesBlock('.dark', 'dark')}</style>`;
}
