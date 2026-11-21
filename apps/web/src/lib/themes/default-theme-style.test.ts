import { describe, expect, it } from 'vitest';
import { resolveBuiltInTheme } from '@openpost/ui/themes/builtins.js';
import { themeSchemeToCssVariables } from '@openpost/ui/themes/runtime.js';
import { defaultThemeStyle } from './default-theme-style';

function block(style: string, selector: string): Map<string, string> {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const body = new RegExp(`(?:^|\\})${escaped}\\{([^}]*)\\}`).exec(style)?.[1] ?? '';
	return new Map(
		body.split(';').map((declaration) => {
			const separator = declaration.indexOf(':');
			return [declaration.slice(0, separator), declaration.slice(separator + 1)];
		})
	);
}

describe('default theme style', () => {
	const style = defaultThemeStyle()
		.replace(/^<style data-openpost-default-theme>/, '')
		.replace(/<\/style>$/, '');

	it.each([
		['light', ':root'],
		['dark', '.dark']
	] as const)(
		'paints every %s Roberto Music variable before the runtime loads',
		(scheme, selector) => {
			const expected = themeSchemeToCssVariables(resolveBuiltInTheme('roberto-music', scheme));
			const actual = block(style, selector);

			expect(Object.keys(expected).length).toBeGreaterThan(50);
			for (const [property, value] of Object.entries(expected)) {
				expect(actual.get(property), property).toBe(value);
			}
		}
	);

	it('wraps the variables in one identifiable style element', () => {
		expect(defaultThemeStyle()).toMatch(
			/^<style data-openpost-default-theme>:root\{.*\}\.dark\{.*\}<\/style>$/s
		);
	});
});
