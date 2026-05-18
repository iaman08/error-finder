import type { Metadata } from 'next';
import { RunList } from '@/components/runs/run-list';

export const metadata: Metadata = {
  title: 'History',
};

export default function HistoryPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">
          Recent verification runs from this device.
        </p>
      </header>
      <RunList />
    </div>
  );
}
