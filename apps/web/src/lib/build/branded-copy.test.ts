import { describe, expect, it } from 'vitest';
import { brandedMessageModule, isParaglideMessageModule } from './branded-copy';

const compiledMessage = [
	'/* eslint-disable */',
	"import { getLocale, experimentalStaticLocale } from '../runtime.js';",
	'/** @typedef {{}} Common_OpenpostInputs */',
	'const es_common_saved = /** @type {(inputs: Common_OpenpostInputs) => LocalizedString} */ () => {',
	'\treturn /** @type {LocalizedString} */ (`Guardado en OpenPost. OpenPost lo publica.`)',
	'};'
].join('\n');

describe('branded copy', () => {
	it('swaps the product name in message templates for the live brand name', () => {
		const branded = brandedMessageModule(compiledMessage);

		expect(branded.split('\n')[0]).toBe(
			'import { brandName as __openpostBrandName } from "$lib/brand-name.svelte";'
		);
		expect(branded).toContain(
			'(`Guardado en ${__openpostBrandName()}. ${__openpostBrandName()} lo publica.`)'
		);
		expect(branded).toContain('Common_OpenpostInputs');
		expect(branded).not.toContain('OpenPost');
	});

	it('leaves modules without the product name unchanged', () => {
		const plain = compiledMessage.replaceAll('OpenPost', 'Roberto Music');
		expect(brandedMessageModule(plain)).toBe(plain);
	});

	it('recognizes only compiled message modules', () => {
		expect(
			isParaglideMessageModule('/repo/apps/web/src/lib/paraglide/messages/common_saved.js')
		).toBe(true);
		expect(
			isParaglideMessageModule('C:\\repo\\apps\\web\\src\\lib\\paraglide\\messages\\es.js?v=1')
		).toBe(true);
		expect(isParaglideMessageModule('/repo/apps/web/src/lib/paraglide/messages.js')).toBe(true);
		expect(isParaglideMessageModule('/repo/apps/web/src/lib/paraglide/runtime.js')).toBe(false);
		expect(isParaglideMessageModule('/repo/apps/web/src/lib/i18n.ts')).toBe(false);
	});
});
