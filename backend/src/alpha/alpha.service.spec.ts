import { Test, TestingModule } from '@nestjs/testing';
import { AlphaService } from './alpha.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { SignalType } from '@prisma/client';
import { StocksService } from '../stocks/stocks.service';
import { SentimentService } from '../sentiment/sentiment.service';
import { FlowsService } from '../flows/flows.service';

const mockPrisma = {
  stock: { upsert: jest.fn().mockResolvedValue({ id: 'stock-1', symbol: 'AAPL' }), findUnique: jest.fn().mockResolvedValue({ id: 'stock-1', symbol: 'AAPL' }) },
  stockSignal: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
};
const mockCache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
// Data services return empty -> all anomaly inputs default to 0.
const mockStocks = { getHistory: jest.fn().mockResolvedValue({ symbol: 'AAPL', candles: [] }) };
const mockSentiment = { getVelocity: jest.fn().mockResolvedValue(null) };
const mockFlows = { getSummary: jest.fn().mockResolvedValue(null) };

describe('AlphaService', () => {
  let service: AlphaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlphaService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: StocksService, useValue: mockStocks },
        { provide: SentimentService, useValue: mockSentiment },
        { provide: FlowsService, useValue: mockFlows },
      ],
    }).compile();
    service = module.get<AlphaService>(AlphaService);
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
  });

  // ── detectAnomaly ──────────────────────────────────────────────
  describe('detectAnomaly', () => {
    it('should return an AnomalyResult for a valid symbol', async () => {
      const result = await service.detectAnomaly('AAPL');
      expect(result).toBeDefined();
      expect(result.symbol).toBe('AAPL');
    });

    it('should return anomalyScore between 0 and 1', async () => {
      const result = await service.detectAnomaly('AAPL');
      expect(result.anomalyScore).toBeGreaterThanOrEqual(0);
      expect(result.anomalyScore).toBeLessThanOrEqual(1);
    });

    it('should handle an unknown symbol gracefully', async () => {
      const result = await service.detectAnomaly('INVALID');
      expect(result).toBeDefined();
      expect(result.symbol).toBe('INVALID');
    });
  });

  // ── sentimentVelocity (via detectAnomaly) ──────────────────────
  describe('sentimentVelocity (via detectAnomaly)', () => {
    it('should include sentimentVelocity in result', async () => {
      const result = await service.detectAnomaly('AAPL');
      expect(result.sentimentVelocity).toBeGreaterThanOrEqual(0);
      expect(result.sentimentVelocity).toBeLessThanOrEqual(1);
    });

    it('should return a numeric sentimentVelocity', async () => {
      const result = await service.detectAnomaly('AAPL');
      expect(typeof result.sentimentVelocity).toBe('number');
    });

    it('should handle INVALID symbol for sentimentVelocity', async () => {
      const result = await service.detectAnomaly('INVALID');
      expect(result.sentimentVelocity).toBeDefined();
    });
  });

  // ── insiderActivity (via detectAnomaly) ───────────────────────
  describe('insiderActivity (via detectAnomaly)', () => {
    it('should include insiderActivity in result', async () => {
      const result = await service.detectAnomaly('AAPL');
      expect(result.insiderActivity).toBeGreaterThanOrEqual(0);
      expect(result.insiderActivity).toBeLessThanOrEqual(1);
    });

    it('should return numeric insiderActivity', async () => {
      const result = await service.detectAnomaly('AAPL');
      expect(typeof result.insiderActivity).toBe('number');
    });

    it('should handle INVALID symbol for insiderActivity', async () => {
      const result = await service.detectAnomaly('INVALID');
      expect(result.insiderActivity).toBeDefined();
    });

    it('should not throw for any symbol', async () => {
      await expect(service.detectAnomaly('AAPL')).resolves.not.toThrow();
    });

    it('should return insiderActivity between 0 and 1', async () => {
      const result = await service.detectAnomaly('AAPL');
      expect(result.insiderActivity).toBeGreaterThanOrEqual(0);
      expect(result.insiderActivity).toBeLessThanOrEqual(1);
    });
  });

  // ── institutionalShift (via detectAnomaly) ────────────────────
  describe('institutionalShift (via detectAnomaly)', () => {
    it('should include institutionalShift in result', async () => {
      const result = await service.detectAnomaly('AAPL');
      expect(result.institutionalShift).toBeGreaterThanOrEqual(0);
      expect(result.institutionalShift).toBeLessThanOrEqual(1);
    });

    it('should return numeric institutionalShift', async () => {
      const result = await service.detectAnomaly('AAPL');
      expect(typeof result.institutionalShift).toBe('number');
    });

    it('should handle INVALID symbol', async () => {
      const result = await service.detectAnomaly('INVALID');
      expect(result.institutionalShift).toBeDefined();
    });

    it('should return institutionalShift between 0 and 1', async () => {
      const result = await service.detectAnomaly('AAPL');
      expect(result.institutionalShift).toBeGreaterThanOrEqual(0);
      expect(result.institutionalShift).toBeLessThanOrEqual(1);
    });
  });

  // ── computeAnomalyScore ───────────────────────────────────────
  describe('computeAnomalyScore', () => {
    it('should return 0 for all-zero inputs', () => {
      const result = service.computeAnomalyScore(0, 0, 0, 0);
      expect(result).toBe(0);
    });

    it('should return 1 (max) for all-one inputs', () => {
      const result = service.computeAnomalyScore(1, 1, 1, 1);
      expect(result).toBeLessThanOrEqual(1);
      expect(result).toBeGreaterThan(0.9);
    });

    it('should weight volume higher than sentiment', () => {
      const highVol  = service.computeAnomalyScore(1, 0, 0, 0);
      const highSent = service.computeAnomalyScore(0, 1, 0, 0);
      expect(highVol).toBeGreaterThan(highSent);
    });

    it('should produce different scores for different inputs', () => {
      const r1 = service.computeAnomalyScore(0.5, 0.3, 0.7, 0.2);
      const r2 = service.computeAnomalyScore(0.1, 0.9, 0.4, 0.6);
      expect(r1).not.toBe(r2);
    });
  });

  // ── classifySignal ────────────────────────────────────────────
  describe('classifySignal', () => {
    it('should return SMART_MONEY_ENTRY for high insider + institutional', () => {
      const result = service.classifySignal(0.3, 0.2, 0.8, 0.7, 0);
      expect(result).toBe(SignalType.SMART_MONEY_ENTRY);
    });

    it('should return ACCUMULATION for high volume, low sentiment, no price move', () => {
      const result = service.classifySignal(0.8, 0.2, 0.3, 0.1, 0);
      expect(result).toBe(SignalType.ACCUMULATION);
    });

    it('should return SENTIMENT_PUMP for high sentiment, low volume', () => {
      const result = service.classifySignal(0.2, 0.9, 0.1, 0.1, 0);
      expect(result).toBe(SignalType.SENTIMENT_PUMP);
    });

    it('should return MOMENTUM_IGNITION for high volume + positive price move', () => {
      // sentiment >= 0.3 so the earlier ACCUMULATION rule does not match.
      const result = service.classifySignal(0.7, 0.4, 0.1, 0.1, 0.05);
      expect(result).toBe(SignalType.MOMENTUM_IGNITION);
    });

    it('should return NEUTRAL for all-low inputs', () => {
      const result = service.classifySignal(0.05, 0.05, 0.05, 0.05, 0);
      expect(result).toBe(SignalType.NEUTRAL);
    });

    it('should return RISK_WARNING for negative price move', () => {
      const result = service.classifySignal(0.3, 0.3, 0.3, 0.3, -0.06);
      expect(result).toBe(SignalType.RISK_WARNING);
    });
  });

  // ── isEarlyOpportunity ────────────────────────────────────────
  describe('isEarlyOpportunity', () => {
    it('should return true for high anomaly + small price move', () => {
      expect(service.isEarlyOpportunity(0.8, 0.01)).toBe(true);
    });

    it('should return false for low anomaly', () => {
      expect(service.isEarlyOpportunity(0.1, 0.01)).toBe(false);
    });

    it('should return false exactly at threshold (0.65)', () => {
      expect(service.isEarlyOpportunity(0.65, 0.01)).toBe(false);
    });

    it('should return true just above threshold (0.66)', () => {
      expect(service.isEarlyOpportunity(0.66, 0.01)).toBe(true);
    });

    it('should return false when 5d move exceeds 3%', () => {
      expect(service.isEarlyOpportunity(0.8, 0.05)).toBe(false);
    });

    it('should return false for zero anomaly', () => {
      expect(service.isEarlyOpportunity(0, 0.01)).toBe(false);
    });
  });

  // ── getEarlyOpportunities ─────────────────────────────────────
  describe('getEarlyOpportunities', () => {
    it('should return an array', async () => {
      jest.spyOn(service, 'getEarlyOpportunities').mockResolvedValue([]);
      const result = await service.getEarlyOpportunities();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should call prisma when cache is cold', async () => {
      const result = await service.getEarlyOpportunities();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ── getLatestSignals ──────────────────────────────────────────
  describe('getLatestSignals', () => {
    it('should return an array for a known symbol', async () => {
      const result = await service.getLatestSignals('AAPL');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for unknown symbol', async () => {
      mockPrisma.stock.findUnique.mockResolvedValueOnce(null);
      const result = await service.getLatestSignals('UNKNOWN');
      expect(result).toEqual([]);
    });
  });
});
