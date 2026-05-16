import { logger as rootLogger } from '@/config/logger.js';
import { AppError } from '@/domain/errors.js';
import type { VerificationInput, VerificationResult } from '@/domain/types.js';
import {
  VerificationRunModel,
  type VerificationRunStatus,
} from '@/persistence/models/verification.model.js';

export interface CreatePendingRunParams {
  correlationId: string;
  input: VerificationInput;
}

export const createPendingRun = async (params: CreatePendingRunParams): Promise<void> => {
  try {
    await VerificationRunModel.create({
      correlationId: params.correlationId,
      status: 'pending' satisfies VerificationRunStatus,
      input: {
        userInput: params.input.userInput,
        modelOutput: params.input.modelOutput,
        mode: params.input.mode,
        ...(params.input.domainOverride ? { domainOverride: params.input.domainOverride } : {}),
      },
      startedAt: new Date(),
    });
  } catch (err) {
    rootLogger.error({ err, correlationId: params.correlationId }, 'Failed to persist pending run');
    throw new AppError('DB_ERROR', 'Failed to persist pending verification run', { cause: err });
  }
};

export const completeRun = async (result: VerificationResult): Promise<void> => {
  try {
    await VerificationRunModel.updateOne(
      { correlationId: result.correlationId },
      {
        $set: {
          status: 'completed' satisfies VerificationRunStatus,
          detectedDomain: result.detectedDomain,
          claims: result.claims,
          verdicts: result.verdicts,
          compliance: result.compliance,
          overallStatus: result.overallStatus,
          correctedOutput: result.correctedOutput,
          timings: result.timings,
          warnings: result.warnings,
          injection: result.injection,
          completedAt: new Date(),
        },
      },
    );
  } catch (err) {
    rootLogger.error(
      { err, correlationId: result.correlationId },
      'Failed to persist completed run',
    );
    throw new AppError('DB_ERROR', 'Failed to persist completed verification run', { cause: err });
  }
};

export const failRun = async (correlationId: string, error: string): Promise<void> => {
  try {
    await VerificationRunModel.updateOne(
      { correlationId },
      {
        $set: {
          status: 'failed' satisfies VerificationRunStatus,
          error,
          completedAt: new Date(),
        },
      },
    );
  } catch (err) {
    rootLogger.error({ err, correlationId }, 'Failed to persist failed run state');
    // Swallow — this path is already an error path; we don't want to mask the original.
  }
};

export const findRunByCorrelationId = async (correlationId: string) => {
  try {
    return await VerificationRunModel.findOne({ correlationId }).lean().exec();
  } catch (err) {
    throw new AppError('DB_ERROR', 'Failed to load verification run', { cause: err });
  }
};
