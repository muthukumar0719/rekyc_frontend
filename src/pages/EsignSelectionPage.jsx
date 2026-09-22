import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api, { fetchAccount } from '../services/api';
import { AlertCircle, FileText, ArrowRight, RefreshCw, Loader2, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import aionionLogo from '../assets/aionion-logo.png';

export default function EsignSelectionPage() {
  const { clientId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateAccount } = useAuth();

  const operationId = searchParams.get('operation_id');
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signingForm, setSigningForm] = useState(null);
  const [previewUrls, setPreviewUrls] = useState({});

  // Keeps the shared account (gating flags like Personal's DigiLocker gate,
  // operation status, pending changes) in sync with this operation's e-Sign
  // progress. Without this, a section that should unlock the moment its
  // e-Sign completes (e.g. Bank/Nominee/DDPI right after Personal Details is
  // signed) stays locked in the UI until the client logs out and back in —
  // the account object otherwise only ever updates via explicit API calls.
  const refreshAccount = async () => {
    try {
      const { data } = await fetchAccount(clientId);
      if (data?.data) updateAccount(data.data);
    } catch (_err) {
      // Non-fatal — the eSign requirements below are the primary data for this page.
    }
  };

  const fetchRequirements = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/client/${clientId}/esign/requirements?operation_id=${operationId}`);
      setRequirements(res.data.requirements);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load eSign requirements');
    } finally {
      setLoading(false);
    }
    await refreshAccount();
  };

  useEffect(() => {
    if (clientId && operationId) {
      fetchRequirements();
    }
  }, [clientId, operationId]);

  // Refetch on every `requirements` change, not just once per form_type —
  // the assembled package can change after the first preview was cached
  // (e.g. a personal-details edit, or a DDPI/nominee change lands on this
  // operation, or the user hits "Refresh Status").
  useEffect(() => {
    const toFetch = requirements.filter((req) => req.status !== 'sign_complete');
    toFetch.forEach(async (req) => {
      // Drop the previous preview (if any) the moment a refresh starts, so
      // the UI falls back to "Loading preview…" instead of ever silently
      // showing a blob that no longer matches the current data — that stale
      // blob is exactly what made a fresh change look like it "didn't fetch".
      setPreviewUrls((prev) => {
        if (!prev[req.form_type]) return prev;
        URL.revokeObjectURL(prev[req.form_type]);
        const next = { ...prev };
        delete next[req.form_type];
        return next;
      });
      try {
        const res = await api.get(`/client/${clientId}/esign/${req.form_type}/preview?operation_id=${operationId}`, {
          responseType: 'blob',
        });
        const blobUrl = URL.createObjectURL(res.data);
        setPreviewUrls((prev) => {
          if (prev[req.form_type]) URL.revokeObjectURL(prev[req.form_type]);
          return { ...prev, [req.form_type]: blobUrl };
        });
      } catch (err) {
        // Preview is a convenience — swallow errors, the sign flow still works
        // without it (the "Loading preview…" state just stays put).
        console.error(`Failed to load preview for ${req.form_type}:`, err);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requirements]);

  // Revoke every blob URL on unmount. Reads via a ref (not `previewUrls`
  // directly) because this effect's cleanup only ever runs once, at unmount —
  // closing over `previewUrls` directly would capture its value from the
  // very first render (always {}) and revoke nothing.
  const previewUrlsRef = useRef(previewUrls);
  useEffect(() => { previewUrlsRef.current = previewUrls; }, [previewUrls]);
  useEffect(() => {
    return () => {
      Object.values(previewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Location is mandatory for eSign — Setu records it as part of the signed
  // audit trail, so we no longer fall back to a hardcoded default when it's
  // unavailable; the client must grant it.
  const getCurrentPosition = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Your browser does not support location access, which is required to eSign.'));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => {
          const message = err.code === err.PERMISSION_DENIED
            ? 'Location access was denied. Please allow location access in your browser and try again — it is required to eSign.'
            : 'Could not determine your location. Please try again — it is required to eSign.';
          reject(new Error(message));
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });

  const handleSign = async (formType) => {
    setSigningForm(formType);
    setError(null);
    let position;
    try {
      position = await getCurrentPosition();
    } catch (locErr) {
      setError(locErr.message);
      setSigningForm(null);
      return;
    }

    try {
      const res = await api.post(`/client/${clientId}/esign/${formType}/start`, {
        operation_id: operationId,
        ...position,
      });

      if (res.data.signing_url) {
        window.location.href = res.data.signing_url;
      }
    } catch (err) {
      if (err.response?.status === 409) {
        // Generating or stuck, prompt to wait and refresh
        setError(err.response.data.message || 'Request is currently being generated. Please wait and refresh.');
      } else {
        setError(err.response?.data?.message || 'Failed to start eSign process');
      }
    } finally {
      setSigningForm(null);
    }
  };

  const handleRefreshStatus = async (formType, silent = false) => {
    try {
      await api.get(`/client/${clientId}/esign/${formType}/status?operation_id=${operationId}`);
      await fetchRequirements();
    } catch (err) {
      if (!silent) setError(err.response?.data?.message || 'Failed to check status');
    }
  };

  // Auto-detect e-Sign completion instead of relying on the client to click
  // "Refresh Status" — this is what makes Bank/Nominee/DDPI unlock
  // immediately and automatically, in the same session, the moment Personal
  // Details' e-Sign actually finishes (each check refreshes the shared
  // account via fetchRequirements() above, which clears the gate the moment
  // the server confirms sign_complete).
  useEffect(() => {
    const pendingForms = requirements.filter((r) => r.status === 'pending');
    if (pendingForms.length === 0) return;
    const interval = setInterval(() => {
      pendingForms.forEach((r) => handleRefreshStatus(r.form_type, true));
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requirements]);

  const handleDownload = async (formType) => {
    try {
      const res = await api.get(`/client/${clientId}/esign/${formType}/signed-pdf?operation_id=${operationId}`);
      window.open(res.data.url, '_blank');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to get signed PDF');
    }
  };

  if (!operationId) {
    return <div className="p-8">Missing operation_id in URL</div>;
  }

  return (
    <PageShell contentClassName="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full flex justify-center mb-2">
        <img src={aionionLogo} alt="Aionion Capital" className="h-16 md:h-20 object-contain drop-shadow-sm" />
      </div>

      <div className="max-w-3xl mx-auto space-y-8 mt-2">
        <div>
          <Button variant="link" onClick={() => navigate('/account')} className="mb-4 text-sm no-underline">
            ← Back to Account Details
          </Button>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">eSign Documents</h1>
          <p className="mt-2 text-slate-500">Sign the generated forms for your modification request.</p>
          <div className="mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-brand-blue-600 to-brand-coral-500" />
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3 border border-red-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 text-brand-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {requirements.map(req => (
              <Card key={req.form_type} className="p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl flex-shrink-0 ${req.status === 'sign_complete' ? 'bg-emerald-100' : 'bg-gradient-to-br from-brand-blue-50 to-brand-coral-50'}`}>
                      <FileText className={`w-6 h-6 ${req.status === 'sign_complete' ? 'text-emerald-600' : 'text-brand-blue-600'}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {{
                          MODIFICATION: 'Re-KYC Modification Form',
                          KRA: 'KRA KYC Form',
                          BANK: 'Bank Details Form',
                          NOMINEE: 'Nominee Details Form',
                          DDPI: 'DDPI Form',
                        }[req.form_type] || req.form_type}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                        <span>Status:</span>
                        <span className={`font-medium ${
                          req.status === 'sign_complete' ? 'text-emerald-600' :
                          req.status === 'pending' ? 'text-amber-600' :
                          req.status === 'failed' ? 'text-red-600' : 'text-slate-600'
                        }`}>
                          {req.status === 'sign_complete' ? 'Signed' :
                           req.status === 'pending' ? 'Awaiting Signature / Processing' :
                           req.status === 'failed' ? 'Failed' : 'Not Started'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {req.status === 'sign_complete' ? (
                    <Button variant="subtle" size="md" className="flex-1 sm:flex-none" onClick={() => handleDownload(req.form_type)}>
                      <Download className="w-4 h-4" /> Download
                    </Button>
                  ) : req.status === 'pending' ? (
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      {req.signing_url && (
                        <Button as="a" href={req.signing_url} variant="primary" size="md" className="flex-1 sm:flex-none">
                          Continue Signing <ArrowRight className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="secondary" size="md" className="flex-1 sm:flex-none" onClick={() => handleRefreshStatus(req.form_type)}>
                        <RefreshCw className="w-4 h-4" /> Refresh Status
                      </Button>
                    </div>
                  ) : null}
                </div>

                {req.status !== 'sign_complete' && req.status !== 'pending' && (
                  <div className="mt-5 pt-5 border-t border-slate-100">
                    {previewUrls[req.form_type] ? (
                      <iframe
                        title={`${req.form_type} preview`}
                        src={previewUrls[req.form_type]}
                        className="w-full h-[500px] rounded-lg border border-slate-200"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-40 text-slate-400 text-sm gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading preview…
                      </div>
                    )}
                    <div className="flex justify-end mt-4">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => handleSign(req.form_type)}
                        disabled={signingForm === req.form_type}
                      >
                        {signingForm === req.form_type ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                        ) : (
                          <>Proceed to eSign <ArrowRight className="w-4 h-4" /></>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
