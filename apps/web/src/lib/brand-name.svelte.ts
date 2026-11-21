import { defaultAppBranding } from '@openpost/query-catalog';

// Interface copy names the product "OpenPost". The build swaps that word in
// compiled Paraglide messages for brandName() (see brandedMessageModule in
// $lib/build/branded-copy), and app branding keeps the name current. Reading
// it while a template renders keeps the copy reactive to brand changes.
let current = $state(defaultAppBranding.display_name);

export function brandName(): string {
	return current;
}

export function setBrandName(name: string) {
	current = name.trim() || defaultAppBranding.display_name;
}
