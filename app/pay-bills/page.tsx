'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  CheckCircle2Icon,
  AlertTriangleIcon,
  ArrowLeftIcon
} from 'lucide-react'

type Biller = { id: string; name: string; logo: string }

const billers: Biller[] = [
  { id: 'water', name: 'Water Board', logo: '/billers/water-board.png' },
  { id: 'cable', name: 'Cable TV', logo: '/billers/cable-tv.png' },
  { id: 'ceb', name: 'CEB', logo: '/billers/ceb.png' },
  { id: 'airtel', name: 'Airtel', logo: '/billers/airtel.png' },
  { id: 'dialog', name: 'Dialog', logo: '/billers/dialog.png' },
  { id: 'slt', name: 'Sri Lanka Telecom', logo: '/billers/electricity.png' },
  { id: 'peotv', name: 'PEO TV', logo: '/billers/mpesa.png' },
  { id: 'hutch', name: 'Hutch', logo: '/billers/hutch.png' },
  { id: 'aia', name: 'AIA', logo: '/billers/aia.png' },
  { id: 'lolc', name: 'LOLC', logo: '/billers/lolc.png' },
  { id: 'insurance2', name: 'Insurance', logo: '/billers/insurance2.png' },
  { id: 'hsbc', name: 'HSBC', logo: '/billers/hsbc.png' }
]

interface Account {
  id: number
  account_number: string
  account_name: string
  balance: number
}
type Screen = 'select' | 'form' | 'success' | 'failed'

function formatCurrency(n: number) {
  return `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
}

export default function PayBillsPage() {
  const [screen, setScreen] = useState<Screen>('select')
  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [fromAccount, setFromAccount] = useState('')
  const [billId, setBillId] = useState('')
  const [dueAmount, setDueAmount] = useState('')
  const [remarks, setRemarks] = useState('')
  const [txId, setTxId] = useState('')
  const [failReason, setFailReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          const accs = json.data?.accounts ?? json.accounts ?? []
          setAccounts(accs)
          if (accs.length > 0) setFromAccount(accs[0].account_number)
        }
      })
  }, [])

  const selected = accounts.find((a) => a.account_number === fromAccount)

  async function handlePayNow(e: React.FormEvent) {
    e.preventDefault()
    if (!billId.trim() || !dueAmount.trim() || Number(dueAmount) <= 0) {
      setError('Please fill all required fields')
      return
    }
    setError('')
    setLoading(true)

    const res = await fetch('/api/pay-bill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccount,
        billerId: selectedBiller?.id,
        billRef: billId,
        amount: Number(dueAmount),
        description: `Bill payment: ${selectedBiller?.name}${remarks ? ' - ' + remarks : ''}`
      })
    })
    const json = await res.json()
    setLoading(false)

    if (json.ok) {
      setTxId(String(json.data?.transaction_id ?? json.transaction_id))
      setScreen('success')
    } else {
      const msg = json.data?.message ?? json.message ?? 'Payment failed'
      setFailReason(
        selected
          ? `${msg}\nCurrent Balance: ${formatCurrency(selected.balance)}`
          : msg
      )
      setScreen('failed')
    }
  }

  function reset() {
    setScreen('select')
    setSelectedBiller(null)
    setBillId('')
    setDueAmount('')
    setRemarks('')
    setError('')
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setAccounts(json.data?.accounts ?? json.accounts ?? [])
      })
  }

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
        <div className="flex flex-1 flex-col items-center p-4 md:p-6 gap-4">
          <div className="w-full max-w-2xl">
            <div className="mb-2">
              <h1 className="text-2xl font-bold">Pay Bills</h1>
              <p className="text-sm text-muted-foreground">
                {selected
                  ? `Paying from: ${selected.account_name} — ${formatCurrency(selected.balance)}`
                  : 'Pay your utility bills and subscriptions'}
              </p>
            </div>
            {screen === 'select' && (
              <Card>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
                    {billers.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => {
                          setSelectedBiller(b)
                          setScreen('form')
                        }}
                        className="flex flex-col items-center gap-2 rounded-lg border p-3 transition hover:bg-muted"
                      >
                        <div className="flex size-14 items-center justify-center rounded-full border bg-white">
                          <Image
                            src={b.logo}
                            alt={b.name}
                            width={32}
                            height={32}
                            style={{ objectFit: 'contain' }}
                          />
                        </div>
                        <span className="text-xs font-medium text-center">
                          {b.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {screen === 'form' && selectedBiller && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setScreen('select')}
                    >
                      <ArrowLeftIcon className="size-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                      <Image
                        src={selectedBiller.logo}
                        alt={selectedBiller.name}
                        width={24}
                        height={24}
                        style={{ objectFit: 'contain' }}
                      />
                      <CardTitle>{selectedBiller.name}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePayNow} className="flex flex-col gap-4">
                    {accounts.length > 1 && (
                      <div className="flex flex-col gap-2">
                        <Label>Pay from</Label>
                        <Select
                          value={fromAccount}
                          onValueChange={setFromAccount}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => (
                              <SelectItem
                                key={a.account_number}
                                value={a.account_number}
                              >
                                {a.account_name} — {formatCurrency(a.balance)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <Label>Bill ID / Account</Label>
                      <Input
                        value={billId}
                        onChange={(e) => setBillId(e.target.value)}
                        placeholder="Enter bill ID"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Due Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={dueAmount}
                        onChange={(e) => setDueAmount(e.target.value)}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Remarks (optional)</Label>
                      <Input
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Processing...' : 'Pay Now'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {screen === 'success' && (
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-10">
                  <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2Icon className="size-8 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-semibold">Payment Successful!</h2>
                  <p className="text-sm text-muted-foreground">
                    Transaction ID: {txId}
                  </p>
                  <Button onClick={reset}>Back to Bills</Button>
                </CardContent>
              </Card>
            )}

            {screen === 'failed' && (
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-10">
                  <div className="flex size-16 items-center justify-center rounded-full bg-red-100">
                    <AlertTriangleIcon className="size-8 text-destructive" />
                  </div>
                  <h2 className="text-xl font-semibold">Payment Failed</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {failReason}
                  </p>
                  <Button onClick={reset}>Try Again</Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
