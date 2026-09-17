import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Trash2 } from 'lucide-react';
import { startBankEsign, deleteBankAccount } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import SignaturePad from '../SignaturePad';

export default function BankTab({ account, onNext }) {
  const navigate = useNavigate();
  const { updateAccount } = useAuth();
  const banks = account.bank || [];
  const isLocked = ['AWAITING_ESIGN', 'PENDING_VERIFICATION', 'REJECTED'].includes(account.operationStatus);

  const hasNewBank = banks.some((b) => b.source === 'rekyc');

  // Flow: Bank → Signature → eSign page (PDF preview + Proceed to eSign)
  const [phase, setPhase] = useState('bank'); // 'bank' | 'signature'
  const [sigRecord, setSigRecord] = useState(null);
  const [opening, setOpening] = useState(false);
  const [sigError, setSigError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [bankError, setBankError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Remove the bank account added in this flow — only after the user confirms.
  // Only that account is affected.
  const handleDeleteBank = async () => {
    setBankError('');
    setDeleting(true);
    try {
      const { data } = await deleteBankAccount(account.clientId);
      updateAccount(data.data);
      setConfirmDelete(false);
    } catch (err) {
      setBankError(err.response?.data?.message || 'Could not remove the bank account.');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  // Bank NEXT — go to the Signature step first (never opens the PDF directly).
  const handleBankNext = () => {
    if (hasNewBank && !isLocked) setPhase('signature');
    else onNext();
  };

  // Signature NEXT — only after a signature is captured. Moves the operation to
  // e-sign and goes to the eSign page, where the populated modification PDF is
  // shown inline with a "Proceed to eSign" button. On completion the signed PDF
  // is emailed to the client's registered address.
  const handleSignatureNext = async () => {
    setOpening(true);
    setSigError('');
    try {
      const { data } = await startBankEsign(account.clientId);
      const operationId = data?.data?.operationId || account.rekycMasterId;
      navigate(`/esign/${account.clientId}?operation_id=${operationId}`);
    } catch (err) {
      setSigError(err.response?.data?.message || 'Could not start e-sign. Please try again.');
    } finally {
      setOpening(false);
    }
  };

  if (phase === 'signature') {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-100/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800">Signature</h3>
          <button
            type="button"
            onClick={() => setPhase('bank')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Provide your signature below. It will be placed on the generated form.
        </p>

        <SignaturePad
          clientId={account.clientId}
          existingRecord={sigRecord}
          onUploaded={setSigRecord}
          onView={(url) => window.open(url, '_blank')}
        />

        {sigError && <p className="text-sm text-red-600 font-medium text-center mt-4">{sigError}</p>}

        <div className="flex justify-end mt-6 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSignatureNext}
            disabled={!sigRecord || opening}
            className="bg-gradient-to-r from-brand-blue-600 to-brand-coral-500 hover:from-brand-blue-500 hover:to-brand-coral-400 disabled:opacity-50 text-white text-sm font-bold uppercase tracking-wider rounded-lg px-6 py-2.5 shadow-[0_4px_14px_0_rgba(30,47,224,0.35)] hover:shadow-[0_6px_20px_rgba(240,64,95,0.3)] hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
          >
            {opening ? 'Loading…' : 'Next'} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-100/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-800">Bank Details</h3>
        {banks.length < 3 && !isLocked && (
          <button
            onClick={() => navigate('/account/add-bank')}
            className="bg-gradient-to-r from-brand-blue-600 to-brand-coral-500 hover:from-brand-blue-500 hover:to-brand-coral-400 text-white text-sm font-semibold rounded-lg px-4 py-2 shadow-[0_4px_14px_0_rgba(30,47,224,0.35)] hover:shadow-[0_6px_20px_rgba(240,64,95,0.3)] hover:-translate-y-0.5 transition-all duration-200"
          >
            + Add Bank Account
          </button>
        )}
      </div>

      <div className="bg-brand-blue-50 text-brand-blue-700 text-sm rounded-lg px-4 py-3 mb-4">
        <strong>Addition of Bank Account:</strong> Please link those bank accounts only, in which you are
        primary/secondary account holder. Maximum 3 accounts can be linked to your trading account.
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2 pr-4">S. No.</th>
              <th className="py-2 pr-4 text-left">Bank Details</th>
              <th className="py-2 pr-4">Account Number</th>
              <th className="py-2 pr-4">IFSC Code</th>
              <th className="py-2 pr-4">Default Bank</th>
              <th className="py-2 pr-4">Account DP type</th>
              <th className="py-2 pr-4">Penny Drop</th>
              <th className="py-2 pr-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {banks.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-400">No bank accounts on file.</td>
              </tr>
            )}
            {banks.map((b, i) => (
              <tr key={i} className="border-b border-slate-50">
                <td className="py-3 pr-4">{String(i + 1).padStart(2, '0')}</td>
                <td className="py-3 pr-4 font-medium text-slate-800">
                  {b.bankName}
                  {b.bankAddress && <div className="text-xs text-slate-500 mt-1 font-normal max-w-xs">{b.bankAddress}</div>}
                </td>
                <td className="py-3 pr-4">{b.accountNumber}</td>
                <td className="py-3 pr-4">{b.ifscCode}</td>
                <td className="py-3 pr-4">{b.isDefault ? 'Set as Default' : '—'}</td>
                <td className="py-3 pr-4">{b.accountType}</td>
                <td className="py-3 pr-4">
                  {b.penny_drop_status?.toUpperCase() === 'PASS' && <span className="text-green-600 font-medium">✓ Verified</span>}
                  {b.penny_drop_status?.toUpperCase() === 'FAIL' && <span className="text-red-500 font-medium">✗ Failed</span>}
                  {b.source !== 'existing' && (!b.penny_drop_status || b.penny_drop_status?.toUpperCase() === 'ERROR') && <span className="text-amber-500">⏳ Error / Pending</span>}
                  {b.source === 'existing' && <span className="text-slate-400">N/A</span>}
                </td>
                <td className="py-3 pr-4">
                  {b.source === 'rekyc' && !isLocked ? (
                    <button
                      type="button"
                      onClick={() => { setBankError(''); setConfirmDelete(true); }}
                      disabled={deleting}
                      aria-label="Delete bank account"
                      title="Delete bank account"
                      className="text-slate-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bankError && <p className="text-sm text-red-600 font-medium mt-3">{bankError}</p>}

      {onNext && (
        <div className="flex justify-end mt-6 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={handleBankNext}
            className="bg-gradient-to-r from-brand-blue-600 to-brand-coral-500 hover:from-brand-blue-500 hover:to-brand-coral-400 text-white text-sm font-bold uppercase tracking-wider rounded-lg px-6 py-2.5 shadow-[0_4px_14px_0_rgba(30,47,224,0.35)] hover:shadow-[0_6px_20px_rgba(240,64,95,0.3)] hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
          >
            Next <ArrowRight size={16} />
          </button>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-slate-800">Delete bank account</h3>
            <p className="text-sm text-slate-600 mt-2">Are you sure you want to delete this bank account?</p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBank}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
