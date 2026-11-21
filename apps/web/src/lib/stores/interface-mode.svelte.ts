/**
 * Simple mode trims OpenPost to the publishing workflow: Home, New post,
 * Posts, Accounts, and Settings, with Instagram, Facebook, and TikTok as the
 * connectable platforms. Full mode shows every surface. People start in the
 * instance default (OPENPOST_DEFAULT_INTERFACE_MODE, full unless set) and can
 * switch from the profile menu; the choice is kept per device. Hidden
 * surfaces stay reachable by URL, so nothing is removed.
 */
export type InterfaceMode = 'simple' | 'full';

const storageKey = 'openpost-interface-mode';

// The server renders OPENPOST_DEFAULT_INTERFACE_MODE=simple into this tag; see
// renderMetadataTag in apps/server/cmd/openpost/web.go.
const defaultModeMetaSelector = 'meta[name="openpost-default-interface-mode"]';

/** Platforms offered for connection in simple mode, matched on the provider platform id. */
export const simpleModePlatforms: readonly string[] = ['instagram', 'facebook', 'tiktok'];

function savedChoice(): InterfaceMode | undefined {
	try {
		const value = globalThis.localStorage?.getItem(storageKey);
		return value === 'simple' || value === 'full' ? value : undefined;
	} catch {
		return undefined;
	}
}

function instanceDefault(): InterfaceMode {
	const meta = globalThis.document?.querySelector<HTMLMetaElement>(defaultModeMetaSelector);
	return meta?.content === 'simple' ? 'simple' : 'full';
}

class InterfaceModePreference {
	mode = $state<InterfaceMode>(savedChoice() ?? instanceDefault());

	get simple() {
		return this.mode === 'simple';
	}

	set(mode: InterfaceMode) {
		this.mode = mode;
		try {
			globalThis.localStorage?.setItem(storageKey, mode);
		} catch {
			// Keep this session's choice when storage is blocked.
		}
	}
}

export const interfaceMode = new InterfaceModePreference();
