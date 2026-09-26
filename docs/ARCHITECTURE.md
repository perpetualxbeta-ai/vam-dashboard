# Architecture

This document describes how the VAM prototype works today, and sketches how the same design would map onto a production banking platform. Diagrams are written in [Mermaid](https://mermaid.js.org/) so GitHub renders them inline and they can be edited as text.

1. [Business concept: master account and vIBANs](#1-business-concept-master-account-and-vibans)
2. [Application components](#2-application-components)
3. [Data model](#3-data-model)
4. [Payment routing sequence](#4-payment-routing-sequence)
5. [Validation and posting logic](#5-validation-and-posting-logic)
6. [Build and deployment](#6-build-and-deployment)
7. [Target-state production architecture (illustrative)](#7-target-state-production-architecture-illustrative)

---

## 1. Business concept: master account and vIBANs

A corporate client holds **one physical account** at the bank. Each business unit, property or customer gets its own **virtual account number (vIBAN)**. Payers wire money to the vIBAN; cash physically lands in the master account, while a virtual sub-ledger records which vIBAN it belongs to.

```mermaid
flowchart LR
    subgraph Payers["External payers"]
        P1["Harbourline Retail<br/>Pte Ltd"]
        P2["Meridian Freight Co."]
        P3["Crestview Advisory LLP"]
    end

    subgraph Bank["Bank"]
        subgraph VL["Virtual sub-ledger (identification layer)"]
            V1["VA-1001<br/>Retail Store A"]
            V2["VA-1002<br/>Warehouse B"]
            V3["VA-1003<br/>Office Block C"]
        end
        MA[("MA-001<br/>Alpha Property Holdings<br/>Physical master account · USD")]
    end

    P1 -- "wire to VA-1001" --> V1
    P2 -- "wire to VA-1002" --> V2
    P3 -- "wire to VA-1003" --> V3
    V1 -- "cash settles" --> MA
    V2 -- "cash settles" --> MA
    V3 -- "cash settles" --> MA
```

**Core invariant:** `Σ virtualBalance (all vIBANs) = realBalance (MA-001)`. The app checks this on every posting and shows it in the header as the reconciliation indicator.

---

## 2. Application components

A single-page React app. All state lives in one `useReducer` store; UI components read from it and send actions to it. There is no backend: the reducer stands in for the database and the posting engine.

```mermaid
flowchart TB
    subgraph Browser["Browser (single-page app)"]
        direction TB
        subgraph UI["UI layer · src/App.jsx"]
            App["App<br/>(owns the store)"]
            Top["TopBar"]
            Hdr["MasterAccountHeader<br/>real balance · Σ virtual · reconciliation"]
            Tbl["VirtualAccountsTable"]
            Sim["TransactionSimulator<br/>form + client-side validation"]
            Led["TransactionLedger"]
        end

        subgraph Store["State layer · src/state/vamStore.js"]
            Red["vamReducer<br/>SIMULATE_INCOMING_PAYMENT<br/>LOAD_SAMPLE · RESET"]
            Val["validatePayment()"]
            Rec["isReconciled()<br/>sumVirtualBalances()"]
            Init[("initialState<br/>masterAccount · virtualAccounts · ledger")]
        end
    end

    App --> Top & Hdr & Tbl & Sim & Led
    Sim -- "dispatch(action)" --> App
    App -- "dispatch" --> Red
    Red --> Val
    Red --> Rec
    Init -. "seeds" .-> Red
    Red -- "new state" --> App
    Sim -. "pre-check" .-> Val
```

| Layer | File | Responsibility |
|---|---|---|
| UI | `src/App.jsx` | Rendering, form input, dispatching actions |
| State / domain | `src/state/vamStore.js` | Mock database, validation, atomic posting, reconciliation guard |
| Styling | `tailwind.config.js`, `src/index.css` | Corporate navy / slate palette, card shadows |

---

## 3. Data model

Money is stored as **integer cents** to keep the invariant exact (no floating-point drift).

```mermaid
erDiagram
    MASTER_ACCOUNT ||--|{ VIRTUAL_ACCOUNT : "funds held for"
    VIRTUAL_ACCOUNT ||--o{ TRANSACTION : "receives"

    MASTER_ACCOUNT {
        string id PK "MA-001"
        string accountName "Alpha Property Holdings"
        int realBalance "cents"
        string currency "USD"
    }
    VIRTUAL_ACCOUNT {
        string vIban PK "VA-1001..1003"
        string alias "Retail Store A"
        int virtualBalance "cents"
        string status "Active"
    }
    TRANSACTION {
        string id PK "TXN-000001"
        datetime timestamp "ISO 8601"
        string payerName
        int amount "cents"
        string targetVIban FK
        string status "Credited or Rejected"
    }
```

---

## 4. Payment routing sequence

What happens when the operator clicks **Simulate Incoming Payment**.

```mermaid
sequenceDiagram
    autonumber
    actor Op as Treasury operator
    participant Sim as TransactionSimulator
    participant App as App (useReducer)
    participant Red as vamReducer
    participant VA as Virtual accounts
    participant MA as Master account
    participant L as Ledger

    Op->>Sim: Enter payer, amount, target vIBAN
    Op->>Sim: Click "Simulate Incoming Payment"
    Sim->>Sim: validatePayment()
    alt Invalid input
        Sim-->>Op: Show error (e.g. "Select a target vIBAN.")
    else Valid
        Sim->>App: dispatch SIMULATE_INCOMING_PAYMENT
        App->>Red: reducer(state, action)
        Red->>Red: Re-validate, convert amount to cents
        Red->>VA: virtualBalance += amount (target vIBAN)
        Red->>MA: realBalance += amount
        Red->>L: Prepend {id, timestamp, payer, amount, vIBAN, "Credited"}
        Red->>Red: isReconciled(next)?
        alt Invariant holds
            Red-->>App: Commit next state
            App-->>Op: Re-render balances, ledger, "Balanced"
        else Invariant broken
            Red-->>App: Return previous state (rollback)
        end
    end
```

Steps 6 to 9 happen inside one reducer call, so React never renders a state where only one side was credited.

---

## 5. Validation and posting logic

```mermaid
flowchart TD
    A([Payment request]) --> B{Payer name<br/>present?}
    B -- No --> X1[/"Reject: Payer name is required."/]
    B -- Yes --> C{Amount is a<br/>positive number?}
    C -- No --> X2[/"Reject: Amount must be positive."/]
    C -- Yes --> D{Target vIBAN<br/>selected and exists?}
    D -- No --> X3[/"Reject: Select a target vIBAN."/]
    D -- Yes --> E{vIBAN status<br/>= Active?}
    E -- No --> X4[/"Reject: vIBAN is not active."/]
    E -- Yes --> F["Convert amount to integer cents"]
    F --> G["Credit virtualBalance of target vIBAN"]
    G --> H["Credit realBalance of MA-001"]
    H --> I["Append ledger entry (Credited)"]
    I --> J{"Σ virtual = real?"}
    J -- Yes --> K([Commit new state])
    J -- No --> R([Roll back to previous state])

    classDef reject fill:#fde8ea,stroke:#be123c,color:#881337
    classDef ok fill:#e6f4ee,stroke:#047857,color:#064e3b
    class X1,X2,X3,X4,R reject
    class K ok
```

---

## 6. Build and deployment

```mermaid
flowchart LR
    Dev["Developer<br/>git push main"] --> GH[("GitHub repo<br/>perpetualxbeta-ai/vam-dashboard")]
    GH --> WF["GitHub Actions<br/>.github/workflows/deploy.yml"]
    subgraph WF_Steps["Workflow"]
        direction TB
        S1["checkout"] --> S2["setup Node 22"] --> S3["npm ci"] --> S4["vite build → dist/"] --> S5["upload-pages-artifact"]
    end
    WF --> WF_Steps
    S5 --> Pages["GitHub Pages<br/>perpetualxbeta-ai.github.io/vam-dashboard"]
    Pages --> User["Browser"]
```

---

## 7. Target-state production architecture (illustrative)

The prototype puts the whole posting engine in the browser. A production VAM service would move each responsibility behind a server boundary. This diagram is a reference design for discussion, not something built in this repo.

```mermaid
flowchart TB
    subgraph Channels["Channels"]
        Portal["Corporate portal<br/>(this dashboard)"]
        API["Corporate API / host-to-host<br/>(ERP, TMS)"]
    end

    subgraph Inbound["Inbound payment rails"]
        SWIFT["SWIFT MT103 / pacs.008"]
        Local["Local ACH / RTGS / FAST"]
    end

    subgraph VAM["VAM platform"]
        GW["API gateway<br/>authN / authZ, rate limits"]
        Router["Payment router<br/>match vIBAN → master account"]
        VASvc["Virtual account service<br/>open / close / freeze vIBANs"]
        Ledger[("Virtual sub-ledger<br/>double-entry, append-only")]
        Recon["Reconciliation engine<br/>Σ virtual = real, EOD & intraday"]
        Repair["Exception queue<br/>unmatched / invalid vIBAN"]
        Events[["Event bus"]]
    end

    subgraph Core["Core banking"]
        CBS[("Core banking system<br/>physical master account MA-001")]
    end

    subgraph Outbound["Client reporting"]
        Stmt["Statements<br/>camt.053 / camt.054, MT940"]
        Hooks["Webhooks / notifications"]
    end

    SWIFT & Local --> Router
    Portal & API --> GW --> VASvc
    GW --> Ledger
    Router -- "matched" --> Ledger
    Router -- "unmatched" --> Repair
    Router -- "post cash" --> CBS
    VASvc --> Ledger
    Ledger --> Events
    CBS --> Recon
    Ledger --> Recon
    Recon -- "breaks" --> Repair
    Events --> Stmt & Hooks
```

| Prototype (today) | Production equivalent |
|---|---|
| `initialState` in memory | Virtual sub-ledger database + core banking system |
| `vamReducer` atomic update | Database transaction / double-entry posting with idempotency keys |
| `isReconciled()` guard | Reconciliation engine (intraday and end-of-day) with break alerts |
| `validatePayment()` | Payment router checks (vIBAN exists, active, currency match, sanctions screening) |
| Rejected entries in ledger | Exception / repair queue for unmatched payments |
| Transaction list | camt.053 / camt.054 / MT940 statements and webhooks |
