'use client';

import { motion } from 'framer-motion';
import { ClaimCard } from '@/components/results/claim-card';
import { CompliancePanel } from '@/components/results/compliance-panel';
import { CorrectedOutput } from '@/components/results/corrected-output';
import { InjectionAlert } from '@/components/results/injection-alert';
import { ResultSummary } from '@/components/results/result-summary';
import { WarningsBanner } from '@/components/results/warnings-banner';
import type { VerifyResponse } from '@/features/verify/schemas';

interface ResultViewProps {
  result: VerifyResponse;
}

const containerVariants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
};

export const ResultView = ({ result }: ResultViewProps) => {
  const verdictsByClaimId = new Map(result.verdicts.map((v) => [v.claimId, v]));
  const verifiedCount = result.verdicts.filter((v) => v.status === 'VERIFIED').length;
  const falseCount = result.verdicts.filter((v) => v.status === 'FALSE').length;
  const inconclusiveCount = result.verdicts.filter((v) => v.status === 'INCONCLUSIVE').length;

  return (
    <motion.div
      className="space-y-5"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {result.injection.suspected ? (
        <motion.div variants={itemVariants}>
          <InjectionAlert injection={result.injection} />
        </motion.div>
      ) : null}

      {result.warnings.length > 0 ? (
        <motion.div variants={itemVariants}>
          <WarningsBanner warnings={result.warnings} />
        </motion.div>
      ) : null}

      <motion.div variants={itemVariants}>
        <ResultSummary
          correlationId={result.correlationId}
          overallStatus={result.overallStatus}
          detectedDomain={result.detectedDomain}
          mode={result.mode}
          claimCount={result.claims.length}
          verifiedCount={verifiedCount}
          falseCount={falseCount}
          inconclusiveCount={inconclusiveCount}
          timings={result.timings}
        />
      </motion.div>

      {result.claims.length > 0 ? (
        <motion.section variants={itemVariants} className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Atomic claims ({result.claims.length})
          </h2>
          <ul className="space-y-3">
            {result.claims.map((claim, i) => {
              const verdict = verdictsByClaimId.get(claim.id);
              if (!verdict) return null;
              return (
                <motion.li key={claim.id} variants={itemVariants}>
                  <ClaimCard claim={claim} verdict={verdict} index={i} />
                </motion.li>
              );
            })}
          </ul>
        </motion.section>
      ) : (
        <motion.p variants={itemVariants} className="text-sm text-muted-foreground">
          No atomic claims were extracted from the response.
        </motion.p>
      )}

      <motion.div variants={itemVariants}>
        <CompliancePanel compliance={result.compliance} />
      </motion.div>

      {result.correctedOutput ? (
        <motion.div variants={itemVariants}>
          <CorrectedOutput text={result.correctedOutput} />
        </motion.div>
      ) : null}
    </motion.div>
  );
};
