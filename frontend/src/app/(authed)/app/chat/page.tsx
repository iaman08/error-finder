'use client';

import { AlertCircle, Bot, Loader2, SendHorizonal, ShieldCheck, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { VerdictBadge } from '@/components/results/verdict-badge';
import { useAuth } from '@/features/auth/context';
import { sendChat, type ChatMessage } from '@/features/chat/api';
import { verifyApi } from '@/features/verify/api';
import type { VerifyResponse } from '@/features/verify/schemas';
import { cn } from '@/lib/utils';

type VerifyState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; result: VerifyResponse }
  | { kind: 'error'; message: string };

interface Turn {
  id: string;
  user: string;
  assistant: string | null;
  generating: boolean;
  generationError: string | null;
  verify: VerifyState;
}

const newTurnId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `t-${Date.now()}-${Math.random()}`;

const toHistory = (turns: Turn[]): ChatMessage[] => {
  const messages: ChatMessage[] = [];
  for (const t of turns) {
    if (t.assistant) {
      messages.push({ role: 'user', content: t.user });
      messages.push({ role: 'assistant', content: t.assistant });
    }
  }
  return messages;
};

export default function ChatPage() {
  const { token } = useAuth();
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  const updateTurn = (id: string, patch: Partial<Turn>): void => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!token) return;
    const text = input.trim();
    if (!text) return;
    const id = newTurnId();
    const turn: Turn = {
      id,
      user: text,
      assistant: null,
      generating: true,
      generationError: null,
      verify: { kind: 'idle' },
    };
    setTurns((prev) => [...prev, turn]);
    setInput('');

    let assistantText: string;
    try {
      const reply = await sendChat({ history: toHistory(turns), message: text }, token);
      assistantText = reply.response;
      updateTurn(id, { assistant: assistantText, generating: false });
    } catch (err) {
      updateTurn(id, {
        generating: false,
        generationError: err instanceof Error ? err.message : 'Failed to generate response',
      });
      return;
    }

    updateTurn(id, { verify: { kind: 'running' } });
    try {
      const accepted = await verifyApi.submit({
        userInput: text,
        modelOutput: assistantText,
        mode: 'standard',
      });
      const result = await verifyApi.pollUntilDone(accepted.correlationId);
      updateTurn(id, { verify: { kind: 'done', result } });
    } catch (err) {
      updateTurn(id, {
        verify: {
          kind: 'error',
          message: err instanceof Error ? err.message : 'Verification failed',
        },
      });
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="text-sm text-muted-foreground">
          Ask anything. Every response is verified against authoritative sources in real time.
        </p>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm"
      >
        {turns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Bot className="h-5 w-5" aria-hidden />
            </div>
            <p>Send a message to start a verified conversation.</p>
            <p className="mt-1 text-xs">Each reply is fact-checked and scored.</p>
          </div>
        ) : (
          <ul className="space-y-6">
            {turns.map((t) => (
              <li key={t.id} className="space-y-3">
                <Bubble role="user">{t.user}</Bubble>
                {t.generationError ? (
                  <Bubble role="assistant" tone="error">
                    <span className="inline-flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" /> {t.generationError}
                    </span>
                  </Bubble>
                ) : t.generating || !t.assistant ? (
                  <Bubble role="assistant">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                    </span>
                  </Bubble>
                ) : (
                  <>
                    <Bubble role="assistant">{t.assistant}</Bubble>
                    <VerificationStrip state={t.verify} runId={
                      t.verify.kind === 'done' ? t.verify.result.correlationId : null
                    } />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border/60 bg-card/60 p-3 backdrop-blur-sm">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask Shien Ai anything…"
          rows={2}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between border-t border-border/40 pt-2">
          <p className="text-[11px] text-muted-foreground">
            Press <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">⌘ Enter</kbd> to send.
          </p>
          <Button type="submit" disabled={!input.trim()} className="gap-1.5">
            <SendHorizonal className="h-4 w-4" aria-hidden /> Send
          </Button>
        </div>
      </form>
    </div>
  );
}

const Bubble = ({
  role,
  tone,
  children,
}: {
  role: 'user' | 'assistant';
  tone?: 'error';
  children: React.ReactNode;
}) => {
  const isUser = role === 'user';
  return (
    <div className={cn('flex items-start gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser ? (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bot className="h-3.5 w-3.5" aria-hidden />
        </div>
      ) : null}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground'
            : tone === 'error'
              ? 'border border-destructive/40 bg-destructive/15 text-destructive-foreground'
              : 'border border-border/50 bg-background/60 text-foreground',
        )}
      >
        {children}
      </div>
      {isUser ? (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground">
          <User className="h-3.5 w-3.5" aria-hidden />
        </div>
      ) : null}
    </div>
  );
};

const VerificationStrip = ({ state, runId }: { state: VerifyState; runId: string | null }) => {
  if (state.kind === 'idle') return null;

  if (state.kind === 'running') {
    return (
      <div className="ml-10 flex w-fit items-center gap-2 rounded-full border border-border/50 bg-background/60 px-3 py-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Verifying claims against sources…
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="ml-10 flex w-fit items-center gap-2 rounded-full border border-destructive/40 bg-destructive/15 px-3 py-1 text-xs text-destructive-foreground">
        <AlertCircle className="h-3 w-3" /> Verification failed: {state.message}
      </div>
    );
  }

  const { result } = state;
  const verified = result.verdicts.filter((v) => v.status === 'VERIFIED').length;
  const falses = result.verdicts.filter((v) => v.status === 'FALSE').length;
  const incons = result.verdicts.filter((v) => v.status === 'INCONCLUSIVE').length;

  return (
    <div className="ml-10 flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/60 px-3 py-1 text-muted-foreground">
        <ShieldCheck className="h-3 w-3 text-primary" />
        {result.overallStatus ? <VerdictBadge status={result.overallStatus} /> : 'Verified'}
      </span>
      <span className="rounded-full border border-border/50 bg-background/60 px-3 py-1 text-muted-foreground">
        {result.claims.length} claims · {verified} verified · {falses} false · {incons} inconclusive
      </span>
      {runId ? (
        <Link
          href={`/app/history/${encodeURIComponent(runId)}`}
          className="rounded-full border border-border/50 bg-background/60 px-3 py-1 text-muted-foreground hover:text-foreground"
        >
          View detail →
        </Link>
      ) : null}
    </div>
  );
};
