import { Router, type Request, type Response, type NextFunction } from 'express';
import { logger } from '@/config/logger.js';
import { runVerificationPipeline } from '@/modules/pipeline/pipeline.orchestrator.js';
import {
  completeRun,
  createPendingRun,
  failRun,
  findRunByCorrelationId,
} from '@/persistence/repositories/verification.repository.js';
import { verifyRequestSchema } from '@/shared/validators/verify.schema.js';

export const verifyRouter = Router();

verifyRouter.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.correlationId;
  try {
    const dto = verifyRequestSchema.parse(req.body);
    const input = {
      userInput: dto.userInput,
      modelOutput: dto.modelOutput,
      mode: dto.mode,
      ...(dto.domainOverride ? { domainOverride: dto.domainOverride } : {}),
    };

    await createPendingRun({ correlationId, input });

    try {
      const result = await runVerificationPipeline(input, { correlationId });
      await completeRun(result);
      res.status(200).json(result);
    } catch (pipelineErr) {
      logger.error({ err: pipelineErr, correlationId }, 'Pipeline execution failed');
      await failRun(correlationId, asMessage(pipelineErr));
      next(pipelineErr);
    }
  } catch (err) {
    next(err);
  }
});

verifyRouter.get('/verify/:correlationId', async (req, res, next) => {
  try {
    const id = req.params.correlationId;
    if (!id || id.length > 100) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid correlationId' },
      });
      return;
    }
    const doc = await findRunByCorrelationId(id);
    if (!doc) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Verification run not found', correlationId: id },
      });
      return;
    }
    res.status(200).json(doc);
  } catch (err) {
    next(err);
  }
});

const asMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  return String(err);
};
