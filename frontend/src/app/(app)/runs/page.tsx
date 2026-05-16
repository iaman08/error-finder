import type { Metadata } from 'next';
import { RunList } from '@/components/runs/run-list';

export const metadata: Metadata = {
  title: 'Run history',
};

export default function RunsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Run history</h1>
        <p className="text-sm text-muted-foreground">
          Recent verification runs from this device.
        </p>
      </header>
      <RunList />
    </div>
  );
}
