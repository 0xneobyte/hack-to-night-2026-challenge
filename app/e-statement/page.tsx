'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/sidebar'

interface Account {
  id: number
  account_number: string
  account_name: string
  balance: number
}

interface Transaction {
  id: number
  from_account: string
  to_account: string
  amount: number
  description: string | null
  status: string
  created_at: string
}

export default function EStatementPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          const accs = json.data?.accounts ?? json.accounts ?? []
          setAccounts(accs)
          if (accs.length > 0) setSelectedAccount(accs[0].account_number)
        }
      })
  }, [])

  const account = accounts.find((a) => a.account_number === selectedAccount)

  async function handleFetch(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAccount) return
    setLoading(true)
    const res = await fetch(`/api/transactions?account=${selectedAccount}`)
    const json = await res.json()
    if (json.ok) {
      setTransactions(json.data?.transactions ?? json.transactions ?? [])
    }
    setFetched(true)
    setLoading(false)
  }

  function formatCurrency(n: number) {
    return `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const totalDebits = transactions
    .filter((t) => t.from_account === selectedAccount)
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const totalCredits = transactions
    .filter((t) => t.to_account === selectedAccount)
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const closingBalance = account?.balance ?? 0
  const openingBalance = closingBalance + totalDebits - totalCredits

  return (
    <div className="min-h-screen bg-bg-light font-geist p-0">
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="flex-1 p-12 text-black">
          <div className="mb-10 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">E-Statement</h2>
            <div className="flex items-center gap-3">
              <div className="size-12 overflow-hidden rounded-full border-2 border-gray-200">
                <img
                  src="/avatar.png"
                  alt="avatar"
                  className="size-full bg-white object-cover"
                />
              </div>
            </div>
          </div>

          <form
            onSubmit={handleFetch}
            className="rounded-[32px] bg-white px-10 py-8 text-black shadow-[0_1px_3px_0_rgba(0,0,0,0.30),0_4px_8px_3px_rgba(0,0,0,0.15)]"
          >
            <div className="grid items-end gap-6 text-xl md:grid-cols-[auto_1fr_auto]">
              <span>Select account:</span>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="min-w-0 border-0 border-b border-black bg-transparent px-2 py-1 text-xl text-black outline-none"
              >
                {accounts.map((a) => (
                  <option key={a.account_number} value={a.account_number}>
                    {a.account_name} ({a.account_number})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-[#450043] px-6 py-2 text-base text-white"
              >
                {loading ? 'Loading...' : 'View Statement'}
              </button>
            </div>
          </form>

          {fetched && account && (
            <section className="mt-6 min-h-[560px] bg-[#e7e7e7] px-7 py-9 text-black">
              <div className="max-w-full">
                <img
                  src="/loginlogo.png"
                  alt="Nova Bank"
                  className="size-[86px] rounded-full object-cover"
                />

                <div className="mt-5 text-sm leading-tight">
                  <h2 className="font-bold">Bank Statement</h2>
                  <dl>
                    <div>
                      <dt className="inline">Account Holder: </dt>
                      <dd className="inline">{account.account_name}</dd>
                    </div>
                    <div>
                      <dt className="inline">Account Number: </dt>
                      <dd className="inline">{account.account_number}</dd>
                    </div>
                    <div>
                      <dt className="inline">Current Balance: </dt>
                      <dd className="inline">
                        {formatCurrency(account.balance)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-9 text-sm">
                  <h3 className="font-bold">Account Summary</h3>
                  <table className="mt-4 w-full table-fixed border-collapse text-left">
                    <thead>
                      <tr>
                        <th className="pr-4 font-normal">Opening Balance</th>
                        <th className="pr-4 font-normal">Total Credits</th>
                        <th className="pr-4 font-normal">Total Debits</th>
                        <th className="font-normal">Closing Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="pt-2 font-semibold">
                          {formatCurrency(openingBalance)}
                        </td>
                        <td className="pt-2 font-semibold text-green-700">
                          {formatCurrency(totalCredits)}
                        </td>
                        <td className="pt-2 font-semibold text-red-700">
                          {formatCurrency(totalDebits)}
                        </td>
                        <td className="pt-2 font-semibold">
                          {formatCurrency(closingBalance)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-10 border-t border-black pt-9">
                  <h3 className="text-sm font-bold">Transaction Details</h3>
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-black">
                          <th className="w-[13%] pb-3 font-normal">Date</th>
                          <th className="w-[22%] pb-3 font-normal">
                            Description
                          </th>
                          <th className="w-[18%] pb-3 font-normal">
                            Reference ID
                          </th>
                          <th className="w-[15%] pb-3 font-normal">Debit</th>
                          <th className="w-[16%] pb-3 font-normal">Credit</th>
                          <th className="w-[16%] pb-3 font-normal">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.length === 0 ? (
                          <tr>
                            <td className="pt-4 text-gray-500" colSpan={6}>
                              No transactions found
                            </td>
                          </tr>
                        ) : (
                          transactions.map((t) => {
                            const isDebit = t.from_account === selectedAccount
                            return (
                              <tr
                                key={t.id}
                                className="border-b border-gray-300"
                              >
                                <td className="py-2">
                                  {formatDate(t.created_at)}
                                </td>
                                <td className="py-2">{t.description || '-'}</td>
                                <td className="py-2">TXN-{t.id}</td>
                                <td className="py-2 text-red-700">
                                  {isDebit ? formatCurrency(t.amount) : '-'}
                                </td>
                                <td className="py-2 text-green-700">
                                  {!isDebit ? formatCurrency(t.amount) : '-'}
                                </td>
                                <td className="py-2">{t.status}</td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
