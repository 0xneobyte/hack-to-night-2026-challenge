import { AiConfigError, chatJson } from '@/lib/ai/nvidia'
import type { PredictorResult } from '@/lib/ai/types'
import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'
import { fetchUtilitySources } from '@/lib/utility-sources'

export const maxDuration = 60

const SYSTEM_PROMPT = `You are a Sri Lankan household utility cost analyst. Currency is LKR ("Rs.").
You receive recent text scraped from official utility sources (electricity, fuel, water) and the live USD/LKR rate.
For each utility, estimate the current typical monthly cost for an average household and predict the near-term
(next 1-2 months) direction and percentage change, with brief reasoning grounded in the data provided.
Then produce a practical monthly budgeting plan to manage the impact.
Respond ONLY with a JSON object matching exactly this TypeScript type:
{
  "predictions": {
    "utility": string,
    "current_estimate": string,          // e.g. "Rs. 4,500 / month"
    "predicted_change_pct": number,      // signed, e.g. -3.5 or 8
    "direction": "up"|"down"|"stable",
    "confidence": "low"|"medium"|"high",
    "reasoning": string,
    "source_available": boolean
  }[],
  "budget_plan": {
    "summary": string,
    "monthly_actions": string[],
    "estimated_monthly_impact": string
  }
}
Keep reasoning to one or two sentences. Provide one prediction per utility (electricity, fuel, water).`

export async function GET() {
  try {
    // Require an authenticated session — the page sits behind the app shell.
    const supabase = await createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) {
      return apiError('Unauthorized', 401)
    }

    const sources = await fetchUtilitySources()

    const userPrompt = JSON.stringify({
      today: new Date().toISOString().slice(0, 10),
      sources: sources.map((s) => ({
        utility: s.label,
        available: s.available,
        background: s.context,
        scraped_excerpt: s.excerpt
      }))
    })

    let ai: Omit<PredictorResult, 'generated_at' | 'sources_used'>
    try {
      ai = await chatJson<
        Omit<PredictorResult, 'generated_at' | 'sources_used'>
      >(SYSTEM_PROMPT, userPrompt, { maxTokens: 1600, temperature: 0.3 })
    } catch (err) {
      if (err instanceof AiConfigError) {
        return apiError('AI is not configured on the server', 503)
      }
      return serverError(err)
    }

    const result: PredictorResult = {
      ...ai,
      generated_at: new Date().toISOString(),
      sources: sources.map((s) => ({
        label: s.label,
        url: s.url,
        available: s.available
      }))
    }

    return apiSuccess<PredictorResult>(result)
  } catch (reason) {
    return serverError(reason)
  }
}
