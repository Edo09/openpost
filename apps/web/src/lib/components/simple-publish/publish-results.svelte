<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { publicationDetailQueryOptions } from '@openpost/query-catalog';
	import type { components } from '$lib/api/types';
	import { resolveAppPath } from '$lib/app-path';
	import PlatformIcon from '$lib/components/platform-icon.svelte';
	import { Button } from '$lib/components/ui/button';
	import { createComposerPublicationClient } from '$lib/composer/publication-client';
	import { getLocaleTag } from '$lib/i18n';
	import { m } from '$lib/paraglide/messages';
	import { queryAPI } from '$lib/query/api';
	import { ProtectedIcon, ThemeIcon } from '$lib/themes/icons';
	import { showToast } from '$lib/toast';
	import { getPlatformName } from '$lib/utils';

	type Rendition = components['schemas']['RenditionResponse'];

	interface Props {
		workspaceId: string;
		publicationId: string;
		/** ISO time the video was scheduled for; empty when it was published right away. */
		scheduledFor: string;
		onStartOver: () => void;
	}

	let { workspaceId, publicationId, scheduledFor, onStartOver }: Props = $props();

	function stillPublishing(renditions: Rendition[]): boolean {
		if (renditions.length === 0) return true;
		return renditions.some(
			(rendition) =>
				rendition.status === 'publishing' ||
				rendition.status === 'ready' ||
				(!scheduledFor && rendition.status === 'scheduled')
		);
	}

	// Poll while any account is still on its way, then stop.
	const publicationQuery = createQuery(() => ({
		...publicationDetailQueryOptions(queryAPI, workspaceId, publicationId),
		refetchInterval: (query: { state: { data?: { renditions: Rendition[] | null } } }) =>
			stillPublishing(query.state.data?.renditions ?? []) ? 3000 : false
	}));
	const renditions = $derived(publicationQuery.data?.renditions ?? []);
	const scheduledTime = $derived(
		scheduledFor
			? new Intl.DateTimeFormat(getLocaleTag(), { dateStyle: 'medium', timeStyle: 'short' }).format(
					new Date(scheduledFor)
				)
			: ''
	);
	const outcome = $derived.by(() => {
		if (scheduledFor && renditions.length > 0 && renditions.every((r) => r.status === 'scheduled'))
			return 'scheduled';
		if (stillPublishing(renditions)) return 'publishing';
		if (renditions.every((rendition) => rendition.status === 'published')) return 'done';
		return 'partial';
	});
	const heading = $derived.by(() => {
		switch (outcome) {
			case 'scheduled':
				return m.simple_publish_status_scheduled();
			case 'done':
				return m.simple_publish_status_done();
			case 'partial':
				return m.simple_publish_status_partial();
			default:
				return m.simple_publish_status_publishing();
		}
	});

	function statusText(rendition: Rendition): string {
		if (rendition.status === 'published') return m.simple_publish_row_published();
		if (rendition.status === 'failed') return m.simple_publish_row_failed();
		if (scheduledFor && rendition.status === 'scheduled')
			return m.simple_publish_row_scheduled({ time: scheduledTime });
		return m.simple_publish_row_publishing();
	}

	let retryingAccountID = $state('');
	async function retry(rendition: Rendition) {
		retryingAccountID = rendition.social_account_id;
		try {
			await createComposerPublicationClient(workspaceId).retry(
				publicationId,
				rendition.social_account_id,
				rendition.target_key
			);
			await publicationQuery.refetch();
		} catch (cause) {
			showToast(
				cause instanceof Error && cause.message ? cause.message : m.simple_publish_failed(),
				'error'
			);
		} finally {
			retryingAccountID = '';
		}
	}
</script>

<section class="space-y-6" aria-labelledby="simple-publish-results-heading">
	<div class="flex items-center gap-3">
		{#if outcome === 'publishing'}
			<ProtectedIcon
				icon="loading"
				class="size-5 animate-spin text-muted-foreground motion-reduce:animate-none"
			/>
		{:else if outcome === 'partial'}
			<ThemeIcon role="close" class="size-5 text-destructive" />
		{:else}
			<ThemeIcon role="check" class="size-5 text-primary" />
		{/if}
		<h2 id="simple-publish-results-heading" class="text-lg font-semibold" aria-live="polite">
			{heading}
		</h2>
	</div>

	<ul class="divide-y rounded-lg border">
		{#each renditions as rendition (rendition.id)}
			<li class="flex items-center gap-3 px-4 py-3">
				<PlatformIcon platform={rendition.platform} class="size-5 shrink-0" />
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium">
						{rendition.account?.display_name || getPlatformName(rendition.platform)}
					</p>
					<p
						class="text-sm {rendition.status === 'failed'
							? 'text-destructive'
							: 'text-muted-foreground'}"
					>
						{statusText(rendition)}
					</p>
					{#if rendition.status === 'failed' && rendition.error_message}
						<p class="mt-1 text-sm text-muted-foreground">{rendition.error_message}</p>
					{/if}
				</div>
				{#if rendition.status === 'published' && rendition.external_url}
					<Button
						variant="outline"
						size="sm"
						href={rendition.external_url}
						target="_blank"
						rel="noopener noreferrer"
					>
						{m.simple_publish_view_post()}
					</Button>
				{:else if rendition.status === 'failed'}
					<Button
						variant="outline"
						size="sm"
						disabled={retryingAccountID === rendition.social_account_id}
						onclick={() => retry(rendition)}
					>
						{m.simple_publish_retry()}
					</Button>
				{/if}
			</li>
		{/each}
	</ul>

	<div class="flex flex-wrap gap-2">
		<Button onclick={onStartOver}>{m.simple_publish_another()}</Button>
		<Button variant="ghost" href={resolveAppPath('/publications')}>
			{m.simple_publish_view_posts()}
		</Button>
	</div>
</section>
