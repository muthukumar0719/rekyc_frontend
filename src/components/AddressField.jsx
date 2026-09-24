import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { startDigilocker, confirmDigilockerAddress, fetchAccount } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { appAbsoluteUrl } from '../utils/basePath';

export default function AddressField({ disabled = false, label, value, pending, clientId, wide }) {
  const { updateAccount } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // State from DigiLocker callback
  const { digilockerAddress, digilockerRef } = location.state || {};
  const isConfirming = !!(digilockerAddress && digilockerRef);

  // Clear state on cancel
  const handleCancel = () => {
    navigate(location.pathname, { replace: true });
    setError('');
  };

  const handleStartDigilocker = async () => {
    setLoading(true);
    setError('');
    try {
      // Create callback URL for this app
      const redirectUrl = appAbsoluteUrl('digilocker-callback');
      const { data } = await startDigilocker(clientId, redirectUrl);

      // SETU returns the URL in the `url` field
      const setuUrl = data?.data?.url;
      if (setuUrl) {
        window.location.href = setuUrl;
      } else {
        setError('Failed to get redirect URL from DigiLocker');
        setLoading(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not start DigiLocker.');
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      await confirmDigilockerAddress(clientId, digilockerRef, digilockerAddress);

      // Fetch fresh account data from backend (so pending address shows correctly)
      const { data } = await fetchAccount(clientId);
      if (data?.data) {
        updateAccount(data.data);
      }
      // Clear the DigiLocker state from router so the confirmation UI disappears
      navigate(location.pathname, { replace: true, state: {} });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save address.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={wide ? 'md:col-span-3' : ''}>
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-xs text-slate-400">{label}</p>
        {!disabled && !pending && !isConfirming && (
          <button
            type="button"
            onClick={handleStartDigilocker}
            disabled={loading}
            className="text-brand-blue-500 hover:text-brand-blue-700 disabled:opacity-50"
            aria-label={`Update ${label} via DigiLocker`}
          >
            <Pencil size={13} />
          </button>
        )}
        {pending && !isConfirming && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
            Requested
          </span>
        )}
      </div>

      {!isConfirming && (
        <p className="font-bold text-slate-800 break-words">{value || 'N/A'}</p>
      )}

      {pending && !isConfirming && (
        <div className="mt-1 text-xs">
          <span className="text-slate-500 block">New address pending verification: </span>
          <span className="font-medium text-slate-700 break-words">{pending.newValue}</span>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      {isConfirming && (
        <div className="flex flex-col gap-2 mt-2 bg-brand-blue-50 p-3 rounded-lg border border-brand-blue-100">
          <p className="text-sm font-semibold text-brand-blue-800">Confirm Address</p>
          <p className="text-xs text-slate-600 mb-1">The following address was fetched from DigiLocker:</p>

          <div className="bg-white p-3 rounded border border-slate-200 shadow-inner">
            <p className="text-sm font-medium text-slate-800">{digilockerAddress}</p>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="bg-brand-blue-600 hover:bg-brand-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg px-4 py-2"
            >
              {loading ? 'Saving…' : 'Proceed'}
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-300 rounded-lg px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
