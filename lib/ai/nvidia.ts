import OpenAI from 'openai'

/**
 * NVIDIA NIM is OpenAI-compatible, so we drive it through the official OpenAI
 * SDK pointed at NVIDIA's base URL. The key is server-only (no NEXT_PUBLIC_
 * prefix) and must never reach the browser — only call this from API routes.
 */

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiConfigError'
  }
}

const BASE_URL =
  process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'
const MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct'

let client: OpenAI | null = null

function getClient(): OpenAI {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) {
    throw new AiConfigError('NVIDIA_API_KEY is not configured')
  }
  if (!client) {
    client = new OpenAI({ apiKey, baseURL: BASE_URL })
  }
  return client
}

/** Pulls the first balanced JSON object out of a model response. */
function extractJson(text: string): unknown {
  const trimmed = text.trim()
  // Strip ```json fences if present.
  const unfenced = trimmed
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
  try {
    return JSON.parse(unfenced)
  } catch {
    const start = unfenced.indexOf('{')
    const end = unfenced.lastIndexOf('}')
    if (start !== -1 && end > start) {
      return JSON.parse(unfenced.slice(start, end + 1))
    }
    throw new Error('Model did not return valid JSON')
  }
}

/**
 * Sends a system + user prompt and parses the reply as a JSON object of type T.
 * Asks the model for JSON via response_format and re-parses defensively.
 */
export async function chatJson<T>(
  system: string,
  user: string,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<T> {
  const openai = getClient()
  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 1200,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  })

  const content = completion.choices[0]?.message?.content ?? ''
  if (!content) {
    throw new Error('Empty response from model')
  }
  return extractJson(content) as T
}
