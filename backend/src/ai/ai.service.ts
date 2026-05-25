import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CacheService } from "../cache/cache.service";
import axios from "axios";

// AI Analysis Engine — Multi-agent style with 3 analyst perspectives
// Uses OpenAI GPT-4o-mini (cheap: ~$0.15/1M tokens)
// Falls back to rule-based analysis if no API key

const BULLISH_PROMPT = (data: any) => `You are a bullish equity analyst. Given this data about ${data.symbol}:
- Score: ${data.finalScore}/10, Anomaly: ${data.anomalyScore}/10
- Fundamental: ${data.fundamental}, Technical: ${data.technical}, Sentiment: ${data.sentiment}
- Signal: ${data.signalType}, Drivers: ${data.drivers?.join(", ")}
Write a concise 3-sentence bullish case. Be specific. End with a Buy recommendation and price target rationale.`;

const BEARISH_PROMPT = (data: any) => `You are a bearish equity analyst. Given this data about ${data.symbol}:
- Score: ${data.finalScore}/10, Anomaly: ${data.anomalyScore}/10
- Fundamental: ${data.fundamental}, Technical: ${data.technical}, Sentiment: ${data.sentiment}
- Signal: ${data.signalType}, Drivers: ${data.drivers?.join(", ")}
Write a concise 3-sentence bearish case. Highlight risks and contradictions. End with a Sell/Reduce recommendation.`;

const NEUTRAL_PROMPT = (data: any) => `You are a neutral equity analyst. Given this data about ${data.symbol}:
- Score: ${data.finalScore}/10, Anomaly: ${data.anomalyScore}/10
- Fundamental: ${data.fundamental}, Technical: ${data.technical}, Sentiment: ${data.sentiment}
- Signal: ${data.signalType}
Write a balanced 3-sentence assessment. Weigh both sides. End with a Hold recommendation and key catalysts to watch.`;

@Injectable()
export class AiService {
  constructor(private config: ConfigService, private cache: CacheService) {}

  private async callGPT(prompt: string): Promise<string> {
    const key = this.config.get("OPENAI_API_KEY");
    if (!key) return "";
    try {
      const { data } = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        { model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: 200, temperature: 0.7 },
        { headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" } }
      );
      return data.choices?.[0]?.message?.content || "";
    } catch { return ""; }
  }

  // Rule-based fallback when no OpenAI key
  private ruleBasedAnalysis(data: any) {
    const score = data.finalScore || 5;
    const anomaly = data.anomalyScore || 0;
    const bullish = {
      analysis: score > 7
        ? `${data.symbol} shows strong fundamentals with a score of ${score.toFixed(1)}/10. ${anomaly > 0.4 ? "Unusual institutional activity suggests smart money accumulation. " : ""}Technical momentum supports a continued uptrend with improving volume metrics.`
        : `${data.symbol} presents a moderate opportunity with score ${score.toFixed(1)}/10. Value investors may find attractive entry points at current levels. Key catalysts could drive re-rating.`,
      recommendation: score > 7 ? "BUY" : "ACCUMULATE",
      confidence: Math.min(0.95, 0.5 + score / 20),
    };
    const bearish = {
      analysis: score < 5
        ? `${data.symbol} faces headwinds with a score of ${score.toFixed(1)}/10. Weak sentiment and deteriorating technicals suggest continued downside pressure. Risk/reward is unfavorable at current valuations.`
        : `Despite an average score, ${data.symbol} faces near-term risks. Macro headwinds and potential earnings misses could pressure the stock. Wait for better entry point.`,
      recommendation: score < 5 ? "SELL" : "REDUCE",
      confidence: Math.min(0.85, 0.4 + (10 - score) / 20),
    };
    const neutral = {
      analysis: `${data.symbol} scores ${score.toFixed(1)}/10 reflecting balanced risk/reward. Bulls point to ${data.signalType?.toLowerCase() || "improving"} signals while bears highlight macro uncertainties. Key catalyst: next earnings report and institutional flow developments.`,
      recommendation: "HOLD",
      confidence: 0.6,
    };
    return { bullish, bearish, neutral };
  }

  async analyzeStock(data: {
    symbol: string; finalScore: number; anomalyScore: number;
    fundamental: number; technical: number; sentiment: number;
    signalType: string; drivers: string[];
  }) {
    const cacheKey = `ai_analysis_${data.symbol}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const hasOpenAI = !!this.config.get("OPENAI_API_KEY");
    let result;

    if (hasOpenAI) {
      const [bullishText, bearishText, neutralText] = await Promise.all([
        this.callGPT(BULLISH_PROMPT(data)),
        this.callGPT(BEARISH_PROMPT(data)),
        this.callGPT(NEUTRAL_PROMPT(data)),
      ]);
      result = {
        bullish: { analysis: bullishText, recommendation: "BUY", confidence: 0.75 + data.finalScore / 40 },
        bearish: { analysis: bearishText, recommendation: "SELL", confidence: 0.5 },
        neutral: { analysis: neutralText, recommendation: "HOLD", confidence: 0.65 },
        poweredBy: "GPT-4o-mini",
      };
    } else {
      result = { ...this.ruleBasedAnalysis(data), poweredBy: "Rule-based engine" };
    }

    await this.cache.set(cacheKey, result, 7200); // 2h cache
    return result;
  }
}
