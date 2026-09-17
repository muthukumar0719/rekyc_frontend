import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload } from 'lucide-react';
import { addBankAccount, uploadManualDocument } from '../services/api';
import { maskAccount, maskAccountLast4 } from '../utils/mask';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/ui/PageShell';
import Topbar from '../components/Topbar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function AddBankAccount() {
  const { account, updateAccount } = useAuth();
  const navigate = useNavigate();

  const [accountNumber, setAccountNumber] = useState('');
  const [accountFocused, setAccountFocused] = useState(false);
  const [reAccountNumber, setReAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountType, setAccountType] = useState('Saving');
  const [statementFile, setStatementFile] = useState(null);
  const [declaration, setDeclaration] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Re-enter field: typing only, no clipboard, and masked while typing. The
  // real digits stay in `reAccountNumber` state so validation can still
  // compare it against the Account Number.
  const blockClipboard = (e) => e.preventDefault();
  const handleReAccountChange = (e) => {
    const typed = e.target.value;
    const shown = maskAccount(reAccountNumber);
    if (!typed.includes('*')) {
      setReAccountNumber(typed.replace(/\*/g, ''));
    } else if (typed.length > shown.length) {
      setReAccountNumber((prev) => prev + typed.slice(shown.length).replace(/\*/g, ''));
    } else if (typed.length < shown.length) {
      const removed = shown.length - typed.length;
      setReAccountNumber((prev) => prev.slice(0, Math.max(0, prev.length - removed)));
    }
  };

  if (!account) return null;

  const handleSave = async () => {
    setError('');

    if (!accountNumber.trim()) return setError('Account Number is required.');
    if (!reAccountNumber.trim()) return setError('Re-enter Account Number is required.');
    if (accountNumber !== reAccountNumber) return setError('Account numbers do not match.');
    if (!ifsc.trim()) return setError('IFSC is required.');
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifsc.trim())) return setError('Enter a valid IFSC code (e.g., HDFC0001234).');
    if (!declaration) return setError('Please accept the declaration to proceed.');

    setLoading(true);
    try {
      const { data } = await addBankAccount(account.clientId, {
        accountNumber: accountNumber.trim(),
        ifscCode: ifsc.trim(),
        accountType,
      });
      updateAccount(data.data);

      if (statementFile) {
        try {
          const formData = new FormData();
          formData.append('documentType', 'BANK_PROOF');
          formData.append('file', statementFile);
          await uploadManualDocument(account.clientId, formData);
        } catch (uploadErr) {
          // Bank account itself is already saved — surface the upload failure
          // separately rather than losing the successful save.
          setError(uploadErr.response?.data?.message || 'Bank account saved, but the statement upload failed.');
          setLoading(false);
          return;
        }
      }

      navigate('/account');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add bank account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <Topbar />
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
        <Button variant="link" onClick={() => navigate('/account')} className="mb-4 text-sm no-underline">
          <ArrowLeft size={16} /> Back to Account Details
        </Button>

        <Card className="p-6 md:p-8">
          <h3 className="text-xl font-extrabold text-slate-800">Add Bank Account</h3>
          <p className="text-sm text-slate-500 mt-1 mb-6">Please enter your new bank details below.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="group">
              <label className="block text-xs font-bold text-slate-600 mb-2 group-focus-within:text-brand-blue-600 transition-colors">ACCOUNT NUMBER (REQUIRED)</label>
              <input
                type="text"
                value={accountFocused ? accountNumber : maskAccountLast4(accountNumber)}
                onChange={(e) => setAccountNumber(e.target.value)}
                onFocus={() => setAccountFocused(true)}
                onBlur={() => setAccountFocused(false)}
                placeholder="Enter account number"
                className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue-500/40 focus:border-brand-blue-500 transition-all shadow-inner text-slate-800"
              />
            </div>
            <div className="group">
              <label className="block text-xs font-bold text-slate-600 mb-2 group-focus-within:text-brand-blue-600 transition-colors">RE-ENTER ACCOUNT (REQUIRED)</label>
              <input
                type="text"
                value={maskAccount(reAccountNumber)}
                onChange={handleReAccountChange}
                onPaste={blockClipboard}
                onCopy={blockClipboard}
                onCut={blockClipboard}
                onDrop={blockClipboard}
                autoComplete="off"
                placeholder="Re-enter account number"
                className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue-500/40 focus:border-brand-blue-500 transition-all shadow-inner text-slate-800"
              />
            </div>

            <div className="group">
              <label className="block text-xs font-bold text-slate-600 mb-2 group-focus-within:text-brand-blue-600 transition-colors">IFSC CODE (REQUIRED)</label>
              <input
                type="text"
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                placeholder="e.g., HDFC0001234"
                className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue-500/40 focus:border-brand-blue-500 transition-all shadow-inner uppercase text-slate-800 tracking-wide"
              />
            </div>
            <div className="group">
              <label className="block text-xs font-bold text-slate-600 mb-2 group-focus-within:text-brand-blue-600 transition-colors">ACCOUNT TYPE</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue-500/40 focus:border-brand-blue-500 transition-all shadow-inner text-slate-800"
              >
                <option value="Saving">Saving</option>
                <option value="Current">Current</option>
              </select>
            </div>

            <div className="group md:col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-2">BANK STATEMENT (OPTIONAL)</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setStatementFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="bank-statement-input"
                />
                <label
                  htmlFor="bank-statement-input"
                  className="inline-flex items-center gap-2 bg-white/60 border border-slate-200 rounded-xl px-4 py-3 cursor-pointer hover:bg-white transition-all shadow-inner text-slate-700 text-sm font-medium"
                >
                  <Upload size={16} /> {statementFile ? statementFile.name : 'Choose file'}
                </label>
              </div>
              <p className="text-xs text-slate-400 mt-2">A cancelled cheque or bank statement, uploaded as proof for this account.</p>
            </div>
          </div>

          <div className="flex items-start gap-4 bg-brand-blue-50/50 p-5 rounded-2xl border border-brand-blue-100/50 shadow-inner">
            <input
              type="checkbox"
              id="bank-declaration"
              checked={declaration}
              onChange={(e) => setDeclaration(e.target.checked)}
              className="mt-1 w-5 h-5 text-brand-blue-600 rounded border-slate-300 focus:ring-brand-blue-500 flex-shrink-0 cursor-pointer"
            />
            <label htmlFor="bank-declaration" className="text-sm text-slate-600 leading-relaxed cursor-pointer select-none">
              I/We hereby declare that the above information provided by me is correct. I/We undertake to inform AIONION CAPITAL MARKET SERVICES PRIVATE LIMITED immediately in case of any incorrect information that I become aware of. This change will affect the Trading and Demat account that I hold with AIONION.
            </label>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-medium">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-slate-100">
            <button
              onClick={() => navigate('/account')}
              disabled={loading}
              className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-200/50 rounded-xl transition-colors disabled:opacity-50 uppercase tracking-wide text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !declaration}
              className="px-10 py-3 bg-gradient-to-r from-brand-blue-600 to-brand-coral-500 hover:from-brand-blue-500 hover:to-brand-coral-400 text-white font-bold rounded-xl transition-all duration-300 disabled:opacity-60 disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none shadow-[0_8px_20px_-6px_rgba(30,47,224,0.5)] hover:shadow-[0_10px_25px_-6px_rgba(240,64,95,0.45)] hover:-translate-y-0.5 uppercase tracking-wide text-sm"
            >
              {loading ? 'Saving...' : 'SAVE BANK'}
            </button>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
