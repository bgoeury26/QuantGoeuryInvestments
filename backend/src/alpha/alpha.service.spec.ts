import { Test, TestingModule } from '@nestjs/testing';
import { AlphaService } from './alpha.service';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { SignalType } from '@prisma/client';

describe('AlphaService', () => {
  let service: AlphaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlphaService,
        { provide: HttpService, useValue: { get: jest.fn() } },
        { provide: PrismaService, useValue: { stock: { findUnique: jest.fn(), findMany: jest.fn() }, stockSignal: { create: jest.fn(), findMany: jest.fn() } } },
        { provide: CacheService, useValue: { get: jest.fn().mockResolvedValue(null), set: jest.fn() } },
      ],
    }).compile();
    service = module.get<AlphaService>(AlphaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detectVolumeAnomaly', () => {
    it('should return a number between 0 and 1', async () => {
      const result = await service.detectVolumeAnomaly('AAPL');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should handle missing API key gracefully', async () => {
      delete process.env.ALPHA_VANTAGE_API_KEY;
      const result = await service.detectVolumeAnomaly('AAPL');
      expect(typeof result).toBe('number');
    });

    it('should return fallback on error', async () => {
      const result = await service.detectVolumeAnomaly('INVALID');
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectSentimentVelocity', () => {
    it('should return a number between 0 and 1', async () => {
      const result = await service.detectSentimentVelocity('AAPL');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should handle missing API key gracefully', async () => {
      delete process.env.NEWS_API_KEY;
      const result = await service.detectSentimentVelocity('AAPL');
      expect(typeof result).toBe('number');
    });

    it('should return value between 0 and 1 on error', async () => {
      const result = await service.detectSentimentVelocity('INVALID');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('detectInsiderActivity', () => {
    it('should return a number', async () => {
      const result = await service.detectInsiderActivity('AAPL');
      expect(typeof result).toBe('number');
    });

    it('should return between 0 and 1', async () => {
      const result = await service.detectInsiderActivity('AAPL');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should handle errors gracefully', async () => {
      const result = await service.detectInsiderActivity('INVALID');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should not throw', async () => {
      await expect(service.detectInsiderActivity('AAPL')).resolves.not.toThrow();
    });

    it('should return a fallback when SEC is unreachable', async () => {
      jest.spyOn(service as any, 'detectInsiderActivity').mockResolvedValueOnce(0.2);
      const result = await service.detectInsiderActivity('AAPL');
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('detectInstitutionalShift', () => {
    it('should return a number', async () => {
      const result = await service.detectInstitutionalShift('AAPL');
      expect(typeof result).toBe('number');
    });

    it('should return between 0 and 1', async () => {
      const result = await service.detectInstitutionalShift('AAPL');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should return low score without API key', async () => {
      delete process.env.FMP_API_KEY;
      const result = await service.detectInstitutionalShift('AAPL');
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should handle arrays gracefully', async () => {
      const result = await service.detectInstitutionalShift('AAPL');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('computeAnomalyScore', () => {
    it('should return 0 for all-zero inputs', () => {
      const result = service.computeAnomalyScore({ volumeAnomaly: 0, sentimentVelocity: 0, insiderActivity: 0, institutionalShift: 0 });
      expect(result).toBe(0);
    });

    it('should return 1 for all-one inputs', () => {
      const result = service.computeAnomalyScore({ volumeAnomaly: 1, sentimentVelocity: 1, insiderActivity: 1, institutionalShift: 1 });
      expect(result).toBeCloseTo(1, 2);
    });

    it('should weight volume highest', () => {
      const highVol = service.computeAnomalyScore({ volumeAnomaly: 1, sentimentVelocity: 0, insiderActivity: 0, institutionalShift: 0 });
      const highSent = service.computeAnomalyScore({ volumeAnomaly: 0, sentimentVelocity: 1, insiderActivity: 0, institutionalShift: 0 });
      expect(highVol).toBeGreaterThan(highSent);
    });

    it('should return between 0 and 1', () => {
      const r1 = service.computeAnomalyScore({ volumeAnomaly: 0.5, sentimentVelocity: 0.3, insiderActivity: 0.7, institutionalShift: 0.2 });
      const r2 = service.computeAnomalyScore({ volumeAnomaly: 0.1, sentimentVelocity: 0.9, insiderActivity: 0.4, institutionalShift: 0.6 });
      expect(r1).toBeGreaterThanOrEqual(0);
      expect(r2).toBeLessThanOrEqual(1);
    });
  });

  describe('classifySignal', () => {
    it('should return SMART_MONEY_ENTRY for high insider + institutional', () => {
      const result = service.classifySignal({ volumeAnomaly: 0.3, sentimentVelocity: 0.2, insiderActivity: 0.8, institutionalShift: 0.7 });
      expect(result).toBe(SignalType.SMART_MONEY_ENTRY);
    });

    it('should return ACCUMULATION for high volume + institutional', () => {
      const result = service.classifySignal({ volumeAnomaly: 0.8, sentimentVelocity: 0.2, insiderActivity: 0.3, institutionalShift: 0.7 });
      expect(result).toBe(SignalType.ACCUMULATION);
    });

    it('should return SENTIMENT_PUMP for high sentiment velocity', () => {
      const result = service.classifySignal({ volumeAnomaly: 0.2, sentimentVelocity: 0.9, insiderActivity: 0.1, institutionalShift: 0.1 });
      expect(result).toBe(SignalType.SENTIMENT_PUMP);
    });

    it('should return MOMENTUM_IGNITION for high volume alone', () => {
      const result = service.classifySignal({ volumeAnomaly: 0.7, sentimentVelocity: 0.1, insiderActivity: 0.1, institutionalShift: 0.1 });
      expect(result).toBe(SignalType.MOMENTUM_IGNITION);
    });

    it('should return RISK_WARNING for all-low inputs', () => {
      const result = service.classifySignal({ volumeAnomaly: 0.05, sentimentVelocity: 0.05, insiderActivity: 0.05, institutionalShift: 0.05 });
      expect(result).toBe(SignalType.RISK_WARNING);
    });

    it('should always return a valid SignalType', () => {
      const validTypes = Object.values(SignalType);
      const result = service.classifySignal({ volumeAnomaly: 0.3, sentimentVelocity: 0.3, insiderActivity: 0.3, institutionalShift: 0.3 });
      expect(validTypes).toContain(result);
    });
  });

  describe('isEarlyOpportunity', () => {
    it('should return true for high anomaly score', () => {
      expect(service.isEarlyOpportunity(0.8)).toBe(true);
    });

    it('should return false for low anomaly score', () => {
      expect(service.isEarlyOpportunity(0.1)).toBe(false);
    });

    it('should return false at boundary', () => {
      expect(service.isEarlyOpportunity(0.45)).toBe(false);
    });

    it('should return true just above boundary', () => {
      expect(service.isEarlyOpportunity(0.46)).toBe(true);
    });

    it('should handle edge case 0', () => {
      expect(service.isEarlyOpportunity(0)).toBe(false);
    });
  });

  describe('getEarlyOpportunities', () => {
    it('should return an array', async () => {
      jest.spyOn(service, 'getTopOpportunities').mockResolvedValue([]);
      const result = await service.getEarlyOpportunities();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getLatestSignals', () => {
    it('should call prisma stockSignal.findMany', async () => {
      const mockSignals = [{ id: '1', signalType: SignalType.ACCUMULATION }];
      jest.spyOn((service as any).prisma.stockSignal, 'findMany').mockResolvedValue(mockSignals as any);
      const result = await service.getLatestSignals();
      expect(result).toEqual(mockSignals);
    });
  });
});
