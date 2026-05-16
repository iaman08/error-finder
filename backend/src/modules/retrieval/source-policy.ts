import type { Domain, RetrievalMode } from '@/domain/enums.js';

/**
 * Domain blocklists/allowlists used to enforce trust tiers across retrieval modes.
 * Lists are intentionally explicit and code-reviewable rather than crowdsourced.
 */

const LOW_TRUST_HOSTS: ReadonlyArray<string> = [
  'reddit.com',
  'old.reddit.com',
  'x.com',
  'twitter.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'discord.com',
  'discord.gg',
  'quora.com',
  'medium.com',
  'substack.com',
  'pinterest.com',
  'tumblr.com',
  '4chan.org',
  'threads.net',
  'mastodon.social',
];

const PROFESSIONAL_INCLUDE_BY_DOMAIN: Record<Domain, ReadonlyArray<string>> = {
  medical: [
    'pubmed.ncbi.nlm.nih.gov',
    'ncbi.nlm.nih.gov',
    'nih.gov',
    'who.int',
    'cdc.gov',
    'fda.gov',
    'cochranelibrary.com',
    'nejm.org',
    'thelancet.com',
    'bmj.com',
    'mayoclinic.org',
    'medlineplus.gov',
  ],
  finance: [
    'sec.gov',
    'federalreserve.gov',
    'rbi.org.in',
    'sebi.gov.in',
    'imf.org',
    'worldbank.org',
    'bis.org',
    'ecb.europa.eu',
    'treasury.gov',
    'reuters.com',
    'bloomberg.com',
    'ft.com',
  ],
  legal: [
    'supremecourt.gov',
    'law.cornell.edu',
    'uscourts.gov',
    'eur-lex.europa.eu',
    'gov.uk',
    'indiacode.nic.in',
    'justice.gov',
    'oyez.org',
  ],
  tech: [
    'developer.mozilla.org',
    'rfc-editor.org',
    'ietf.org',
    'w3.org',
    'cve.mitre.org',
    'nvd.nist.gov',
    'arxiv.org',
    'acm.org',
    'ieee.org',
  ],
  news: [
    'reuters.com',
    'apnews.com',
    'bbc.com',
    'npr.org',
    'pbs.org',
    'theguardian.com',
    'nytimes.com',
    'washingtonpost.com',
  ],
  general: [
    'nature.com',
    'science.org',
    'springer.com',
    'sciencedirect.com',
    'jstor.org',
    'oecd.org',
    'britannica.com',
  ],
};

export interface SourcePolicy {
  includeDomains: string[];
  excludeDomains: string[];
  maxResults: number;
  preferRecent: boolean;
}

export const buildSourcePolicy = (
  mode: RetrievalMode,
  domain: Domain,
  limits: { standard: number; professional: number },
): SourcePolicy => {
  if (mode === 'professional') {
    return {
      includeDomains: [...PROFESSIONAL_INCLUDE_BY_DOMAIN[domain]],
      excludeDomains: [...LOW_TRUST_HOSTS],
      maxResults: limits.professional,
      preferRecent: domain === 'news' || domain === 'finance',
    };
  }
  return {
    includeDomains: [],
    excludeDomains: [...LOW_TRUST_HOSTS],
    maxResults: limits.standard,
    preferRecent: domain === 'news' || domain === 'finance',
  };
};

export const isTrustedHost = (url: string, policy: SourcePolicy): boolean => {
  const host = safeHost(url);
  if (!host) return false;
  if (policy.excludeDomains.some((d) => host === d || host.endsWith(`.${d}`))) return false;
  if (policy.includeDomains.length === 0) return true;
  return policy.includeDomains.some((d) => host === d || host.endsWith(`.${d}`));
};

const safeHost = (url: string): string | null => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
};
