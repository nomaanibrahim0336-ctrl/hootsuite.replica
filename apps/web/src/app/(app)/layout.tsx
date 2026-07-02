import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="pl-60">
        <Topbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
