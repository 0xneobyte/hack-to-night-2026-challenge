'use client'

import {
  CheckCircle2Icon,
  CopyIcon,
  PlusIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { QrCodeImage } from '@/components/qr-code-image'
import { QrScannerInput } from '@/components/qr-scanner-input'
import { SiteHeader } from '@/components/site-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Account {
  id: number
  account_number: string
  account_name: string
  balance: number
}

interface RequestView {
  id: number
  code: string
  to_account: string
  amount: number | null
  description: string | null
  status: string
  expires_at: string | null
  requester_name: string | null
  isMine: boolean
}

interface SplitView {
  id: number
  percentage: number
  amount: number
  status: string
  request: {
    code: string
    description: string | null
    to_account: string
    amount: number | null
    status: string
  } | null
}

function formatCurrency(n: number) {
  return `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
}

function qrLink(code: string) {
  if (typeof window === 'undefined') return code
  return `${window.location.origin}/qr-pay?code=${encodeURIComponent(code)}`
}

export default function QrPayPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tab, setTab] = useState('receive')

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setAccounts(json.data?.accounts ?? json.accounts ?? [])
        }
      })
  }, [])

  // Deep link: /qr-pay?code=XYZ jumps straight to the Pay tab.
  const [deepCode, setDeepCode] = useState<string | null>(null)
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      setDeepCode(code)
      setTab('pay')
    }
  }, [])

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
        <div className="flex flex-1 flex-col items-center p-4 md:p-6">
          <div className="w-full max-w-xl">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-4 grid w-full grid-cols-3">
                <TabsTrigger value="receive">Receive</TabsTrigger>
                <TabsTrigger value="pay">Pay</TabsTrigger>
                <TabsTrigger value="splits">Shared with me</TabsTrigger>
              </TabsList>

              <TabsContent value="receive">
                <ReceiveTab accounts={accounts} />
              </TabsContent>
              <TabsContent value="pay">
                <PayTab accounts={accounts} initialCode={deepCode} />
              </TabsContent>
              <TabsContent value="splits">
                <SplitsTab accounts={accounts} active={tab === 'splits'} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

// ---------------------------------------------------------------------------
// Receive — generate a QR (open-amount personal, or fixed-amount temp)
// ---------------------------------------------------------------------------

function ReceiveTab({ accounts }: { accounts: Account[] }) {
  const [toAccount, setToAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [temp, setTemp] = useState(false)
  const [expiry, setExpiry] = useState('60')
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!toAccount && accounts.length > 0)
      setToAccount(accounts[0].account_number)
  }, [accounts, toAccount])

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!toAccount) {
      setError('Pick an account to receive into')
      return
    }
    setLoading(true)
    const res = await fetch('/api/payment-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toAccount,
        amount: amount ? Number(amount) : undefined,
        description: description || undefined,
        expiresInMinutes: temp && expiry ? Number(expiry) : undefined
      })
    })
    const json = await res.json()
    setLoading(false)
    if (json.ok) {
      setCode(json.data?.code ?? json.code)
    } else {
      setError(json.message || 'Could not create QR')
    }
  }

  function reset() {
    setCode(null)
    setAmount('')
    setDescription('')
    setCopied(false)
  }

  if (code) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your payment QR</CardTitle>
          <CardDescription>
            {amount
              ? `Requesting ${formatCurrency(Number(amount))}`
              : 'Open amount — the payer chooses how much'}
            {temp && ' · expires soon'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <QrCodeImage value={qrLink(code)} />
          <code className="rounded bg-muted px-2 py-1 text-xs">{code}</code>
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                navigator.clipboard?.writeText(qrLink(code))
                setCopied(true)
              }}
            >
              <CopyIcon className="size-4" />
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
            <Button className="flex-1" onClick={reset}>
              New QR
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request money via QR</CardTitle>
        <CardDescription>
          Share a QR so someone can pay you. Leave the amount empty for a
          reusable personal QR.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={generate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Receive into</Label>
            <Select value={toAccount} onValueChange={setToAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.account_number} value={a.account_number}>
                    {a.account_name} — {formatCurrency(a.balance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Amount (optional)</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Leave empty for open amount"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Note (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this for?"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">One-time QR</p>
              <p className="text-xs text-muted-foreground">
                Expires after a set time
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={temp ? 'default' : 'outline'}
              onClick={() => setTemp((v) => !v)}
            >
              {temp ? 'On' : 'Off'}
            </Button>
          </div>
          {temp && (
            <div className="flex flex-col gap-2">
              <Label>Expires in (minutes)</Label>
              <Input
                type="number"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? 'Generating...' : 'Generate QR'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Pay — scan a code, then settle it (single) or split it (group)
// ---------------------------------------------------------------------------

type PayMode = 'choose' | 'single' | 'group'

function PayTab({
  accounts,
  initialCode
}: {
  accounts: Account[]
  initialCode: string | null
}) {
  const [code, setCode] = useState<string | null>(initialCode)
  const [request, setRequest] = useState<RequestView | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<PayMode>('choose')
  const [done, setDone] = useState<string | null>(null)

  const loadRequest = useCallback(async (c: string) => {
    setError('')
    setLoading(true)
    const res = await fetch(`/api/payment-requests/${encodeURIComponent(c)}`)
    const json = await res.json()
    setLoading(false)
    if (json.ok) {
      const r = json.data.request
      setRequest({ ...r, isMine: json.data.isMine })
      setMode('choose')
    } else {
      setError(json.message || 'Could not load request')
      setRequest(null)
    }
  }, [])

  useEffect(() => {
    if (code) loadRequest(code)
  }, [code, loadRequest])

  function reset() {
    setCode(null)
    setRequest(null)
    setMode('choose')
    setDone(null)
    setError('')
  }

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2Icon className="size-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold">{done}</h2>
          <Button onClick={reset}>Done</Button>
        </CardContent>
      </Card>
    )
  }

  if (!code || !request) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scan to pay</CardTitle>
          <CardDescription>
            Scan a Nova Bank QR or enter the payment code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QrScannerInput onResult={(c) => setCode(c)} />
          {loading && (
            <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
          )}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    )
  }

  const notPayable = request.status !== 'OPEN'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment request</CardTitle>
        <CardDescription>
          {request.requester_name
            ? `Requested by ${request.requester_name}`
            : `To account ${request.to_account}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg border p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-semibold">
              {request.amount != null
                ? formatCurrency(request.amount)
                : 'Open (you choose)'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">To account</span>
            <span className="font-medium">{request.to_account}</span>
          </div>
          {request.description && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Note</span>
              <span>{request.description}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge
              variant={request.status === 'OPEN' ? 'default' : 'secondary'}
            >
              {request.status}
            </Badge>
          </div>
        </div>

        {request.isMine && (
          <p className="text-sm text-muted-foreground">
            This is your own request — share the QR with someone to get paid.
          </p>
        )}

        {notPayable && (
          <p className="text-sm text-destructive">
            This request can no longer be paid.
          </p>
        )}

        {!notPayable && !request.isMine && mode === 'choose' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">How do you want to pay?</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-auto flex-col gap-1 py-4"
                onClick={() => setMode('single')}
              >
                <UserIcon className="size-5" />
                <span>Pay it all</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-1 py-4"
                disabled={request.amount == null}
                onClick={() => setMode('group')}
              >
                <UsersIcon className="size-5" />
                <span>Split with others</span>
              </Button>
            </div>
            {request.amount == null && (
              <p className="text-xs text-muted-foreground">
                Splitting needs a fixed amount.
              </p>
            )}
          </div>
        )}

        {!notPayable && mode === 'single' && (
          <SinglePay
            accounts={accounts}
            request={request}
            onBack={() => setMode('choose')}
            onDone={(msg) => setDone(msg)}
          />
        )}

        {!notPayable && mode === 'group' && (
          <GroupSplit
            request={request}
            onBack={() => setMode('choose')}
            onDone={() =>
              setDone('Split created — settle your share in “Shared with me”.')
            }
          />
        )}
      </CardContent>
    </Card>
  )
}

function SinglePay({
  accounts,
  request,
  onBack,
  onDone
}: {
  accounts: Account[]
  request: RequestView
  onBack: () => void
  onDone: (msg: string) => void
}) {
  const [fromAccount, setFromAccount] = useState(
    accounts[0]?.account_number ?? ''
  )
  const [amount, setAmount] = useState(
    request.amount != null ? String(request.amount) : ''
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function pay() {
    setError('')
    if (!fromAccount) {
      setError('Pick an account to pay from')
      return
    }
    if (request.amount == null && (!amount || Number(amount) <= 0)) {
      setError('Enter an amount')
      return
    }
    setLoading(true)
    const res = await fetch(
      `/api/payment-requests/${encodeURIComponent(request.code)}/pay`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAccount,
          amount: request.amount == null ? Number(amount) : undefined
        })
      }
    )
    const json = await res.json()
    setLoading(false)
    if (json.ok) {
      onDone(`Paid ${formatCurrency(json.data.amount)} successfully!`)
    } else {
      setError(json.message || 'Payment failed')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>Pay from</Label>
        <Select value={fromAccount} onValueChange={setFromAccount}>
          <SelectTrigger>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.account_number} value={a.account_number}>
                {a.account_name} — {formatCurrency(a.balance)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {request.amount == null && (
        <div className="flex flex-col gap-2">
          <Label>Amount</Label>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button className="flex-1" onClick={pay} disabled={loading}>
          {loading ? 'Paying…' : 'Pay now'}
        </Button>
      </div>
    </div>
  )
}

interface Row {
  username: string
  percentage: string
}

function GroupSplit({
  request,
  onBack,
  onDone
}: {
  request: RequestView
  onBack: () => void
  onDone: () => void
}) {
  const [rows, setRows] = useState<Row[]>([
    { username: '', percentage: '50' },
    { username: '', percentage: '50' }
  ])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const total = rows.reduce((s, r) => s + (Number(r.percentage) || 0), 0)
  const baseAmount = request.amount ?? 0

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function addRow() {
    setRows((rs) => [...rs, { username: '', percentage: '0' }])
  }
  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i))
  }
  function splitEven() {
    const each = Math.floor((100 / rows.length) * 100) / 100
    setRows((rs) =>
      rs.map((r, idx) => ({
        ...r,
        // Last row absorbs the rounding remainder so the total is exactly 100.
        percentage:
          idx === rs.length - 1
            ? String(Math.round((100 - each * (rs.length - 1)) * 100) / 100)
            : String(each)
      }))
    )
  }

  async function create() {
    setError('')
    if (rows.some((r) => !r.username.trim())) {
      setError('Every row needs a username')
      return
    }
    if (Math.round(total * 100) / 100 !== 100) {
      setError(`Percentages must add up to 100 (now ${total}%)`)
      return
    }
    setLoading(true)
    const res = await fetch(
      `/api/payment-requests/${encodeURIComponent(request.code)}/split`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participants: rows.map((r) => ({
            username: r.username.trim(),
            percentage: Number(r.percentage)
          }))
        })
      }
    )
    const json = await res.json()
    setLoading(false)
    if (json.ok) {
      onDone()
    } else {
      setError(json.message || 'Could not create split')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Split {formatCurrency(baseAmount)}
        </p>
        <Button type="button" size="sm" variant="ghost" onClick={splitEven}>
          Split evenly
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((r, i) => {
          const share = (baseAmount * (Number(r.percentage) || 0)) / 100
          return (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={r.username}
                onChange={(e) => setRow(i, { username: e.target.value })}
                placeholder="username"
                className="flex-1"
              />
              <Input
                type="number"
                value={r.percentage}
                onChange={(e) => setRow(i, { percentage: e.target.value })}
                className="w-20"
              />
              <span className="w-24 text-right text-xs text-muted-foreground">
                {formatCurrency(share)}
              </span>
              {rows.length > 1 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeRow(i)}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              )}
            </div>
          )
        })}
      </div>

      <Button type="button" size="sm" variant="outline" onClick={addRow}>
        <PlusIcon className="size-4" /> Add person
      </Button>

      <p
        className={`text-sm ${
          Math.round(total * 100) / 100 === 100
            ? 'text-muted-foreground'
            : 'text-destructive'
        }`}
      >
        Total: {total}%
      </p>

      <p className="text-xs text-muted-foreground">
        Each person (including you, if you add yourself) settles their own share
        from “Shared with me”.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button className="flex-1" onClick={create} disabled={loading}>
          {loading ? 'Creating…' : 'Create split'}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Splits — settle shares you were invited to
// ---------------------------------------------------------------------------

function SplitsTab({
  accounts,
  active
}: {
  accounts: Account[]
  active: boolean
}) {
  const [splits, setSplits] = useState<SplitView[]>([])
  const [loading, setLoading] = useState(false)
  const [fromAccount, setFromAccount] = useState('')
  const [payingId, setPayingId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/splits')
    const json = await res.json()
    setLoading(false)
    if (json.ok) setSplits(json.data?.splits ?? [])
  }, [])

  useEffect(() => {
    if (active) load()
  }, [active, load])

  useEffect(() => {
    if (!fromAccount && accounts.length > 0) {
      setFromAccount(accounts[0].account_number)
    }
  }, [accounts, fromAccount])

  async function pay(id: number) {
    setError('')
    if (!fromAccount) {
      setError('Pick an account to pay from')
      return
    }
    setPayingId(id)
    const res = await fetch(`/api/splits/${id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromAccount })
    })
    const json = await res.json()
    setPayingId(null)
    if (json.ok) {
      await load()
    } else {
      setError(json.message || 'Payment failed')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shared with me</CardTitle>
        <CardDescription>Your share of group payments.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Pay from</Label>
          <Select value={fromAccount} onValueChange={setFromAccount}>
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.account_number} value={a.account_number}>
                  {a.account_name} — {formatCurrency(a.balance)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && splits.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing shared with you yet.
          </p>
        )}

        {splits.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {formatCurrency(s.amount)}{' '}
                <span className="text-xs text-muted-foreground">
                  ({s.percentage}%)
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {s.request?.description || 'Group payment'}
              </p>
            </div>
            {s.status === 'PAID' ? (
              <Badge variant="secondary">Paid</Badge>
            ) : (
              <Button
                size="sm"
                onClick={() => pay(s.id)}
                disabled={payingId === s.id}
              >
                {payingId === s.id ? 'Paying…' : 'Pay share'}
              </Button>
            )}
          </div>
        ))}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
