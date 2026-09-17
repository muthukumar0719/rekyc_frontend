import { useState } from 'react';
import { Pencil, ShieldCheck } from 'lucide-react';
import {
  requestFieldChange,
  sendEmailChangeIdentityOtp, verifyEmailChangeIdentityOtp, sendEmailChangeOtp, confirmEmailChange,
  sendMobileChangeIdentityOtp, verifyMobileChangeIdentityOtp, sendMobileChangeOtp, confirmMobileChange,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function EditableField({ disabled = false, label, field, value, pending, clientId, wide, type = 'text', options, identityChannel, identityContactMasked }) {
  const { updateAccount } = useAuth();
  const [editing, setEditing] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Email/Mobile OTP flow states
  const [otpStep, setOtpStep] = useState(false); // true = waiting for OTP entry
  const [otp, setOtp] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [devOtp, setDevOtp] = useState('');

  // Identity-verification pre-step (proves access to the OTHER registered channel first)
  const [identityVerified, setIdentityVerified] = useState(false);
  const [identityOtpStep, setIdentityOtpStep] = useState(false);
  const [identityOtp, setIdentityOtp] = useState('');
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState('');
  const [identityDevOtp, setIdentityDevOtp] = useState('');
  const [identityMessage, setIdentityMessage] = useState('');

  const isEmail = field === 'email';
  const isMobile = field === 'mobile';
  const isOtpFlow = isEmail || isMobile;
  const needsIdentityCheck = isOtpFlow && !identityVerified;

  const handleSendIdentityOtp = async () => {
    setIdentityLoading(true);
    setIdentityError('');
    try {
      const { data } = isMobile
        ? await sendMobileChangeIdentityOtp(clientId)
        : await sendEmailChangeIdentityOtp(clientId);
      setIdentityOtpStep(true);
      setIdentityMessage(data.message);
      setIdentityDevOtp(data.devOtp || '');
    } catch (err) {
      setIdentityError(err.response?.data?.message || 'Could not send verification OTP.');
    } finally {
      setIdentityLoading(false);
    }
  };

  const handleVerifyIdentityOtp = async (e) => {
    e.preventDefault();
    if (!identityOtp.trim()) return;
    setIdentityLoading(true);
    setIdentityError('');
    try {
      if (isMobile) {
        await verifyMobileChangeIdentityOtp(clientId, identityOtp.trim());
      } else {
        await verifyEmailChangeIdentityOtp(clientId, identityOtp.trim());
      }
      setIdentityVerified(true);
    } catch (err) {
      setIdentityError(err.response?.data?.message || 'Invalid or expired OTP.');
    } finally {
      setIdentityLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newValue.trim()) return;
    setLoading(true);
    setError('');

    if (isEmail) {
      // Step 1: Send OTP to the new email
      try {
        const { data } = await sendEmailChangeOtp(clientId, newValue.trim());
        setOtpStep(true);
        setOtpMessage(data.message);
        setDevOtp(data.devOtp || '');
      } catch (err) {
        setError(err.response?.data?.message || 'Could not send OTP to new email.');
      } finally {
        setLoading(false);
      }
    } else if (isMobile) {
      // Step 1: Send OTP to the new mobile
      try {
        const { data } = await sendMobileChangeOtp(clientId, newValue.trim());
        setOtpStep(true);
        setOtpMessage(data.message);
        setDevOtp(data.devOtp || '');
      } catch (err) {
        setError(err.response?.data?.message || 'Could not send OTP to new mobile.');
      } finally {
        setLoading(false);
      }
    } else {
      // Other fields — direct change request
      try {
        const { data } = await requestFieldChange(clientId, field, newValue.trim());
        updateAccount(data.data);
        setEditing(false);
        setNewValue('');
      } catch (err) {
        setError(err.response?.data?.message || 'Could not submit change request.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setLoading(true);
    setError('');
    try {
      let data;
      if (isEmail) {
        const res = await confirmEmailChange(clientId, newValue.trim(), otp.trim());
        data = res.data;
      } else if (isMobile) {
        const res = await confirmMobileChange(clientId, newValue.trim(), otp.trim());
        data = res.data;
      }
      updateAccount(data.data);
      // Reset everything
      handleCancel();
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setOtpStep(false);
    setNewValue('');
    setOtp('');
    setError('');
    setDevOtp('');
    setOtpMessage('');
    setIdentityVerified(false);
    setIdentityOtpStep(false);
    setIdentityOtp('');
    setIdentityError('');
    setIdentityDevOtp('');
    setIdentityMessage('');
  };

  return (
    <div className={wide ? 'md:col-span-3' : ''}>
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-xs text-slate-400">{label}</p>
        {!disabled && !pending && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-brand-blue-500 hover:text-brand-blue-700"
            aria-label={`Edit ${label}`}
          >
            <Pencil size={13} />
          </button>
        )}
        {pending && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
            Requested
          </span>
        )}
      </div>

      {!editing && <p className="font-bold text-slate-800 break-words">{value || 'N/A'}</p>}

      {/* Step 0 (email/mobile only): verify identity via the OTHER registered channel */}
      {editing && needsIdentityCheck && !identityOtpStep && (
        <div className="flex flex-col gap-3 mt-1 bg-brand-blue-50/60 border border-brand-blue-100 rounded-xl p-3">
          <p className="text-xs text-slate-600 flex items-start gap-1.5">
            <ShieldCheck size={14} className="text-brand-blue-600 shrink-0 mt-0.5" />
            For security, we'll first send an OTP to your registered {identityChannel}
            {identityContactMasked ? ` (${identityContactMasked})` : ''} to verify it's you.
          </p>
          {identityError && <p className="text-xs text-red-500 font-medium">{identityError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSendIdentityOtp}
              disabled={identityLoading}
              className="bg-brand-blue-600 hover:bg-brand-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg px-3 py-1.5"
            >
              {identityLoading ? 'Sending OTP…' : 'Send OTP'}
            </button>
            <button type="button" onClick={handleCancel} className="text-xs text-slate-500 hover:text-slate-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {editing && needsIdentityCheck && identityOtpStep && (
        <form onSubmit={handleVerifyIdentityOtp} className="flex flex-col gap-2 mt-1 bg-brand-blue-50/60 border border-brand-blue-100 rounded-xl p-3">
          <p className="text-xs text-slate-600">{identityMessage}</p>
          {identityDevOtp && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Dev OTP: <strong>{identityDevOtp}</strong>
            </p>
          )}
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={identityOtp}
            onChange={(e) => setIdentityOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter 6-digit OTP"
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm tracking-widest text-center"
          />
          {identityError && <p className="text-xs text-red-600">{identityError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={identityLoading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg px-3 py-1.5"
            >
              {identityLoading ? 'Verifying…' : 'Verify'}
            </button>
            <button type="button" onClick={handleCancel} className="text-xs text-slate-500 hover:text-slate-700">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Step 1: Enter new email / new value (only once identity is verified for email/mobile) */}
      {editing && !needsIdentityCheck && !otpStep && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-1">
          {options ? (
            <select
              autoFocus
              required
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue-500/40 focus:border-brand-blue-500 transition-all shadow-inner text-sm text-slate-800"
            >
              <option value="">---Select {label}---</option>
              {options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              type={type}
              autoFocus
              required
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={`New ${label.toLowerCase()}`}
              className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue-500/40 focus:border-brand-blue-500 transition-all shadow-inner text-sm text-slate-800"
            />
          )}
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-brand-blue-600 hover:bg-brand-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg px-3 py-1.5"
            >
              {loading ? (isOtpFlow ? 'Sending OTP…' : 'Submitting…') : (isOtpFlow ? 'Send OTP' : 'Submit')}
            </button>
            <button type="button" onClick={handleCancel} className="text-xs text-slate-500 hover:text-slate-700">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Step 2 (email/mobile): Verify OTP for the new value */}
      {editing && !needsIdentityCheck && otpStep && (
        <form onSubmit={handleOtpVerify} className="flex flex-col gap-2">
          <p className="text-xs text-slate-500">{otpMessage}</p>
          {devOtp && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Dev OTP: <strong>{devOtp}</strong>
            </p>
          )}
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter 6-digit OTP"
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm tracking-widest text-center"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg px-3 py-1.5"
            >
              {loading ? 'Verifying…' : 'Verify & Save'}
            </button>
            <button type="button" onClick={handleCancel} className="text-xs text-slate-500 hover:text-slate-700">
              Cancel
            </button>
          </div>
        </form>
      )}

      {pending && (
        <p className="text-xs text-slate-400 mt-1">
          New value pending verification: <span className="font-medium text-slate-600">{pending.newValue}</span>
        </p>
      )}
    </div>
  );
}
