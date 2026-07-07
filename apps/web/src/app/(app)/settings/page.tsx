'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, PageHeader, Button, Badge, NetworkChip, Avatar } from '@/components/ui';
import { api, API_BASE } from '@/lib/api';
import { NETWORK_META, formatNumber } from '@/lib/utils';
import type { Network, TeamMember, UserRole, NetworkType, AuditEntry } from '@/lib/types';
import { format, formatDistanceToNow } from 'date-fns';
import { Plus, ScrollText, Plug, ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { AiSettingsPanel } from '@/components/AiSettingsPanel';
import { toast } from '@/components/Toast';

const roleColor: Record<UserRole, string> = {
  owner: 'purple',
  admin: 'blue',
  editor: 'green',
  viewer: 'slate',
};

const SUPPORTED_NETWORKS: NetworkType[] = ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok'];

type NetTestState = { status: 'idle' | 'running' | 'pass' | 'fail'; latencyMs?: number; error?: string; reason?: string };

/** Plain-English cause for a network connect/test failure, same pattern as the
 *  Connections diagnostics panel — a raw error code alone isn't actionable. */
function explainNetworkFailure(error: string): string {
  const e = error.toLowerCase();
  if (e.includes('failed to fetch') || e.includes('network error') || e.includes('unreachable')) {
    return 'The backend API is unreachable from your browser — check Settings → Connections → "Backend API" test.';
  }
  if (e.includes('http 401') || e.includes('missing or invalid') || e.includes('expired')) {
    return "You're signed out or your session expired — log out and back in, then retry.";
  }
  if (e.includes('http 403')) {
    return 'Your account role does not have permission to manage connections.';
  }
  if (e.includes('http 404') || e.includes('not found')) {
    return 'The backend is running an older build without this endpoint — it may need a fresh deploy.';
  }
  if (e.includes('http 5')) {
    return 'The backend hit a server error handling this request — check Railway deploy logs.';
  }
  return 'This app manages the connection record only — there is no real OAuth to a social platform yet, so this is a database round-trip failure, not a rejection from the network itself.';
}

// Networks that use real OAuth (redirect flow) vs. simple DB toggle
const OAUTH_NETWORKS: Partial<Record<NetworkType, string>> = {
  facebook: 'facebook',
  instagram: 'facebook', // Instagram is connected via Facebook app
};

function SettingsPage() {
  const searchParams = useSearchParams();
  const [networks, setNetworks] = useState<Network[]>([]);
  const [networksLoaded, setNetworksLoaded] = useState(false);
  const [netTests, setNetTests] = useState<Record<string, NetTestState>>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [inviting, setInviting] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [ayrshare, setAyrshare] = useState<{ configured: boolean; connected: boolean; activeSocialAccounts: string[]; error?: string } | null>(null);
  const [zernio, setZernio] = useState<{ configured: boolean; accounts: { platform: string; handle: string; connected: boolean; followers?: number }[]; error?: string } | null>(null);
  const [zernioConnecting, setZernioConnecting] = useState<string | null>(null);

  // Handle OAuth return — show success/error toast and clean the URL
  useEffect(() => {
    const success = searchParams.get('oauth_success');
    const error = searchParams.get('oauth_error');
    const network = searchParams.get('network');
    if (success && network) {
      toast.success(`${NETWORK_META[network as NetworkType]?.label ?? network} connected via OAuth!`);
      // Clean URL without re-triggering navigation
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error && network) {
      if (error === 'missing_config') {
        toast.error(`Facebook App not configured — add FACEBOOK_APP_ID + FACEBOOK_APP_SECRET to Railway env vars.`);
      } else {
        toast.error(`Could not connect ${network}: ${decodeURIComponent(error)}`);
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [meRes, teamRes, networksRes, auditRes, ayrshareRes, zernioRes] = await Promise.all([
          api.getMe().catch(() => null),
          api.getTeam().catch(() => []),
          api.getNetworks().catch(() => []),
          api.getAudit().catch(() => null),
          api.ayrshareStatus().catch(() => null),
          api.zernioStatus().catch(() => null),
        ]);
        if (cancelled) return;
        if (meRes) { setName(meRes.name || ''); setEmail(meRes.email || ''); }
        setTeam(teamRes ?? []);
        setNetworks(networksRes ?? []);
        setNetworksLoaded(true);
        if (auditRes) {
          setAuditLog(auditRes.map((e: any) => ({
            id: e.id, action: e.action, entity: e.entity, actor: e.userId ?? 'system', timestamp: e.createdAt,
          })));
        }
        if (ayrshareRes) setAyrshare(ayrshareRes);
        if (zernioRes) setZernio(zernioRes);
      } catch {
        if (cancelled) return;
        setNetworksLoaded(true);
        toast.error('Live API unreachable — some data may be missing.');
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

  // Always show every supported network; merge in the real DB row when one exists
  // so a network the API hasn't created yet still renders with a Connect button.
  const displayNetworks: Network[] = SUPPORTED_NETWORKS.map((type) => {
    const existing = networks.find((n) => n.type === type);
    return existing ?? {
      id: '', type, name: NETWORK_META[type].label, username: '', followers: 0,
      connected: false, connectedAt: new Date().toISOString(),
    };
  });

  const toggle = async (type: NetworkType) => {
    const target = displayNetworks.find((n) => n.type === type)!;
    const connecting = !target.connected;

    if (connecting && OAUTH_NETWORKS[type]) {
      // Real OAuth flow — redirect to backend OAuth initiation endpoint
      const oauthNetwork = OAUTH_NETWORKS[type];
      const returnTo = window.location.href.split('?')[0]; // current page without params
      window.location.href = `${API_BASE}/api/oauth/${oauthNetwork}?returnTo=${encodeURIComponent(returnTo)}`;
      return;
    }

    toast.success(`${NETWORK_META[type].label} ${connecting ? 'connected' : 'disconnected'}`);
    try {
      if (connecting) {
        const created = (await api.connectNetwork({ type, name: NETWORK_META[type].label, username: `@${type}` })) as Network;
        setNetworks((l) => [...l.filter((n) => n.type !== type), created]);
      } else if (target.id) {
        await api.disconnectNetwork(target.id);
        setNetworks((l) => l.map((n) => (n.type === type ? { ...n, connected: false, followers: 0 } : n)));
      }
    } catch (e: any) {
      toast.error(`Could not ${connecting ? 'connect' : 'disconnect'} ${NETWORK_META[type].label} — API unreachable`);
    }
  };

  const testNetwork = async (type: NetworkType) => {
    setNetTests((t) => ({ ...t, [type]: { status: 'running' } }));
    const started = Date.now();
    try {
      const fresh = await api.getNetworks();
      const latencyMs = Date.now() - started;
      const row = (fresh as Network[])?.find((n) => n.type === type);
      setNetworks(fresh ?? []);
      setNetTests((t) => ({
        ...t,
        [type]: { status: 'pass', latencyMs, reason: row?.connected ? `Connected · ${formatNumber(row.followers)} followers, verified via live DB round-trip.` : 'Reachable — currently not connected.' },
      }));
    } catch (e: any) {
      const latencyMs = Date.now() - started;
      const error = e?.message || 'Request failed';
      setNetTests((t) => ({ ...t, [type]: { status: 'fail', latencyMs, error, reason: explainNetworkFailure(error) } }));
    }
  };

  const openAyrshareDashboard = () => {
    window.open('https://app.ayrshare.com', '_blank', 'noopener,noreferrer');
  };

  const refreshAyrshareStatus = async () => {
    try {
      const fresh = await api.ayrshareStatus();
      setAyrshare(fresh);
      toast.success('Status refreshed');
    } catch { /* ignore */ }
  };

  const connectZernio = async (platform: string) => {
    setZernioConnecting(platform);
    try {
      const returnTo = window.location.href.split('?')[0];
      const { url } = await api.zernioConnect(platform, returnTo);
      window.open(url, '_blank', 'noopener,noreferrer,width=700,height=800');
      setTimeout(async () => {
        try {
          const fresh = await api.zernioStatus();
          setZernio(fresh);
        } catch { /* ignore */ }
        setZernioConnecting(null);
      }, 5000);
    } catch (e: any) {
      toast.error(e?.message || 'Could not start Zernio connect flow');
      setZernioConnecting(null);
    }
  };

  const disconnectZernio = async (platform: string) => {
    try {
      await api.zernioDisconnect(platform);
      toast.success(`Disconnected ${platform}`);
      const fresh = await api.zernioStatus();
      setZernio(fresh);
    } catch (e: any) {
      toast.error(e?.message || 'Could not disconnect');
    }
  };

  const refreshZernioStatus = async () => {
    try {
      const fresh = await api.zernioStatus();
      setZernio(fresh);
      toast.success('Zernio status refreshed');
    } catch { /* ignore */ }
  };

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
              <Button
                disabled={savingProfile || !name.trim() || !email.trim()}
                onClick={async () => {
                  setSavingProfile(true);
                  try {
                    const updated = await api.updateMe({ name: name.trim(), email: email.trim() });
                    setName(updated.name);
                    setEmail(updated.email);
                    toast.success('Profile saved');
                  } catch (e: any) {
                    toast.error(e?.message || 'Could not save profile — live API unreachable');
                  } finally {
                    setSavingProfile(false);
                  }
                }}
              >
                {savingProfile ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Connected networks */}
        <Card>
          <CardHeader title="Connected accounts" subtitle="Connect your social networks to publish and monitor. Test verifies the connection round-trips through the live database." />
          <div className="divide-y divide-slate-100">
            {!networksLoaded && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Loading connections…</div>
            )}
            {networksLoaded && displayNetworks.map((n) => {
              const t = netTests[n.type] ?? { status: 'idle' as const };
              return (
                <div key={n.type} className="px-5 py-4">
                  <div className="flex items-center gap-4">
                    <NetworkChip type={n.type} size={40} />
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{NETWORK_META[n.type].label}</p>
                      <p className="text-sm text-slate-400">
                        {n.connected ? `${n.username} · ${formatNumber(n.followers)} followers` : 'Not connected'}
                      </p>
                    </div>
                    {t.status === 'pass' && <Badge color="green"><CheckCircle2 className="mr-1 inline h-3 w-3" /> Test passed</Badge>}
                    {t.status === 'fail' && <Badge color="red"><XCircle className="mr-1 inline h-3 w-3" /> Test failed</Badge>}
                    <Button variant="secondary" size="sm" onClick={() => testNetwork(n.type)} disabled={t.status === 'running'}>
                      {t.status === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
                    </Button>
                    {n.connected ? (
                      <>
                        <Badge color="green">Connected</Badge>
                        <Button variant="secondary" size="sm" onClick={() => toggle(n.type)}>Disconnect</Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => toggle(n.type)}>
                        {OAUTH_NETWORKS[n.type] ? `Connect with ${NETWORK_META[n.type].label}` : 'Connect'}
                      </Button>
                    )}
                  </div>
                  {t.status === 'fail' && (
                    <div className="mt-2 ml-14 space-y-1.5">
                      <p className="break-words rounded-md bg-red-50 px-2 py-1 font-mono text-xs text-negative">{t.error}</p>
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                        <span className="font-semibold">Likely cause:</span> {t.reason}
                      </div>
                    </div>
                  )}
                  {t.status === 'pass' && t.reason && (
                    <p className="ml-14 mt-2 break-words rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{t.reason} ({t.latencyMs}ms)</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Ayrshare — multi-network social connect */}
        <Card>
          <CardHeader
            title="Social accounts (Ayrshare)"
            subtitle="Connect Facebook, Instagram, X, LinkedIn, TikTok and more through one hosted flow."
          />
          <div className="p-5">
            {ayrshare === null ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : !ayrshare.configured ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Ayrshare not configured</p>
                <p className="mt-1">Add <code className="rounded bg-amber-100 px-1">AYRSHARE_API_KEY</code> to your Railway environment variables to enable real social publishing.</p>
                <p className="mt-2 text-xs text-amber-700">Get your API key at <span className="font-medium">app.ayrshare.com → API Key</span></p>
              </div>
            ) : (
              <div className="space-y-4">
                {ayrshare.error && (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{ayrshare.error}</p>
                )}
                {ayrshare.activeSocialAccounts.length > 0 ? (
                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">Connected networks</p>
                    <div className="flex flex-wrap gap-2">
                      {ayrshare.activeSocialAccounts.map((n) => (
                        <span key={n} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 capitalize">
                          <span className="h-2 w-2 rounded-full bg-green-400" />
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No social accounts connected yet.</p>
                )}
                <div className="flex gap-2">
                  <Button onClick={openAyrshareDashboard}>
                    {ayrshare.activeSocialAccounts.length > 0 ? 'Manage in Ayrshare' : 'Connect accounts in Ayrshare'}
                  </Button>
                  <Button variant="secondary" onClick={refreshAyrshareStatus}>Refresh status</Button>
                </div>
                <p className="text-xs text-slate-400">
                  Connect your social accounts once at <span className="font-medium">app.ayrshare.com</span> → Social Accounts. Once connected, this app publishes through Ayrshare automatically.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Zernio — direct social platform connections */}
        <Card>
          <CardHeader
            title="Direct connections (Zernio)"
            subtitle="Connect each social platform directly through Zernio — bypasses hosted flows for a lower-latency posting path."
          />
          <div className="p-5">
            {zernio === null ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : !zernio.configured ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Zernio not configured</p>
                <p className="mt-1">Add <code className="rounded bg-amber-100 px-1">ZERNIO_API_KEY</code> to your Railway environment variables (optionally <code className="rounded bg-amber-100 px-1">ZERNIO_API_URL</code> if using a custom endpoint).</p>
                <p className="mt-2 text-xs text-amber-700">Once configured, per-platform connect buttons appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {zernio.error && (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{zernio.error}</p>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  {SUPPORTED_NETWORKS.map((platform) => {
                    const acc = zernio.accounts.find((a) => a.platform === platform);
                    const isConnecting = zernioConnecting === platform;
                    return (
                      <div key={platform} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                        <NetworkChip type={platform} size={32} />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{NETWORK_META[platform].label}</p>
                          <p className="text-xs text-slate-400">
                            {acc?.connected ? `${acc.handle}${acc.followers ? ` · ${formatNumber(acc.followers)} followers` : ''}` : 'Not connected'}
                          </p>
                        </div>
                        {acc?.connected ? (
                          <Button variant="secondary" size="sm" onClick={() => disconnectZernio(platform)}>Disconnect</Button>
                        ) : (
                          <Button size="sm" disabled={isConnecting} onClick={() => connectZernio(platform)}>
                            {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Button variant="secondary" onClick={refreshZernioStatus}>Refresh status</Button>
              </div>
            )}
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

export default function SettingsPageWrapper() {
  return (
    <Suspense>
      <SettingsPage />
    </Suspense>
  );
}
