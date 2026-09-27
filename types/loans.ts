export type LoanType = 'commercial' | 'consumer' | 'vehicle' | 'housing' | 'other'

export interface LoanInstallment {
  installment_no: number
  due_date: string
  total_amount: number
  principal_amount: number
  interest_amount: number
  tax_amount?: number // BSMV / KKDF
  remaining_principal_after: number
  status: 'pending' | 'paid'
  payment_date?: string | null
  bank_account_id?: string | null
  bank_tx_id?: string | null
  expense_tx_id?: string | null
  is_opening_settled?: boolean
  notes?: string | null
}

export interface BankLoan {
  id: string
  loan_name: string
  bank_name: string
  loan_reference_no?: string | null
  bank_account_id: string | null
  company_id: string | null
  loan_type: LoanType
  principal_amount: number
  interest_rate: number
  tax_rate_type?: 'commercial_bsmv' | 'consumer_tax' | 'none'
  total_installments: number
  paid_installments: number
  monthly_installment: number
  total_payment: number
  total_interest: number
  total_tax?: number
  remaining_principal: number
  remaining_total: number
  currency: string
  start_date: string
  first_due_date: string
  insurance_amount?: number
  net_disbursed_amount?: number
  status: 'active' | 'completed' | 'cancelled'
  notes?: string | null
  installments_plan: LoanInstallment[]
  created_at?: string
  updated_at?: string
  company?: { name: string; is_personal: boolean }
  bank_account?: { bank_name: string; account_name?: string; currency?: string }
}
