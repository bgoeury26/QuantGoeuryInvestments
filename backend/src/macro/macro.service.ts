import { Injectable } from "@nestjs/common";
import { CacheService } from "../cache/cache.service";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

const FRED_SERIES = {
  fed_rate: "FEDFUNDS", inflation: "CPIAUCSL", unemployment: "UNRATE",
  gdp_growth: "A191RL1Q225SBEA", yield_10y: "DGS10", yield_2y: "DGS2",
  vix: "VIXCLS", ism_manufacturing: "MANEMP",
};

@Injectable()
export class MacroService {
  constructor(private cache: CacheService, private config: ConfigService) {}

  // FRED API — FREE. Cached 6h
  async getSeries(seriesId: string) {
    const cached = await this.cache.get("fred", { seriesId });
    if (cached) return cached;
    const key = this.config.get("FRED_API_KEY");
    if (!key) return null;
    try {
      const { data } = await axios.get(`https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&limit=24&sort_order=desc`);
      await this.cache.set("fred", { seriesId }, data, 21600);
      return data;
    } catch { return null; }
  }

  async getMacroEnvironment() {
    const cached = await this.cache.get("macro_env", {});
    if (cached) return cached;
    const results: Record<string, any> = {};
    await Promise.all(Object.entries(FRED_SERIES).map(async ([key, id]) => {
      const data = await this.getSeries(id);
      results[key] = data?.observations?.[0];
    }));
    // Compute yield curve spread (10Y - 2Y)
    const y10 = parseFloat(results.yield_10y?.value || "0");
    const y2 = parseFloat(results.yield_2y?.value || "0");
    results.yield_curve_spread = y10 - y2;
    results.yield_curve_inverted = results.yield_curve_spread < 0;
    // Macro score: 0-10
    let score = 5;
    if (results.yield_curve_inverted) score -= 1.5;
    if (parseFloat(results.inflation?.value || "0") > 4) score -= 1;
    if (parseFloat(results.fed_rate?.value || "0") > 5) score -= 0.5;
    if (parseFloat(results.vix?.value || "20") > 30) score -= 1;
    if (parseFloat(results.gdp_growth?.value || "0") > 2) score += 1;
    results.macroScore = Math.max(0, Math.min(10, score));
    await this.cache.set("macro_env", {}, results, 21600);
    return results;
  }
}
