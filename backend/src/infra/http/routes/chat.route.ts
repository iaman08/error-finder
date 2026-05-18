import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { AppError } from '@/domain/errors.js';
import { requireAuth } from '@/infra/http/middleware/auth.js';
import { llmClient } from '@/infra/llm/llm.client.js';

export const chatRouter = Router();

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(20_000),
});

const chatRequestSchema = z.object({
  history: z.array(messageSchema).max(40).default([]),
  message: z.string().min(1).max(10_000),
});

const CHAT_SYSTEM_PROMPT = [
  'You are Shien Ai, a helpful, factual assistant.',
  'Answer the user\'s question concisely and accurately.',
  'If you are unsure, say so honestly instead of guessing.',
  'Do not invent citations, statistics, or sources.',
].join(' ');

chatRouter.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = chatRequestSchema.parse(req.body);

    const completion = await llmClient.complete({
      stageTag: 'chat-response',
      correlationId: req.correlationId,
      skipGlobalSystemPrompt: true,
      tier: 'fast',
      temperature: 0.3,
      maxTokens: 600,
      messages: [
        { role: 'system', content: CHAT_SYSTEM_PROMPT },
        ...dto.history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: dto.message },
      ],
    });

    const text = completion.text.trim();
    if (!text) throw new AppError('LLM_ERROR', 'Empty chat response');

    res.status(200).json({
      response: text,
      model: completion.model,
      latencyMs: completion.latencyMs,
    });
  } catch (err) {
    next(err);
  }
});
