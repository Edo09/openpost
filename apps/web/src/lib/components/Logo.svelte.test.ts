import { expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Logo from './Logo.svelte';

it('draws the Roberto Music beams with the middle beam in the current text color', async () => {
	const screen = await render(Logo);
	const logo = screen.getByRole('img', { name: 'Roberto Music' }).element();
	const container = logo.parentElement!;
	const beams = [...logo.querySelectorAll('rect')];
	expect(beams).toHaveLength(3);
	for (const text of ['rgb(20, 20, 24)', 'rgb(242, 245, 250)']) {
		container.style.setProperty('color', text);
		await expect
			.poll(() => beams.map((beam) => getComputedStyle(beam).fill))
			.toEqual(['rgb(122, 167, 245)', text, 'rgb(216, 27, 106)']);
	}
});
