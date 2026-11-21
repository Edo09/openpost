<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { publishingOptionsQueryOptions } from '@openpost/query-catalog';
	import AppSelect from '$lib/components/app-select.svelte';
	import { Label } from '$lib/components/ui/label';
	import { getLocaleTag } from '$lib/i18n';
	import { m } from '$lib/paraglide/messages';
	import { schedulingQueryAPI } from '$lib/query/scheduling';

	interface Props {
		workspaceId: string;
		accountId: string;
		accountName: string;
		showAccountName: boolean;
		value: string;
		onValueChange: (value: string) => void;
	}

	let { workspaceId, accountId, accountName, showAccountName, value, onValueChange }: Props =
		$props();

	// TikTok lists the privacy levels each creator may use, and its rules
	// require the person to choose one, so there is no preselected value.
	const optionsQuery = createQuery(() =>
		publishingOptionsQueryOptions(schedulingQueryAPI, workspaceId, {
			accountId,
			source: 'tiktok_privacy_levels',
			region: '',
			locale: getLocaleTag(),
			limit: 25,
			context: JSON.stringify({ content_posting_method: 'DIRECT_POST' })
		})
	);
	const options = $derived(
		(optionsQuery.data?.options ?? []).map((option) => ({
			value: option.value,
			label: option.label
		}))
	);
	const fieldID = $derived(`simple-publish-tiktok-privacy-${accountId}`);
</script>

<div class="space-y-1.5">
	<Label for={fieldID}>
		{m.simple_publish_tiktok_privacy()}{#if showAccountName}<span
				class="font-normal text-muted-foreground"
			>
				({accountName})</span
			>{/if}
	</Label>
	<AppSelect
		id={fieldID}
		{value}
		{options}
		placeholder={optionsQuery.isPending
			? m.common_loading()
			: m.simple_publish_tiktok_privacy_placeholder()}
		disabled={optionsQuery.isPending || options.length === 0}
		{onValueChange}
	/>
	{#if optionsQuery.isError}
		<p class="text-sm text-destructive">{m.compose_load_provider_options_failed()}</p>
	{/if}
</div>
