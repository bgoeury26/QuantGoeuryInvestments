import { Test, TestingModule } from '@nestjs/testing';
import { ScoringService } from './scoring.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';

const mockPrisma = {
  stock: { upsert: jest.fn().mockResolvedValue({ id: 'stock-1', symbol: 'AAPL' }) },
  stockScore: {
    upsert: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
  },
};
const mockCache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
const mockConfig = { get: jest.fn().mockReturnValue(null) };

describe('ScoringService', () => {
  let service: ScoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<ScoringService>(ScoringService);
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
  });

  // ── computeConfidence ─────────────────────────────────────────
  describe('computeConfidence', () => {
    it('should return a number between 0.5 and 1.2', () => {
      const result = service.computeConfidence(0.5, 0.5, 1.0, 0.1);
      expect(result).toBeGreaterThanOrEqual(0.5);
      expect(result).toBeLessThanOrEqual(1.2);
    });

    it('should return a number for arbitrary inputs', () => {
      const result = service.computeConfidence(0.7, 0.8, 1.0, 0.1);
      expect(typeof result).toBe('number');
    });

    it('should return higher confidence for higher agreement', () => {
      const highAgreement = service.computeConfidence(1, 1, 1, 0);
      const lowAgreement  = service.computeConfidence(0, 0, 0, 1);
      expect(highAgreement).toBeGreaterThan(lowAgreement);
    });

    it('should return a number for single-factor completeness', () => {
      const result = service.computeConfidence(0.8, 0.5, 1.0, 0.0);
      expect(typeof result).toBe('number');
    });

    it('should clamp to minimum 0.5 for zero inputs', () => {
      const result = service.computeConfidence(0, 0, 0, 1);
      expect(result).toBeGreaterThanOrEqual(0.5);
    });

    it('should clamp to maximum 1.2 for all-max inputs', () => {
      const result = service.computeConfidence(1, 1, 1, 0);
      expect(result).toBeLessThanOrEqual(1.2);
    });
  });

  // ── computeRankingScore ───────────────────────────────────────
  describe('computeRankingScore', () => {
    it('should boost score with anomaly and momentum', () => {
      const base    = service.computeRankingScore(5, 0, 0);
      const boosted = service.computeRankingScore(5, 0.5, 1);
      expect(boosted).toBeGreaterThan(base);
    });

    it('should never go below 0', () => {
      const result = service.computeRankingScore(0, 0, 0);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  // ── computeFundamentalScore ───────────────────────────────────
  describe('computeFundamentalScore', () => {
    it('should return 5 for empty data', () => {
      const result = service.computeFundamentalScore({});
      expect(result).toBe(5);
    });

    it('should reward low P/E ratio', () => {
      const low  = service.computeFundamentalScore({ peRatio: 10 });
      const high = service.computeFundamentalScore({ peRatio: 50 });
      expect(low).toBeGreaterThan(high);
    });

    it('should stay within 0–10 range', () => {
      const result = service.computeFundamentalScore({ peRatio: 5, roe: 0.4, revenueGrowth: 0.5, operatingMargin: 0.3, debtToEquity: 0.2 });
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(10);
    });
  });

  // ── computeTechnicalScore ─────────────────────────────────────
  describe('computeTechnicalScore', () => {
    it('should reward oversold RSI (<30)', () => {
      const oversold   = service.computeTechnicalScore({ rsi: 25 });
      const overbought = service.computeTechnicalScore({ rsi: 75 });
      expect(oversold).toBeGreaterThan(overbought);
    });

    it('should stay within 0–10 range', () => {
      const result = service.computeTechnicalScore({ rsi: 50, macdSignal: 'bullish', priceVsMA200: 0.05 });
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(10);
    });
  });

  // ── computeScore (integration) ────────────────────────────────
  describe('computeScore', () => {
    it('should return a ScoreResult with finalScore in 0–10', async () => {
      const result = await service.computeScore('AAPL');
      expect(result.finalScore).toBeGreaterThanOrEqual(0);
      expect(result.finalScore).toBeLessThanOrEqual(10);
    });

    it('should use cache on second call', async () => {
      mockCache.get.mockResolvedValueOnce(null);
      await service.computeScore('AAPL');
      mockCache.get.mockResolvedValueOnce({ symbol: 'AAPL', finalScore: 7 } as any);
      const cached = await service.computeScore('AAPL');
      expect(cached.finalScore).toBe(7);
    });

    it('should include all required score fields', async () => {
      const result = await service.computeScore('MSFT');
      expect(result).toHaveProperty('fundamental');
      expect(result).toHaveProperty('technical');
      expect(result).toHaveProperty('sentiment');
      expect(result).toHaveProperty('institutional');
      expect(result).toHaveProperty('analyst');
      expect(result).toHaveProperty('political');
      expect(result).toHaveProperty('macro');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('rankingScore');
    });
  });

  // ── getTopOpportunities ───────────────────────────────────────
  describe('getTopOpportunities', () => {
    it('should return an array', async () => {
      const result = await service.getTopOpportunities();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should respect the limit parameter', async () => {
      mockPrisma.stockScore.findMany.mockResolvedValueOnce(new Array(5).fill({ stock: {} }));
      const result = await service.getTopOpportunities(5);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });
});
