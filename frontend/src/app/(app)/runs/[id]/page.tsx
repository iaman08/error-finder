import type { Metadata } from 'next';
import { RunDetail } from '@/components/runs/run-detail';

interface RunDetailPageProps {
  params: Promise<{ id: string }>;
}

export const generateMetadata = async (props: RunDetailPageProps): Promise<Metadata> => {
  const params = await props.params;
  return { title: `Run ${params.id.slice(0, 8)}` };
};

export default async function RunDetailPage(props: RunDetailPageProps) {
  const params = await props.params;
  return <RunDetail correlationId={params.id} />;
}
