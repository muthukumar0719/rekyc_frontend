import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { requestFieldChange } from '../../services/api';
import EditableField from '../EditableField';
import AddressField from '../AddressField';
import Card from '../ui/Card';
import { maskEmail, maskMobile } from '../../utils/mask';

const INCOME_OPTIONS = [
  'Less Than One Lakhs',
  'One To Five Lakhs',
  'Five To Ten Lakhs',
  'Ten To TwentyFive Lakhs',
  'TwentyFive Lakhs To One Crore',
  'Above One Crore',
];

export default function PersonalTab({ account, onNext }) {
  const { personal, clientId } = account;
  const isLocked = ['AWAITING_ESIGN', 'PENDING_VERIFICATION', 'REJECTED'].includes(account.operationStatus);
  const pendingChanges = personal.pendingChanges || {};
  const { updateAccount } = useAuth();
  const savedIncome = pendingChanges.annual_income?.newValue || account.others?.annualIncome || '';
  const [income, setIncome] = useState(savedIncome);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setIncome(savedIncome); }, [savedIncome]);

  const handleNext = async () => {
    if (isLocked) { onNext?.(); return; }
    if (!income) {
      setError('Please select your annual income.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // Only recorded as a change request if it actually differs from the
      // existing value — the backend no-ops otherwise, so operations that
      // don't touch income (e.g. DDPI-only) don't get an income change forced in.
      if (!pendingChanges.annual_income) {
        const { data } = await requestFieldChange(clientId, 'annual_income', income);
        updateAccount(data.data);
      }
      onNext?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save annual income. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-base font-bold text-slate-800 mb-1">Personal Details</h3>
      {/* <div className="bg-brand-blue-50 text-brand-blue-700 text-sm rounded-lg px-4 py-3 my-4 border border-brand-blue-100/60">
        Updating e-mail and phone number will take up to 48 hours to reflect in your account post verification.
      </div> */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <EditableField
          label="E-mail"
          field="email"
          type="email"
          value={personal.email}
          pending={pendingChanges.email}
          clientId={clientId}
          disabled={isLocked}
          identityChannel="mobile"
          identityContactMasked={maskMobile(personal.mobile)}
        />
        <EditableField
          label="Mobile"
          field="mobile"
          value={personal.mobile}
          pending={pendingChanges.mobile}
          clientId={clientId}
          disabled={isLocked}
          identityChannel="email"
          identityContactMasked={maskEmail(personal.email)}
        />

        <div>
          <label htmlFor="annual-income" className="block text-xs text-slate-400 mb-1">
            Annual Income <span className="text-red-500">*</span>
          </label>
          <select
            id="annual-income"
            value={income}
            onChange={(event) => { setIncome(event.target.value); setError(''); }}
            disabled={isLocked || saving || !!pendingChanges.annual_income}
            required
            aria-invalid={!!error}
            aria-describedby={error ? 'annual-income-error' : undefined}
            className="w-full rounded-full border border-brand-blue-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue-500 disabled:bg-slate-50"
          >
            <option value="">Select Annual Income</option>
            {savedIncome && !INCOME_OPTIONS.includes(savedIncome) && <option value={savedIncome}>{savedIncome}</option>}
            {INCOME_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          {pendingChanges.annual_income && <p className="mt-1 text-xs text-amber-600">Pending verification</p>}
          {error && <p id="annual-income-error" role="alert" className="mt-1 text-xs text-red-500">{error}</p>}
        </div>

        <AddressField
          label="Address"
          value={personal.address}
          pending={pendingChanges.address}
          clientId={clientId}
          disabled={isLocked}
          wide
        />
      </div>

      {onNext && (
        <div className="flex justify-end mt-8 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="bg-gradient-to-r from-brand-blue-600 to-brand-coral-500 hover:from-brand-blue-500 hover:to-brand-coral-400 text-white text-sm font-bold uppercase tracking-wider rounded-lg px-6 py-2.5 shadow-[0_4px_14px_0_rgba(30,47,224,0.35)] hover:shadow-[0_6px_20px_rgba(240,64,95,0.3)] hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
          >
            {saving ? 'Saving...' : 'Next'} <ArrowRight size={16} />
          </button>
        </div>
      )}
    </Card>
  );
}
