'use client';

import { useState } from 'react';
import { Card, CardHeader, PageHeader, Button, Badge, NetworkChip, Avatar } from '@/components/ui';
import { networks as seedNetworks, team, currentUser } from '@/lib/mock';
import { NETWORK_META, formatNumber } from '@/lib/utils';
import type { Network, UserRole } from '@/lib/types';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';

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

  const toggle = (id: string) =>
    setNetworks((l) =>
      l.map((n) =>
        n.id === id
          ? { ...n, connected: !n.connected, followers: n.connected ? 0 : Math.floor(Math.random() * 40000 + 5000) }
          : n
      )
    );

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your profile, connected accounts and team." />

      <div className="space-y-6">
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
              <Button>Save changes</Button>
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

        {/* Team */}
        <Card>
          <CardHeader
            title="Team members"
            subtitle={`${team.length} members`}
            action={<Button size="sm"><Plus className="h-4 w-4" /> Invite</Button>}
          />
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
      </div>
    </div>
  );
}
