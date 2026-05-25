/**
 * Shared HTTP helper for all external-API services.
 * - Single axios instance with sane timeout + browser-like UA (SEC EDGAR rejects
 *   requests with no User-Agent).
 * - getJson() never throws: on any failure it returns null and logs once, so a
 *   dead provider degrades one dimension instead of crashing a whole score.
 */
import { Logger } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';

const log = new Logger('HttpUtil');

// SEC EDGAR rejects requests with generic/unparseable User-Agent strings.
// The format SEC accepts is: "Company Name AdminContactEmail@domain.com".
// We read SEC_USER_AGENT first (set this to your real name + email), then
// fall back to ADMIN_EMAIL if present, then to a safe default that still
// includes a valid email format.
const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
const userAgent =
  process.env.SEC_USER_AGENT ||
  `QuantGoeuryInvestments research ${adminEmail}`;

export const http = axios.create({
  timeout: 12000,
  headers: {
    'User-Agent': userAgent,
    Accept: 'application/json',
  },
});

export async function getJson<T = any>(
  url: string,
  config?: AxiosRequestConfig,
  label?: string,
): Promise<T | null> {
  try {
    const res = await http.get<T>(url, config);
    return res.data;
  } catch (e: any) {
    const status = e?.response?.status;
    log.warn(`GET ${label ?? url} failed${status ? ` [${status}]` : ''}: ${e?.message ?? e}`);
    return null;
  }
}

/** Fetch a raw text/XML body. Same swallow-and-warn behavior as getJson. */
export async function getText(
  url: string,
  config?: AxiosRequestConfig,
  label?: string,
): Promise<string | null> {
  try {
    const res = await http.get<string>(url, {
      ...config,
      responseType: 'text',
      headers: { Accept: 'application/xml, text/xml, text/plain, */*', ...(config?.headers ?? {}) },
      transformResponse: [(d) => d],
    });
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  } catch (e: any) {
    const status = e?.response?.status;
    log.warn(`GET(text) ${label ?? url} failed${status ? ` [${status}]` : ''}: ${e?.message ?? e}`);
    return null;
  }
}

export async function postJson<T = any>(
  url: string,
  body: any,
  config?: AxiosRequestConfig,
  label?: string,
): Promise<T | null> {
  try {
    const res = await http.post<T>(url, body, config);
    return res.data;
  } catch (e: any) {
    const status = e?.response?.status;
    log.warn(`POST ${label ?? url} failed${status ? ` [${status}]` : ''}: ${e?.message ?? e}`);
    return null;
  }
}

/** Clamp a number into [min,max]. */
export const clamp = (n: number, min = 0, max = 10): number =>
  Math.min(Math.max(Number.isFinite(n) ? n : min, min), max);

/** Mean of a numeric array, 0 if empty. */
export const mean = (xs: number[]): number =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

/** Population standard deviation. */
export const stdev = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
