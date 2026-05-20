# QuantGoeuryInvestments — LLM Prompts Reference

This file documents all AI prompts used in the platform. These run via `AiService` against OpenAI GPT-4o-mini (or fall back to rule-based analysis).

---

## Multi-Agent Stock Analysis

Three analyst perspectives are generated in parallel for every stock analysis request.

### Bullish Analyst Prompt

```
You are a bullish equity analyst. Given this data about {symbol}:
- Score: {finalScore}/10, Anomaly: {anomalyScore}/10
- Fundamental: {fundamental}, Technical: {technical}, Sentiment: {sentiment}
- Signal: {signalType}, Drivers: {drivers}

Write a concise 3-sentence bullish case. Be specific. 
End with a Buy recommendation and price target rationale.
```

**Expected output**: 3 sentences + "Recommendation: BUY"

---

### Bearish Analyst Prompt

```
You are a bearish equity analyst. Given this data about {symbol}:
- Score: {finalScore}/10, Anomaly: {anomalyScore}/10
- Fundamental: {fundamental}, Technical: {technical}, Sentiment: {sentiment}
- Signal: {signalType}, Drivers: {drivers}

Write a concise 3-sentence bearish case. Highlight risks and contradictions.
End with a Sell/Reduce recommendation.
```

**Expected output**: 3 sentences + "Recommendation: SELL" or "REDUCE"

---

### Neutral Analyst Prompt

```
You are a neutral equity analyst. Given this data about {symbol}:
- Score: {finalScore}/10, Anomaly: {anomalyScore}/10
- Fundamental: {fundamental}, Technical: {technical}, Sentiment: {sentiment}
- Signal: {signalType}

Write a balanced 3-sentence assessment. Weigh both sides.
End with a Hold recommendation and key catalysts to watch.
```

**Expected output**: 3 sentences + "Recommendation: HOLD"

---

## Rule-Based Fallback (No API Key)

When `OPENAI_API_KEY` is not set, the `AiService` generates deterministic analysis based on the numeric score:

| Score range | Bullish rec | Bearish rec | Neutral rec |
|-------------|------------|------------|-------------|
| ≥ 7.0 | BUY | REDUCE | HOLD |
| 5.0 – 6.9 | ACCUMULATE | REDUCE | HOLD |
| < 5.0 | ACCUMULATE | SELL | HOLD |

Confidence is derived from `0.5 + score/20` (capped at 0.95).

---

## Caching

All AI responses are cached in-process for **1 hour** per symbol to minimize API costs.

Estimated cost with GPT-4o-mini:
- ~200 tokens per analyst × 3 analysts = ~600 tokens/request
- At $0.15/1M tokens = $0.00009/request
- 100 analyses/day = ~$0.009/day = ~$0.27/month

---

## Extension Points

To add a new analyst persona, duplicate a prompt function in `backend/src/ai/ai.service.ts` and add a new parallel call in `analyzeStock()`. The multi-agent framework supports any number of perspectives.

To switch to a different LLM provider (Anthropic, Mistral, local Ollama), replace the `callGPT()` method — the rest of the service is provider-agnostic.
