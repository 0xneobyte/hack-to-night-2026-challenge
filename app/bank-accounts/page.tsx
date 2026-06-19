'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Sidebar from '@/components/sidebar'
import { Search, Bell } from '@/components/Icons'
import styles from './accounts.module.css'

interface Account {
  id: number
  account_number: string
  account_name: string
  balance: number
  created_at: string
}

type Screen = 'list' | 'edit'

export default function AccountsPage() {
  const [screen, setScreen] = useState<Screen>('list')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [nickname, setNickname] = useState('')

  useEffect(() => {
    loadAccounts()
  }, [])

  async function loadAccounts() {
    setLoading(true)
    const res = await fetch('/api/accounts')
    const json = await res.json()
    if (json.ok) {
      setAccounts(json.data?.accounts ?? json.accounts ?? [])
    }
    setLoading(false)
  }

  function formatCurrency(n: number) {
    return `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
  }

  function goToEdit(account: Account) {
    setEditingAccount(account)
    setNickname(account.account_name)
    setScreen('edit')
  }

  function handleCancel() {
    setEditingAccount(null)
    setNickname('')
    setScreen('list')
  }

  function handleEditNickname(e: React.FormEvent) {
    e.preventDefault()
    if (!nickname.trim() || nickname.trim().length < 2) {
      alert('Nickname must be at least 2 characters')
      return
    }
    alert(`Nickname updated to: ${nickname}`)
    handleCancel()
  }

  function maskAccount(num: string) {
    return `......${num.slice(-4)}`
  }

  return (
    <main className={styles.accountsPage}>
      <Sidebar />
      <section className={styles.content}>
        <header className={styles.contentHeader}>
          <h1 className={styles.pageTitle}>Accounts</h1>
          <div className={styles.headerActions}>
            <Search size={22} />
            <Bell size={22} />
            <div className={styles.avatarPlaceholder}>
              <Image
                src="/person-logo.png"
                alt="Profile"
                width={40}
                height={40}
                style={{ objectFit: 'cover', borderRadius: '50%' }}
              />
            </div>
          </div>
        </header>

        {screen === 'list' && (
          <div className={styles.cardsContainer}>
            {loading ? (
              <p style={{ color: '#666' }}>Loading accounts...</p>
            ) : accounts.length === 0 ? (
              <p style={{ color: '#666' }}>No accounts found</p>
            ) : (
              accounts.map((acc) => (
                <div key={acc.id} className={styles.accountCard}>
                  <div
                    className={styles.iconEdit}
                    onClick={() => goToEdit(acc)}
                  >
                    ✏️
                  </div>
                  <div className={styles.accountCardContent}>
                    <h2 className={styles.accountName}>{acc.account_name}</h2>
                    <div className={styles.accountAvatar}>
                      <Image
                        src="/account-logo.png"
                        alt="profile"
                        width={100}
                        height={100}
                        style={{ objectFit: 'cover', borderRadius: '50%' }}
                      />
                    </div>
                    <p className={styles.accountDetails}>
                      {maskAccount(acc.account_number)}
                      <br />
                      {formatCurrency(acc.balance)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {screen === 'edit' && editingAccount && (
          <div className={styles.formContainer}>
            <div className={styles.formCard}>
              <div className={styles.formHeader}>
                <h2 className={styles.formTitle}>Edit Account Nickname</h2>
              </div>
              <form onSubmit={handleEditNickname} className={styles.formFields}>
                <div className={styles.formGroup}>
                  <label htmlFor="accountNumber">Account Number:</label>
                  <input
                    type="text"
                    id="accountNumber"
                    value={editingAccount.account_number}
                    disabled
                    className={styles.inputDisabled}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="balance">Balance:</label>
                  <input
                    type="text"
                    id="balance"
                    value={formatCurrency(editingAccount.balance)}
                    disabled
                    className={styles.inputDisabled}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="nickname">Nickname:</label>
                  <input
                    type="text"
                    id="nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Enter new nickname"
                    required
                  />
                </div>
                <div className={styles.formActionsBottom}>
                  <button
                    type="button"
                    className={styles.btnCancel}
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                  <button type="submit" className={styles.btnUpdate}>
                    UPDATE
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
