'use client'

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CandlestickChartIcon,
  CircleDotIcon,
  HistoryIcon,
  RefreshCwIcon,
  SearchIcon,
  ShoppingCartIcon,
  TagIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  WalletIcon
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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

  // --- Portfolio state ------------------------------------------------------
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [portfolioLoading, setPortfolioLoading] = useState(true)

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

  useEffect(() => {
    loadMarketData()
    loadPortfolio()
    const id = setInterval(() => loadMarketData(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [loadMarketData, loadPortfolio])

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

  const portfolioValue = useMemo(() => {
    if (!portfolio) return 0
    const holdingsValue = (portfolio.holdings ?? []).reduce((sum, h) => {
      const live = prices.find((p) => p.symbol === h.symbol)
      const price = live?.lastTradedPrice ?? h.avg_price
      return sum + price * h.quantity
    }, 0)
    return portfolio.balance.balance + holdingsValue
  }, [portfolio, prices])

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
        <div className="flex flex-1 flex-col p-4 md:p-6 gap-4">
          {/* Page heading */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <CandlestickChartIcon className="size-6" />
                Stock Trading
              </h1>
              <p className="text-sm text-muted-foreground">
                Demo trading with virtual LKR — live CSE market data
              </p>
            </div>
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <span className="text-xs text-muted-foreground">
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

          {/* Market status banner */}
          {marketError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {marketError}
            </div>
          )}

          {/* Top stats grid */}
          <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
            {/* Market status */}
            <Card>
              <CardHeader>
                <CardDescription>Market Status</CardDescription>
                <CardTitle className="text-xl flex items-center gap-2">
                  {marketLoading ? (
                    <Skeleton className="h-6 w-24" />
                  ) : (
                    <>
                      <CircleDotIcon
                        className={`size-4 ${
                          summary?.marketOpen
                            ? 'text-emerald-500'
                            : 'text-muted-foreground'
                        }`}
                      />
                      {summary?.marketOpen ? 'Open' : 'Closed'}
                    </>
                  )}
                </CardTitle>
                <CardAction>
                  <Badge variant="outline">CSE</Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="text-xs text-muted-foreground">
                {summary?.summary
                  ? `${summary.summary.trades.toLocaleString()} trades today`
                  : 'No trades reported'}
              </CardFooter>
            </Card>

            {/* ASPI */}
            <Card>
              <CardHeader>
                <CardDescription>ASPI</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {marketLoading ? (
                    <Skeleton className="h-6 w-32" />
                  ) : summary?.aspi ? (
                    formatNumber(summary.aspi.value, 2)
                  ) : (
                    '—'
                  )}
                </CardTitle>
                <CardAction>
                  {summary?.aspi && (
                    <Badge
                      variant="outline"
                      className={
                        summary.aspi.change >= 0
                          ? 'text-emerald-600'
                          : 'text-destructive'
                      }
                    >
                      {summary.aspi.change >= 0 ? (
                        <ArrowUpIcon className="size-3" />
                      ) : (
                        <ArrowDownIcon className="size-3" />
                      )}
                      {formatPercent(summary.aspi.percentage)}
                    </Badge>
                  )}
                </CardAction>
              </CardHeader>
              <CardFooter className="text-xs text-muted-foreground">
                {summary?.aspi
                  ? `Range ${formatNumber(summary.aspi.lowValue)} – ${formatNumber(
                      summary.aspi.highValue
                    )}`
                  : 'No ASPI data'}
              </CardFooter>
            </Card>

            {/* Portfolio value */}
            <Card>
              <CardHeader>
                <CardDescription>Portfolio Value</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {portfolioLoading ? (
                    <Skeleton className="h-6 w-32" />
                  ) : (
                    formatLKR(portfolioValue)
                  )}
                </CardTitle>
                <CardAction>
                  <Badge variant="outline">
                    <WalletIcon className="size-3" />
                    Cash {formatLKRCompact(portfolio?.balance.balance ?? 0)}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="text-xs">
                <span
                  className={`font-medium ${
                    totalPnl >= 0 ? 'text-emerald-600' : 'text-destructive'
                  }`}
                >
                  {totalPnl >= 0 ? '+' : ''}
                  {formatLKR(totalPnl)} P/L
                </span>
              </CardFooter>
            </Card>

            {/* Holdings count */}
            <Card>
              <CardHeader>
                <CardDescription>Holdings</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {portfolioLoading ? (
                    <Skeleton className="h-6 w-16" />
                  ) : (
                    (portfolio?.holdings.length ?? 0)
                  )}
                </CardTitle>
                <CardAction>
                  <Badge variant="outline">symbols</Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="text-xs text-muted-foreground">
                Trade volume{' '}
                {summary?.summary
                  ? formatCompactVolume(summary.summary.tradeVolume)
                  : '—'}
              </CardFooter>
            </Card>
          </div>

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
                  icon={<TrendingUpIcon className="size-4 text-emerald-600" />}
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
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Change</TableHead>
                            <TableHead className="text-right hidden sm:table-cell">
                              Volume
                            </TableHead>
                            <TableHead className="text-right">Action</TableHead>
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
                      Cash {formatLKRCompact(portfolio?.balance.balance ?? 0)}
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
                          <TableHead className="text-right">Avg Cost</TableHead>
                          <TableHead className="text-right">Last</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead className="text-right">P/L</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(portfolio?.holdings ?? []).map((h) => {
                          const live = prices.find((p) => p.symbol === h.symbol)
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
                  <CardDescription>Most recent 50 demo trades</CardDescription>
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
                              {new Date(t.created_at).toLocaleString('en-GB', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })}
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
      </SidebarInset>

      {/* ---------------- Trade Sheet ---------------- */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(v) => {
          setSheetOpen(v)
          if (!v) setSheetStock(null)
        }}
      >
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {sheetMode === 'BUY' ? (
                <ShoppingCartIcon className="size-5" />
              ) : (
                <TagIcon className="size-5" />
              )}
              {sheetMode === 'BUY' ? 'Buy' : 'Sell'} {sheetStock?.symbol ?? ''}
            </SheetTitle>
            <SheetDescription>
              {sheetMode === 'BUY'
                ? 'Place a virtual buy order at the live market price.'
                : 'Place a virtual sell order at the live market price.'}
            </SheetDescription>
          </SheetHeader>

          {sheetStock && (
            <form
              onSubmit={handleSubmitOrder}
              className="flex flex-1 flex-col gap-4 px-4"
            >
              <div className="rounded-lg border p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Price</span>
                  <span className="font-medium tabular-nums">
                    {formatNumber(sheetStock.lastTradedPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Day Change</span>
                  <span
                    className={`font-medium tabular-nums ${
                      sheetStock.change >= 0
                        ? 'text-emerald-600'
                        : 'text-destructive'
                    }`}
                  >
                    {formatPercent(sheetStock.changePercentage)}
                  </span>
                </div>
                {sheetMode === 'SELL' &&
                  holdingsBySymbol.has(sheetStock.symbol) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">You Own</span>
                      <span className="font-medium tabular-nums">
                        {holdingsBySymbol
                          .get(sheetStock.symbol)!
                          .quantity.toLocaleString('en-LK')}{' '}
                        shares
                      </span>
                    </div>
                  )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="qty">Quantity</Label>
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  step={1}
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  placeholder="Number of shares"
                  required
                  autoFocus
                />
              </div>

              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Total</span>
                  <span className="font-medium tabular-nums">
                    {formatLKR(
                      (Number(orderQty) || 0) * sheetStock.lastTradedPrice
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Cash After Order
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatLKR(
                      sheetMode === 'BUY'
                        ? (portfolio?.balance.balance ?? 0) -
                            (Number(orderQty) || 0) * sheetStock.lastTradedPrice
                        : (portfolio?.balance.balance ?? 0) +
                            (Number(orderQty) || 0) * sheetStock.lastTradedPrice
                    )}
                  </span>
                </div>
              </div>

              <SheetFooter className="mt-auto gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSheetOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={sheetMode === 'BUY' ? 'default' : 'destructive'}
                  disabled={submitting}
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
