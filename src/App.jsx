import { useReducer, useState } from 'react';
import {
  initialState,
  vamReducer,
  validatePayment,
  formatMoney,
  sumVirtualBalances,
  isReconciled,
} from './state/vamStore';

function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`bg-white rounded-lg border border-slate-200 shadow-card ${className}`}>
      {title && (
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    Credited: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    Rejected: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  };
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        styles[status] ?? 'bg-slate-50 text-slate-600 ring-slate-500/20'
      }`}
    >
      {status}
    </span>
  );
}

function TopBar() {
  return (
    <div className="bg-navy-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-white/10 grid place-items-center font-bold text-sm">VB</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Corporate Banking</div>
            <div className="text-[11px] text-slate-300">Virtual Account Management</div>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
          <span className="text-white border-b-2 border-sky-400 pb-[17px] pt-[19px]">Dashboard</span>
          <span>Payments</span>
          <span>Reports</span>
          <span>Administration</span>
        </nav>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="hidden sm:inline">Treasury Operator</span>
          <div className="h-8 w-8 rounded-full bg-navy-600 grid place-items-center text-white font-medium">TO</div>
        </div>
      </div>
    </div>
  );
}

function MasterAccountHeader({ master, virtualTotal, reconciled, vaCount }) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-navy-800 to-navy-600 px-6 py-6 text-white">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-sky-200 font-medium">Physical Master Account</p>
            <h1 className="text-2xl font-semibold mt-1">{master.accountName}</h1>
            <p className="text-sm text-slate-300 mt-1">
              {master.id} · {master.currency} · Operating Account
            </p>
          </div>
          <div className="md:text-right">
            <p className="text-xs uppercase tracking-wider text-sky-200 font-medium">Real Balance</p>
            <p className="text-4xl md:text-5xl font-semibold tabular mt-1" data-testid="real-balance">
              {formatMoney(master.realBalance, master.currency)}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="px-6 py-4">
          <p className="text-xs text-slate-500">Linked virtual accounts</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">{vaCount}</p>
        </div>
        <div className="px-6 py-4">
          <p className="text-xs text-slate-500">Σ Virtual balances</p>
          <p className="text-lg font-semibold text-slate-900 tabular mt-0.5">
            {formatMoney(virtualTotal, master.currency)}
          </p>
        </div>
        <div className="px-6 py-4">
          <p className="text-xs text-slate-500">Reconciliation</p>
          <p
            className={`text-sm font-semibold mt-1 flex items-center gap-2 ${
              reconciled ? 'text-emerald-700' : 'text-rose-700'
            }`}
            data-testid="reconciliation"
          >
            <span className={`h-2 w-2 rounded-full ${reconciled ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {reconciled ? 'Balanced — virtual ledger matches master' : 'Out of balance'}
          </p>
        </div>
      </div>
    </Card>
  );
}

function VirtualAccountsTable({ accounts, total, currency }) {
  return (
    <Card title="Virtual Accounts" subtitle="vIBANs linked to MA-001">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-6 py-3">vIBAN</th>
              <th className="px-6 py-3">Alias</th>
              <th className="px-6 py-3 hidden sm:table-cell">Status</th>
              <th className="px-6 py-3 text-right">Virtual Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.map((va) => (
              <tr key={va.vIban} className="hover:bg-slate-50/70">
                <td className="px-6 py-3.5 font-mono text-navy-700 font-medium whitespace-nowrap">{va.vIban}</td>
                <td className="px-6 py-3.5 text-slate-800">{va.alias}</td>
                <td className="px-6 py-3.5 hidden sm:table-cell">
                  <StatusBadge status={va.status} />
                </td>
                <td className="px-6 py-3.5 text-right tabular font-semibold text-slate-900" data-testid={`bal-${va.vIban}`}>
                  {formatMoney(va.virtualBalance, currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200">
              <td colSpan={2} className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Total
              </td>
              <td className="hidden sm:table-cell" />
              <td className="px-6 py-3 text-right tabular font-semibold text-slate-900">
                {formatMoney(total, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

const emptyForm = { payerName: '', amount: '', targetVIban: '' };

function TransactionSimulator({ accounts, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(null);

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setError(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validatePayment(form, accounts);
    if (err) {
      setError(err);
      setFlash(null);
      return;
    }
    onSubmit(form);
    setFlash(`Payment routed to ${form.targetVIban}.`);
    setForm(emptyForm);
  };

  const inputCls =
    'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/20';

  return (
    <Card title="Transaction Simulator" subtitle="Simulate an inbound wire to a vIBAN">
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4" noValidate>
        <div>
          <label htmlFor="payerName" className="text-xs font-medium text-slate-700">
            Payer Name
          </label>
          <input
            id="payerName"
            type="text"
            className={inputCls}
            placeholder="e.g. Tenant Co. Ltd"
            value={form.payerName}
            onChange={update('payerName')}
          />
        </div>
        <div>
          <label htmlFor="amount" className="text-xs font-medium text-slate-700">
            Amount (USD)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 mt-0.5 text-sm text-slate-400">$</span>
            <input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              className={`${inputCls} pl-7 tabular`}
              placeholder="0.00"
              value={form.amount}
              onChange={update('amount')}
            />
          </div>
        </div>
        <div>
          <label htmlFor="targetVIban" className="text-xs font-medium text-slate-700">
            Target vIBAN
          </label>
          <select id="targetVIban" className={inputCls} value={form.targetVIban} onChange={update('targetVIban')}>
            <option value="">Select a virtual account…</option>
            {accounts.map((va) => (
              <option key={va.vIban} value={va.vIban} disabled={va.status !== 'Active'}>
                {va.vIban} — {va.alias}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
        {flash && !error && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {flash}
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-md bg-navy-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-600 focus:ring-offset-2 transition-colors"
        >
          Simulate Incoming Payment
        </button>
        <p className="text-xs text-slate-500 leading-relaxed">
          Funds are credited to the selected virtual ledger and the physical master account in one atomic step.
        </p>
      </form>
    </Card>
  );
}

function TransactionLedger({ ledger, currency, aliasOf }) {
  return (
    <Card title="Recent Transactions" subtitle={`${ledger.length} entr${ledger.length === 1 ? 'y' : 'ies'} in ledger`}>
      {ledger.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">No transactions yet</p>
          <p className="text-xs text-slate-500 mt-1">Use the simulator to post an incoming wire transfer.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-6 py-3">Transaction ID</th>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Payer</th>
                <th className="px-6 py-3">Target vIBAN</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-3 font-mono text-xs text-slate-600">{tx.id}</td>
                  <td className="px-6 py-3 text-slate-600 whitespace-nowrap">
                    {new Date(tx.timestamp).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'medium',
                    })}
                  </td>
                  <td className="px-6 py-3 text-slate-800">{tx.payerName}</td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span className="font-mono text-navy-700">{tx.targetVIban}</span>
                    {aliasOf(tx.targetVIban) && (
                      <span className="text-xs text-slate-500 ml-2">{aliasOf(tx.targetVIban)}</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <StatusBadge status={tx.status} />
                  </td>
                  <td className="px-6 py-3 text-right tabular font-semibold text-emerald-700 whitespace-nowrap">
                    +{formatMoney(tx.amount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(vamReducer, initialState);
  const { masterAccount, virtualAccounts, ledger } = state;
  const virtualTotal = sumVirtualBalances(virtualAccounts);
  const reconciled = isReconciled(state);
  const aliasOf = (vIban) => virtualAccounts.find((va) => va.vIban === vIban)?.alias;

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Cash Management / Virtual Accounts</p>
            <h2 className="text-lg font-semibold text-slate-900">Account Overview</h2>
          </div>
          <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch({ type: 'LOAD_SAMPLE' })}
            className="rounded-md border border-navy-600/30 bg-navy-50 px-3 py-1.5 text-xs font-medium text-navy-700 shadow-sm hover:bg-navy-100"
          >
            Load sample payments
          </button>
          <button
            onClick={() => dispatch({ type: 'RESET' })}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Reset mock data
          </button>
          </div>
        </div>

        <MasterAccountHeader
          master={masterAccount}
          virtualTotal={virtualTotal}
          reconciled={reconciled}
          vaCount={virtualAccounts.length}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <VirtualAccountsTable accounts={virtualAccounts} total={virtualTotal} currency={masterAccount.currency} />
          </div>
          <TransactionSimulator
            accounts={virtualAccounts}
            onSubmit={(payload) => dispatch({ type: 'SIMULATE_INCOMING_PAYMENT', payload })}
          />
        </div>

        <TransactionLedger ledger={ledger} currency={masterAccount.currency} aliasOf={aliasOf} />

        <p className="text-center text-xs text-slate-400 pb-4">
          Prototype — mock data held in local state. Not connected to any core banking system.
        </p>
      </main>
    </div>
  );
}
