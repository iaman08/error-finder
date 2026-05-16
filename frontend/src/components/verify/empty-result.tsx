import { ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VERIFY_EXAMPLES, type VerifyExample } from '@/features/verify/examples';

interface EmptyResultProps {
  onSelectExample: (example: VerifyExample) => void;
}

export const EmptyResult = ({ onSelectExample }: EmptyResultProps) => (
  <Card className="border-dashed">
    <CardContent className="space-y-6 py-10">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <ShieldCheck className="h-4 w-4" aria-hidden />
        </div>
        <p className="mt-2 text-sm font-medium">Ready to verify</p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground leading-relaxed">
          Paste a user question and an AI response above, or try one of these adversarial
          examples to see the pipeline catch known hallucination patterns.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {VERIFY_EXAMPLES.map((example) => (
          <Button
            key={example.id}
            variant="outline"
            onClick={() => onSelectExample(example)}
            className="group h-auto items-start justify-start gap-3 px-3.5 py-3 text-left font-normal"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
              <Sparkles className="h-3 w-3" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 space-y-0.5">
              <span className="block text-sm font-medium">{example.title}</span>
              <span className="block text-xs text-muted-foreground leading-snug">
                {example.description}
              </span>
            </span>
          </Button>
        ))}
      </div>
    </CardContent>
  </Card>
);
