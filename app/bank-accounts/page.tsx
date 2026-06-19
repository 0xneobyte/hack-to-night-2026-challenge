'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Sidebar from '@/components/sidebar'
import { Search, Bell } from '@/components/Icons'
import styles from './accounts.module.css'

type Screen = 'list' | 'add' | 'edit'

export default function AccountsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Screen state
  const [screen, setScreen] = useState<Screen>('list')

  // Check if we're in edit mode from URL
  const isEditMode = searchParams.get('mode') === 'edit'
  const accountNumberParam = searchParams.get('accountNumber') || ''
  const nicknameParam = searchParams.get('nickname') || ''
  const accountNameParam = searchParams.get('accountName') || ''
  const emailParam = searchParams.get('email') || ''

  // Form data state
  const [formData, setFormData] = useState({
    accountNumber: '',
    accountName: '',
    email: '',
    nickname: ''
  })

  // Edit nickname state
  const [nickname, setNickname] = useState('')

  // Validation errors state
  const [errors, setErrors] = useState({
    accountNumber: '',
    accountName: '',
    email: '',
    nickname: ''
  })

  // Load data if in edit mode
  useEffect(() => {
    if (isEditMode) {
      setFormData({
        accountNumber: accountNumberParam,
        accountName: accountNameParam,
        email: emailParam,
        nickname: nicknameParam
      })
      setNickname(nicknameParam || accountNameParam)
      setScreen('edit')
    }
  }, [
    isEditMode,
    accountNumberParam,
    accountNameParam,
    emailParam,
    nicknameParam
  ])

  // ===== VALIDATION FUNCTIONS =====
  const validateField = (name: string, value: string) => {
    let error = ''

    switch (name) {
      case 'accountNumber':
        if (!value.trim()) {
          error = 'Account number is required'
        } else if (!/^\d+$/.test(value)) {
          error = 'Account number must contain only numbers'
        } else if (value.length < 8 || value.length > 20) {
          error = 'Account number must be between 8 and 20 digits'
        }
        break

      case 'accountName':
        if (!value.trim()) {
          error = 'Account name is required'
        } else if (value.trim().length < 2) {
          error = 'Account name must be at least 2 characters'
        } else if (!/^[a-zA-Z\s]+$/.test(value)) {
          error = 'Account name must contain only letters and spaces'
        }
        break

      case 'email':
        if (!value.trim()) {
          error = 'Email is required'
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = 'Please enter a valid email address'
        }
        break

      case 'nickname':
        if (!value.trim()) {
          error = 'Nickname is required'
        } else if (value.trim().length < 2) {
          error = 'Nickname must be at least 2 characters'
        }
        break

      default:
        break
    }

    return error
  }

  const validateForm = () => {
    const newErrors = {
      accountNumber: validateField('accountNumber', formData.accountNumber),
      accountName: validateField('accountName', formData.accountName),
      email: validateField('email', formData.email),
      nickname: validateField('nickname', formData.nickname)
    }

    setErrors(newErrors)

    // Return true if no errors
    return !Object.values(newErrors).some((error) => error !== '')
  }

  // ===== RESET FORM FUNCTION =====
  const resetForm = () => {
    setFormData({
      accountNumber: '',
      accountName: '',
      email: '',
      nickname: ''
    })
    setNickname('')
    setErrors({
      accountNumber: '',
      accountName: '',
      email: '',
      nickname: ''
    })
  }

  // ===== NAVIGATION FUNCTIONS =====
  const goToList = () => {
    resetForm()
    setScreen('list')
    router.push('/bank-accounts')
  }

  const goToAdd = () => {
    resetForm()
    setScreen('add')
    router.push('/bank-accounts?mode=add')
  }

  const goToEdit = () => {
    setScreen('edit')
    router.push('/bank-accounts?mode=edit')
  }

  // ===== FORM HANDLERS =====
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }))

    // Clear error for this field when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const error = validateField(name, value)
    setErrors((prev) => ({
      ...prev,
      [name]: error
    }))
  }

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      // Scroll to first error
      const firstErrorField = document.querySelector(`.${styles.fieldError}`)
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    console.log('Adding new account:', formData)
    alert('Account added successfully!')
    resetForm()
    goToList()
  }

  const handleUpdateAccount = (e: React.FormEvent) => {
    e.preventDefault()

    // Check if at least account number is filled
    if (!formData.accountNumber.trim()) {
      alert('Please enter an account number first')
      return
    }

    // Navigate to edit mode with whatever data is filled
    router.push(
      `/bank-accounts?mode=edit&accountNumber=${formData.accountNumber}&accountName=${formData.accountName || ''}&email=${formData.email || ''}&nickname=${formData.nickname || ''}`
    )
  }

  const handleEditNickname = (e: React.FormEvent) => {
    e.preventDefault()

    if (!nickname.trim()) {
      alert('Please enter a nickname')
      return
    }

    if (nickname.trim().length < 2) {
      alert('Nickname must be at least 2 characters')
      return
    }

    console.log('Updating nickname to:', nickname)
    alert(`Nickname updated to: ${nickname}`)
    resetForm()
    goToList()
  }

  const handleCancel = () => {
    resetForm()
    goToList()
  }

  return (
    <main className={styles.accountsPage}>
      <Sidebar />
      <section className={styles.content}>
        {/* ===== LIST SCREEN ===== */}
        {screen === 'list' && (
          <>
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

            <div className={styles.cardsContainer}>
              <div className={styles.accountCard}>
                <div className={styles.iconEdit} onClick={goToEdit}>
                  ✏️
                </div>
                <div className={styles.iconDelete}>🗑️</div>
                <div className={styles.accountCardContent}>
                  <h2 className={styles.accountName}>Anura</h2>
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
                    Nova Bank <br />
                    Colombo 05
                  </p>
                </div>
              </div>

              <button className={styles.addAccountCard} onClick={goToAdd}>
                <h2 className={styles.addAccountTitle}>Add a Bank Account</h2>
                <div className={styles.addAccountIcon}>+</div>
              </button>
            </div>
          </>
        )}

        {/* ===== ADD SCREEN ===== */}
        {screen === 'add' && (
          <>
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

            <div className={styles.formContainer}>
              <div className={styles.formCard}>
                <div className={styles.formHeader}>
                  <h2 className={styles.formTitle}>Add Another Bank Account</h2>
                </div>

                <form className={styles.formFields}>
                  <div className={styles.formGroup}>
                    <label htmlFor="accountNumber">Bank Account Number:</label>
                    <input
                      type="text"
                      id="accountNumber"
                      name="accountNumber"
                      value={formData.accountNumber}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Enter account number"
                      className={errors.accountNumber ? styles.inputError : ''}
                      required
                    />
                    {errors.accountNumber && (
                      <span className={styles.fieldError}>
                        {errors.accountNumber}
                      </span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="accountName">Bank Account Name:</label>
                    <input
                      type="text"
                      id="accountName"
                      name="accountName"
                      value={formData.accountName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Enter account holder name"
                      className={errors.accountName ? styles.inputError : ''}
                      required
                    />
                    {errors.accountName && (
                      <span className={styles.fieldError}>
                        {errors.accountName}
                      </span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="email">Email:</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Enter email address"
                      className={errors.email ? styles.inputError : ''}
                      required
                    />
                    {errors.email && (
                      <span className={styles.fieldError}>{errors.email}</span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="nickname">Nickname:</label>
                    <input
                      type="text"
                      id="nickname"
                      name="nickname"
                      value={formData.nickname}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Enter a nickname"
                      className={errors.nickname ? styles.inputError : ''}
                      required
                    />
                    {errors.nickname && (
                      <span className={styles.fieldError}>
                        {errors.nickname}
                      </span>
                    )}
                  </div>

                  <div className={styles.formActionsBottom}>
                    <button
                      type="button"
                      className={styles.btnCancel}
                      onClick={handleCancel}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.btnAdd}
                      onClick={handleAddAccount}
                    >
                      Add Account
                    </button>
                    <button
                      type="button"
                      className={styles.btnUpdate}
                      onClick={handleUpdateAccount}
                    >
                      Update Account
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}

        {/* ===== EDIT SCREEN ===== */}
        {screen === 'edit' && (
          <>
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

            <div className={styles.formContainer}>
              <div className={styles.formCard}>
                <div className={styles.formHeader}>
                  <h2 className={styles.formTitle}>Edit the nickname</h2>
                </div>

                <form
                  onSubmit={handleEditNickname}
                  className={styles.formFields}
                >
                  <div className={styles.formGroup}>
                    <label htmlFor="accountNumber">Bank Account Number:</label>
                    <input
                      type="text"
                      id="accountNumber"
                      value={formData.accountNumber || '1234567890'}
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
          </>
        )}
      </section>
    </main>
  )
}
