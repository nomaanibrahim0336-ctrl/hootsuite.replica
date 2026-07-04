'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, PageHeader, Button, Badge, Avatar } from '@/components/ui';
import { advocacyContent as seedContent, advocacyLeaderboard as seedLeaderboard, advocacyStats as seedStats } from '@/lib/mock';
import { api } from '@/lib/api';
import { formatNumber, cn } from '@/lib/utils';
import { toast } from '@/components/Toast';
import { Megaphone, Share2, Trophy, Users, TrendingUp, Medal } from 'lucide-react';

export default function AmplifyPage() {
  const [shared, setShared] = useState<Record<string, boolean>>({});
  const [advocacyContent, setAdvocacyContent] = useState<typeof seedContent>([]);
  const [advocacyLeaderboard, setAdvocacyLeaderboard] = useState<typeof seedLeaderboard>([]);
  const [advocacyStats, setAdvocacyStats] = useState({ totalShares: 0, totalReach: 0, activeAdvocates: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [contentRes, analyticsRes] = await Promise.all([api.getAdvocacyContent(), api.getAdvocacyAnalytics()]);
        if (cancelled) return;
        setAdvocacyContent(contentRes ?? []);
        setAdvocacyLeaderboard(analyticsRes?.leaderboard ?? []);
        setAdvocacyStats({
          totalShares: analyticsRes?.totalShares ?? 0,
          totalReach: analyticsRes?.totalReach ?? 0,
          activeAdvocates: analyticsRes?.leaderboard?.length ?? 0,
        });
      } catch {
        if (cancelled) return;
        // Live API unreachable — fall back to demo data so the page still renders.
        setAdvocacyContent(seedContent);
        setAdvocacyLeaderboard(seedLeaderboard);
        setAdvocacyStats(seedStats);
        toast.info('Showing demo data — live API unreachable.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const share = (id: string, title: string) => {
    setShared((s) => ({ ...s, [id]: true }));
    toast.success(`Shared “${title}” to your networks 🎉`);
    api.shareAdvocacyContent(id, {}).catch(() => {
      // API unreachable — local share state stands as the offline result.
    });
  };

  const medal = ['#FFB81C', '#B0B8C4', '#CD7F32'];

  return (
    <div>
      <PageHeader
        title="Amplify"
        subtitle="Share pre-approved brand content and climb the leaderboard."
        action={<Badge color="purple"><Megaphone className="mr-1 inline h-3 w-3" /> Employee Advocacy</Badge>}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total shares', value: advocacyStats.totalShares, icon: Share2 },
          { label: 'Total reach', value: advocacyStats.totalReach, icon: TrendingUp },
          { label: 'Active advocates', value: advocacyStats.activeAdvocates, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent-light to-accent/20">
              <Icon className="h-5 w-5 text-accent-deep" />
            </span>
            <div>
              <p className="text-sm text-slate-500">{label}</p>
              <p className="text-2xl font-bold text-slate-900">{formatNumber(value)}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Content hub */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Content hub" subtitle="Brand-approved posts ready to share" />
            <div className="divide-y divide-slate-100">
              {advocacyContent.map((c) => (
                <div key={c.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800">{c.title}</p>
                      <Badge>{c.category}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{c.body}</p>
                    <p className="mt-1 text-xs text-slate-400">{c.shareCount + (shared[c.id] ? 1 : 0)} shares</p>
                  </div>
                  <Button
                    variant={shared[c.id] ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => share(c.id, c.title)}
                    disabled={shared[c.id]}
                  >
                    <Share2 className="h-4 w-4" /> {shared[c.id] ? 'Shared' : 'Share'}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Leaderboard */}
        <Card className="h-fit">
          <CardHeader title="Leaderboard" subtitle="Top advocates by reach" action={<Trophy className="h-5 w-5 text-accent-deep" />} />
          <div className="divide-y divide-slate-100">
            {advocacyLeaderboard.map((l, i) => (
              <div key={l.name} className="flex items-center gap-3 px-5 py-3">
                <span
                  className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold', i < 3 ? 'text-white' : 'bg-slate-100 text-slate-500')}
                  style={i < 3 ? { background: medal[i] } : undefined}
                >
                  {i < 3 ? <Medal className="h-4 w-4" /> : i + 1}
                </span>
                <Avatar name={l.name} size={32} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{l.name}</p>
                  <p className="text-xs text-slate-400">{l.shares} shares</p>
                </div>
                <span className="text-sm font-semibold text-slate-700">{formatNumber(l.reach)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
