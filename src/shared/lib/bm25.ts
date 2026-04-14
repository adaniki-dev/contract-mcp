/**
 * BM25 (Best Matching 25) — lightweight search ranking engine.
 * Zero dependencies, designed for small corpora like contract sets.
 */

export interface BM25Document {
  id: string;
  fields: Record<string, string>;
}

export interface BM25Options {
  k1?: number;
  b?: number;
  fieldWeights?: Record<string, number>;
}

export interface BM25Result {
  id: string;
  score: number;
  matchedTerms: string[];
}

/** Split text into lowercase tokens on whitespace, hyphens, underscores, dots, slashes. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_./\\,;:()]+/)
    .filter((t) => t.length > 1);
}

interface IndexedDoc {
  id: string;
  fieldTokens: Map<string, string[]>; // field → tokens
  totalTokens: number;
}

export class BM25Index {
  private k1: number;
  private b: number;
  private fieldWeights: Record<string, number>;
  private docs: IndexedDoc[] = [];
  private avgDocLen = 0;

  // term → Set of doc indices that contain it
  private invertedIndex = new Map<string, Set<number>>();
  private built = false;

  constructor(options?: BM25Options) {
    this.k1 = options?.k1 ?? 1.2;
    this.b = options?.b ?? 0.75;
    this.fieldWeights = options?.fieldWeights ?? {};
  }

  addDocument(doc: BM25Document): void {
    const fieldTokens = new Map<string, string[]>();
    let total = 0;

    for (const [field, text] of Object.entries(doc.fields)) {
      const tokens = tokenize(text);
      fieldTokens.set(field, tokens);
      total += tokens.length;
    }

    this.docs.push({ id: doc.id, fieldTokens, totalTokens: total });
    this.built = false;
  }

  private build(): void {
    if (this.built) return;

    this.invertedIndex.clear();
    let totalTokens = 0;

    for (let i = 0; i < this.docs.length; i++) {
      const doc = this.docs[i];
      totalTokens += doc.totalTokens;

      const seen = new Set<string>();
      for (const tokens of doc.fieldTokens.values()) {
        for (const t of tokens) {
          if (!seen.has(t)) {
            seen.add(t);
            if (!this.invertedIndex.has(t)) {
              this.invertedIndex.set(t, new Set());
            }
            this.invertedIndex.get(t)!.add(i);
          }
        }
      }
    }

    this.avgDocLen = this.docs.length > 0 ? totalTokens / this.docs.length : 0;
    this.built = true;
  }

  /** IDF: log((N - df + 0.5) / (df + 0.5) + 1) */
  private idf(term: string): number {
    const df = this.invertedIndex.get(term)?.size ?? 0;
    const N = this.docs.length;
    return Math.log((N - df + 0.5) / (df + 0.5) + 1);
  }

  /** Term frequency of `term` in a token list. */
  private tf(term: string, tokens: string[]): number {
    let count = 0;
    for (const t of tokens) {
      if (t === term) count++;
    }
    return count;
  }

  search(query: string): BM25Result[] {
    this.build();

    const queryTerms = tokenize(query);
    if (queryTerms.length === 0) return [];

    const scores = new Map<number, { score: number; terms: Set<string> }>();

    for (const term of queryTerms) {
      const idf = this.idf(term);
      const docSet = this.invertedIndex.get(term);
      if (!docSet) continue;

      for (const idx of docSet) {
        const doc = this.docs[idx];
        let termScore = 0;

        // Score each field separately, weighted
        for (const [field, tokens] of doc.fieldTokens) {
          const freq = this.tf(term, tokens);
          if (freq === 0) continue;

          const weight = this.fieldWeights[field] ?? 1;
          const fieldLen = tokens.length;
          const numerator = freq * (this.k1 + 1);
          const denominator =
            freq + this.k1 * (1 - this.b + this.b * (fieldLen / (this.avgDocLen || 1)));
          termScore += idf * (numerator / denominator) * weight;
        }

        if (termScore > 0) {
          if (!scores.has(idx)) {
            scores.set(idx, { score: 0, terms: new Set() });
          }
          const entry = scores.get(idx)!;
          entry.score += termScore;
          entry.terms.add(term);
        }
      }
    }

    const results: BM25Result[] = [];
    for (const [idx, { score, terms }] of scores) {
      results.push({
        id: this.docs[idx].id,
        score: Math.round(score * 1000) / 1000,
        matchedTerms: [...terms],
      });
    }

    return results.sort((a, b) => b.score - a.score);
  }
}
