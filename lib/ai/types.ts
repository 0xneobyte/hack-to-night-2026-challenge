/** Shared shapes for the Smart Spend AI features (insights + predictor). */

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface SpendingAlert {
  severity: AlertSeverity
  title: string
  message: string
}

export interface SpendingCategory {
  name: string
  amount: number
  percentage: number
}

export interface InsightsResult {
  headline: string
  summary: string
  totals: {
    inflow: number
    outflow: number
    net: number
  }
  categories: SpendingCategory[]
  insights: string[]
  alerts: SpendingAlert[]
  budget_tips: string[]
  /** What was fed to the model — shown to the user for transparency. */
  analyzed: {
    transactions: number
    accounts: number
    endpoint: string
  }
}

export type PriceDirection = 'up' | 'down' | 'stable'

export interface UtilityPrediction {
  utility: string
  current_estimate: string
  predicted_change_pct: number
  direction: PriceDirection
  confidence: 'low' | 'medium' | 'high'
  reasoning: string
  source_available: boolean
}

export interface BudgetPlan {
  summary: string
  monthly_actions: string[]
  estimated_monthly_impact: string
}

/** A data-source endpoint the predictor pulled from, with its fetch outcome. */
export interface PredictorSource {
  label: string
  url: string
  available: boolean
}

export interface PredictorResult {
  predictions: UtilityPrediction[]
  budget_plan: BudgetPlan
  generated_at: string
  sources: PredictorSource[]
}
