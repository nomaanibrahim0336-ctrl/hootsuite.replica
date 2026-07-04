'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, PageHeader, Button, Badge, NetworkChip, Avatar } from '@/components/ui';
import { networks as seedNetworks, team as seedTeam, currentUser, auditLog } from '@/lib/mock';
import { api } from '@/lib/api';
import { NETWORK_META, formatNumber } from '@/lib/utils';
import type { Network, TeamMember, UserRole } from '@/lib/types';
import { format, formatDistanceToNow } from 'date-fns';
import { Plus, ScrollText, Plug, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { AiSettingsPanel } from '@/components/AiSettingsPanel';
import { toast } from '@/components/Toast';

const roleColor: Record<UserRole, string> = {
  owner: 'purple',
  admin: 'blue',
  editor: 'green',
  viewer: 'slate',
};

export default function SettingsPage() {
  const [networks, setNetworks] = useState<Network[]>(seedNetworks);
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [inviting, setInviting] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getTeam();
        if (!cancelled) setTeam(res ?? []);
      } catch {
        if (cancelled) return;
        // Live API unreachable — fall back to demo data so the page still renders.
        setTeam(seedTeam);
        toast.info('Showing demo data — live API unreachable.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const invite = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    const member: TeamMember = { id: 't' + Date.now(), name: inviteName, email: inviteEmail, role: 'viewer', joinedAt: new Date().toISOString() };
    setTeam((l) => [...l, member]);
    toast.success(`Invited ${inviteEmail}`);
    setInviteName('');
    setInviteEmail('');
    setInviting(false);
    try {
      const created = (await api.inviteMember({ name: member.name, email: member.email, role: member.role })) as TeamMember;
      setTeam((l: TeamMember[]) => [...l.filter((m) => m.id !== member.id), created]);
    } catch {
      // API unreachable — locally added member stands as the offline result.
    }
  };

  const toggle = (id: string) =>
    setNetworks((l) =>
      l.map((n) => {
        if (n.id !== id) return n;
        const connected = !n.connected;
        toast.success(`${NETWORK_META[n.type].label} ${connected ? 'connected' : 'disconnected'}`);
        return { ...n, connected, followers: connected ? Math.floor(Math.random() * 40000 + 5000) : 0 };
      })
    );

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your profile, connected accounts and team." />

      <div className="space-y-6">
        {/* Connections shortcut */}
        <Link href="/settings/connections">
          <Card className="flex items-center gap-4 p-5 transition hover:border-accent hover:shadow-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent-light to-accent/20">
              <Plug className="h-5 w-5 text-accent-deep" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-slate-800">Connections</p>
              <p className="text-sm text-slate-500">Database (Supabase), backend API, social OAuth & AI providers.</p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </Card>
        </Link>

        {/* Profile */}
        <Card>
          <CardHeader title="Profile" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent" />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={() => toast.success('Profile saved')}>Save changes</Button>
            </div>
          </div>
        </Card>

        {/* Connected networks */}
        <Card>
          <CardHeader title="Connected accounts" subtitle="Connect your social networks to publish and monitor." />
          <div className="divide-y divide-slate-100">
            {networks.map((n) => (
              <div key={n.id} className="flex items-center gap-4 px-5 py-4">
                <NetworkChip type={n.type} size={40} />
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{NETWORK_META[n.type].label}</p>
                  <p className="text-sm text-slate-400">
                    {n.connected ? `${n.username} · ${formatNumber(n.followers)} followers` : 'Not connected'}
                  </p>
                </div>
                {n.connected ? (
                  <>
                    <Badge color="green">Connected</Badge>
                    <Button variant="secondary" size="sm" onClick={() => toggle(n.id)}>Disconnect</Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => toggle(n.id)}>Connect</Button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* AI providers */}
        <AiSettingsPanel />

        {/* Team */}
        <Card>
          <CardHeader
            title="Team members"
            subtitle={`${team.length} members`}
            action={<Button size="sm" onClick={() => setInviting((c) => !c)}><Plus className="h-4 w-4" /> Invite</Button>}
          />
          {inviting && (
            <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
              <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Name" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent" />
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent" />
              <Button size="sm" onClick={invite}>Send invite</Button>
            </div>
          )}
          <div className="divide-y divide-slate-100">
            {team.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={m.name} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{m.name}</p>
                  <p className="text-xs text-slate-400">{m.email}</p>
                </div>
                <span className="text-xs text-slate-400">Joined {format(new Date(m.joinedAt), 'MMM yyyy')}</span>
                <Badge color={roleColor[m.role]}>{m.role}</Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Audit trail */}
        <Card>
          <CardHeader title="Audit trail" subtitle="Recent actions across your workspace" action={<ScrollText className="h-5 w-5 text-accent-deep" />} />
          <div className="divide-y divide-slate-100">
            {auditLog.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{e.action}</code>
                <span className="flex-1 truncate text-slate-700">{e.entity}</span>
                <span className="hidden text-xs text-slate-400 sm:inline">{e.actor}</span>
                <span className="text-xs text-slate-400">{formatDistanceToNow(new Date(e.timestamp), { addSuffix: true })}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
