'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/sidebar'

interface Account {
  id: number
  account_number: string
  account_name: string
  balance: number
}

type Step = 'form' | 'confirm' | 'success' | 'failure'

type Errors = Partial<{
  amount: string
  accountNumber: string
  fromAccount: string
}>

export default function BankTransferPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [fromAccount, setFromAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [step, setStep] = useState<Step>('form')
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [failMessage, setFailMessage] = useState('')
  const [failBalance, setFailBalance] = useState<number | null>(null)
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

  const selectedAccount = accounts.find((a) => a.account_number === fromAccount)

  function validate() {
    const e: Errors = {}
    if (!fromAccount) e.fromAccount = 'Select a source account'
    if (!amount) e.amount = 'Amount is required'
    else if (Number(amount) <= 0 || isNaN(Number(amount)))
      e.amount = 'Enter a valid positive amount'
    if (!accountNumber) e.accountNumber = 'Recipient account number is required'
    else if (!/^\d{6,}$/.test(accountNumber))
      e.accountNumber = 'Enter a valid account number'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) setStep('confirm')
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccount,
        toAccount: accountNumber,
        amount: Number(amount),
        description
      })
    })

    const json = await res.json()
    setLoading(false)

    if (json.ok) {
      const txId = json.data?.transaction_id ?? json.transaction_id
      setConfirmation(String(txId))
      setStep('success')
    } else {
      const msg = json.data?.message ?? json.message ?? 'Transfer failed'
      setFailMessage(msg)
      const bal = json.data?.balance ?? json.balance ?? selectedAccount?.balance
      setFailBalance(bal != null ? Number(bal) : null)
      setStep('failure')
    }
  }

  function resetForm() {
    setAmount('')
    setAccountNumber('')
    setDescription('')
    setErrors({})
    setConfirmation(null)
    setFailMessage('')
    setFailBalance(null)
    setStep('form')
  }

  function formatCurrency(n: number) {
    return `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
  }

  return (
    <div className="min-h-screen bg-bg-light font-geist p-0">
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="flex-1 p-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Bank Transfer</h2>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200">
                <img
                  src="/avatar.png"
                  alt="avatar"
                  className="w-full h-full object-cover bg-white"
                />
              </div>
            </div>
          </div>

          {step === 'form' && (
            <form onSubmit={handleNext} className="transfer-card p-8">
              <div className="grid grid-cols-12 gap-y-6 gap-x-8 items-center">
                <label className="col-span-3 text-gray-700">
                  From Account :
                </label>
                <div className="col-span-9">
                  <select
                    value={fromAccount}
                    onChange={(e) => setFromAccount(e.target.value)}
                    className="underline-input bg-transparent"
                  >
                    {accounts.map((a) => (
                      <option key={a.account_number} value={a.account_number}>
                        {a.account_name} ({a.account_number}) —{' '}
                        {formatCurrency(a.balance)}
                      </option>
                    ))}
                  </select>
                  {errors.fromAccount && (
                    <div className="text-sm text-red-600 mt-1">
                      {errors.fromAccount}
                    </div>
                  )}
                </div>

                <label className="col-span-3 text-gray-700">Amount :</label>
                <div className="col-span-9">
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="underline-input"
                    placeholder="0.00"
                  />
                  {errors.amount && (
                    <div className="text-sm text-red-600 mt-1">
                      {errors.amount}
                    </div>
                  )}
                </div>

                <label className="col-span-3 text-gray-700">
                  To Account Number :
                </label>
                <div className="col-span-9">
                  <input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="underline-input"
                    placeholder="Recipient account number"
                  />
                  {errors.accountNumber && (
                    <div className="text-sm text-red-600 mt-1">
                      {errors.accountNumber}
                    </div>
                  )}
                </div>

                <label className="col-span-3 text-gray-700">
                  Description :
                </label>
                <div className="col-span-9">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="description-box"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex justify-center mt-10">
                <button type="submit" className="next-btn">
                  NEXT
                </button>
              </div>
            </form>
          )}

          {step === 'confirm' && (
            <div className="transfer-card p-8">
              <h3 className="text-center text-2xl font-semibold mb-6">
                Confirm Transfer
              </h3>
              <div className="bg-white rounded-lg p-6 shadow-lg max-w-xl mx-auto text-center">
                <p className="mb-2">
                  From <strong>{selectedAccount?.account_name}</strong> (
                  {fromAccount})
                </p>
                <p className="mb-4">
                  Transfer <strong>{formatCurrency(Number(amount))}</strong> to
                  account <strong>{accountNumber}</strong>
                </p>
                {description && (
                  <p className="text-sm text-gray-500 mb-4">{description}</p>
                )}
                <div className="mb-6">
                  <img
                    src="/transfer-illustration.png"
                    alt="illustration"
                    className="mx-auto"
                  />
                </div>
                <div className="flex justify-center gap-4">
                  <button onClick={() => setStep('form')} className="next-btn">
                    BACK
                  </button>
                  <button
                    onClick={handleTransfer}
                    className="next-btn transfer-btn"
                    disabled={loading}
                  >
                    {loading ? 'PROCESSING...' : 'TRANSFER'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="transfer-card p-8">
              <div className="relative">
                <div className="success-check inside-check">
                  <svg
                    viewBox="0 0 120 120"
                    width="100"
                    height="100"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="60" cy="60" r="50" fill="#dff7e7" />
                    <circle cx="60" cy="60" r="40" fill="#10a654" />
                    <path
                      d="M38 62 L54 78 L82 42"
                      stroke="#fff"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </div>
                <h3 className="text-center text-2xl font-semibold mb-4">
                  Transfer Successful!
                </h3>
                <p className="text-center text-sm text-gray-500 mb-10">
                  Transaction ID : {confirmation}
                </p>
                <div className="flex justify-center">
                  <button
                    onClick={resetForm}
                    className="transfer-btn success-btn"
                  >
                    <span className="mr-3">&lsaquo;</span> BACK TO HOME
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'failure' && (
            <div className="transfer-card p-8">
              <div className="relative">
                <div className="success-check inside-check">
                  <svg
                    viewBox="0 0 120 120"
                    width="220"
                    height="220"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="60" cy="60" r="50" fill="#ffdede" />
                    <circle cx="60" cy="60" r="40" fill="#ffb6b6" />
                    <path
                      d="M60 30 L93 86 L27 86 Z"
                      fill="#ff4d4f"
                      stroke="#fff"
                      strokeWidth="4"
                      strokeLinejoin="round"
                    />
                    <text
                      x="60"
                      y="78"
                      textAnchor="middle"
                      fontSize="36"
                      fill="#fff"
                      fontWeight="700"
                    >
                      !
                    </text>
                  </svg>
                </div>
                <h3 className="text-center text-2xl font-semibold mb-4">
                  Transaction Failed!
                </h3>
                <p className="text-center text-sm text-gray-500 mb-6">
                  {failMessage}
                  {failBalance != null && (
                    <>
                      <br />
                      Current Balance: {formatCurrency(failBalance)}
                    </>
                  )}
                </p>
                <div className="flex justify-center">
                  <button
                    onClick={resetForm}
                    className="transfer-btn success-btn"
                  >
                    <span className="mr-3">&lsaquo;</span> BACK TO HOME
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
