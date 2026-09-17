import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateNominee, startNomineeEsign } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PlusCircle, Trash2, ArrowRight, Edit3, User, ChevronDown, ChevronUp } from 'lucide-react';

const EMPTY_NOMINEE = {
  relation: '', firstName: '', dob: '', percentage: '',
};

// DOB is entered/shown as DD/MM/YYYY; stored on the wire as ISO (YYYY-MM-DD).
const isoToDMY = (s) =>
  s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : (s || '');
const dmyToISO = (s) => {
  const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

// ── Existing Nominee Card (read-only display) ────────────────────────────────
function ExistingNomineeCard({ nominee, index }) {
  const [expanded, setExpanded] = useState(index === 0);
  const name = [nominee.firstName, nominee.middleName, nominee.lastName].filter(Boolean).join(' ') || '—';
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-blue-100 flex items-center justify-center">
            <User size={15} className="text-brand-blue-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-800">{name}</p>
            {nominee.relation && <p className="text-xs text-slate-500">{nominee.relation}</p>}
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {expanded && (
        <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 bg-white">
          {[
            ['Name', name],
            ['Relationship', nominee.relation],
            ['Date of Birth', nominee.dob],
            ['Mobile', nominee.mobile],
            ['Email', nominee.email],
            ['Share %', nominee.percentage ? `${nominee.percentage}%` : null],
            ['Address', nominee.addressLine1],
            ['Address Line 2', nominee.addressLine2],
            ['City', nominee.city],
            ['State', nominee.state],
            ['PIN Code', nominee.pincode],
            ['Country', nominee.country],
            ['PAN', nominee.idProofType === 'PAN' ? nominee.idProofValue : null],
            ['Aadhaar', nominee.idProofType === 'AADHAAR' ? nominee.idProofValue : null],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
              <p className="text-sm text-slate-700 font-medium">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NomineeTab({ account, onNext }) {
  const { updateAccount } = useAuth();
  const navigate = useNavigate();
  const initialOption = account.nominee?.option || 'NO_CHANGE';
  const [option, setOption] = useState(initialOption);
  
  const initialNominees = Array.isArray(account.nominee?.nominees) && account.nominee.nominees.length > 0
    ? account.nominee.nominees
    : [];
  
  const isLocked = ['AWAITING_ESIGN', 'PENDING_VERIFICATION', 'REJECTED'].includes(account.operationStatus);

  // Make sure we never have null values in state, which breaks controlled inputs
  const mergedNominees = initialNominees.map(n => {
    const merged = { ...EMPTY_NOMINEE, ...n };
    Object.keys(merged).forEach(k => {
      if (merged[k] === null || merged[k] === undefined) merged[k] = '';
    });
    merged.dob = isoToDMY(merged.dob); // show as DD/MM/YYYY
    return merged;
  });
  
  const [nominees, setNominees] = useState(mergedNominees);
  const [editMode, setEditMode] = useState(initialOption === 'YES');
  const [printName, setPrintName] = useState(false);
  const [printYesNo, setPrintYesNo] = useState(false);
  const [authRights, setAuthRights] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const totalPercentage = nominees.reduce((sum, n) => sum + (Number(n.percentage) || 0), 0);

  const addNominee = () => {
    if (nominees.length >= 3) return;
    const isFirst = nominees.length === 0;
    setNominees([...nominees, { ...EMPTY_NOMINEE, percentage: isFirst ? '100' : '' }]);
  };

  const removeNominee = (index) => {
    setNominees(nominees.filter((_, i) => i !== index));
  };

  const updateNomineeField = (index, field, value) => {
    setNominees(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleEditClick = () => {
    if (nominees.length === 0) {
      setNominees([{ ...EMPTY_NOMINEE, percentage: '100' }]);
    }
    setEditMode(true);
    setOption('YES');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (option === 'YES') {
      if (nominees.length === 0) {
        setError('Please add at least one nominee.');
        return;
      }
      if (totalPercentage !== 100) {
        setError('Total nominee percentage share must be exactly 100%');
        return;
      }
      for (let i = 0; i < nominees.length; i++) {
        const n = nominees[i];
        if (!n.relation || !n.firstName || !dmyToISO(n.dob) || !n.percentage) {
          setError(`Please fill in all mandatory fields (*) for Nominee ${i + 1}.`);
          return;
        }
      }
      for (const n of nominees) {
        const iso = dmyToISO(n.dob);
        if (iso) {
          const ageDifMs = Date.now() - new Date(iso).getTime();
          const ageDate = new Date(ageDifMs);
          const age = Math.abs(ageDate.getUTCFullYear() - 1970);
          if (age < 18) {
            setError('Minor nominees (under 18) are not allowed.');
            return;
          }
        }
      }
    }

    setLoading(true);
    setError('');
    setSaved(false);
    try {
      const payload = {
        option,
        nominees: option === 'YES' ? nominees.map((n) => ({ ...n, dob: dmyToISO(n.dob) })) : [],
        meta: { printName, printYesNo, authRights }
      };
      const { data } = await updateNominee(account.clientId, payload);
      updateAccount(data.data);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update nominee details.');
    } finally {
      setLoading(false);
    }
  };

  const getNomineeTitle = (index) => {
    if (index === 0) return 'First Nominee';
    if (index === 1) return 'Second Nominee';
    return 'Third Nominee';
  };

  // NEXT — if a nominee change was saved in this flow, move to e-sign and open
  // the eSign page (Nominee PDF preview + Proceed to eSign). Otherwise proceed.
  const nomineeSaved = !!account.personal?.pendingChanges?.nominee;
  const handleNext = async () => {
    if (!nomineeSaved) { onNext(); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await startNomineeEsign(account.clientId);
      const operationId = data?.data?.operationId || account.rekycMasterId;
      navigate(`/esign/${account.clientId}?operation_id=${operationId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start e-sign. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-100/50 p-8">
      <h3 className="text-lg font-bold text-slate-800 mb-2">Nominee Details</h3>
      <div className="bg-brand-blue-50/80 text-brand-blue-700 text-sm rounded-lg px-4 py-3 mb-6">
        Nominee modifications are securely recorded and will take up to 48 hours to reflect post verification.
      </div>

      {['pending', 'in_progress', 'pending_verification'].includes(account.nominee?.status) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-6 text-sm flex items-center gap-3">
          <span className="bg-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Requested</span>
          <span>You have a pending nominee modification request. Your new details are shown below but will take up to 48 hours to reflect post verification.</span>
        </div>
      )}

      {initialNominees.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Existing Nominee{initialNominees.length > 1 ? 's' : ''}
            </h4>
            {!isLocked && !editMode && (
              <button
                type="button"
                onClick={handleEditClick}
                className="flex items-center gap-2 text-xs font-bold text-brand-blue-600 hover:text-brand-blue-800 border border-brand-blue-200 hover:border-brand-blue-400 bg-brand-blue-50 hover:bg-brand-blue-100 rounded-lg px-4 py-2 transition-all duration-200"
              >
                <Edit3 size={13} />
                EDIT / CHANGE NOMINEE
              </button>
            )}
          </div>
          <div className="space-y-3">
            {initialNominees.map((n, i) => (
              <ExistingNomineeCard key={i} nominee={n} index={i} />
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-8">
          <p className="text-sm text-slate-500 mb-3">Do you wish to make changes in Nomination?</p>
          <div className="flex gap-8 flex-wrap">
            {[
              { value: 'YES', label: 'YES (Replace Nominee)' },
              { value: 'NO_CHANGE', label: 'NO CHANGE' },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-600 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={option === opt.value}
                  onChange={() => {
                    setOption(opt.value);
                    if (opt.value === 'YES' && !editMode) handleEditClick();
                    if (opt.value === 'NO_CHANGE') setEditMode(false);
                  }}
                  disabled={isLocked}
                  className="w-4 h-4 text-brand-blue-600 rounded border-slate-300 focus:ring-brand-blue-500 disabled:opacity-50"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {option === 'YES' && editMode && (
          <div className="space-y-8">
            {nominees.map((n, index) => (
              <div key={index} className="space-y-5">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h4 className="text-lg font-bold text-slate-800">{getNomineeTitle(index)}</h4>
                  {!isLocked && index > 0 && (
                    <button 
                      type="button" 
                      onClick={() => removeNominee(index)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <SelectField label="Relation*" value={n.relation} onChange={(v) => updateNomineeField(index, 'relation', v)} required options={['Father', 'Mother', 'Spouse', 'Son', 'Daughter', 'Brother', 'Sister', 'Other']} />
                  <Field label="Name*" value={n.firstName} onChange={(v) => updateNomineeField(index, 'firstName', v)} required />
                  <DobField value={n.dob} onChange={(v) => updateNomineeField(index, 'dob', v)} required />
                  <Field label={`Nominee${index + 1} Percentage*`} value={n.percentage} onChange={(v) => updateNomineeField(index, 'percentage', v)} required type="number" />
                </div>
              </div>
            ))}

            {!isLocked && nominees.length < 3 && (
              <button 
                type="button" 
                onClick={addNominee}
                className="flex items-center gap-2 text-brand-blue-700 font-bold hover:text-brand-blue-800 transition-colors"
              >
                Add {nominees.length === 1 ? 'Second' : 'Third'} Nominee <PlusCircle size={20} />
              </button>
            )}

            {nominees.length > 0 && totalPercentage > 100 && (
              <p className="text-sm text-red-600 font-medium">
                Error: Total percentage share exceeds 100%
              </p>
            )}

            <div className="border-t border-slate-100 pt-6 space-y-6">
              <div>
                <p className="text-sm text-slate-500 mb-3">
                  I/We want the details of my/our nominee to be printed in the statement of holding, provided to me/us by the AMC/DP as follows; (please tick, as appropriate)
                </p>
                <div className="flex gap-12">
                  <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                    <input type="checkbox" checked={printName} onChange={(e) => setPrintName(e.target.checked)} className="rounded border-slate-300 text-brand-blue-600 w-3.5 h-3.5" />
                    Name of Nominee
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                    <input type="checkbox" checked={printYesNo} onChange={(e) => setPrintYesNo(e.target.checked)} className="rounded border-slate-300 text-brand-blue-600 w-3.5 h-3.5" />
                    Nominee Yes/No
                  </label>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-500 mb-3">
                  I herby authorize (nominee number) to operate my account on my behalf, in case of my incapacitation in terms of paragraph 3.5 of the circular. He / She is authorized to encash my assets up to % of assets in the account / folio or Rs.
                </p>
                <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                  <input type="checkbox" checked={authRights} onChange={(e) => setAuthRights(e.target.checked)} className="rounded border-slate-300 text-brand-blue-600 w-3.5 h-3.5" />
                  Rights, Entitlement and Obligation of the investor and nominee
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-3">
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          {saved && <p className="text-sm text-green-600 font-medium">Nominee details updated.</p>}
          {!isLocked && (
            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-brand-blue-600 to-brand-coral-500 hover:from-brand-blue-500 hover:to-brand-coral-400 disabled:opacity-60 text-white font-bold rounded-xl px-12 py-3 shadow-[0_8px_20px_-6px_rgba(30,47,224,0.5)] hover:shadow-[0_10px_25px_-6px_rgba(240,64,95,0.45)] hover:-translate-y-0.5 transition-all duration-300 uppercase tracking-wider text-sm"
            >
              {loading ? 'Saving…' : 'SAVE CHANGES'}
            </button>
          )}
        </div>

        {onNext && (
          <div className="flex justify-end mt-6 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className="bg-gradient-to-r from-brand-blue-600 to-brand-coral-500 hover:from-brand-blue-500 hover:to-brand-coral-400 disabled:opacity-60 text-white text-sm font-bold uppercase tracking-wider rounded-lg px-6 py-2.5 shadow-[0_4px_14px_0_rgba(30,47,224,0.35)] hover:shadow-[0_6px_20px_rgba(240,64,95,0.3)] hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
            >
              {loading ? 'Loading…' : 'Next'} <ArrowRight size={16} />
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function Field({ label, value, onChange, required, type = 'text' }) {
  return (
    <div className="group/field transition-all duration-300 hover:-translate-y-0.5">
      <label className="block text-xs font-bold text-slate-700 mb-1.5 group-hover/field:text-brand-blue-600 transition-colors">{label}</label>
      <input
        type={type}
        required={required}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder=""
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-brand-blue-500 focus:ring-1 focus:ring-brand-blue-500 transition-all duration-300 placeholder:text-slate-300 group-hover/field:shadow-md group-hover/field:border-brand-blue-300"
      />
    </div>
  );
}

// Date of Birth — text input shown/typed as DD/MM/YYYY (auto-inserts slashes).
function DobField({ value, onChange, required }) {
  const format = (raw) => {
    const d = raw.replace(/\D/g, '').slice(0, 8);
    if (d.length >= 5) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
    if (d.length >= 3) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return d;
  };
  return (
    <div className="group/field transition-all duration-300 hover:-translate-y-0.5">
      <label className="block text-xs font-bold text-slate-700 mb-1.5 group-hover/field:text-brand-blue-600 transition-colors">Date of Birth*</label>
      <input
        type="text"
        inputMode="numeric"
        required={required}
        value={value || ''}
        onChange={(e) => onChange(format(e.target.value))}
        placeholder="DD/MM/YYYY"
        maxLength={10}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-brand-blue-500 focus:ring-1 focus:ring-brand-blue-500 transition-all duration-300 placeholder:text-slate-300 group-hover/field:shadow-md group-hover/field:border-brand-blue-300"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, required, options }) {
  return (
    <div className="group/field transition-all duration-300 hover:-translate-y-0.5">
      <label className="block text-xs font-bold text-slate-700 mb-1.5 group-hover/field:text-brand-blue-600 transition-colors">{label}</label>
      <select
        required={required}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:border-brand-blue-500 focus:ring-1 focus:ring-brand-blue-500 transition-all duration-300 group-hover/field:shadow-md group-hover/field:border-brand-blue-300"
      >
        <option value="" disabled>--- Select {label.replace('*','')} ---</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
