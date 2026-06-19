'use client'

import { useEffect, useState } from 'react'
import type { ProfileWithEmail } from '@/lib/types'
import { Bell, ChevronRight, Search } from '../../components/Icons'
import Sidebar from '../../components/sidebar'

interface AccountRow {
  id: number
  account_number: string
  account_name: string
  balance: number
  created_at: string
}

interface TransactionRow {
  id: number
  from_account: string
  to_account: string
  amount: number
  description: string | null
  status: string
  created_at: string
}

function formatCurrency(amount: number) {
  return `Rs. ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function maskAccount(num: string) {
  return `......${num.slice(-4)}`
}

export default function Dashboard() {
  const [profile, setProfile] = useState<ProfileWithEmail | null>(null)
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const [profileRes, accountsRes, txRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/accounts'),
        fetch('/api/transactions?limit=5')
      ])

      if (profileRes.ok) {
        const json = await profileRes.json()
        if (json.ok) setProfile(json.data.profile)
      }
      if (accountsRes.ok) {
        const json = await accountsRes.json()
        if (json.ok) setAccounts(json.data.accounts)
      }
      if (txRes.ok) {
        const json = await txRes.json()
        if (json.ok) setTransactions(json.data.transactions)
      }

      setLoading(false)
    }

    loadData()
  }, [])

  const primaryAccount = accounts[0]
  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0)

  return (
    <main className="dashboard">
      <Sidebar />

      <section className="content">
        {/* Header */}
        <header className="content-header">
          <h1 className="page-title">Dashboard</h1>
          <div className="header-actions">
            <Search size={24} />
            <Bell size={24} />
            <img src="/person-logo.png" alt="profile" className="avatar" />
          </div>
        </header>

        {loading ? (
          <div className="loading-state">Loading your data…</div>
        ) : (
          <>
            {/* Top Section */}
            <div className="top-section">
              <div className="welcome-card">
                <h2 className="welcome-title">
                  Welcome back, {profile?.full_name?.split(' ')[0] ?? 'there'}!
                </h2>
                <div className="balance-card">
                  <p className="balance-label">Current Balance</p>
                  <p className="balance-amount">
                    {primaryAccount
                      ? formatCurrency(primaryAccount.balance)
                      : totalBalance > 0
                        ? formatCurrency(totalBalance)
                        : 'Rs. 0.00'}
                  </p>
                  <ChevronRight className="balance-chevron" size={30} />
                </div>
                <div className="carousel-dots">
                  <span className="dot active" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
                <img
                  src="/dashboard-logo.png"
                  alt="woman"
                  className="welcome-image"
                />
              </div>

              <div className="payees-card">
                <h3 className="payees-title">My Accounts</h3>
                <div className="payees-list">
                  {accounts.slice(0, 2).map((acc) => (
                    <div key={acc.id} className="payee-item">
                      <img
                        src="/person-logo.png"
                        alt="account"
                        className="avatar"
                      />
                      <div className="payee-info">
                        <p>{acc.account_name}</p>
                        <p>{maskAccount(acc.account_number)}</p>
                      </div>
                    </div>
                  ))}
                  {accounts.length === 0 && (
                    <p className="no-data">No accounts yet</p>
                  )}
                </div>
                <div className="view-all">
                  View all
                  <ChevronRight size={15} />
                </div>
              </div>
            </div>

            {/* Transactions */}
            <div className="transactions-section">
              <h2 className="transactions-title">Recent Transactions</h2>
              <div className="transactions-card">
                {transactions.length === 0 ? (
                  <p className="no-data">No transactions yet</p>
                ) : (
                  transactions.map((t) => (
                    <div key={t.id} className="transaction-item">
                      <img
                        src="/person-logo.png"
                        alt="user"
                        className="avatar"
                      />
                      <span className="transaction-date">
                        {formatDate(t.created_at)}
                      </span>
                      <span className="transaction-account">
                        {maskAccount(t.to_account)}
                      </span>
                      <span className="transaction-amount">
                        -{formatCurrency(t.amount)}
                      </span>
                      <span className="transaction-status">{t.status}</span>
                    </div>
                  ))
                )}
                <div className="view-all">
                  View all
                  <ChevronRight size={15} />
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <style jsx>{`
        .dashboard {
          width: 100vw;
          min-height: 100vh;
          background: #f1f1f1;
          display: flex;
          gap: 1.5rem;
          overflow: hidden;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .content {
          flex: 1;
          padding: 1.5rem 1.25rem;
          overflow-y: auto;
          min-width: 0;
        }

        .content-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .page-title {
          font-size: 28px;
          font-weight: 700;
          color: black;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .avatar {
          width: 45px;
          height: 45px;
          border-radius: 50%;
          object-fit: cover;
        }

        .loading-state {
          margin-top: 3rem;
          text-align: center;
          color: #6b7280;
          font-size: 1.1rem;
        }

        .no-data {
          color: #9ca3af;
          font-size: 0.9rem;
          text-align: center;
          padding: 0.5rem 0;
        }

        .top-section {
          margin-top: 1rem;
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
        }

        .welcome-card {
          width: 640px;
          max-width: 100%;
          height: 230px;
          background: #e7e1e8;
          border-radius: 18px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
        }

        .welcome-title {
          font-size: 18px;
          padding: 0.75rem 1rem 0;
          color: black;
        }

        .balance-card {
          position: absolute;
          left: 5rem;
          top: 60px;
          width: 380px;
          max-width: calc(100% - 2rem);
          height: 120px;
          background: black;
          border-radius: 14px;
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 0 1rem;
        }

        .balance-label {
          font-size: 21px;
        }

        .balance-amount {
          color: #a7d93a;
          font-size: 20px;
          margin-top: 0.25rem;
        }

        .balance-chevron {
          position: absolute;
          right: 1rem;
        }

        .carousel-dots {
          position: absolute;
          bottom: 1.25rem;
          left: 160px;
          display: flex;
          gap: 0.5rem;
        }

        .dot {
          width: 6px;
          height: 3px;
          background: #9ca3af;
          border-radius: 2px;
        }
        .dot.active {
          width: 50px;
          background: #6060d5;
        }

        .welcome-image {
          position: absolute;
          right: 0;
          bottom: 0;
          height: 250px;
          object-fit: cover;
        }

        .payees-card {
          width: 270px;
          height: 230px;
          background: white;
          border-radius: 18px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          padding: 1rem;
          color: black;
          flex: 1;
          min-width: 200px;
        }

        .payees-title {
          font-weight: 600;
          text-align: center;
          font-size: 1rem;
        }

        .payees-list {
          margin-top: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .payee-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .payee-info {
          font-size: 13px;
          line-height: 1.3;
        }
        .payee-info p:first-child {
          font-weight: 500;
        }
        .payee-info p:last-child {
          color: #4b5563;
        }

        .view-all {
          text-align: right;
          margin-top: 1rem;
          font-size: 13px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 0.25rem;
          cursor: default;
        }

        .transactions-section {
          margin-top: 0.75rem;
          color: black;
        }

        .transactions-title {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 0.75rem;
        }

        .transactions-card {
          background: white;
          border-radius: 22px;
          box-shadow: 18px 18px 12px rgba(0, 0, 0, 0.15);
          padding: 1.25rem;
          width: 1000px;
          max-width: 100%;
          overflow-x: auto;
        }

        .transaction-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .transaction-date,
        .transaction-account,
        .transaction-amount {
          font-size: 0.95rem;
        }

        .transaction-status {
          background: #d5f1cb;
          padding: 0.25rem 1.5rem;
          border-radius: 4px;
          color: black;
          font-size: 0.9rem;
          white-space: nowrap;
        }

        @media (max-width: 1024px) {
          .welcome-card {
            width: 100%;
          }
          .transactions-card {
            width: 100%;
          }
        }

        @media (max-width: 768px) {
          .dashboard {
            flex-direction: column;
            gap: 0;
          }

          .content {
            padding: 1rem;
          }

          .page-title {
            font-size: 22px;
          }

          .top-section {
            flex-direction: column;
            align-items: stretch;
          }

          .welcome-card {
            height: 220px;
          }
          .balance-card {
            width: calc(100% - 2rem);
            left: 1rem;
            top: 50px;
            height: 100px;
          }
          .balance-label {
            font-size: 18px;
          }
          .balance-amount {
            font-size: 18px;
          }
          .welcome-image {
            height: 160px;
          }
          .carousel-dots {
            left: 1.5rem;
            bottom: 0.75rem;
          }

          .payees-card {
            width: 100%;
            height: auto;
            min-height: 200px;
          }

          .transactions-card {
            padding: 1rem;
          }

          .transaction-item {
            flex-wrap: wrap;
            gap: 0.5rem;
            border-bottom: 1px solid #f0f0f0;
            padding-bottom: 0.75rem;
          }
          .transaction-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
          }
          .transaction-status {
            padding: 0.15rem 1rem;
            font-size: 0.8rem;
          }
        }

        @media (max-width: 480px) {
          .header-actions {
            gap: 0.75rem;
          }
          .avatar {
            width: 35px;
            height: 35px;
          }
          .page-title {
            font-size: 20px;
          }
          .balance-label {
            font-size: 16px;
          }
          .balance-amount {
            font-size: 16px;
          }
          .welcome-card {
            height: 200px;
          }
          .welcome-image {
            height: 130px;
          }
          .transaction-date,
          .transaction-account,
          .transaction-amount {
            font-size: 0.8rem;
          }
        }
      `}</style>
    </main>
  )
}
