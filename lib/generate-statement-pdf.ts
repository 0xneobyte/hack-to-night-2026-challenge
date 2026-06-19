/**
 * Generates and triggers a browser download of a Nova Bank e-statement PDF.
 *
 * Uses jsPDF + jspdf-autotable entirely client-side — no server round-trip.
 * Import only inside a 'use client' component (or dynamic import) to avoid
 * bundling jsPDF on the server.
 */

interface Account {
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

interface StatementData {
  account: Account
  transactions: Transaction[]
  openingBalance: number
  totalCredits: number
  totalDebits: number
}

function fmt(n: number) {
  return `Rs. ${n.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export async function generateStatementPDF(data: StatementData) {
  // Dynamic import keeps jsPDF out of the server bundle
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const { account, transactions, openingBalance, totalCredits, totalDebits } =
    data
  const closingBalance = account.balance

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14

  // ── Header band ───────────────────────────────────────────────────────────
  doc.setFillColor(69, 0, 67) // #450043 — Nova Bank purple
  doc.rect(0, 0, pageW, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('NOVA BANK', margin, 12)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Secure · Reliable · Modern Banking', margin, 19)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('ACCOUNT STATEMENT', pageW - margin, 12, { align: 'right' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    pageW - margin,
    19,
    { align: 'right' }
  )

  // ── Account info block ────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('ACCOUNT DETAILS', margin, 36)

  doc.setFont('helvetica', 'normal')
  const details = [
    ['Account Name', account.account_name],
    ['Account Number', account.account_number]
  ]
  let detailY = 42
  for (const [label, value] of details) {
    doc.setFont('helvetica', 'bold')
    doc.text(`${label}:`, margin, detailY)
    doc.setFont('helvetica', 'normal')
    doc.text(value, margin + 35, detailY)
    detailY += 6
  }

  // ── Summary boxes ─────────────────────────────────────────────────────────
  const summaryY = 56
  const boxW = (pageW - margin * 2 - 9) / 4
  const boxH = 16
  const summaryItems = [
    {
      label: 'Opening Balance',
      value: fmt(openingBalance),
      color: [240, 240, 240] as [number, number, number]
    },
    {
      label: 'Total Credits',
      value: fmt(totalCredits),
      color: [220, 245, 220] as [number, number, number]
    },
    {
      label: 'Total Debits',
      value: fmt(totalDebits),
      color: [250, 220, 220] as [number, number, number]
    },
    {
      label: 'Closing Balance',
      value: fmt(closingBalance),
      color: [225, 215, 240] as [number, number, number]
    }
  ]

  summaryItems.forEach(({ label, value, color }, i) => {
    const x = margin + i * (boxW + 3)
    doc.setFillColor(...color)
    doc.roundedRect(x, summaryY, boxW, boxH, 2, 2, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(label, x + boxW / 2, summaryY + 5, { align: 'center' })
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(value, x + boxW / 2, summaryY + 12, { align: 'center' })
  })

  // ── Transactions table ────────────────────────────────────────────────────
  const rows = transactions.map((t) => {
    const isDebit = t.from_account === account.account_number
    return [
      fmtDate(t.created_at),
      t.description || '-',
      `TXN-${t.id}`,
      isDebit ? fmt(t.amount) : '-',
      !isDebit ? fmt(t.amount) : '-',
      t.status
    ]
  })

  autoTable(doc, {
    startY: summaryY + boxH + 6,
    head: [['Date', 'Description', 'Ref', 'Debit', 'Credit', 'Status']],
    body:
      rows.length > 0 ? rows : [['', 'No transactions found', '', '', '', '']],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: [69, 0, 67],
      textColor: 255,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 24 },
      2: { cellWidth: 22, textColor: [120, 120, 120] },
      3: { halign: 'right', textColor: [180, 30, 30] },
      4: { halign: 'right', textColor: [22, 130, 60] },
      5: { cellWidth: 20 }
    },
    alternateRowStyles: { fillColor: [250, 248, 252] }
  })

  // ── Footer on every page ──────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setTextColor(140, 140, 140)
    doc.setFont('helvetica', 'normal')
    doc.text(
      'This is a computer-generated statement. No signature required. Nova Bank — All rights reserved.',
      pageW / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    )
    doc.text(
      `Page ${p} of ${pageCount}`,
      pageW - margin,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'right' }
    )
  }

  // ── Download ──────────────────────────────────────────────────────────────
  const filename = `nova-bank-statement-${account.account_number}-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
