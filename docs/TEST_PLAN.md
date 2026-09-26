# Test Plan: VAM Dashboard Prototype

| | |
|---|---|
| **Application** | Virtual Account Management (VAM) dashboard, `perpetualxbeta-ai/vam-dashboard` |
| **Version under test** | `main` branch |
| **Document status** | Draft v1.0, 26 Sep 2026 |
| **Related docs** | [README](../README.md), [Architecture](ARCHITECTURE.md) |

## Contents

1. [Purpose and scope](#1-purpose-and-scope)
2. [Requirements under test](#2-requirements-under-test)
3. [Test approach](#3-test-approach)
4. [Environments and test data](#4-environments-and-test-data)
5. [Entry and exit criteria](#5-entry-and-exit-criteria)
6. [Test cases](#6-test-cases)
7. [Traceability matrix](#7-traceability-matrix)
8. [Known defects and observations](#8-known-defects-and-observations)
9. [Risks](#9-risks)
10. [Automation roadmap](#10-automation-roadmap)

---

## 1. Purpose and scope

This plan defines how the VAM prototype is verified against its requirements. Most of the weight goes on the **payment routing logic and the reconciliation invariant**, because that is where a defect would matter in a real banking product.

**In scope**
- Mock data model and initial state
- Transaction simulator form and validation
- Payment routing: crediting the virtual ledger, crediting the master account, writing the ledger entry
- Reconciliation invariant: `Σ virtualBalance = realBalance`
- Dashboard rendering: header card, virtual accounts table, recent transactions
- Sample data and reset controls
- Responsive layout, basic accessibility, GitHub Pages deployment

**Out of scope**
- Persistence (by design, state is in memory and a page refresh resets it)
- Authentication, authorisation, multi-user concurrency
- Real payment rails, core banking integration, FX, sanctions screening (see the target state in [ARCHITECTURE.md §7](ARCHITECTURE.md#7-target-state-production-architecture-illustrative))
- Performance and load testing beyond a basic volume check

---

## 2. Requirements under test

| ID | Requirement | Source |
|---|---|---|
| **R1** | Initialise master account `MA-001` (Alpha Property Holdings, USD, balance 0), three active vIBANs `VA-1001..1003` at balance 0, and an empty ledger | Original spec §1 |
| **R2** | Header card shows the master account name and real balance in large text | Spec §2 |
| **R3** | Virtual accounts table lists vIBAN, alias and virtual balance | Spec §2 |
| **R4** | Simulator has Payer Name, Amount, Target vIBAN and a "Simulate Incoming Payment" button | Spec §2 |
| **R5** | Validation: an amount and a target vIBAN are required | Spec §3.1 |
| **R6** | Credit the selected vIBAN's `virtualBalance` by the amount | Spec §3.2 |
| **R7** | Credit the master `realBalance` by the exact same amount | Spec §3.3 |
| **R8** | The sum of all virtual balances always equals the master real balance | Spec §3.3 (crucial rule) |
| **R9** | Log `{ id, timestamp, payerName, amount, targetVIban, status }` and show recent transactions at the bottom | Spec §3.4 |
| **R10** | Enterprise look: corporate blues, greys and white, clear type, subtle card shadows | Spec §4 |
| **R11** | Load sample payments and reset controls | Added feature |
| **R12** | App is published to GitHub Pages on push to `main` | Added feature |

---

## 3. Test approach

| Level | What it covers | Tooling | Status |
|---|---|---|---|
| **Unit** | `vamReducer`, `validatePayment`, `toCents`, `formatMoney`, `isReconciled` as pure functions | Vitest | Planned |
| **Component** | Rendering and form behaviour of `TransactionSimulator`, tables, header | Vitest + React Testing Library | Planned |
| **End-to-end** | Full user journeys in a real browser against `vite preview` | Playwright | Planned (smoke run done manually during build) |
| **Property-based** | Random sequences of payments never break the invariant | fast-check with Vitest | Planned |
| **Manual / exploratory** | Visual polish, responsive layout, accessibility | Browser, DevTools, axe | Each release |

**Priority key:** **P1** blocks release · **P2** must fix before a demo · **P3** nice to have.

---

## 4. Environments and test data

| Environment | How to run | Notes |
|---|---|---|
| Local dev | `npm run dev` → http://localhost:5173 | React StrictMode is on, so reducers run twice (see DEF-01) |
| Local production build | `npm run build && npm run preview` → http://localhost:4173 | Main target for E2E tests |
| GitHub Pages | https://perpetualxbeta-ai.github.io/vam-dashboard/ | Post-deploy smoke test |

**Browsers:** latest Chrome, Edge, Safari and Firefox on desktop; Safari on iOS and Chrome on Android at 390 px width.

**Standard test data**

| Set | Payments | Expected result |
|---|---|---|
| **TD-1** Sample | Harbourline Retail Pte Ltd $18,250.00 → VA-1001 · Meridian Freight Co. $7,420.35 → VA-1002 · Crestview Advisory LLP $32,600.00 → VA-1003 | Master $58,270.35 |
| **TD-2** Float trap | $0.10 → VA-1002, then $0.20 → VA-1002 | VA-1002 and master both exactly $0.30 |
| **TD-3** Mixed | $12,500.50 → VA-1001 · $0.10 → VA-1002 · $0.20 → VA-1002 · $48,000 → VA-1003 | Master $60,500.80 |

---

## 5. Entry and exit criteria

**Entry**
- `npm ci` and `npm run build` succeed with no errors
- Build is deployed to the environment under test

**Exit**
- 100% of P1 cases pass
- At least 95% of P2 cases pass, and every failure has a logged defect with an owner
- No open defect breaks the reconciliation invariant (R8)
- The GitHub Pages smoke test (TC-DEP-01) passes

---

## 6. Test cases

### 6.1 Initial state (R1, R2, R3)

| ID | Title | Steps | Expected result | Pri | Level |
|---|---|---|---|---|---|
| TC-INIT-01 | Master account initialises | Open the app | Header shows "Alpha Property Holdings", "MA-001 · USD", real balance **$0.00** | P1 | E2E, Unit |
| TC-INIT-02 | Three vIBANs initialise | Open the app | Table lists VA-1001 Retail Store A, VA-1002 Warehouse B, VA-1003 Office Block C, each **$0.00** and **Active**; total row $0.00 | P1 | E2E, Unit |
| TC-INIT-03 | Ledger starts empty | Open the app | "No transactions yet" empty state; subtitle "0 entries in ledger" | P2 | E2E |
| TC-INIT-04 | Reconciliation starts balanced | Open the app | Σ Virtual balances $0.00; indicator green, "Balanced" | P1 | E2E |
| TC-INIT-05 | Refresh clears state | Post a payment, reload the page | Everything returns to the TC-INIT-01..04 state | P3 | E2E |

### 6.2 Form validation (R4, R5)

| ID | Title | Steps | Expected result | Pri | Level |
|---|---|---|---|---|---|
| TC-VAL-01 | Form fields present | Inspect simulator | Payer Name (text), Amount (number, $ prefix), Target vIBAN (dropdown listing all three vIBANs with alias), "Simulate Incoming Payment" button | P1 | Component |
| TC-VAL-02 | Empty form | Click submit with all fields blank | Error "Payer name is required."; no balances change; no ledger entry | P1 | Component, E2E |
| TC-VAL-03 | Blank payer (spaces only) | Payer "   ", amount 100, VA-1001 | Error "Payer name is required."; no change | P2 | Unit |
| TC-VAL-04 | Missing amount | Payer filled, amount blank, VA-1001 | Error "Amount is required."; no change | P1 | Unit, E2E |
| TC-VAL-05 | Zero amount | Amount 0 | Error "Amount must be a positive number." | P1 | Unit |
| TC-VAL-06 | Negative amount | Amount -500 | Error "Amount must be a positive number."; no debit happens | P1 | Unit, E2E |
| TC-VAL-07 | Amount below one cent | Amount 0.004 | Rejected as not positive (rounds to 0 cents) | P2 | Unit |
| TC-VAL-08 | Missing target vIBAN | Payer and amount filled, no vIBAN | Error "Select a target vIBAN."; no change | P1 | Unit, E2E |
| TC-VAL-09 | Unknown vIBAN | Dispatch payment to `VA-9999` directly to the reducer | Rejected with "vIBAN VA-9999 does not exist."; balances unchanged; ledger entry with status **Rejected** | P1 | Unit |
| TC-VAL-10 | Inactive vIBAN | Set a vIBAN's status to `Frozen` in test state, dispatch a payment to it | Rejected with "vIBAN … is not active."; dropdown shows that option disabled | P2 | Unit, Component |
| TC-VAL-11 | Error clears on edit | Trigger TC-VAL-02, then type in any field | Error message disappears | P3 | Component |
| TC-VAL-12 | Non-numeric amount | Type letters into Amount | Browser blocks the input, or the reducer rejects `NaN` | P2 | Unit |

### 6.3 Payment routing and reconciliation (R6, R7, R8, R9)

| ID | Title | Steps | Expected result | Pri | Level |
|---|---|---|---|---|---|
| TC-RTE-01 | Credit target vIBAN | Post $1,000.00 to VA-1001 | VA-1001 = $1,000.00; VA-1002 and VA-1003 unchanged | P1 | Unit, E2E |
| TC-RTE-02 | Credit master by same amount | Same as TC-RTE-01 | Real balance = $1,000.00 | P1 | Unit, E2E |
| TC-RTE-03 | Invariant after one payment | Same as TC-RTE-01 | Σ virtual = real; indicator "Balanced" | P1 | Unit, E2E |
| TC-RTE-04 | Multiple vIBANs | Post TD-1 | VA-1001 $18,250.00, VA-1002 $7,420.35, VA-1003 $32,600.00; master and table total $58,270.35 | P1 | E2E |
| TC-RTE-05 | Repeated payments to one vIBAN | Post $100 to VA-1002 three times | VA-1002 $300.00; master $300.00 | P1 | Unit |
| TC-RTE-06 | Floating-point safety | Post TD-2 | Exactly $0.30 on both sides, never $0.30000000000000004 | P1 | Unit, E2E |
| TC-RTE-07 | Mixed decimal amounts | Post TD-3 | Master $60,500.80; invariant holds | P1 | E2E |
| TC-RTE-08 | Large amount | Post $999,999,999.99 | Balances display correctly with thousands separators; invariant holds | P2 | Unit |
| TC-RTE-09 | Atomic update | Unit test: after a valid dispatch, compare old and new state | Both balances and the ledger change in one returned state object; old state object not mutated | P1 | Unit |
| TC-RTE-10 | Invariant guard rolls back | Unit test: start from a state where real ≠ Σ virtual, dispatch a valid payment | Reducer returns the original state unchanged and logs an error | P1 | Unit |
| TC-RTE-11 | Invariant under random load | Property test: 1,000 random sequences of 1–50 valid payments | Σ virtual = real after every step | P1 | Property |
| TC-RTE-12 | Rejected payment leaves balances alone | Dispatch an invalid payment directly | All balances unchanged; invariant still holds | P1 | Unit |

### 6.4 Transaction ledger (R9)

| ID | Title | Steps | Expected result | Pri | Level |
|---|---|---|---|---|---|
| TC-LED-01 | Entry fields | Post one payment | Row shows transaction ID (`TXN-######`), timestamp, payer, target vIBAN with alias, **Credited** badge, `+$amount` | P1 | E2E, Unit |
| TC-LED-02 | Newest first | Post three payments | Most recent payment is at the top | P2 | E2E |
| TC-LED-03 | Unique IDs | Post 20 payments | All transaction IDs are unique | P1 | Unit |
| TC-LED-04 | Timestamp is ISO 8601 | Inspect a ledger record in a unit test | `timestamp` parses as a valid date within a second of now | P2 | Unit |
| TC-LED-05 | Payer name trimmed | Payer "  Acme Ltd  " | Ledger shows "Acme Ltd" | P3 | Unit |
| TC-LED-06 | Entry count label | Post 1, then 2 payments | Subtitle reads "1 entry in ledger", then "2 entries in ledger" | P3 | Component |

### 6.5 Simulator UX

| ID | Title | Steps | Expected result | Pri | Level |
|---|---|---|---|---|---|
| TC-UX-01 | Confirmation message | Post a valid payment to VA-1002 | Green message "Payment routed to VA-1002." | P2 | Component |
| TC-UX-02 | Form resets after success | Same as TC-UX-01 | All three fields return to blank or placeholder | P2 | Component |
| TC-UX-03 | Enter key submits | Fill the form, press Enter in the Amount field | Payment posts, same as clicking the button | P3 | E2E |

### 6.6 Sample data and reset (R11)

| ID | Title | Steps | Expected result | Pri | Level |
|---|---|---|---|---|---|
| TC-SMP-01 | Load sample payments | Click "Load sample payments" on a fresh page | TD-1 results; 3 ledger entries; indicator "Balanced" | P2 | E2E |
| TC-SMP-02 | Sample goes through normal routing | Unit test on the `LOAD_SAMPLE` action | Result equals dispatching the three TD-1 payments one by one | P2 | Unit |
| TC-SMP-03 | Load sample twice | Click it twice | Balances double (master $116,540.70); 6 entries; invariant holds | P3 | E2E |
| TC-SMP-04 | Reset | Post payments, click "Reset mock data" | All balances $0.00, ledger empty, indicator "Balanced" | P2 | E2E, Unit |

### 6.7 UI, responsive and accessibility (R2, R3, R10)

| ID | Title | Steps | Expected result | Pri | Level |
|---|---|---|---|---|---|
| TC-UI-01 | Visual style | Review at 1360 px | Navy top bar, navy gradient header card, white cards with subtle shadows on a light slate background; balance in large type | P2 | Manual |
| TC-UI-02 | Currency format | Post $1234.5 | Displays "$1,234.50" everywhere | P2 | Unit, E2E |
| TC-UI-03 | Numbers align | Review balance columns | Right-aligned, tabular figures line up | P3 | Manual |
| TC-UI-04 | Mobile layout | View at 390 px | Single column; page never scrolls sideways; accounts table hides Status and fits; ledger table scrolls within its card | P2 | E2E, Manual |
| TC-UI-05 | Tablet layout | View at 768 px | Cards stack cleanly; no overlap or clipped text | P3 | Manual |
| TC-UI-06 | Labels | Inspect form | Each input has a `<label for>` matching its `id` | P2 | Component |
| TC-UI-07 | Errors announced | Trigger a validation error | Error element has `role="alert"` | P2 | Component |
| TC-UI-08 | Keyboard only | Complete a payment using only Tab, typing and Enter | Every control is reachable in order with a visible focus ring | P2 | Manual |
| TC-UI-09 | Automated a11y scan | Run axe on the page | No serious or critical violations | P2 | E2E |
| TC-UI-10 | Colour contrast | Check text and badges | WCAG AA (4.5:1 for body text) | P3 | Manual |

### 6.8 Build and deployment (R12)

| ID | Title | Steps | Expected result | Pri | Level |
|---|---|---|---|---|---|
| TC-DEP-01 | Pages smoke test | After a push to `main`, open the Pages URL | App loads with no console errors; TC-SMP-01 passes | P1 | Manual, E2E |
| TC-DEP-02 | Workflow succeeds | Check the Actions tab after a push | "Deploy to GitHub Pages" run is green | P1 | Manual |
| TC-DEP-03 | Relative asset paths | Load the Pages URL (served from `/vam-dashboard/`) | CSS and JS load; no 404s in the network panel | P1 | Manual |
| TC-DEP-04 | Clean install | `npm ci && npm run build` on a fresh clone | Build succeeds with no errors | P1 | CI |

---

## 7. Traceability matrix

| Requirement | Test cases |
|---|---|
| R1 Initial data | TC-INIT-01, 02, 03 |
| R2 Header card | TC-INIT-01, TC-UI-01 |
| R3 Accounts table | TC-INIT-02, TC-RTE-04 |
| R4 Simulator form | TC-VAL-01 |
| R5 Validation | TC-VAL-02 … 12 |
| R6 Credit vIBAN | TC-RTE-01, 04, 05 |
| R7 Credit master | TC-RTE-02, 04, 08 |
| R8 Invariant | TC-INIT-04, TC-RTE-03, 06, 07, 09, 10, 11, 12, TC-SMP-03 |
| R9 Ledger | TC-LED-01 … 06 |
| R10 Visual polish | TC-UI-01 … 10 |
| R11 Sample / reset | TC-SMP-01 … 04 |
| R12 Deployment | TC-DEP-01 … 04 |

---

## 8. Known defects and observations

Found during exploratory testing on 26 Sep 2026.

| ID | Severity | Summary | Details | Suggested fix |
|---|---|---|---|---|
| **DEF-01** | Low | Transaction IDs skip numbers in dev mode | Under `npm run dev`, React StrictMode runs the reducer twice. `nextTxId()` is a side effect, so the first sample load produces TXN-000004…000006 instead of 000001…000003. Production builds are unaffected. | Keep the ID counter in state (for example `state.nextTxSeq`) so the reducer stays pure |
| **DEF-02** | Low | IDs don't restart after reset | After "Reset mock data" the next IDs continue from the previous sequence (e.g. TXN-000010). | Same fix as DEF-01; `RESET` then restores the counter too |
| **DEF-03** | Medium | Amounts with more than 2 decimals are silently rounded | Entering 1.005 credits $1.00, and 0.005 credits $0.01, with no warning. The invariant still holds, but the operator sees a different amount from the one entered. | Reject amounts with more than 2 decimal places in `validatePayment` |
| OBS-01 | Info | Rejected ledger entries only reachable through direct dispatch | The form validates before dispatching, so the UI never shows a **Rejected** row. The reducer path is covered by unit tests TC-VAL-09 and TC-RTE-12. | None needed for the prototype |

---

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| No automated tests yet | Regressions in routing logic could ship unnoticed | Deliver unit and property tests first (§10) |
| Floating-point money handling reintroduced by a future change | Invariant breaks | Keep TC-RTE-06 and TC-RTE-11 in CI as release blockers |
| Module-level state (`txSeq`) | Non-deterministic IDs in tests and dev | Fix DEF-01; reset between tests until then |
| Demo audiences may read the prototype as production-ready | Wrong expectations | Footer disclaimer; ARCHITECTURE.md §7 describes the real target state |

---

## 10. Automation roadmap

| Step | Deliverable | Covers |
|---|---|---|
| 1 | Add Vitest; unit tests for `vamStore.js` | TC-VAL, TC-RTE-01…12, TC-LED-03…05, TC-SMP-02, 04 |
| 2 | Property test with fast-check for the invariant | TC-RTE-11 |
| 3 | React Testing Library tests for the simulator | TC-VAL-01, 11, TC-UX-01, 02, TC-LED-06, TC-UI-06, 07 |
| 4 | Playwright E2E suite against `vite preview`, with axe | TC-INIT, TC-RTE-04, 06, 07, TC-SMP, TC-UI-04, 09 |
| 5 | Add a `test` job to `.github/workflows/deploy.yml` that must pass before deploy | TC-DEP-04; keeps P1 cases blocking |

Proposed scripts once tooling is added:

```bash
npm test            # Vitest unit + component tests
npm run test:e2e    # Playwright against a production build
```
