# Virtual Account Management (VAM) — Prototype

A single-page prototype of a corporate banking **Virtual Account Management** dashboard, built with React + Vite + Tailwind CSS. All data lives in local React state (a `useReducer` store) that stands in for a database.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## What it does

- **Master account header**: Alpha Property Holdings (`MA-001`, USD) with its real balance, the sum of virtual balances and a live reconciliation indicator.
- **Virtual accounts table**: `VA-1001` Retail Store A, `VA-1002` Warehouse B, `VA-1003` Office Block C, with balances and a total row.
- **Transaction simulator**: payer name, amount and target vIBAN; "Simulate Incoming Payment" routes the wire.
- **Recent transactions**: the ledger, newest first.

## Routing logic (`src/state/vamStore.js`)

1. **Validate**: payer, a positive amount and an active target vIBAN are required.
2. **Credit virtual ledger**: add the amount to the target vIBAN's `virtualBalance`.
3. **Credit master account**: add the same amount to `realBalance`.
4. **Log**: prepend `{ id, timestamp, payerName, amount, targetVIban, status }` to the ledger.

Steps 2–4 happen in one reducer transition, so the UI never sees a half-applied payment. Balances are stored as **integer cents**, so `Σ virtualBalance === realBalance` holds exactly (no floating-point drift such as 0.1 + 0.2). The reducer also checks this invariant before committing and rolls back if it would break.
