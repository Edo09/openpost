<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { createQuery } from '@tanstack/svelte-query';
	import { workspaceAccountsQueryOptions } from '@openpost/query-catalog';
	import type { SocialAccount } from '$lib/api/client';
	import type { components } from '$lib/api/types';
	import { appBranding } from '$lib/app-branding.svelte';
	import { resolveAppPath } from '$lib/app-path';
	import { accountDisplayName } from '$lib/components/account-presentation';
	import InlineNotice from '$lib/components/inline-notice.svelte';
	import PageContainer from '$lib/components/page-container.svelte';
	import PlatformIcon from '$lib/components/platform-icon.svelte';
	import PublishResults from '$lib/components/simple-publish/publish-results.svelte';
	import TikTokPrivacyField from '$lib/components/simple-publish/tiktok-privacy-field.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { createComposerPublicationClient } from '$lib/composer/publication-client';
	import { uploadMediaFile } from '$lib/media-upload-client';
	import { m } from '$lib/paraglide/messages';
	import { queryAPI } from '$lib/query/api';
	import { simpleModePlatforms } from '$lib/stores/interface-mode.svelte';
	import { workspaceCtx } from '$lib/stores/workspace.svelte';
	import { ThemeIcon } from '$lib/themes/icons';
	import { getPlatformName } from '$lib/utils';
	import type { VideoPreparationProgress } from '$lib/video/types';

	type ValidationIssue = components['schemas']['ValidationIssue'];

	const workspaceID = $derived(workspaceCtx.currentWorkspace?.id ?? '');
	$effect(() => {
		if (workspaceCtx.currentWorkspace && !workspaceCtx.currentWorkspace.can_edit)
			void goto(resolveAppPath('/publications'), { replaceState: true });
	});

	// One video goes to every selected account. Simple publishing covers the
	// platforms the team uses; other accounts stay in the full composer.
	const accountsQuery = createQuery(() => workspaceAccountsQueryOptions(queryAPI, workspaceID));
	const accounts = $derived(
		(accountsQuery.data ?? []).filter(
			(account) => account.is_active && simpleModePlatforms.includes(account.platform)
		)
	);
	let excludedAccountIDs = $state<string[]>([]);
	const selectedAccounts = $derived(
		accounts.filter((account) => !excludedAccountIDs.includes(account.id))
	);
	const allSelected = $derived(accounts.length > 0 && selectedAccounts.length === accounts.length);
	const tiktokAccounts = $derived(
		selectedAccounts.filter((account) => account.platform === 'tiktok')
	);

	function setAccountSelected(account: SocialAccount, selected: boolean) {
		excludedAccountIDs = selected
			? excludedAccountIDs.filter((id) => id !== account.id)
			: [...excludedAccountIDs, account.id];
	}

	function setAllSelected(selected: boolean) {
		excludedAccountIDs = selected ? [] : accounts.map((account) => account.id);
	}

	let fileInput = $state<HTMLInputElement | null>(null);
	let dragging = $state(false);
	let videoName = $state('');
	let videoPreviewURL = $state('');
	let mediaID = $state('');
	let uploading = $state(false);
	let uploadProgress = $state<VideoPreparationProgress | null>(null);
	let uploadError = $state('');
	let uploadController: AbortController | null = null;

	const uploadLabel = $derived.by(() => {
		const stage = uploadProgress?.stage;
		if (stage === 'uploading')
			return m.simple_publish_uploading({
				percent: Math.round((uploadProgress?.fraction ?? 0) * 100)
			});
		if (stage === 'finalizing' || stage === 'processing') return m.simple_publish_finishing();
		return m.simple_publish_preparing();
	});

	function looksLikeVideo(file: File): boolean {
		return file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name);
	}

	async function chooseVideo(file: File | undefined) {
		if (!file) return;
		if (!looksLikeVideo(file)) {
			uploadError = m.simple_publish_not_video();
			return;
		}
		uploadController?.abort();
		const controller = new AbortController();
		uploadController = controller;
		if (videoPreviewURL) URL.revokeObjectURL(videoPreviewURL);
		videoPreviewURL = URL.createObjectURL(file);
		videoName = file.name;
		mediaID = '';
		uploadError = '';
		uploadProgress = null;
		uploading = true;
		try {
			const result = await uploadMediaFile({
				workspaceId: workspaceID,
				file,
				signal: controller.signal,
				onProgress: (progress) => {
					if (uploadController === controller) uploadProgress = progress;
				}
			});
			if (uploadController === controller) mediaID = result.id;
		} catch {
			if (uploadController === controller && !controller.signal.aborted)
				uploadError = m.simple_publish_upload_failed();
		} finally {
			if (uploadController === controller) uploading = false;
		}
	}

	function dropVideo(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		void chooseVideo(event.dataTransfer?.files?.[0]);
	}

	let description = $state('');
	let tiktokPrivacy = $state<Record<string, string>>({});
	let tiktokMusicConfirmed = $state(false);

	let scheduling = $state(false);
	let scheduleAt = $state('');
	const scheduledDate = $derived(scheduling && scheduleAt ? new Date(scheduleAt) : null);

	function localDateTimeValue(date: Date): string {
		const pad = (value: number) => String(value).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
	}
	const earliestSchedule = localDateTimeValue(new Date());

	function startScheduling() {
		scheduling = true;
		if (!scheduleAt) scheduleAt = localDateTimeValue(new Date(Date.now() + 60 * 60 * 1000));
	}

	// The primary action says why it is unavailable instead of failing later.
	const blockedReason = $derived.by(() => {
		if (!mediaID)
			return uploading ? m.simple_publish_needs_upload() : m.simple_publish_needs_video();
		if (selectedAccounts.length === 0) return m.simple_publish_needs_account();
		if (
			tiktokAccounts.length > 0 &&
			(!tiktokMusicConfirmed || tiktokAccounts.some((account) => !tiktokPrivacy[account.id]))
		)
			return m.simple_publish_needs_tiktok();
		if (
			scheduling &&
			(!scheduledDate ||
				Number.isNaN(scheduledDate.getTime()) ||
				scheduledDate.getTime() <= Date.now())
		)
			return m.simple_publish_needs_time();
		return '';
	});

	let submitting = $state(false);
	let submitError = $state('');
	let validationMessages = $state<string[]>([]);
	let publicationID = $state('');
	let scheduledFor = $state('');

	function renditionSettings(account: SocialAccount): Record<string, string | boolean> | undefined {
		switch (account.platform) {
			case 'instagram':
				return { is_reel: true };
			case 'tiktok':
				return {
					content_posting_method: 'DIRECT_POST',
					privacy_level: tiktokPrivacy[account.id] ?? '',
					music_usage_confirmed: tiktokMusicConfirmed
				};
			default:
				return undefined;
		}
	}

	function issueMessage(issue: ValidationIssue): string {
		const message = issue.message || issue.fallback_message;
		return issue.provider ? `${getPlatformName(issue.provider)}: ${message}` : message;
	}

	async function publish() {
		if (blockedReason || submitting) return;
		submitting = true;
		submitError = '';
		validationMessages = [];
		const client = createComposerPublicationClient(workspaceID);
		const text = description.trim();
		const media = [{ media_id: mediaID, role: 'attachment' }];
		const scheduledAt = scheduling && scheduledDate ? scheduledDate.toISOString() : undefined;
		try {
			const created = await client.create(workspaceID, {
				title: text.split('\n')[0]?.trim() || videoName,
				intent: 'short_video',
				creation_preset: 'short_video',
				content_profile: 'short_video',
				source_text: text,
				social_account_ids: selectedAccounts.map((account) => account.id),
				media,
				renditions: selectedAccounts.map((account) => ({
					social_account_id: account.id,
					profile: 'short_video',
					body: text,
					media,
					settings: renditionSettings(account)
				})),
				scheduled_at: scheduledAt,
				metadata: { created_from: 'simple_publish' }
			});
			const { issues } = await client.validate(created.id);
			const blocking = issues.filter((issue) => issue.severity === 'error');
			if (blocking.length > 0) {
				validationMessages = blocking.map(issueMessage);
				// The draft only existed for this attempt; the form keeps everything.
				await client.delete(created.id, created.revision).catch(() => undefined);
				return;
			}
			if (scheduledAt) await client.schedule(created.id, created.revision);
			else await client.publishNow(created.id, created.revision);
			scheduledFor = scheduledAt ?? '';
			publicationID = created.id;
		} catch (cause) {
			submitError =
				cause instanceof Error && cause.message ? cause.message : m.simple_publish_failed();
		} finally {
			submitting = false;
		}
	}

	function startOver() {
		uploadController?.abort();
		uploadController = null;
		if (videoPreviewURL) URL.revokeObjectURL(videoPreviewURL);
		videoPreviewURL = '';
		videoName = '';
		mediaID = '';
		uploading = false;
		uploadProgress = null;
		uploadError = '';
		description = '';
		tiktokPrivacy = {};
		tiktokMusicConfirmed = false;
		scheduling = false;
		scheduleAt = '';
		excludedAccountIDs = [];
		validationMessages = [];
		submitError = '';
		scheduledFor = '';
		publicationID = '';
	}

	onDestroy(() => {
		uploadController?.abort();
		if (videoPreviewURL) URL.revokeObjectURL(videoPreviewURL);
	});
</script>

<svelte:head>
	<title>{m.simple_publish_title()} · {appBranding.profile.display_name}</title>
</svelte:head>

<PageContainer title={m.simple_publish_title()} themeIconRole="video">
	<div class="mx-auto w-full max-w-2xl">
		{#if publicationID}
			<PublishResults
				workspaceId={workspaceID}
				publicationId={publicationID}
				{scheduledFor}
				onStartOver={startOver}
			/>
		{:else}
			<form
				class="space-y-8"
				onsubmit={(event) => {
					event.preventDefault();
					void publish();
				}}
			>
				<section class="space-y-3">
					{#if videoPreviewURL}
						<div class="overflow-hidden rounded-lg border bg-black">
							<video
								src={videoPreviewURL}
								controls
								muted
								playsinline
								class="mx-auto max-h-80 w-full object-contain"
							></video>
						</div>
						<div class="flex flex-wrap items-center justify-between gap-2">
							<p
								class="min-w-0 text-sm {uploadError ? 'text-destructive' : 'text-muted-foreground'}"
								role="status"
								aria-live="polite"
							>
								{#if uploadError}
									{uploadError}
								{:else if uploading}
									{uploadLabel}
								{:else}
									<ThemeIcon role="check" class="mr-1 inline size-4 text-primary" />
									{m.simple_publish_uploaded()}
								{/if}
							</p>
							<Button type="button" variant="outline" size="sm" onclick={() => fileInput?.click()}>
								{m.simple_publish_change_video()}
							</Button>
						</div>
						{#if uploading}
							<progress
								class="h-1.5 w-full overflow-hidden rounded-full"
								max="1"
								value={uploadProgress?.stage === 'uploading' ? uploadProgress.fraction : undefined}
								aria-label={uploadLabel}
							></progress>
						{/if}
					{:else}
						<button
							type="button"
							class="flex min-h-48 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none {dragging
								? 'border-primary bg-muted/40'
								: 'border-border'}"
							onclick={() => fileInput?.click()}
							ondragover={(event) => {
								event.preventDefault();
								dragging = true;
							}}
							ondragleave={() => (dragging = false)}
							ondrop={dropVideo}
						>
							<ThemeIcon role="video" class="size-8 text-muted-foreground" />
							<span class="text-base font-semibold">{m.simple_publish_choose_video()}</span>
							<span class="text-sm text-muted-foreground">{m.simple_publish_drop_hint()}</span>
						</button>
						{#if uploadError}
							<InlineNotice tone="error" message={uploadError} />
						{/if}
					{/if}
					<Input
						bind:ref={fileInput}
						type="file"
						accept="video/*"
						class="sr-only"
						tabindex={-1}
						aria-hidden="true"
						onchange={() => {
							void chooseVideo(fileInput?.files?.[0]);
							if (fileInput) fileInput.value = '';
						}}
					/>
				</section>

				<section class="space-y-2">
					<Label for="simple-publish-description">{m.simple_publish_description()}</Label>
					<Textarea
						id="simple-publish-description"
						bind:value={description}
						rows={4}
						placeholder={m.simple_publish_description_placeholder()}
					/>
				</section>

				<section class="space-y-3" aria-labelledby="simple-publish-where">
					<div class="flex items-center justify-between gap-3">
						<h2 id="simple-publish-where" class="text-sm font-medium">
							{m.simple_publish_where()}
						</h2>
						{#if accounts.length > 1}
							<label class="flex items-center gap-2 text-sm text-muted-foreground">
								<Checkbox
									checked={allSelected}
									onCheckedChange={(value) => setAllSelected(value === true)}
								/>
								{m.simple_publish_select_all()}
							</label>
						{/if}
					</div>
					{#if accountsQuery.isPending}
						<p class="text-sm text-muted-foreground">{m.common_loading()}</p>
					{:else if accounts.length === 0}
						<div class="space-y-3 rounded-lg border px-4 py-5">
							<p class="text-sm text-muted-foreground">{m.simple_publish_no_accounts()}</p>
							<Button variant="outline" size="sm" href={resolveAppPath('/accounts')}>
								{m.simple_publish_connect_accounts()}
							</Button>
						</div>
					{:else}
						<ul class="divide-y rounded-lg border">
							{#each accounts as account (account.id)}
								<li>
									<label class="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3">
										<Checkbox
											checked={!excludedAccountIDs.includes(account.id)}
											onCheckedChange={(value) => setAccountSelected(account, value === true)}
										/>
										<PlatformIcon platform={account.platform} class="size-5 shrink-0" />
										<span class="min-w-0 flex-1">
											<span class="block truncate text-sm font-medium">
												{accountDisplayName(account)}
											</span>
											<span class="block text-sm text-muted-foreground">
												{getPlatformName(account.platform)}
											</span>
										</span>
									</label>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				{#if tiktokAccounts.length > 0}
					<section class="space-y-4 rounded-lg border px-4 py-4">
						{#each tiktokAccounts as account (account.id)}
							<TikTokPrivacyField
								workspaceId={workspaceID}
								accountId={account.id}
								accountName={accountDisplayName(account)}
								showAccountName={tiktokAccounts.length > 1}
								value={tiktokPrivacy[account.id] ?? ''}
								onValueChange={(value) =>
									(tiktokPrivacy = { ...tiktokPrivacy, [account.id]: value })}
							/>
						{/each}
						<label class="flex items-start gap-3 text-sm">
							<Checkbox
								checked={tiktokMusicConfirmed}
								onCheckedChange={(value) => (tiktokMusicConfirmed = value === true)}
							/>
							<span>{m.simple_publish_tiktok_music()}</span>
						</label>
					</section>
				{/if}

				{#if scheduling}
					<section class="space-y-2">
						<Label for="simple-publish-schedule">{m.simple_publish_schedule_at()}</Label>
						<Input
							id="simple-publish-schedule"
							type="datetime-local"
							min={earliestSchedule}
							bind:value={scheduleAt}
							class="max-w-xs"
						/>
					</section>
				{/if}

				{#if validationMessages.length > 0}
					<InlineNotice tone="error" message={m.simple_publish_check_failed()}>
						<ul class="mt-1 list-disc space-y-1 pl-5">
							{#each validationMessages as message (message)}
								<li>{message}</li>
							{/each}
						</ul>
					</InlineNotice>
				{/if}
				{#if submitError}
					<InlineNotice tone="error" message={submitError} />
				{/if}

				<div class="space-y-2">
					<div class="flex flex-wrap items-center gap-2">
						<Button type="submit" size="lg" disabled={Boolean(blockedReason) || submitting}>
							<ThemeIcon role={scheduling ? 'calendar' : 'send'} class="size-4" />
							{scheduling ? m.simple_publish_schedule_submit() : m.compose_publish_now()}
						</Button>
						{#if scheduling}
							<Button type="button" variant="ghost" onclick={() => (scheduling = false)}>
								{m.simple_publish_publish_now_instead()}
							</Button>
						{:else}
							<Button type="button" variant="ghost" onclick={startScheduling}>
								{m.simple_publish_schedule_later()}
							</Button>
						{/if}
					</div>
					{#if blockedReason}
						<p class="text-sm text-muted-foreground">{blockedReason}</p>
					{/if}
				</div>
			</form>
		{/if}
	</div>
</PageContainer>
