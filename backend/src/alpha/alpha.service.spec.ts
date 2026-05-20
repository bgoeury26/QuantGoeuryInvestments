import { AlphaService } from './alpha.service';

const mockPrisma = {
  stockSignal: { findMany: jest.fn() }
} as any;

describe('AlphaService', () => {
  let svc: AlphaService;

  beforeEach(() => {
    svc = new AlphaService(mockPrisma);
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // VOLUME ANOMALY DETECTION
  // ----------------------------------------------------------------
  describe('detectVolumeAnomaly()', () => {
    const baseHist = [1e6, 1.1e6, 0.9e6, 1.05e6, 0.95e6, 1e6, 1.1e6, 0.9e6, 1e6, 1e6];

    it('normal volume returns 0', () => {
      expect(svc.detectVolumeAnomaly(1e6, baseHist)).toBe(0);
    });

    it('3× normal volume returns significant anomaly score', () => {
      const score = svc.detectVolumeAnomaly(3e6, baseHist);
      expect(score).toBeGreaterThan(0.3);
    });

    it('10× normal volume is capped at 1', () => {
      expect(svc.detectVolumeAnomaly(10e6, baseHist)).toBeLessThanOrEqual(1);
    });

    it('returns 0 with fewer than 5 historical data points', () => {
      expect(svc.detectVolumeAnomaly(5e6, [1e6, 2e6])).toBe(0);
    });

    it('returns 0 when std deviation is 0 (flat volume)', () => {
      expect(svc.detectVolumeAnomaly(1e6, [1e6, 1e6, 1e6, 1e6, 1e6])).toBe(0);
    });

    it('result is always between 0 and 1', () => {
      [0.5e6, 1e6, 2e6, 5e6, 20e6].forEach(v => {
        const r = svc.detectVolumeAnomaly(v, baseHist);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      });
    });
  });

  // ----------------------------------------------------------------
  // SENTIMENT VELOCITY
  // ----------------------------------------------------------------
  describe('detectSentimentVelocity()', () => {
    it('tripled mentions returns meaningful velocity', () => {
      const v = svc.detectSentimentVelocity(300, 100, 50, 10);
      expect(v).toBeGreaterThan(0.3);
    });

    it('same mentions returns 0', () => {
      expect(svc.detectSentimentVelocity(100, 100, 10, 10)).toBe(0);
    });

    it('zero previous mentions does not crash', () => {
      expect(() => svc.detectSentimentVelocity(100, 0, 50, 0)).not.toThrow();
    });

    it('result is always between 0 and 1', () => {
      [[500, 10, 200, 5], [100, 100, 10, 10], [0, 0, 0, 0]].forEach(([a, b, c, d]) => {
        const r = svc.detectSentimentVelocity(a, b, c, d);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      });
    });
  });

  // ----------------------------------------------------------------
  // INSIDER ACTIVITY DETECTION
  // ----------------------------------------------------------------
  describe('detectInsiderActivity()', () => {
    it('no trades returns 0', () => {
      expect(svc.detectInsiderActivity([])).toBe(0);
    });

    it('only sells returns 0', () => {
      const trades = [{ type:'sell', daysAgo:5, value:1e6 }];
      expect(svc.detectInsiderActivity(trades)).toBe(0);
    });

    it('cluster of 3+ insider buys boosts score', () => {
      const trades = [
        { type:'buy', daysAgo:5, value:5e5 },
        { type:'buy', daysAgo:8, value:3e5 },
        { type:'buy', daysAgo:12, value:4e5 },
      ];
      expect(svc.detectInsiderActivity(trades)).toBeGreaterThan(0.3);
    });

    it('old trades (>30 days) are not counted', () => {
      const trades = [
        { type:'buy', daysAgo:35, value:1e6 },
        { type:'buy', daysAgo:45, value:1e6 },
      ];
      expect(svc.detectInsiderActivity(trades)).toBe(0);
    });

    it('buys vs sells netting reduces score', () => {
      const onlyBuys = [{ type:'buy', daysAgo:5, value:1e6 }, { type:'buy', daysAgo:6, value:1e6 }];
      const mixed    = [...onlyBuys, { type:'sell', daysAgo:3, value:2e6 }];
      expect(svc.detectInsiderActivity(onlyBuys)).toBeGreaterThanOrEqual(svc.detectInsiderActivity(mixed));
    });

    it('result is always between 0 and 1', () => {
      const trades = [{ type:'buy', daysAgo:1, value:50e6 }, { type:'buy', daysAgo:2, value:50e6 }, { type:'buy', daysAgo:3, value:50e6 }];
      expect(svc.detectInsiderActivity(trades)).toBeLessThanOrEqual(1);
    });
  });

  // ----------------------------------------------------------------
  // INSTITUTIONAL SHIFT DETECTION
  // ----------------------------------------------------------------
  describe('detectInstitutionalShift()', () => {
    it('increasing position returns positive score', () => {
      expect(svc.detectInstitutionalShift(120, 100, 8, 10)).toBeGreaterThan(0);
    });

    it('decreasing position returns 0', () => {
      expect(svc.detectInstitutionalShift(80, 100, 2, 10)).toBe(0);
    });

    it('zero previous position does not crash', () => {
      expect(() => svc.detectInstitutionalShift(100, 0, 5, 10)).not.toThrow();
    });

    it('high fund participation amplifies score', () => {
      const low  = svc.detectInstitutionalShift(120, 100, 1, 10);
      const high = svc.detectInstitutionalShift(120, 100, 9, 10);
      expect(high).toBeGreaterThan(low);
    });

    it('result is between 0 and 1', () => {
      expect(svc.detectInstitutionalShift(200, 100, 10, 10)).toBeLessThanOrEqual(1);
    });
  });

  // ----------------------------------------------------------------
  // COMPOSITE ANOMALY SCORE
  // ----------------------------------------------------------------
  describe('computeAnomalyScore()', () => {
    it('all zeros returns 0', () => {
      expect(svc.computeAnomalyScore(0, 0, 0, 0)).toBe(0);
    });

    it('all ones returns 1', () => {
      expect(svc.computeAnomalyScore(1, 1, 1, 1)).toBe(1);
    });

    it('result is always between 0 and 1', () => {
      [[0.3, 0.5, 0.2, 0.7], [0, 1, 0, 1], [0.5, 0.5, 0.5, 0.5]].forEach(([v, s, i, inst]) => {
        const r = svc.computeAnomalyScore(v, s, i, inst);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      });
    });

    it('volume has highest weight (0.30)', () => {
      const volDriven  = svc.computeAnomalyScore(1, 0, 0, 0);
      const sentDriven = svc.computeAnomalyScore(0, 1, 0, 0);
      expect(volDriven).toBeGreaterThanOrEqual(sentDriven);
    });
  });

  // ----------------------------------------------------------------
  // SIGNAL CLASSIFICATION
  // ----------------------------------------------------------------
  describe('classifySignal()', () => {
    it('high insider + institutional = SMART_MONEY_ENTRY', () => {
      expect(svc.classifySignal(0.3, 0.3, 0.8, 0.6, 0.01)).toBe('SMART_MONEY_ENTRY');
    });

    it('high volume + flat price = ACCUMULATION', () => {
      expect(svc.classifySignal(0.8, 0.2, 0.1, 0.2, 0.005)).toBe('ACCUMULATION');
    });

    it('high sentiment + volume = SENTIMENT_PUMP', () => {
      expect(svc.classifySignal(0.6, 0.8, 0.1, 0.1, 0.01)).toBe('SENTIMENT_PUMP');
    });

    it('high volume + rising price = MOMENTUM_IGNITION', () => {
      expect(svc.classifySignal(0.8, 0.3, 0.1, 0.1, 0.05)).toBe('MOMENTUM_IGNITION');
    });

    it('high volume + no insider + falling price = RISK_WARNING', () => {
      expect(svc.classifySignal(0.6, 0.3, 0.05, 0.1, -0.05)).toBe('RISK_WARNING');
    });

    it('neutral baseline returns NEUTRAL', () => {
      expect(svc.classifySignal(0.1, 0.1, 0.1, 0.1, 0)).toBe('NEUTRAL');
    });
  });

  // ----------------------------------------------------------------
  // EARLY OPPORTUNITY FLAG
  // ----------------------------------------------------------------
  describe('isEarlyOpportunity()', () => {
    it('high anomaly + flat price = true', () => {
      expect(svc.isEarlyOpportunity(0.6, 0.01)).toBe(true);
    });

    it('high anomaly but large price move = false (already moved)', () => {
      expect(svc.isEarlyOpportunity(0.6, 0.08)).toBe(false);
    });

    it('low anomaly + flat price = false', () => {
      expect(svc.isEarlyOpportunity(0.3, 0.01)).toBe(false);
    });

    it('threshold is exactly 0.45 — below = false', () => {
      expect(svc.isEarlyOpportunity(0.44, 0.01)).toBe(false);
    });

    it('threshold is exactly 0.45 — above = true (if price flat)', () => {
      expect(svc.isEarlyOpportunity(0.46, 0.02)).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // PERSISTENCE (mocked)
  // ----------------------------------------------------------------
  describe('getEarlyOpportunities()', () => {
    it('calls prisma with earlyFlag:true filter', async () => {
      mockPrisma.stockSignal.findMany.mockResolvedValue([]);
      await svc.getEarlyOpportunities();
      const call = mockPrisma.stockSignal.findMany.mock.calls[0][0];
      expect(call.where.earlyFlag).toBe(true);
    });
  });

  describe('getLatestSignals()', () => {
    it('filters by stockId and future expiry', async () => {
      mockPrisma.stockSignal.findMany.mockResolvedValue([]);
      await svc.getLatestSignals('NVDA');
      const call = mockPrisma.stockSignal.findMany.mock.calls[0][0];
      expect(call.where.stockId).toBe('NVDA');
      expect(call.where.expiresAt).toBeDefined();
    });
  });
});
