import { afterEach, describe, expect, it, vi } from 'vitest';

interface DeviceState {
	saved?: string;
	instanceDefault?: string;
}

function stubDevice({ saved, instanceDefault }: DeviceState) {
	const storage = new Map<string, string>(
		saved === undefined ? [] : [['openpost-interface-mode', saved]]
	);
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value)
	});
	const meta = instanceDefault === undefined ? null : { content: instanceDefault };
	vi.stubGlobal('document', {
		querySelector: (selector: string) =>
			selector === 'meta[name="openpost-default-interface-mode"]' ? meta : null
	});
	return storage;
}

// The preference is read once when the module loads, like a page load.
async function loadPreference(state: DeviceState) {
	const storage = stubDevice(state);
	vi.resetModules();
	const { interfaceMode } = await import('./interface-mode.svelte');
	return { interfaceMode, storage };
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('interface mode', () => {
	it('shows the full app unless the instance defaults to simple mode', async () => {
		expect((await loadPreference({})).interfaceMode.mode).toBe('full');
		expect((await loadPreference({ instanceDefault: 'simple' })).interfaceMode.mode).toBe('simple');
		expect((await loadPreference({ instanceDefault: 'other' })).interfaceMode.mode).toBe('full');
	});

	it('keeps the choice a person made on this device', async () => {
		const { interfaceMode, storage } = await loadPreference({
			saved: 'full',
			instanceDefault: 'simple'
		});
		expect(interfaceMode.mode).toBe('full');

		interfaceMode.set('simple');
		expect(interfaceMode.simple).toBe(true);
		expect(storage.get('openpost-interface-mode')).toBe('simple');
	});
});
