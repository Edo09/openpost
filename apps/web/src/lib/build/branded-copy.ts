/**
 * Compiled Paraglide messages return template literals such as `Saved to
 * OpenPost`. This rewrites the product name in those templates to the live
 * brand name, so every locale follows App branding without changing the
 * translation catalogs. Message keys are lowercase, so generated identifiers
 * like `Common_OpenpostInputs` never match.
 */
const productName = 'OpenPost';
const brandImport = 'import { brandName as __openpostBrandName } from "$lib/brand-name.svelte";';

export function isParaglideMessageModule(id: string): boolean {
	const path = id.split('?')[0].replaceAll('\\', '/');
	return /\/src\/lib\/paraglide\/messages(\/[^/]+)?\.js$/.test(path);
}

export function brandedMessageModule(code: string): string {
	if (!code.includes(productName)) return code;
	return `${brandImport}\n${code.replaceAll(productName, `\${__openpostBrandName()}`)}`;
}
