/**
 * Predefined public data sources for the Utility Price Predictor.
 *
 * Each source is fetched server-side (best effort, short timeout). Live Sri
 * Lankan government / utility pages are HTML and change often, so a failed
 * fetch is non-fatal: we record it as unavailable and still let the model
 * reason from whatever did load plus the `context` anchor describing the
 * typical billing structure.
 */

export interface UtilitySource {
  key: string
  label: string
  url: string
  /** Background the model can rely on when the live fetch is thin or fails. */
  context: string
}

export const UTILITY_SOURCES: UtilitySource[] = [
  {
    key: 'electricity',
    label: 'Electricity (CEB)',
    url: 'https://www.ceb.lk/',
    context:
      'Ceylon Electricity Board domestic tariff is block-based: low usage (0-60 units) is heavily subsidised, higher blocks cost much more per unit plus a fixed monthly charge. Tariffs are revised by the PUCSL.'
  },
  {
    key: 'fuel',
    label: 'Fuel / Oil (Ceypetco)',
    url: 'https://ceypetco.gov.lk/marketing-sales/',
    context:
      'Ceylon Petroleum Corporation revises Petrol 92/95, Auto Diesel and Super Diesel prices roughly monthly, tracking global crude oil and the USD/LKR rate.'
  },
  {
    key: 'water',
    label: 'Water (NWSDB)',
    url: 'https://www.waterboard.lk/',
    context:
      'National Water Supply & Drainage Board bills domestic water on a rising block tariff by units (cubic metres) consumed plus a fixed service charge.'
  },
  {
    key: 'fx',
    label: 'USD/LKR exchange rate',
    url: 'https://open.er-api.com/v6/latest/USD',
    context:
      'The USD/LKR rate drives import-linked costs (fuel, gas, many goods). A weaker rupee pushes utility and fuel prices up.'
  }
]

/** Naive HTML -> text: drop scripts/styles/tags, collapse whitespace. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface FetchedSource {
  key: string
  label: string
  url: string
  context: string
  available: boolean
  excerpt: string
}

/** Fetches one source with a hard timeout; never throws. */
async function fetchOne(
  source: UtilitySource,
  timeoutMs: number
): Promise<FetchedSource> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'NovaBank-UtilityPredictor/1.0' },
      cache: 'no-store'
    })
    if (!res.ok) {
      return { ...source, available: false, excerpt: '' }
    }
    const body = await res.text()
    const isJson = (res.headers.get('content-type') || '').includes('json')
    const text = isJson ? body : htmlToText(body)
    return {
      ...source,
      available: text.length > 0,
      excerpt: text.slice(0, 1800)
    }
  } catch {
    return { ...source, available: false, excerpt: '' }
  } finally {
    clearTimeout(timer)
  }
}

/** Fetches every predefined source in parallel. */
export function fetchUtilitySources(
  timeoutMs = 8000
): Promise<FetchedSource[]> {
  return Promise.all(UTILITY_SOURCES.map((s) => fetchOne(s, timeoutMs)))
}
