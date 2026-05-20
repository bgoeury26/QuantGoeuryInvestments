import { ScoringService } from './scoring.service';

// Mock PrismaService — pure unit tests, no DB needed
const mockPrisma = { stockScore: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() } } as any;

describe('ScoringService', () => {
  let svc: ScoringService;

  beforeEach(() => {
    svc = new ScoringService(mockPrisma);
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // CONFIDENCE ENGINE
  // ----------------------------------------------------------------
  describe('computeConfidence()', () => {
    it('clamps minimum to 0.5', () => {
      expect(svc.computeConfidence(0, 0, 0, 1)).toBeGreaterThanOrEqual(0.5);
    });

    it('clamps maximum to 1.2', () => {
      expect(svc.computeConfidence(1, 1, 1, 0)).toBeLessThanOrEqual(1.2);
    });

    it('returns higher confidence with perfect inputs', () => {
      const high = svc.computeConfidence(1, 1, 1, 0);
      const low  = svc.computeConfidence(0, 0, 0, 1);
      expect(high).toBeGreaterThan(low);
    });

    it('noise reduces confidence', () => {
      const noNoise   = svc.computeConfidence(0.8, 0.8, 0.8, 0);
      const highNoise = svc.computeConfidence(0.8, 0.8, 0.8, 1);
      expect(noNoise).toBeGreaterThan(highNoise);
    });

    it('baseline mid-quality data returns ~0.9', () => {
      const c = svc.computeConfidence(0.7, 0.7, 0.7, 0.2);
      expect(c).toBeGreaterThanOrEqual(0.85);
      expect(c).toBeLessThanOrEqual(1.1);
    });
  });

  // ----------------------------------------------------------------
  // FINAL SCORE ENGINE
  // ----------------------------------------------------------------
  describe('computeFinalScore()', () => {
    const allNine: any = { fundamental:9, technical:9, sentiment:9, institutional:9, analyst:9, political:9, macro:9 };
    const allOne: any  = { fundamental:1, technical:1, sentiment:1, institutional:1, analyst:1, political:1, macro:1 };
    const mixed: any   = { fundamental:7, technical:6, sentiment:5, institutional:8, analyst:6, political:4, macro:5 };

    it('all-9 components with max confidence approaches 10', () => {
      const score = svc.computeFinalScore(allNine, 1.2);
      expect(score).toBeGreaterThan(9);
      expect(score).toBeLessThanOrEqual(10);
    });

    it('all-1 components with min confidence is very low', () => {
      const score = svc.computeFinalScore(allOne, 0.5);
      expect(score).toBeLessThan(2);
    });

    it('score is always between 0 and 10 (inclusive)', () => {
      [allNine, allOne, mixed].forEach(c => {
        [0.5, 0.8, 1.0, 1.2].forEach(conf => {
          const s = svc.computeFinalScore(c, conf);
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(10);
        });
      });
    });

    it('higher confidence produces higher final score', () => {
      const low  = svc.computeFinalScore(mixed, 0.5);
      const high = svc.computeFinalScore(mixed, 1.2);
      expect(high).toBeGreaterThan(low);
    });

    it('weights sum to 10 — verify W_TOTAL normalisation', () => {
      // If all components = 5 and confidence = 1.0, score should be ~5
      const flat: any = { fundamental:5, technical:5, sentiment:5, institutional:5, analyst:5, political:5, macro:5 };
      const score = svc.computeFinalScore(flat, 1.0);
      expect(score).toBeCloseTo(5, 0);
    });
  });

  // ----------------------------------------------------------------
  // RANKING SCORE ENGINE
  // ----------------------------------------------------------------
  describe('computeRankingScore()', () => {
    it('adds alpha boost to final score', () => {
      expect(svc.computeRankingScore(7, 0.8)).toBeGreaterThan(7);
    });

    it('clamps to maximum 12', () => {
      expect(svc.computeRankingScore(10, 1, 5)).toBe(12);
    });

    it('clamps to minimum 0', () => {
      expect(svc.computeRankingScore(-5, 0, 0)).toBe(0);
    });

    it('momentum bonus adds to ranking', () => {
      const base    = svc.computeRankingScore(6, 0.5, 0);
      const boosted = svc.computeRankingScore(6, 0.5, 1.5);
      expect(boosted).toBeGreaterThan(base);
    });

    it('zero anomaly — ranking equals final score', () => {
      expect(svc.computeRankingScore(7.5, 0, 0)).toBeCloseTo(7.5);
    });
  });

  // ----------------------------------------------------------------
  // TIME DECAY
  // ----------------------------------------------------------------
  describe('timeDecay()', () => {
    it('returns 1 for 0 days old (fresh signal)', () => {
      expect(svc.timeDecay(0)).toBeCloseTo(1, 5);
    });

    it('returns ~0.5 at half-life (7 days default)', () => {
      expect(svc.timeDecay(7)).toBeCloseTo(0.5, 1);
    });

    it('decays further at 14 days (~0.25)', () => {
      expect(svc.timeDecay(14)).toBeCloseTo(0.25, 1);
    });

    it('custom half-life of 30 days is slower decay', () => {
      const fast = svc.timeDecay(7, 7);
      const slow = svc.timeDecay(7, 30);
      expect(slow).toBeGreaterThan(fast);
    });
  });

  // ----------------------------------------------------------------
  // FUNDAMENTAL SCORE
  // ----------------------------------------------------------------
  describe('computeFundamentalScore()', () => {
    it('excellent fundamentals score above 7.5', () => {
      const s = svc.computeFundamentalScore({ peRatio: 12, roe: 0.28, revenueGrowth: 0.35, operatingMargin: 0.30, debtToEquity: 0.2 });
      expect(s).toBeGreaterThan(7.5);
    });

    it('poor fundamentals score below 4', () => {
      const s = svc.computeFundamentalScore({ peRatio: 60, roe: -0.1, revenueGrowth: -0.05, operatingMargin: -0.1, debtToEquity: 5 });
      expect(s).toBeLessThan(4);
    });

    it('returns 5 (neutral) when no data provided', () => {
      expect(svc.computeFundamentalScore({})).toBe(5);
    });

    it('handles partial data gracefully', () => {
      const s = svc.computeFundamentalScore({ peRatio: 15, roe: 0.18 });
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThanOrEqual(10);
    });

    it('very low P/E (value trap territory) still scores high', () => {
      const s = svc.computeFundamentalScore({ peRatio: 5 });
      expect(s).toBeGreaterThanOrEqual(8);
    });
  });

  // ----------------------------------------------------------------
  // TECHNICAL SCORE
  // ----------------------------------------------------------------
  describe('computeTechnicalScore()', () => {
    it('oversold RSI (<20) scores near 9', () => {
      const s = svc.computeTechnicalScore({ rsi: 15 });
      expect(s).toBeGreaterThanOrEqual(8);
    });

    it('overbought RSI (>75) scores low', () => {
      const s = svc.computeTechnicalScore({ rsi: 80 });
      expect(s).toBeLessThanOrEqual(3);
    });

    it('bullish MACD boosts score', () => {
      const bull    = svc.computeTechnicalScore({ macdSignal: 'bullish' });
      const bearish = svc.computeTechnicalScore({ macdSignal: 'bearish' });
      expect(bull).toBeGreaterThan(bearish);
    });

    it('price above MA200 by 10%+ scores 8', () => {
      const s = svc.computeTechnicalScore({ priceVsMA200: 0.15 });
      expect(s).toBeGreaterThanOrEqual(7.5);
    });

    it('returns 5 (neutral) with no data', () => {
      expect(svc.computeTechnicalScore({})).toBe(5);
    });
  });

  // ----------------------------------------------------------------
  // PERSISTENCE (mocked)
  // ----------------------------------------------------------------
  describe('saveScore()', () => {
    it('calls prisma.stockScore.create with correct shape', async () => {
      const components: any = { fundamental:7, technical:6, sentiment:6, institutional:7, analyst:6, political:5, macro:5 };
      mockPrisma.stockScore.create.mockResolvedValue({ id: 'abc' });
      await svc.saveScore('AAPL', components, 1.0, 0.3, 8.5);
      expect(mockPrisma.stockScore.create).toHaveBeenCalledTimes(1);
      const arg = mockPrisma.stockScore.create.mock.calls[0][0].data;
      expect(arg.stockId).toBe('AAPL');
      expect(arg.confidenceFactor).toBe(1.0);
      expect(arg.anomalyScore).toBe(0.3);
      expect(arg.rankingScore).toBe(8.5);
      expect(arg.finalScore).toBeGreaterThan(0);
    });
  });

  describe('getTopOpportunities()', () => {
    it('returns top N sorted by rankingScore', async () => {
      const fakeData = [
        { stockId: 'TSLA', rankingScore: 9.2, computedAt: new Date(), stock: {} },
        { stockId: 'NVDA', rankingScore: 10.1, computedAt: new Date(), stock: {} },
        { stockId: 'AAPL', rankingScore: 7.5, computedAt: new Date(), stock: {} },
      ];
      mockPrisma.stockScore.findMany.mockResolvedValue(fakeData);
      const top2 = await svc.getTopOpportunities(2);
      expect(top2[0].stockId).toBe('NVDA');
      expect(top2[1].stockId).toBe('TSLA');
      expect(top2.length).toBe(2);
    });
  });
});
