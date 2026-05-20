import { Injectable } from "@nestjs/common";
import { CacheService } from "../cache/cache.service";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

const FRED_SERIES = {
  gdp: "GDP", inflation: "CPIAUCSL", fedRate: "FEDFUNDS",
  unemployment: "UNRATE", sp500: "SP500", vix: "VIXCLS",
  yieldCurve: "T10Y2Y", m2: "M2SL",
};

@Injectable()
export class MacroService {
  constructor(private cache: CacheService, private config: ConfigService) {}

  async getFredSeries(seriesId: string) {
    const cached = await this.cache.get("fred", { seriesId });
    if (cached) return cached;
    const key = this.config.get("FRED_API_KEY");
    if (!key) return null;
    try {
      const { data } = await axios.get(`https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&limit=24&sort_order=desc`);
      await this.cache.set("fred", { seriesId }, data, 86400);
      return data;
    } catch { return null; }
  }

  async getMacroDashboard() {
    const cached = await this.cache.get("macro_dashboard", {});
    if (cached) return cached;
    const results = await Promise.allSettled(
      Object.entries(FRED_SERIES).map(async ([key, id]) => [key, await this.getFredSeries(id)])
    );
    const dashboard: Record<string, any> = {};
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        const [k, v] = r.value as [string, any];
        dashboard[k] = v?.observations?.slice(0, 12) || [];
      }
    }
    // Macro score: simple heuristic based on key indicators
    const fedRate = dashboard.fedRate?.[0]?.value;
    const vix = dashboard.vix?.[0]?.value;
    const yieldCurve = dashboard.yieldCurve?.[0]?.value;
    let macroScore = 5;
    if (fedRate != null) macroScore += parseFloat(fedRate) < 3 ? 1 : parseFloat(fedRate) > 5 ? -1 : 0;
    if (vix != null) macroScore += parseFloat(vix) < 15 ? 1 : parseFloat(vix) > 30 ? -2 : 0;
    if (yieldCurve != null) macroScore += parseFloat(yieldCurve) > 0.5 ? 1 : parseFloat(yieldCurve) < 0 ? -1 : 0;
    dashboard.macroScore = Math.max(0, Math.min(10, macroScore));
    await this.cache.set("macro_dashboard", {}, dashboard, 86400);
    return dashboard;
  }
}
