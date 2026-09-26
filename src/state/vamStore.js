// Mock database + transaction routing logic for the VAM prototype.
// Money is held internally as integer cents so the reconciliation
// invariant (sum of virtual balances === master real balance) is exact.

export const initialState = {
  masterAccount: {
    id: 'MA-001',
    accountName: 'Alpha Property Holdings',
    realBalance: 0, // cents
    currency: 'USD',
  },
  virtualAccounts: [
    { vIban: 'VA-1001', alias: 'Retail Store A', virtualBalance: 0, status: 'Active' },
    { vIban: 'VA-1002', alias: 'Warehouse B', virtualBalance: 0, status: 'Active' },
    { vIban: 'VA-1003', alias: 'Office Block C', virtualBalance: 0, status: 'Active' },
  ],
  ledger: [], // { id, timestamp, payerName, amount, targetVIban, status }
};

export const toCents = (value) => Math.round(Number(value) * 100);

export const formatMoney = (cents, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

export const sumVirtualBalances = (accounts) =>
  accounts.reduce((total, va) => total + va.virtualBalance, 0);

export const isReconciled = (state) =>
  sumVirtualBalances(state.virtualAccounts) === state.masterAccount.realBalance;

let txSeq = 0;
const nextTxId = () => {
  txSeq += 1;
  return `TXN-${String(txSeq).padStart(6, '0')}`;
};

/**
 * Validate a simulated incoming payment. Returns an error message or null.
 */
export function validatePayment({ payerName, amount, targetVIban }, virtualAccounts) {
  if (!payerName || !payerName.trim()) return 'Payer name is required.';
  if (amount === '' || amount === null || amount === undefined) return 'Amount is required.';
  const cents = toCents(amount);
  if (!Number.isFinite(cents) || cents <= 0) return 'Amount must be a positive number.';
  if (!targetVIban) return 'Select a target vIBAN.';
  const target = virtualAccounts.find((va) => va.vIban === targetVIban);
  if (!target) return `vIBAN ${targetVIban} does not exist.`;
  if (target.status !== 'Active') return `vIBAN ${targetVIban} is not active.`;
  return null;
}

/**
 * Core routing: credit the virtual ledger AND the physical master account
 * by the same amount in a single atomic state transition, then log it.
 */
export function vamReducer(state, action) {
  switch (action.type) {
    case 'SIMULATE_INCOMING_PAYMENT': {
      const { payerName, amount, targetVIban } = action.payload;
      const error = validatePayment(action.payload, state.virtualAccounts);
      const cents = toCents(amount);

      if (error) {
        return {
          ...state,
          ledger: [
            {
              id: nextTxId(),
              timestamp: new Date().toISOString(),
              payerName: payerName?.trim() || '—',
              amount: Number.isFinite(cents) ? cents : 0,
              targetVIban: targetVIban || '—',
              status: 'Rejected',
              reason: error,
            },
            ...state.ledger,
          ],
        };
      }

      // 1. Credit virtual ledger
      const virtualAccounts = state.virtualAccounts.map((va) =>
        va.vIban === targetVIban ? { ...va, virtualBalance: va.virtualBalance + cents } : va,
      );

      // 2. Credit physical master account with the exact same amount
      const masterAccount = {
        ...state.masterAccount,
        realBalance: state.masterAccount.realBalance + cents,
      };

      // 3. Log transaction
      const ledger = [
        {
          id: nextTxId(),
          timestamp: new Date().toISOString(),
          payerName: payerName.trim(),
          amount: cents,
          targetVIban,
          status: 'Credited',
        },
        ...state.ledger,
      ];

      const next = { masterAccount, virtualAccounts, ledger };

      // Invariant guard: never commit a state that breaks reconciliation.
      if (!isReconciled(next)) {
        console.error('Reconciliation invariant violated; transaction rolled back.');
        return state;
      }
      return next;
    }

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}
