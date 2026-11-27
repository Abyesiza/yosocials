"use client";

import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import { Button, ButtonLink, EmptyState, ErrorNote, PageHeader } from "@/app/components/ui";
import { FeedSkeleton } from "@/app/components/skeletons";
import { api, useApi } from "@/app/lib/api/client";
import type { Account, FeedItem, Paginated } from "@/app/lib/api/types";
import { AccountStories } from "./account-stories";
import { FeedRail } from "./feed-rail";
import { PostCard } from "./post-card";
import { useWorkspace } from "./workspace-context";

const PAGE = 12;

export function FeedView() {
  const { base, href, can, workspace } = useWorkspace();
  const { data: accounts } = useApi<Account[]>(`${base}/accounts`);
  const [accountId, setAccountId] = useState<string | null>(null);

  const feed = useSWRInfinite<Paginated<FeedItem>>(
    (index, previous) => {
      if (previous && previous.offset + previous.items.length >= previous.total) return null;
      const q = new URLSearchParams({ limit: String(PAGE), offset: String(index * PAGE) });
      if (accountId) q.set("accountId", accountId);
      return `${base}/feed?${q}`;
    },
    (path: string) => api<Paginated<FeedItem>>(path),
  );
  const items = feed.data?.flatMap((p) => p.items) ?? [];
  const total = feed.data?.[0]?.total ?? 0;

  return (
    <div className="grid gap-8 2xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-label="Published posts" className="min-w-0">
        <PageHeader eyebrow={workspace?.name} title="Home" subtitle="Everything you've published, across every account." />
        <AccountStories accounts={accounts} selected={accountId} onSelect={setAccountId} />
        <ErrorNote error={feed.error} />
        {!feed.data && !feed.error && <FeedSkeleton />}
        {feed.data && items.length === 0 && <EmptyFeed hasAccounts={Boolean(accounts?.length)} canCreate={can("editor")} canConnect={can("admin")} href={href} />}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <PostCard key={item.id} item={item} />
          ))}
        </div>
        {items.length < total && (
          <div className="flex justify-center py-8">
            <Button variant="outline" loading={feed.isValidating} onClick={() => feed.setSize(feed.size + 1)}>
              Load more
            </Button>
          </div>
        )}
      </section>
      <FeedRail />
    </div>
  );
}

function EmptyFeed({ hasAccounts, canCreate, canConnect, href }: { hasAccounts: boolean; canCreate: boolean; canConnect: boolean; href: (p?: string) => string }) {
  if (hasAccounts) {
    return (
      <EmptyState
        title="Nothing published yet"
        body="Posts you publish from Aby Socials show up here with their likes, reposts and replies."
        action={canCreate && <ButtonLink href={href("/create")}>Create a post</ButtonLink>}
      />
    );
  }
  return (
    <EmptyState
      title="Connect your first account"
      body="Bring in Bluesky, Mastodon, Telegram or Discord to start posting from one place."
      action={canConnect && <ButtonLink href={href("/accounts")}>Connect an account</ButtonLink>}
    />
  );
}
