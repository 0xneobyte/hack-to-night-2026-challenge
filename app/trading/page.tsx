'use client'

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ClockIcon,
  HistoryIcon,
  RefreshCwIcon,
  SearchIcon,
  ShoppingCartIcon,
  TagIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  WalletIcon
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  formatCompactVolume,
  formatLKR,
  formatLKRCompact,
  formatNumber,
  formatPercent,
  formatTradeTime
} from '@/lib/trading-format'

// ---------------------------------------------------------------------------
// Local shapes (mirror /lib/types.ts but kept inline so the page file is
// self-contained and easy to review).
// ---------------------------------------------------------------------------

interface SharePrice {
  id: number
  symbol: string
  open: number
  high: number
  low: number
  lastTradedPrice: number
  change: number
  changePercentage: number
  crossingVolume: number
  tradesTime: number
  quantity: number
}

interface Mover {
  id: number
  symbol: string
  price: number
  change: number
  changePercentage: number
  tradeDate: number
}

interface MarketSummary {
  summary: {
    tradeVolume: number
    shareVolume: number
    trades: number
    tradeDate: number | null
  } | null
  aspi: {
    value: number
    lowValue: number
    highValue: number
    change: number
    percentage: number
    timestamp: number | null
  } | null
  marketOpen: boolean
  status: {
    session: 'PRE_OPEN' | 'OPEN' | 'CLOSED' | 'AFTER_HOURS'
    isOpen: boolean
    label: 'Open' | 'Pre-Open' | 'Closed' | 'After Hours'
    colomboTime: string
    colomboDayOfWeek: number
    colomboHourDecimal: number
    reason?: 'WEEKEND' | 'BEFORE_OPEN' | 'AFTER_CLOSE' | 'FORCED_CLOSED'
    nextOpenAt: string | null
  }
}

interface Holding {
  id: number
  symbol: string
  quantity: number
  avg_price: number
  updated_at: string
}

interface Trade {
  id: number
  symbol: string
  side: 'BUY' | 'SELL'
  price: number
  quantity: number
  total: number
  created_at: string
}

interface Portfolio {
  balance: { balance: number }
  holdings: Holding[]
  trades: Trade[]
  seedAmount: number
}

const REFRESH_INTERVAL_MS = 30_000 // 30 seconds

// ---------------------------------------------------------------------------
// usePriceFlash — returns a CSS class that flashes green/red whenever the
// value changes between renders. Used on every live price in the UI so a
// refresh produces a subtle visual cue rather than a silent text swap.
// ---------------------------------------------------------------------------
function usePriceFlash(value: number | null | undefined): string {
  const prevRef = useRef<number | null | undefined>(value)
  const [flash, setFlash] = useState<'nb-flash-up' | 'nb-flash-down' | ''>('')

  useEffect(() => {
    if (
      value !== prevRef.current &&
      typeof value === 'number' &&
      typeof prevRef.current === 'number'
    ) {
      setFlash(value > prevRef.current ? 'nb-flash-up' : 'nb-flash-down')
      const id = setTimeout(() => setFlash(''), 900)
      prevRef.current = value
      return () => clearTimeout(id)
    }
    prevRef.current = value
  }, [value])

  return flash
}

/**
 * Formats a duration in ms as "3h 12m" or "12m 30s" or "in 45s".
 * Used to render "Opens in 3h 12m" next to the closed market badge.
 */
function formatDuration(ms: number): string {
  if (ms <= 0) return 'soon'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/** Formats the Asia/Colombo wall-clock time as "10:45 AM". */
function formatColomboClock(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Colombo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

export default function TradingPage() {
  // --- Market data state ----------------------------------------------------
  const [summary, setSummary] = useState<MarketSummary | null>(null)
  const [prices, setPrices] = useState<SharePrice[]>([])
  const [gainers, setGainers] = useState<Mover[]>([])
  const [losers, setLosers] = useState<Mover[]>([])
  const [marketLoading, setMarketLoading] = useState(true)
  const [marketError, setMarketError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [search, setSearch] = useState('')

  // --- Live ticking Colombo clock (updates every second) --------------------
  // Drives the "now" display in the hero and the "opens in" countdown.
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // --- Portfolio state ------------------------------------------------------
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [portfolioLoading, setPortfolioLoading] = useState(true)

  // --- Bank accounts state (real Nova Bank balance) -------------------------
  interface BankAccount {
    id: number
    account_number: string
    account_name: string
    balance: number
  }
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [bankLoading, setBankLoading] = useState(true)

  // --- Trade sheet state ----------------------------------------------------
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<'BUY' | 'SELL'>('BUY')
  const [sheetStock, setSheetStock] = useState<SharePrice | null>(null)
  const [orderQty, setOrderQty] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ==========================================================================
  // Data fetching
  // ==========================================================================

  const loadMarketData = useCallback(async (silent = false) => {
    if (!silent) setMarketLoading(true)
    try {
      const [sumRes, pricesRes, gainersRes, losersRes] = await Promise.all([
        fetch('/api/cse/market-summary'),
        fetch('/api/cse/share-prices'),
        fetch('/api/cse/top-gainers'),
        fetch('/api/cse/top-losers')
      ])

      const sumJson = await sumRes.json()
      const pricesJson = await pricesRes.json()
      const gainersJson = await gainersRes.json()
      const losersJson = await losersRes.json()

      if (sumJson.ok) setSummary(sumJson.data)
      if (pricesJson.ok) setPrices(pricesJson.data.prices)
      if (gainersJson.ok) setGainers(gainersJson.data.gainers)
      if (losersJson.ok) setLosers(losersJson.data.losers)

      setLastUpdated(new Date())
      setMarketError(null)
    } catch (err) {
      console.error('Failed to load market data', err)
      setMarketError('Unable to reach the CSE market data feed. Retrying…')
    } finally {
      setMarketLoading(false)
    }
  }, [])

  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true)
    try {
      const res = await fetch('/api/demo/portfolio')
      const json = await res.json()
      if (json.ok) setPortfolio(json.data)
    } catch (err) {
      console.error('Failed to load portfolio', err)
      toast.error('Could not load your portfolio')
    } finally {
      setPortfolioLoading(false)
    }
  }, [])

  const loadBankAccounts = useCallback(async () => {
    setBankLoading(true)
    try {
      const res = await fetch('/api/accounts')
      const json = await res.json()
      if (json.ok) {
        const accs = json.data?.accounts ?? json.accounts ?? []
        setBankAccounts(accs)
      }
    } catch (err) {
      console.error('Failed to load bank accounts', err)
    } finally {
      setBankLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMarketData()
    loadPortfolio()
    loadBankAccounts()
    const id = setInterval(() => loadMarketData(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [loadMarketData, loadPortfolio, loadBankAccounts])

  // ==========================================================================
  // Trade sheet handlers
  // ==========================================================================

  function openBuySheet(stock: SharePrice) {
    setSheetMode('BUY')
    setSheetStock(stock)
    setOrderQty('')
    setSheetOpen(true)
  }

  function openSellSheet(stock: SharePrice) {
    setSheetMode('SELL')
    setSheetStock(stock)
    setOrderQty('')
    setSheetOpen(true)
  }

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!sheetStock) return

    const qty = Number(orderQty)
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error('Quantity must be a positive integer')
      return
    }

    const endpoint = sheetMode === 'BUY' ? '/api/demo/buy' : '/api/demo/sell'
    setSubmitting(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: sheetStock.symbol,
          price: sheetStock.lastTradedPrice,
          quantity: qty
        })
      })
      const json = await res.json()

      if (json.ok) {
        toast.success(json.data.message, {
          description: `New balance: ${formatLKR(json.data.new_balance)}`
        })
        setSheetOpen(false)
        // Refresh portfolio so the user sees their updated balance and holdings.
        await loadPortfolio()
      } else {
        toast.error(json.message || 'Order failed')
      }
    } catch (err) {
      console.error('Order submission failed', err)
      toast.error('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  // ==========================================================================
  // Derived values
  // ==========================================================================

  const filteredPrices = useMemo(() => {
    const q = search.trim().toUpperCase()
    if (!q) return prices
    return prices.filter(
      (p) =>
        p.symbol.toUpperCase().includes(q) ||
        p.lastTradedPrice.toString().includes(q)
    )
  }, [prices, search])

  const holdingsBySymbol = useMemo(() => {
    const map = new Map<string, Holding>()
    for (const h of portfolio?.holdings ?? []) {
      map.set(h.symbol, h)
    }
    return map
  }, [portfolio])

  // Seed amount used as the cash-balance fallback before the user has
  // made their first trade. Sourced from the API response so there's a
  // single source of truth (matches `seedAmount` in /api/demo/portfolio).
  const SEED_AMOUNT = portfolio?.seedAmount ?? 1000000

  const portfolioValue = useMemo(() => {
    if (!portfolio) return SEED_AMOUNT
    const holdingsValue = (portfolio.holdings ?? []).reduce((sum, h) => {
      const live = prices.find((p) => p.symbol === h.symbol)
      const price = live?.lastTradedPrice ?? h.avg_price
      return sum + price * h.quantity
    }, 0)
    return (portfolio.balance?.balance ?? SEED_AMOUNT) + holdingsValue
  }, [portfolio, prices, SEED_AMOUNT])

  // Effective cash balance — falls back to the seed amount before the
  // first trade so the UI never flashes Rs. 0.00 while data resolves.
  const effectiveCashBalance = portfolio?.balance?.balance ?? SEED_AMOUNT

  // Total real Nova Bank balance across all the user's accounts.
  // Used in the hero KPI tile to show the user's actual bank balance
  // (separate from the demo trading virtual cash).
  const totalBankBalance = useMemo(
    () =>
      (bankAccounts ?? []).reduce((sum, a) => sum + Number(a.balance || 0), 0),
    [bankAccounts]
  )

  const totalPnl = useMemo(() => {
    if (!portfolio) return 0
    return portfolioValue - portfolio.seedAmount
  }, [portfolio, portfolioValue])

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)'
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4">
          {/* ---------------- Premium Hero ---------------- */}
          <section className="bg-card border-b">
            <div className="px-4 py-6 md:px-8 md:py-8 flex flex-col gap-5">
              {/* Top row: brand + live clock + refresh */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-playfair">
                    Stock Trading
                  </h1>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Demo trading with virtual LKR · Live Colombo Stock Exchange
                    feed
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur px-3 py-1.5 text-xs text-muted-foreground">
                    <ClockIcon className="size-3.5" />
                    <span className="tabular-nums">
                      {formatColomboClock(now.toISOString())}{' '}
                      <span className="text-muted-foreground/70">CSE</span>
                    </span>
                  </div>
                  {lastUpdated && (
                    <span className="hidden md:inline text-xs text-muted-foreground">
                      Updated {formatTradeTime(lastUpdated.getTime())}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadMarketData()}
                    disabled={marketLoading}
                  >
                    <RefreshCwIcon
                      className={`size-4 ${marketLoading ? 'animate-spin' : ''}`}
                    />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Market Pulse Row: market-status badge + ASPI + portfolio KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MarketPulseCard
                  label="Market Status"
                  loading={marketLoading && !summary}
                  colomboTime={summary?.status?.colomboTime}
                  session={summary?.status?.session}
                  label2={summary?.status?.label}
                  isOpen={summary?.status?.isOpen}
                  nextOpenAt={summary?.status?.nextOpenAt}
                  now={now}
                  sub={
                    summary?.summary
                      ? `${summary.summary.trades.toLocaleString()} trades today`
                      : 'No trades reported'
                  }
                />

                <AspiPulseCard
                  loading={marketLoading && !summary}
                  aspi={summary?.aspi}
                />

                <KpiPulseCard
                  label="Bank Balance"
                  loading={bankLoading && bankAccounts.length === 0}
                  value={formatLKR(totalBankBalance)}
                  accentClass="font-playfair"
                  sub={
                    <span className="text-muted-foreground">
                      {bankAccounts.length === 0
                        ? 'No bank accounts'
                        : `${bankAccounts.length} ${bankAccounts.length === 1 ? 'account' : 'accounts'}`}
                    </span>
                  }
                  footer={
                    <Badge variant="outline" className="gap-1">
                      <WalletIcon className="size-3" />
                      Nova Bank
                    </Badge>
                  }
                />

                <KpiPulseCard
                  label="Holdings"
                  loading={portfolioLoading && !portfolio}
                  value={String(portfolio?.holdings.length ?? 0)}
                  accentClass="font-playfair"
                  sub={
                    <span className="text-muted-foreground">
                      Trade volume{' '}
                      {summary?.summary
                        ? formatCompactVolume(summary.summary.tradeVolume)
                        : '—'}
                    </span>
                  }
                  footer={<Badge variant="outline">symbols</Badge>}
                />
              </div>
            </div>
          </section>

          {/* Main body wrapper gets its own padding so the hero can bleed full-width */}
          <div className="px-4 md:px-6 pb-6 flex flex-col gap-4">
            {/* Market status banner */}
            {marketError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {marketError}
              </div>
            )}

            {/* Main content tabs */}
            <Tabs defaultValue="market" className="gap-4">
              <TabsList>
                <TabsTrigger value="market">
                  <TrendingUpIcon className="size-4" />
                  Market
                </TabsTrigger>
                <TabsTrigger value="portfolio">
                  <WalletIcon className="size-4" />
                  My Portfolio
                </TabsTrigger>
                <TabsTrigger value="history">
                  <HistoryIcon className="size-4" />
                  Trade History
                </TabsTrigger>
              </TabsList>

              {/* ---------------- Market tab ---------------- */}
              <TabsContent value="market" className="flex flex-col gap-4">
                {/* Top movers row */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <TopMoversCard
                    title="Top Gainers"
                    icon={
                      <TrendingUpIcon className="size-4 text-emerald-600" />
                    }
                    movers={gainers}
                    loading={marketLoading}
                    onTrade={openBuySheet}
                    emptyMessage="No gainers reported today"
                  />
                  <TopMoversCard
                    title="Top Losers"
                    icon={
                      <TrendingDownIcon className="size-4 text-destructive" />
                    }
                    movers={losers}
                    loading={marketLoading}
                    onTrade={openBuySheet}
                    emptyMessage="No losers reported today"
                  />
                </div>

                {/* Full share price table */}
                <Card>
                  <CardHeader>
                    <CardTitle>All Shares</CardTitle>
                    <CardDescription>
                      Live prices for every listed CSE symbol
                    </CardDescription>
                    <CardAction>
                      <div className="relative">
                        <SearchIcon className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search symbol…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="pl-8 w-48"
                        />
                      </div>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="px-0">
                    {marketLoading ? (
                      <div className="px-6 pb-6 space-y-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <Skeleton key={i} className="h-10 w-full" />
                        ))}
                      </div>
                    ) : (
                      <div className="max-h-[28rem] overflow-y-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-card">
                            <TableRow>
                              <TableHead>Symbol</TableHead>
                              <TableHead className="text-right">
                                Price
                              </TableHead>
                              <TableHead className="text-right">
                                Change
                              </TableHead>
                              <TableHead className="text-right hidden sm:table-cell">
                                Volume
                              </TableHead>
                              <TableHead className="text-right">
                                Action
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredPrices.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={5}
                                  className="text-center text-muted-foreground py-8"
                                >
                                  No shares match your search
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredPrices.map((p) => {
                                const up = p.change >= 0
                                return (
                                  <TableRow key={p.id}>
                                    <TableCell className="font-medium">
                                      {p.symbol}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {formatNumber(p.lastTradedPrice)}
                                    </TableCell>
                                    <TableCell
                                      className={`text-right tabular-nums ${
                                        up
                                          ? 'text-emerald-600'
                                          : 'text-destructive'
                                      }`}
                                    >
                                      {up ? (
                                        <ArrowUpIcon className="inline size-3" />
                                      ) : (
                                        <ArrowDownIcon className="inline size-3" />
                                      )}
                                      {formatPercent(p.changePercentage)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums hidden sm:table-cell text-muted-foreground">
                                      {formatCompactVolume(p.crossingVolume)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-1">
                                        <Button
                                          size="sm"
                                          variant="default"
                                          onClick={() => openBuySheet(p)}
                                        >
                                          Buy
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => openSellSheet(p)}
                                          disabled={
                                            !holdingsBySymbol.has(p.symbol)
                                          }
                                        >
                                          Sell
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ---------------- Portfolio tab ---------------- */}
              <TabsContent value="portfolio">
                <Card>
                  <CardHeader>
                    <CardTitle>Your Holdings</CardTitle>
                    <CardDescription>
                      Live-valued positions in your demo portfolio
                    </CardDescription>
                    <CardAction>
                      <Badge variant="outline">
                        Cash {formatLKRCompact(effectiveCashBalance)}
                      </Badge>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="px-0">
                    {portfolioLoading ? (
                      <div className="px-6 pb-6 space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : (portfolio?.holdings ?? []).length === 0 ? (
                      <div className="px-6 pb-10 text-center text-muted-foreground">
                        You don&apos;t own any shares yet. Switch to the Market
                        tab to place your first buy order.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Symbol</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">
                              Avg Cost
                            </TableHead>
                            <TableHead className="text-right">Last</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                            <TableHead className="text-right">P/L</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(portfolio?.holdings ?? []).map((h) => {
                            const live = prices.find(
                              (p) => p.symbol === h.symbol
                            )
                            const last = live?.lastTradedPrice ?? h.avg_price
                            const value = last * h.quantity
                            const cost = h.avg_price * h.quantity
                            const pnl = value - cost
                            const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
                            return (
                              <TableRow key={h.id}>
                                <TableCell className="font-medium">
                                  {h.symbol}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {h.quantity.toLocaleString('en-LK')}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatNumber(h.avg_price)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatNumber(last)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatLKRCompact(value)}
                                </TableCell>
                                <TableCell
                                  className={`text-right tabular-nums ${
                                    pnl >= 0
                                      ? 'text-emerald-600'
                                      : 'text-destructive'
                                  }`}
                                >
                                  {pnl >= 0 ? '+' : ''}
                                  {formatLKRCompact(pnl)}
                                  <span className="block text-xs">
                                    {formatPercent(pnlPct)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      openSellSheet(
                                        live ?? {
                                          id: h.id,
                                          symbol: h.symbol,
                                          open: h.avg_price,
                                          high: h.avg_price,
                                          low: h.avg_price,
                                          lastTradedPrice: h.avg_price,
                                          change: 0,
                                          changePercentage: 0,
                                          crossingVolume: 0,
                                          tradesTime: 0,
                                          quantity: 0
                                        }
                                      )
                                    }
                                  >
                                    Sell
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ---------------- Trade History tab ---------------- */}
              <TabsContent value="history">
                <Card>
                  <CardHeader>
                    <CardTitle>Trade History</CardTitle>
                    <CardDescription>
                      Most recent 50 demo trades
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-0">
                    {portfolioLoading ? (
                      <div className="px-6 pb-6 space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : (portfolio?.trades ?? []).length === 0 ? (
                      <div className="px-6 pb-10 text-center text-muted-foreground">
                        No trades yet — your order log will appear here.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>When</TableHead>
                            <TableHead>Symbol</TableHead>
                            <TableHead>Side</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(portfolio?.trades ?? []).map((t) => (
                            <TableRow key={t.id}>
                              <TableCell className="text-muted-foreground text-xs">
                                {new Date(t.created_at).toLocaleString(
                                  'en-GB',
                                  {
                                    dateStyle: 'short',
                                    timeStyle: 'short'
                                  }
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                {t.symbol}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    t.side === 'BUY'
                                      ? 'text-emerald-600'
                                      : 'text-destructive'
                                  }
                                >
                                  {t.side}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {t.quantity.toLocaleString('en-LK')}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatNumber(t.price)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                {formatLKR(t.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SidebarInset>

      {/* ---------------- Trade Sheet — premium side panel ---------------- */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(v) => {
          setSheetOpen(v)
          if (!v) setSheetStock(null)
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 gap-0 flex flex-col"
        >
          {/* Header band — coloured by mode for instant visual context */}
          <div
            className={`px-6 pt-6 pb-5 border-b ${
              sheetMode === 'BUY'
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-destructive/10 border-destructive/20'
            }`}
          >
            <SheetHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-10 items-center justify-center rounded-xl text-white shadow-md ${
                      sheetMode === 'BUY' ? 'bg-emerald-600' : 'bg-destructive'
                    }`}
                  >
                    {sheetMode === 'BUY' ? (
                      <ShoppingCartIcon className="size-5" />
                    ) : (
                      <TagIcon className="size-5" />
                    )}
                  </div>
                  <div>
                    <SheetTitle className="text-lg font-semibold tracking-tight">
                      {sheetMode === 'BUY' ? 'Buy' : 'Sell'} Order
                    </SheetTitle>
                    <SheetDescription className="text-xs">
                      {sheetStock?.symbol ?? ''} · Live CSE market price
                    </SheetDescription>
                  </div>
                </div>
              </div>
            </SheetHeader>
          </div>

          {sheetStock && (
            <form
              onSubmit={handleSubmitOrder}
              className="flex flex-1 flex-col overflow-y-auto"
            >
              {/* Stock summary — large symbol + price block */}
              <div className="px-6 py-5 border-b">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Symbol
                    </p>
                    <p className="text-2xl font-bold font-playfair tabular-nums">
                      {sheetStock.symbol}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Last Price
                    </p>
                    <p className="text-2xl font-bold font-playfair tabular-nums">
                      {formatNumber(sheetStock.lastTradedPrice)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`gap-0.5 ${
                      sheetStock.change >= 0
                        ? 'text-emerald-600 border-emerald-500/30'
                        : 'text-destructive border-destructive/30'
                    }`}
                  >
                    {sheetStock.change >= 0 ? (
                      <ArrowUpIcon className="size-3" />
                    ) : (
                      <ArrowDownIcon className="size-3" />
                    )}
                    {formatPercent(sheetStock.changePercentage)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Day change
                  </span>
                  {sheetMode === 'SELL' &&
                    holdingsBySymbol.has(sheetStock.symbol) && (
                      <Badge variant="outline" className="ml-auto gap-1">
                        You own{' '}
                        {holdingsBySymbol
                          .get(sheetStock.symbol)!
                          .quantity.toLocaleString('en-LK')}
                      </Badge>
                    )}
                </div>
              </div>

              {/* Quantity input — large + quick-pick chips */}
              <div className="px-6 py-5 border-b">
                <Label
                  htmlFor="qty"
                  className="text-xs uppercase tracking-wide text-muted-foreground mb-2"
                >
                  Quantity
                </Label>
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  step={1}
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  placeholder="0"
                  required
                  autoFocus
                  className="h-14 text-2xl font-semibold tabular-nums text-center font-playfair"
                />
                <div className="mt-3 flex gap-2">
                  {[10, 50, 100, 500].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setOrderQty(String(n))}
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order summary — sticky-feeling block */}
              <div className="px-6 py-5 bg-muted/30 border-b">
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Price per share
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatLKR(sheetStock.lastTradedPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantity</span>
                    <span className="font-medium tabular-nums">
                      {(Number(orderQty) || 0).toLocaleString('en-LK')}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2.5 mt-2.5">
                    <span className="font-medium">Estimated Total</span>
                    <span className="font-semibold tabular-nums">
                      {formatLKR(
                        (Number(orderQty) || 0) * sheetStock.lastTradedPrice
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Cash After Order
                    </span>
                    <span
                      className={`font-medium tabular-nums ${
                        sheetMode === 'BUY' &&
                        effectiveCashBalance -
                          (Number(orderQty) || 0) * sheetStock.lastTradedPrice <
                          0
                          ? 'text-destructive'
                          : ''
                      }`}
                    >
                      {formatLKR(
                        sheetMode === 'BUY'
                          ? effectiveCashBalance -
                              (Number(orderQty) || 0) *
                                sheetStock.lastTradedPrice
                          : effectiveCashBalance +
                              (Number(orderQty) || 0) *
                                sheetStock.lastTradedPrice
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer — sticky action buttons */}
              <SheetFooter className="mt-auto px-6 py-4 bg-background border-t flex-row gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => setSheetOpen(false)}
                  disabled={submitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  variant={sheetMode === 'BUY' ? 'default' : 'destructive'}
                  disabled={submitting}
                  className="flex-[2]"
                >
                  {submitting
                    ? 'Placing order…'
                    : `${sheetMode === 'BUY' ? 'Buy' : 'Sell'} ${sheetStock.symbol}`}
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: MarketPulseCard — the pulsing Open/Closed badge card.
// Renders a coloured dot with a ping ring when the market is open, plus
// a live countdown to the next open session when closed.
// ---------------------------------------------------------------------------

interface MarketPulseCardProps {
  label: string
  loading: boolean
  colomboTime?: string
  session?: 'PRE_OPEN' | 'OPEN' | 'CLOSED' | 'AFTER_HOURS'
  label2?: 'Open' | 'Pre-Open' | 'Closed' | 'After Hours'
  isOpen?: boolean
  nextOpenAt?: string | null
  now: Date
  sub: string
}

function MarketPulseCard({
  label,
  loading,
  colomboTime,
  session,
  label2,
  isOpen,
  nextOpenAt,
  now,
  sub
}: MarketPulseCardProps) {
  const open = isOpen ?? false
  const dotClass = open
    ? 'bg-emerald-500'
    : session === 'PRE_OPEN'
      ? 'bg-amber-500'
      : 'bg-muted-foreground'

  // Compute the "Opens in …" countdown string.
  let countdown: string | null = null
  if (!open && nextOpenAt) {
    const target = new Date(nextOpenAt).getTime()
    const ms = target - now.getTime()
    if (ms > 0) countdown = `Opens in ${formatDuration(ms)}`
  }

  return (
    <div className="rounded-2xl bg-card/80 backdrop-blur border border-border/60 p-4 flex flex-col gap-2 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          CSE
        </Badge>
      </div>
      {loading ? (
        <>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-20" />
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="relative inline-flex">
              <span
                className={`nb-pulse-dot inline-flex size-2.5 rounded-full ${dotClass}`}
              />
              {open && (
                <span
                  className={`nb-pulse-ring absolute inline-flex size-2.5 rounded-full ${dotClass}`}
                />
              )}
            </span>
            <span className="text-lg font-semibold font-playfair">
              {label2 ?? (open ? 'Open' : 'Closed')}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {colomboTime ? formatColomboClock(colomboTime) : '—'} LK
            {countdown && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                · {countdown}
              </span>
            )}
          </span>
          <span className="text-[11px] text-muted-foreground">{sub}</span>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: AspiPulseCard — large ASPI value with up/down flash + % delta.
// ---------------------------------------------------------------------------

interface AspiPulseCardProps {
  loading: boolean
  aspi?: {
    value: number
    lowValue: number
    highValue: number
    change: number
    percentage: number
    timestamp: number | null
  } | null
}

function AspiPulseCard({ loading, aspi }: AspiPulseCardProps) {
  const flash = usePriceFlash(aspi?.value)
  const up = (aspi?.change ?? 0) >= 0

  return (
    <div className="rounded-2xl bg-card/80 backdrop-blur border border-border/60 p-4 flex flex-col gap-2 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          ASPI
        </span>
        <Badge
          variant="outline"
          className={`gap-0.5 ${up ? 'text-emerald-600' : 'text-destructive'}`}
        >
          {up ? (
            <ArrowUpIcon className="size-3" />
          ) : (
            <ArrowDownIcon className="size-3" />
          )}
          {formatPercent(aspi?.percentage)}
        </Badge>
      </div>
      {loading ? (
        <>
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-24" />
        </>
      ) : (
        <>
          <span
            className={`text-lg font-semibold font-playfair tabular-nums rounded px-1 -mx-1 ${flash}`}
          >
            {aspi ? formatNumber(aspi.value, 2) : '—'}
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {aspi
              ? `Range ${formatNumber(aspi.lowValue)} – ${formatNumber(aspi.highValue)}`
              : 'No ASPI data'}
          </span>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: KpiPulseCard — generic KPI tile for the pulse row.
// ---------------------------------------------------------------------------

interface KpiPulseCardProps {
  label: string
  loading: boolean
  value: string
  accentClass?: string
  sub?: React.ReactNode
  footer?: React.ReactNode
}

function KpiPulseCard({
  label,
  loading,
  value,
  accentClass,
  sub,
  footer
}: KpiPulseCardProps) {
  return (
    <div className="rounded-2xl bg-card/80 backdrop-blur border border-border/60 p-4 flex flex-col gap-2 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {footer}
      </div>
      {loading ? (
        <>
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-20" />
        </>
      ) : (
        <>
          <span
            className={`text-lg font-semibold tabular-nums ${accentClass ?? ''}`}
          >
            {value}
          </span>
          <span className="text-[11px] text-muted-foreground">{sub}</span>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: Top movers card
// ---------------------------------------------------------------------------

function TopMoversCard({
  title,
  icon,
  movers,
  loading,
  onTrade,
  emptyMessage
}: {
  title: string
  icon: React.ReactNode
  movers: Mover[]
  loading: boolean
  onTrade: (s: SharePrice) => void
  emptyMessage: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>Top 10 by percentage change</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <div className="px-6 pb-6 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : movers.length === 0 ? (
          <div className="px-6 pb-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Trade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movers.map((m) => {
                  const up = m.change >= 0
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.symbol}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(m.price)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          up ? 'text-emerald-600' : 'text-destructive'
                        }`}
                      >
                        {formatPercent(m.changePercentage)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            onTrade({
                              id: m.id,
                              symbol: m.symbol,
                              open: m.price,
                              high: m.price,
                              low: m.price,
                              lastTradedPrice: m.price,
                              change: m.change,
                              changePercentage: m.changePercentage,
                              crossingVolume: 0,
                              tradesTime: m.tradeDate,
                              quantity: 0
                            })
                          }
                        >
                          Trade
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
