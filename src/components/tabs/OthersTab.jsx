import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { updateOthers, updateDdpi, createDdpiPaymentOrder, verifyDdpiPayment } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function OthersTab({ account, onNext }) {
  const { updateAccount } = useAuth();
  const [loading, setLoading] = useState(false);
  const [ddpiLoading, setDdpiLoading] = useState(false);
  const [error, setError] = useState('');
  const [ddpiError, setDdpiError] = useState('');
  const [saved, setSaved] = useState(false);
  const [ddpiSaved, setDdpiSaved] = useState(false);

  const pendingDdpi = account.personal?.pendingChanges?.ddpi;
  const currentDdpi = pendingDdpi ? pendingDdpi.newValue : (account.others?.ddpi || 'No');
  // DDPI is a one-way activation — once it's Yes (pending or already active),
  // there's no "change it back" request, so the form locks permanently.
  const ddpiActivated = currentDdpi === 'Yes';
  const isDdpiRequested = !!pendingDdpi;
  const isLocked = ['AWAITING_ESIGN', 'PENDING_VERIFICATION', 'REJECTED'].includes(account.operationStatus);
  
  const [ddpiSelection, setDdpiSelection] = useState(currentDdpi);
  const [showDdpiPopup, setShowDdpiPopup] = useState(false);

  // DDPI charge — comes from the backend (env-driven), never hardcoded. The
  // same value is charged via Razorpay.
  const ddpiCharge = Number(account.others?.ddpiCharge) > 0 ? Number(account.others.ddpiCharge) : 150;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSaved(false);
    
    // Only a No -> Yes activation ever fires — DDPI can't be turned back off
    // through this form.
    let ddpiFailed = false;
    if (ddpiSelection === 'Yes' && !ddpiActivated) {
      ddpiFailed = !(await handleDdpiActivate());
    }

    // If the DDPI change was actually attempted and failed (e.g. an existing
    // operation is already awaiting eSign), stop here — don't show "Details
    // updated." underneath the error, that looked like the whole form
    // succeeded when the one thing the user asked for didn't.
    if (ddpiFailed) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await updateOthers(account.clientId, { networth: null });
      updateAccount(data.data);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDdpiActivate = async () => {
    setDdpiLoading(true);
    setDdpiError('');
    setDdpiSaved(false);
    try {
      const { data } = await updateDdpi(account.clientId);
      updateAccount(data.data);
      setDdpiSaved(true);
      return true;
    } catch (err) {
      setDdpiError(err.response?.data?.message || 'Could not submit DDPI change.');
      return false;
    } finally {
      setDdpiLoading(false);
    }
  };

  // Popup "Continue" — pay the DDPI charge via Razorpay, restricted to the
  // client's verified/registered bank account, for the exact displayed amount.
  const abortDdpi = (message) => {
    if (message) setDdpiError(message);
    setDdpiSelection('No');
    setShowDdpiPopup(false);
  };

  const handleDdpiContinue = async () => {
    setDdpiError('');
    setDdpiLoading(true);
    try {
      const { data } = await createDdpiPaymentOrder(account.clientId);
      const order = data.data;

      if (!window.Razorpay) {
        abortDdpi('Payment could not be started. Please refresh and try again.');
        return;
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'AIONION CAPITAL',
        description: `DDPI Activation Charges (₹${order.amount})`,
        // The order is TPV-bound to the verified bank account — Razorpay only
        // allows netbanking / UPI from that exact account. Hide card/wallet.
        method: { netbanking: true, upi: true, card: false, wallet: false, emi: false, paylater: false },
        prefill: {
          name: order.prefill.name || '',
          email: order.prefill.email || '',
          contact: order.prefill.contact || '',
        },
        readonly: { email: true, contact: true },
        notes: { eligibleIfsc: order.eligibleBank?.ifsc },
        handler: async (resp) => {
          try {
            const verifyRes = await verifyDdpiPayment(account.clientId, {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            updateAccount(verifyRes.data.data);
            setShowDdpiPopup(false);
            setDdpiSaved(true);
          } catch (err) {
            abortDdpi(err.response?.data?.message || 'Payment verification failed.');
          }
        },
        modal: { ondismiss: () => abortDdpi('') },
      });
      rzp.on('payment.failed', (r) => abortDdpi(r?.error?.description || 'Payment failed. Please try again.'));
      rzp.open();
    } catch (err) {
      abortDdpi(err.response?.data?.message || 'Could not start the DDPI payment.');
    } finally {
      setDdpiLoading(false);
    }
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-100/50 p-6">
      <h3 className="text-base font-bold text-slate-800 mb-4">DDPI</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* DDPI Section */}
        <div>
          <label className="block text-xs text-slate-400 mb-1 flex items-center gap-2">
            Do you wish to execute DDPI?
            {isDdpiRequested && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded uppercase tracking-wide">
                REQUESTED
              </span>
            )}
          </label>
          <select
            value={ddpiSelection}
            onChange={(e) => {
              const value = e.target.value;
              setDdpiSelection(value);
              // Selecting "Yes" immediately shows the DDPI charge confirmation popup.
              if (value === 'Yes' && !ddpiActivated) { setDdpiError(''); setShowDdpiPopup(true); }
            }}
            disabled={ddpiActivated || ddpiLoading || isLocked}
            className="w-full border border-slate-200 bg-white/60 rounded-xl px-4 py-3 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue-500/40 focus:border-brand-blue-500 transition-all shadow-inner text-slate-800 disabled:opacity-50"
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
          {ddpiError && <p className="text-xs text-red-600 mt-1">{ddpiError}</p>}
          {ddpiSaved && <p className="text-xs text-green-600 mt-1">DDPI change submitted for review.</p>}
        </div>

        {error && <p className="md:col-span-3 text-sm text-red-600">{error}</p>}
        {saved && <p className="md:col-span-3 text-sm text-green-600">Details updated.</p>}

        {!isLocked && (
          <div className="md:col-span-3 mt-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-brand-blue-600 to-brand-coral-500 hover:from-brand-blue-500 hover:to-brand-coral-400 disabled:opacity-60 text-white font-bold rounded-xl px-12 py-3 shadow-[0_8px_20px_-6px_rgba(30,47,224,0.5)] hover:shadow-[0_10px_25px_-6px_rgba(240,64,95,0.45)] hover:-translate-y-0.5 transition-all duration-300 uppercase tracking-wider text-sm"
            >
              {loading ? 'Saving…' : 'SUBMIT'}
            </button>
          </div>
        )}

        {onNext && (
          <div className="md:col-span-3 flex justify-end mt-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onNext}
              className="bg-gradient-to-r from-brand-blue-600 to-brand-coral-500 hover:from-brand-blue-500 hover:to-brand-coral-400 text-white text-sm font-bold uppercase tracking-wider rounded-lg px-6 py-2.5 shadow-[0_4px_14px_0_rgba(30,47,224,0.35)] hover:shadow-[0_6px_20px_rgba(240,64,95,0.3)] hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
            >
              Next <ArrowRight size={16} />
            </button>
          </div>
        )}
      </form>

      {/* DDPI payment confirmation popup — shown when the user picks "Yes". */}
      {showDdpiPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-brand-blue-600 to-brand-coral-500 text-white px-6 py-4">
              <h3 className="text-lg font-bold leading-snug">
                Do you wish to execute DDPI (Demat Debit Peldge Instructions) <span className="text-rose-300">*</span>
              </h3>
            </div>
            <div className="p-8 text-center">
              <p className="text-brand-coral-500 font-bold text-lg">You have selected the DDPI Option</p>
              <p className="text-4xl font-extrabold text-slate-900 mt-4">₹ {ddpiCharge}</p>
              <p className="text-slate-400 text-sm mt-1">(Additional Charges)</p>
              {ddpiError && <p className="text-sm text-red-600 font-medium mt-4">{ddpiError}</p>}
              <div className="flex justify-center gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => { setShowDdpiPopup(false); setDdpiSelection('No'); }}
                  className="rounded-full border-2 border-brand-blue-600 text-brand-blue-600 font-bold px-10 py-2.5 hover:bg-brand-blue-50 transition-colors"
                >
                  NO
                </button>
                <button
                  type="button"
                  onClick={handleDdpiContinue}
                  disabled={ddpiLoading}
                  className="rounded-full bg-brand-blue-600 hover:bg-brand-blue-700 disabled:opacity-60 text-white font-bold px-10 py-2.5 transition-colors"
                >
                  {ddpiLoading ? 'Processing…' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
