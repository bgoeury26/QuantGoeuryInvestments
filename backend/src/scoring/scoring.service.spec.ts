import { Test, TestingModule } from '@nestjs/testing';
import { ScoringService } from './scoring.service';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

describe('ScoringService', () => {
  let service: ScoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        { provide: HttpService, useValue: { get: jest.fn() } },
        { provide: PrismaService, useValue: {} },
        { provide: CacheService, useValue: { get: jest.fn().mockResolvedValue(null), set: jest.fn() } },
      ],
    }).compile();
    service = module.get<ScoringService>(ScoringService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('computeConfidence', () => {
    it('should return 0.5 for empty input', () => {
      const result = service.computeConfidence({});
      expect(result).toBe(0.5);
    });

    it('should return value between 0.5 and 1.2', () => {
      const result = service.computeConfidence({ a: 7, b: 8, c: 6 });
      expect(result).toBeGreaterThanOrEqual(0.5);
      expect(result).toBeLessThanOrEqual(1.2);
    });

    it('should return higher confidence when all inputs are similar', () => {
      const highAgreement = service.computeConfidence({ a: 7, b: 7, c: 7 });
      const lowAgreement = service.computeConfidence({ a: 1, b: 5, c: 10 });
      expect(highAgreement).toBeGreaterThanOrEqual(lowAgreement);
    });

    it('should handle single value', () => {
      const result = service.computeConfidence({ a: 8 });
      expect(result).toBeGreaterThanOrEqual(0.5);
      expect(result).toBeLessThanOrEqual(1.2);
    });

    it('should handle all zeros', () => {
      const result = service.computeConfidence({ a: 0, b: 0, c: 0 });
      expect(result).toBeGreaterThanOrEqual(0.5);
    });

    it('should handle all max values', () => {
      const result = service.computeConfidence({ a: 10, b: 10, c: 10 });
      expect(result).toBeLessThanOrEqual(1.2);
    });
  });

  describe('computeScore', () => {
    it('should return a ScoreResult with correct shape', async () => {
      const result = await service.computeScore('AAPL');
      expect(result).toHaveProperty('symbol', 'AAPL');
      expect(result).toHaveProperty('finalScore');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('fundamental');
      expect(result.finalScore).toBeGreaterThanOrEqual(0);
    });

    it('should return score between 0 and 12', async () => {
      const result = await service.computeScore('MSFT');
      expect(result.finalScore).toBeGreaterThanOrEqual(0);
      expect(result.finalScore).toBeLessThanOrEqual(12);
    });
  });
});
