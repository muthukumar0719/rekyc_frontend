import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { getDigilockerStatus, getDigilockerAadhaar } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import aionionLogo from '../assets/aionion-logo.png';

export default function DigilockerCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { account } = useAuth();
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!account) {
      setError('Not authenticated. Please log in.');
      return;
    }

    const id = searchParams.get('id');
    if (!id) {
      setError('Invalid DigiLocker callback. Missing ID.');
      return;
    }

    const type = searchParams.get('type');

    if (type === 'document') {
      // For document flow, the main window (DocumentWizard) is the SOLE owner of status polling.
      // We do NOT poll here to avoid duplicate network requests.
      // We just set a success message immediately so the user knows it's done.
      // The main window's pollTimer will detect completion and call popup.close().
      setSuccessMsg('Authentication flow completed. This window should close automatically shortly.');
      return;
    }

    // Address Change flow logic
    let isSubscribed = true;
    let intervalId;

    const pollStatus = async () => {
      try {
        const { data } = await getDigilockerStatus(account.clientId, id);
        const statusData = data?.data;

        if (statusData?.status === 'authenticated') {
          clearInterval(intervalId);

          // Fetch Aadhaar and get formatted address
          const aadhaarRes = await getDigilockerAadhaar(account.clientId, id);
          const formattedAddress = aadhaarRes.data?.formattedAddress;

          if (!formattedAddress) {
            if (isSubscribed) setError('Failed to extract address from Aadhaar data.');
            return;
          }

          // Return to Account Details with state
          if (isSubscribed) {
            navigate('/account', {
              state: {
                digilockerAddress: formattedAddress,
                digilockerRef: id
              },
              replace: true
            });
          }
        } else if (statusData?.status === 'error' || statusData?.status === 'failed' || statusData?.status === 'cancelled') {
           clearInterval(intervalId);
           if (isSubscribed) setError(`DigiLocker status: ${statusData.status}`);
        }
      } catch (err) {
        clearInterval(intervalId);
        if (isSubscribed) setError(err.response?.data?.message || err.message || 'Error checking DigiLocker status.');
      }
    };

    // Initial check
    pollStatus();

    // Poll every 3 seconds
    intervalId = setInterval(pollStatus, 3000);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }, [account, searchParams, navigate]);

  return (
    <PageShell contentClassName="min-h-screen flex flex-col items-center justify-center p-4">
      <img src={aionionLogo} alt="Aionion Capital" className="h-16 md:h-20 object-contain drop-shadow-sm mb-4" />

      <Card className="p-8 max-w-md w-full text-center border-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
        <h2 className="text-xl font-bold text-slate-800 mb-4">DigiLocker Verification</h2>

        {!error && !successMsg ? (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-brand-blue-200 border-t-brand-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600">Please wait while we verify your DigiLocker authentication...</p>
          </div>
        ) : successMsg ? (
          <div>
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6" />
            </div>
            <p className="text-emerald-600 font-medium mb-6">{successMsg}</p>
            <Button variant="primary" onClick={() => window.close()}>
              Close Window
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-red-600 font-medium mb-6">{error}</p>
            <Button variant="primary" onClick={() => navigate('/account')}>
              Return to Account
            </Button>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
