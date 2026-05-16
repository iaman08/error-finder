import { Wand2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CorrectedOutputProps {
  text: string;
}

export const CorrectedOutput = ({ text }: CorrectedOutputProps) => (
  <Card>
    <CardHeader>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Wand2 className="h-4 w-4" aria-hidden />
        </div>
        <div className="flex-1">
          <CardTitle>Corrected response</CardTitle>
          <CardDescription>Original output with per-claim corrections appended.</CardDescription>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground scrollbar-thin">
        {text}
      </pre>
    </CardContent>
  </Card>
);
