import { Test, TestingModule } from '@nestjs/testing';
import { ScoringService } from './scoring.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { StocksService } from '../stocks/stocks.service';
import { SentimentService } from '../sentiment/sentiment.service';
import { FlowsService } from '../flows/flows.service';
import { MacroService } from '../macro/macro.service';

const mockPrisma = {
  stock: {
    upsert: jest.fn().mockResolvedValue({ id: 'stock-1', symbol: 'AAPL' }),
    findUnique: jest.fn().mockResolvedValue({ id: 'stock-1', symbol: 'AAPL', sector: 'Technology' }),
  },
  stockScore: {
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
  },
};
const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
};
// Data services return null/empty -> every dimension falls back to neutral 5.
const mockStocks = {
  getFundamentals: jest.fn().mockResolvedValue(null),
  getTechnicals: jest.fn().mockResolvedValue(null),
  getAnalystRatings: jest.fn().mockResolvedValue(null),
  getRelativeStrength: jest.fn().mockResolvedValue(null),
};
const mockSentiment = { getSentiment: jest.fn().mockResolvedValue(null) };
const mockFlows = {
  getSummary: jest.fn().mockResolvedValue(null),
  getInsider: jest.fn().mockResolvedValue(null),
};
const mockMacro = { getDashboard: jest.fn().mockResolvedValue({ indicators: [] }) };

describe('ScoringService', () => {
  let service: ScoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: StocksService, useValue: mockStocks },
        { provide: SentimentService, useValue: mockSentiment },
        { provide: FlowsService, useValue: mockFlows },
        { provide: MacroService, useValue: mockMacro },
      ],
    }).compile();
    service = module.get<ScoringService>(ScoringService);
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    mockPrisma.stockScore.findFirst.mockResolvedValue(null);
  });

  // ── computeConfidence ─────────────────────────────────────────
  describe('computeConfidence', () => {
    it('should return a number between 0.5 and 1.2', () => {
      const result = service.computeConfidence(0.5, 0.5, 1.0, 0.1);
      expect(result).toBeGreaterThanOrEqual(0.5);
      expect(result).toBeLessThanOrEqual(1.2);
    });

    it('should return a number for arbitrary inputs', () => {
      expect(typeof service.computeConfidence(0.7, 0.8, 1.0, 0.1)).toBe('number');
    });

    it('should return higher confidence for higher completeness/agreement', () => {
      const high = service.computeConfidence(1, 1, 1, 0);
      const low = service.computeConfidence(0, 0, 0, 1);
      expect(high).toBeGreaterThan(low);
    });

    it('should clamp to minimum 0.5 for zero inputs', () => {
      expect(service.computeConfidence(0, 0, 0, 1)).toBeGreaterThanOrEqual(0.5);
    });

    it('should clamp to maximum 1.2 for all-max inputs', () => {
      expect(service.computeConfidence(1, 1, 1, 0)).toBeLessThanOrEqual(1.2);
    });

    it('should be deterministic (no randomness)', () => {
      expect(service.computeConfidence(0.6, 0.7, 1)).toBe(service.computeConfidence(0.6, 0.7, 1));
    });
  });

  // ── computeRankingScore ───────────────────────────────────────
  describe('computeRankingScore', () => {
    it('should boost score with anomaly and momentum', () => {
      expect(service.computeRankingScore(5, 0.5, 1)).toBeGreaterThan(
        service.computeRankingScore(5, 0, 0),
      );
    });
    it('should never go below 0', () => {
      expect(service.computeRankingScore(0, 0, 0)).toBeGreaterThanOrEqual(0);
    });
  });

  // ── computeFundamentalScore ───────────────────────────────────
  describe('computeFundamentalScore', () => {
    it('should return 5 for empty data', () => {
      expect(service.computeFundamentalScore({})).toBe(5);
    });
    it('should reward low P/E ratio', () => {
      expect(service.computeFundamentalScore({ peRatio: 10 })).toBeGreaterThan(
        service.computeFundamentalScore({ peRatio: 50 }),
      );
    });
    it('should stay within 0–10 range', () => {
      const r = service.computeFundamentalScore({
        peRatio: 5, roe: 0.4, revenueGrowth: 0.5, operatingMargin: 0.3, debtToEquity: 0.2,
      });
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(10);
    });
  });

  // ── computeTechnicalScore ─────────────────────────────────────
  describe('computeTechnicalScore', () => {
    it('should reward oversold RSI (<30)', () => {
      expect(service.computeTechnicalScore({ rsi: 25 })).toBeGreaterThan(
        service.computeTechnicalScore({ rsi: 75 }),
      );
    });
    it('should stay within 0–10 range', () => {
      const r = service.computeTechnicalScore({ rsi: 50, macdSignal: 'bullish', priceVsMA200: 0.05 });
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(10);
    });
  });

  // ── computeScore (integration) ────────────────────────────────
  describe('computeScore', () => {
    it('should return a ScoreResult with finalScore in 0–10', async () => {
      const result = await service.computeScore('AAPL');
      expect(result.finalScore).toBeGreaterThanOrEqual(0);
      expect(result.finalScore).toBeLessThanOrEqual(10);
    });

    it('should be deterministic — same inputs yield same score', async () => {
      const a = await service.computeScore('AAPL');
      mockCache.get.mockResolvedValue(null); // force recompute
      const b = await service.computeScore('AAPL');
      expect(a.finalScore).toBe(b.finalScore);
    });

    it('should use cache on second call', async () => {
      mockCache.get.mockResolvedValueOnce(null);
      await service.computeScore('AAPL');
      mockCache.get.mockResolvedValueOnce({ symbol: 'AAPL', finalScore: 7 } as any);
      expect((await service.computeScore('AAPL')).finalScore).toBe(7);
    });

    it('should include all required score fields', async () => {
      const result = await service.computeScore('MSFT');
      for (const f of ['fundamental', 'technical', 'sentiment', 'institutional',
        'analyst', 'political', 'macro', 'confidence', 'rankingScore', 'coverage']) {
        expect(result).toHaveProperty(f);
      }
    });

    it('should mark dimensions uncovered when data services return nothing', async () => {
      const result = await service.computeScore('AAPL');
      expect(Object.values(result.coverage).every((v) => v === false)).toBe(true);
    });
  });

  // ── getTopOpportunities ───────────────────────────────────────
  describe('getTopOpportunities', () => {
    it('should return an array', async () => {
      expect(Array.isArray(await service.getTopOpportunities())).toBe(true);
    });
    it('should respect the limit parameter', async () => {
      mockPrisma.stockScore.findMany.mockResolvedValueOnce(new Array(5).fill({ stock: {} }));
      expect((await service.getTopOpportunities(5)).length).toBeLessThanOrEqual(5);
    });
  });
});
