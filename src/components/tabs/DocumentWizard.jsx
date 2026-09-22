import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDocumentRequirements,
  startDocumentDigilocker,
  fetchDigilockerDocuments,
  uploadManualDocument,
  validateSessionComplete,
  getDigilockerStatus,
} from '../../services/api';
import { CheckCircle, AlertCircle, RefreshCw, ArrowRight, ArrowLeft, Lock, Landmark, CreditCard, FileText, ShieldCheck, Calendar, User, MapPin, LogOut } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import SignaturePad from '../SignaturePad';

// Which required-document types map to their own wizard step, in display order.
// CLIENT_IMAGE isn't a step here — it's the existing IPV flow, reached after
// every step below is complete. AADHAAR_XML is folded into the DIGILOCKER step.
// PAN is normally fetched automatically alongside the Aadhaar XML as part of
// the DigiLocker step (see _internalFetchDigilockerDocuments on the backend),
// but that fetch often fails (PAN isn't always linked in DigiLocker) — this
// step shows as already done when DigiLocker succeeded, or offers a manual
// upload when it didn't.
const STEP_DEFS = [
  { key: 'DIGILOCKER', label: 'DigiLocker', requires: (list) => list.includes('AADHAAR') || list.includes('AADHAAR_XML') },
  { key: 'SIGNATURE', label: 'Signature', requires: (list) => list.includes('SIGNATURE') },
  { key: 'PAN', label: 'PAN', requires: (list) => list.includes('PAN') },
  { key: 'BANK_PROOF', label: 'Bank Proof', requires: (list) => list.includes('BANK_PROOF') },
];

export default function DocumentWizard({ account, onProceed }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [session, setSession] = useState(null);
  const [requirements, setRequirements] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [operationId, setOperationId] = useState(null);
  const [operationStatus, setOperationStatus] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState(null);

  const [digilockerLoading, setDigilockerLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [proceedLoading, setProceedLoading] = useState(false);
  const [autoAdvanced, setAutoAdvanced] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  // True only when the preview was opened automatically right after
  // DigiLocker finished — shows a "Continue" button in the modal that moves
  // straight to the Signature step, instead of requiring a separate "View"
  // click and then "Next". Any manually-opened preview (PAN/Bank Proof/
  // Signature "View" buttons) goes through openManualPreview() below, which
  // always clears this back to false.
  const [previewAutoContinue, setPreviewAutoContinue] = useState(false);
  const openManualPreview = (url) => { setPreviewAutoContinue(false); setPreviewDoc(url); };
  // Local override for the signature step so "Re-sign" (inside SignaturePad)
  // can show the pad again immediately, without waiting on a re-fetch —
  // undefined defers to the server-derived record via getDocRecord.
  const [sigOverride, setSigOverride] = useState(undefined);

  const fetchSession = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await getDocumentRequirements(account.clientId);
      setSession(data.session);
      setRequirements(data.requirements);
      setDocuments(data.documents || []);
      setOperationId(data.operationId);
      setOperationStatus(data.operationStatus);
      setAdminRemarks(data.adminRemarks);
      return data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 400) {
        setError('No active Re-KYC modifications found. Please initiate a modification first.');
      } else {
        setError('Failed to fetch document requirements.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    // eslint-disable-next-line
  }, [account.clientId]);

  const requiredList = requirements?.requiredDocuments || [];
  const steps = STEP_DEFS.filter((s) => s.requires(requiredList));

  const getDocRecord = (type) => documents.find((d) => d.document_type === type && (d.status === 'UPLOADED' || d.status === 'FLAGGED_FOR_REVIEW'));

  const allUploaded = requiredList.every((type) => (type === 'AADHAAR_XML' ? getDocRecord('AADHAAR_XML') : getDocRecord(type)));
  const isReadOnly = operationStatus === 'AWAITING_ESIGN' || operationStatus === 'PENDING_VERIFICATION' || operationStatus === 'COMPLETED';
  const isEditable = !isReadOnly && (!session || session.status === 'IN_PROGRESS' || session.status === 'DIGILOCKER_STARTED' || session.status === 'PARTIAL');
  const canProceed = isEditable || session?.status === 'AWAITING_ESIGN';

  const handleProceed = async () => {
    // DDPI/Nominee/Bank-only operations may never create a document session
    // at all (nothing here requires a capture step for them anymore), so
    // session.operation_id isn't always available — operationId always is.
    const targetOperationId = session?.operation_id ?? operationId;
    try {
      setProceedLoading(true);
      setError(null);
      if (session?.status === 'AWAITING_ESIGN') {
        navigate(`/esign/${account.clientId}?operation_id=${targetOperationId}`);
        return;
      }
      await validateSessionComplete(account.clientId);
      if (onProceed) onProceed();
      navigate(`/esign/${account.clientId}?operation_id=${targetOperationId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Session validation failed. Ensure all documents are uploaded.');
    } finally {
      setProceedLoading(false);
    }
  };

  // Once every required document (including the live photo from IPV) is
  // already uploaded — e.g. the user just returned from the IPV capture
  // page, or nothing was ever required (DDPI/Nominee/Bank) — auto-advance
  // straight to eSign instead of waiting for a click.
  useEffect(() => {
    if (!autoAdvanced && !loading && requirements && canProceed && allUploaded) {
      setAutoAdvanced(true);
      handleProceed();
    }
    // eslint-disable-next-line
  }, [loading, requirements, canProceed, allUploaded]);

  const isStepComplete = (step) => {
    if (step.key === 'DIGILOCKER') return !!getDocRecord('AADHAAR');
    return !!getDocRecord(step.key);
  };

  // Right after DigiLocker successfully hands back documents, pop the
  // Aadhaar preview open automatically (no "View" click needed) with a
  // "Continue" button that moves straight to the Signature step.
  const showAadhaarAutoPreview = (freshData) => {
    const aadhaarDoc = freshData?.documents?.find(
      (d) => d.document_type === 'AADHAAR' && (d.status === 'UPLOADED' || d.status === 'FLAGGED_FOR_REVIEW') && d.viewUrl
    );
    if (aadhaarDoc) {
      setPreviewDoc(aadhaarDoc.viewUrl);
      setPreviewAutoContinue(true);
    }
  };

  const handleGetDocuments = async () => {
    try {
      setDigilockerLoading(true);
      setError(null);
      const redirectUrl = `${window.location.origin}/digilocker-callback?type=document`;
      const { data } = await startDocumentDigilocker(account.clientId, { redirectUrl });

      if (data.success && data.data?.url) {
        const width = 500;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(data.data.url, 'DigiLocker Auth', `width=${width},height=${height},left=${left},top=${top}`);

        const pollTimer = setInterval(async () => {
          try {
            const statusRes = await getDigilockerStatus(account.clientId, data.data.id);
            const statusData = statusRes.data.data;
            if (statusData?.status === 'authenticated') {
              clearInterval(pollTimer);
              popup?.close();
              try {
                await fetchDigilockerDocuments(account.clientId, { digilockerRef: data.data.id });
                const fresh = await fetchSession();
                showAadhaarAutoPreview(fresh);
              } catch (fetchErr) {
                setError(fetchErr.response?.data?.message || 'Failed to retrieve documents from DigiLocker');
              }
              setDigilockerLoading(false);
            } else if (['error', 'failed', 'cancelled'].includes(statusData?.status)) {
              clearInterval(pollTimer);
              popup?.close();
              setError(`DigiLocker authentication failed or was cancelled. Status: ${statusData.status}`);
              setDigilockerLoading(false);
            }
          } catch (pollErr) {
            console.error('Polling error', pollErr);
          }
        }, 3000);

        const checkClosed = setInterval(async () => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            clearInterval(pollTimer);
            try {
              const statusRes = await getDigilockerStatus(account.clientId, data.data.id);
              if (statusRes.data.data?.status === 'authenticated') {
                try {
                  await fetchDigilockerDocuments(account.clientId, { digilockerRef: data.data.id });
                  const fresh = await fetchSession();
                  showAadhaarAutoPreview(fresh);
                } catch (fetchErr) {
                  setError(fetchErr.response?.data?.message || 'Failed to retrieve documents from DigiLocker');
                }
              }
            } catch (err) {
              console.error('Final check after popup close failed', err);
            }
            setDigilockerLoading(false);
          }
        }, 1000);
      } else {
        setError('Failed to start DigiLocker. Please try again later.');
        setDigilockerLoading(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start DigiLocker.');
      setDigilockerLoading(false);
    }
  };

  const handlePanUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setError(null);
      const formData = new FormData();
      formData.append('documentType', 'PAN');
      formData.append('file', file);
      await uploadManualDocument(account.clientId, formData);
      await fetchSession();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload PAN.');
    }
  };

  const handleBankProofUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setError(null);
      const formData = new FormData();
      formData.append('documentType', 'BANK_PROOF');
      formData.append('file', file);
      await uploadManualDocument(account.clientId, formData);
      await fetchSession();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload bank proof.');
    }
  };

  const goNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }
    // Last content step done — move on to the live photo step, or straight
    // to eSign if a photo was already captured earlier in this operation.
    if (requiredList.includes('CLIENT_IMAGE') && !getDocRecord('CLIENT_IMAGE')) {
      window.location.href = `/ipv-capture/${account.clientId}`;
      return;
    }
    handleProceed();
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading document requirements...</div>;
  }

  if (!requirements) {
    return (
      <Card className="p-6 md:p-10">
        <div className="flex flex-col items-center text-center py-4">
          <div className="relative w-20 h-20 mb-6">
            <div className="w-20 h-20 rounded-full bg-brand-blue-50 flex items-center justify-center">
              <FileText className="w-9 h-9 text-brand-blue-300" />
            </div>
            <div className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-brand-blue-600 text-white flex items-center justify-center text-xs font-bold">
              !
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-900">No Changes Detected</h3>
          <p className="text-slate-500 mt-3 max-w-md">You haven't made any changes to your account details.</p>
          <p className="text-slate-500 mt-1 max-w-md">There are no documents to upload or submit.</p>
          <p className="text-slate-500 mt-1 max-w-md">
            If you do not wish to make any changes, please quit the Re-KYC process and return to your dashboard.
          </p>
        </div>
        <div className="flex justify-end pt-6 mt-2 border-t border-slate-100">
          <Button variant="danger" onClick={() => { window.location.href = 'https://www.aionioncapital.com/investor'; }}>
            <LogOut size={16} /> Quit Re-KYC
          </Button>
        </div>
      </Card>
    );
  }

  if (isReadOnly) {
    return (
      <Card className="p-6 space-y-4">
        {operationStatus === 'AWAITING_ESIGN' && (
          <StatusBanner tone="brand" title="Awaiting eSign" body='Your documents are uploaded. Please click "Continue to eSign" below.' />
        )}
        {operationStatus === 'PENDING_VERIFICATION' && (
          <StatusBanner tone="brand" title="Under Review" body="Your Re-KYC request is currently pending verification by our team." />
        )}
        {operationStatus === 'COMPLETED' && (
          <StatusBanner tone="success" title="Re-KYC Complete" body="Your Re-KYC modifications have been verified and processed successfully." />
        )}
        {operationStatus === 'REJECTED' && (
          <StatusBanner tone="error" title="Modifications Rejected" body={adminRemarks || 'Please contact support for details.'} />
        )}
        {operationStatus === 'AWAITING_ESIGN' && (
          <Button variant="primary" uppercase onClick={handleProceed} disabled={proceedLoading}>
            {proceedLoading ? 'Loading…' : 'Continue to eSign'} <ArrowRight size={16} />
          </Button>
        )}
      </Card>
    );
  }

  if (requiredList.length === 0) {
    // Nothing to capture (e.g. DDPI/Nominee/Bank-without-proof) — the
    // auto-advance effect above fires straight to eSign; this is just the
    // brief transition while that request is in flight.
    return <div className="p-8 text-center text-slate-500">Preparing eSign preview…</div>;
  }

  const currentStep = steps[stepIndex];

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Documents</h3>
            <p className="text-sm text-slate-500">Complete each step to proceed with your Re-KYC modification.</p>
          </div>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1 last:flex-none gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  i === stepIndex
                    ? 'bg-gradient-to-br from-brand-blue-600 to-brand-coral-500 text-white'
                    : isStepComplete(s)
                      ? 'bg-brand-blue-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {isStepComplete(s) ? <CheckCircle size={16} /> : i + 1}
              </div>
              <span className={`text-xs font-semibold hidden sm:block ${i === stepIndex ? 'text-brand-blue-700' : 'text-slate-400'}`}>{s.label}</span>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 rounded-full ${isStepComplete(s) ? 'bg-brand-blue-500' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Step content — DigiLocker/Bank Proof use a compact intro card whose
            action opens the capture UI; Signature shows its pad directly. */}
        <div className="flex items-center justify-center">
          {currentStep.key === 'SIGNATURE' && (
            <SignaturePad
              clientId={account.clientId}
              existingRecord={sigOverride !== undefined ? sigOverride : getDocRecord('SIGNATURE')}
              onView={openManualPreview}
              onUploaded={(record) => { setSigOverride(record); fetchSession(); }}
            />
          )}

          {currentStep.key === 'DIGILOCKER' && (
            getDocRecord('AADHAAR') ? (
              // No "View" button here — the preview already popped up
              // automatically as soon as DigiLocker finished.
              <StepDone label="Aadhaar & PAN retrieved from DigiLocker" />
            ) : (
              <StepIntro
                icon={Lock}
                iconClass="bg-emerald-100 text-emerald-600"
                title="DigiLocker"
                description="Fetch your documents securely from DigiLocker."
                actionLabel={digilockerLoading ? 'Processing…' : 'Continue with DigiLocker'}
                actionIcon={digilockerLoading ? RefreshCw : undefined}
                onAction={handleGetDocuments}
                disabled={digilockerLoading}
              />
            )
          )}

          {currentStep.key === 'PAN' && (
            getDocRecord('PAN') ? (
              <StepDone label="PAN uploaded" record={getDocRecord('PAN')} onView={openManualPreview} />
            ) : (
              <StepIntro
                icon={CreditCard}
                iconClass="bg-indigo-100 text-indigo-600"
                title="PAN Card"
                description="DigiLocker couldn't fetch your PAN automatically — please upload a clear photo or scan of it."
                actionLabel="Upload PAN"
                onAction={() => document.getElementById('pan-upload')?.click()}
              />
            )
          )}
          <input type="file" id="pan-upload" accept="image/*,application/pdf" className="hidden" onChange={handlePanUpload} />

          {currentStep.key === 'BANK_PROOF' && (
            getDocRecord('BANK_PROOF') ? (
              <StepDone label="Bank proof uploaded" record={getDocRecord('BANK_PROOF')} onView={openManualPreview} />
            ) : (
              <StepIntro
                icon={Landmark}
                iconClass="bg-amber-100 text-amber-600"
                title="Bank Proof"
                description="Upload a cancelled cheque or bank statement as proof."
                actionLabel="Upload Bank Proof"
                onAction={() => document.getElementById('bank-proof-upload')?.click()}
              />
            )
          )}
          <input type="file" id="bank-proof-upload" className="hidden" onChange={handleBankProofUpload} />
        </div>

        {/* Step navigation */}
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-100">
          <Button variant="secondary" size="sm" onClick={() => setStepIndex((i) => Math.max(0, i - 1))} disabled={stepIndex === 0}>
            <ArrowLeft size={14} /> Back
          </Button>
          {stepIndex < steps.length - 1 ? (
            <Button variant="primary" uppercase onClick={goNext} disabled={!isStepComplete(currentStep) || proceedLoading}>
              Next <ArrowRight size={16} />
            </Button>
          ) : (
            <Button
              variant="success"
              uppercase
              onClick={goNext}
              disabled={!isStepComplete(currentStep) || proceedLoading}
            >
              {proceedLoading ? 'Validating…' : 'Submit'} <CheckCircle size={16} />
            </Button>
          )}
        </div>
      </Card>

      {previewDoc && (
        <DocumentPreviewModal
          url={previewDoc}
          onClose={() => { setPreviewDoc(null); setPreviewAutoContinue(false); }}
          onContinue={previewAutoContinue ? () => { setPreviewDoc(null); setPreviewAutoContinue(false); goNext(); } : undefined}
        />
      )}
    </div>
  );
}

function StepIntro({ icon: Icon, iconClass, title, description, actionLabel, actionIcon: ActionIcon, onAction, disabled }) {
  return (
    <div className="flex items-center gap-5 py-2 w-full">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon size={28} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-slate-800">{title}</h4>
        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        <Button variant="primary" size="sm" className="mt-3" onClick={onAction} disabled={disabled}>
          {ActionIcon && <ActionIcon size={14} className="animate-spin" />} {actionLabel}
        </Button>
      </div>
    </div>
  );
}

function StepDone({ label, record, onView, onRedo, redoLabel }) {
  return (
    <div className="flex items-center gap-5 py-2 w-full">
      <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-600">
        <CheckCircle size={28} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-slate-800">{label}</h4>
        <div className="flex gap-3 mt-3">
          {record?.viewUrl && (
            <Button variant="secondary" size="sm" onClick={() => onView(record.viewUrl)}>
              View
            </Button>
          )}
          {onRedo && (
            <Button variant="outline" size="sm" onClick={onRedo}>
              {redoLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBanner({ tone, title, body }) {
  const styles = {
    brand: 'bg-brand-blue-50 border-brand-blue-200 text-brand-blue-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  };
  return (
    <div className={`p-4 rounded-xl border flex items-start gap-3 ${styles[tone]}`}>
      <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
      <div>
        <h4 className="font-bold">{title}</h4>
        <p className="text-sm mt-1">{body}</p>
      </div>
    </div>
  );
}

function DocumentPreviewModal({ url, onClose, onContinue }) {
  const [jsonContent, setJsonContent] = useState(null);
  const [prettyPrint, setPrettyPrint] = useState(false);

  useEffect(() => {
    try {
      const path = new URL(url, window.location.origin).pathname;
      if (path.toLowerCase().endsWith('.json')) {
        fetch(url).then((res) => res.text()).then(setJsonContent).catch((err) => console.error('Failed to load JSON preview:', err));
      }
    } catch (e) {}
  }, [url]);

  let isImg = false;
  let isJs = false;
  try {
    const path = new URL(url, window.location.origin).pathname;
    isImg = /\.(jpeg|jpg|gif|png|webp|bmp)$/i.test(path);
    isJs = /\.json$/i.test(path);
  } catch (e) {}

  let parsedJson = null;
  let isAadhaar = false;
  if (isJs && jsonContent) {
    try {
      parsedJson = JSON.parse(jsonContent);
      if (parsedJson?.photo && (parsedJson.name || parsedJson.dateOfBirth || parsedJson.maskedNumber)) isAadhaar = true;
    } catch (e) {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          {isAadhaar ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-blue-100 text-brand-blue-600 flex items-center justify-center shrink-0">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 leading-tight">Document Preview</h3>
                <p className="text-sm text-slate-500 leading-tight">Identity details fetched from Digilocker</p>
              </div>
            </div>
          ) : (
            <h3 className="font-bold text-slate-800">Document Preview</h3>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <span className="sr-only">Close</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 bg-slate-100 p-4 overflow-auto flex items-center justify-center">
          {isImg ? (
            <img src={url} alt="Document Preview" className="max-w-full max-h-full object-contain" />
          ) : isJs ? (
            isAadhaar ? (
              <AadhaarPreview parsedJson={parsedJson} />
            ) : (
              <div className="w-full h-full min-h-[60vh] flex flex-col bg-white border border-slate-200 rounded text-slate-700 font-mono text-xs overflow-hidden text-left">
                <div className="flex items-center gap-2 p-3 bg-slate-50 border-b border-slate-200">
                  <input
                    type="checkbox"
                    id="pretty-print"
                    className="w-4 h-4 rounded border-slate-300 bg-white text-brand-blue-500 focus:ring-brand-blue-500 cursor-pointer"
                    checked={prettyPrint}
                    onChange={(e) => setPrettyPrint(e.target.checked)}
                  />
                  <label htmlFor="pretty-print" className="text-slate-600 select-none cursor-pointer text-sm font-sans">Pretty-print</label>
                </div>
                <div className="flex-1 overflow-auto p-4 whitespace-pre-wrap break-all">
                  {jsonContent ? (
                    prettyPrint ? (
                      (() => {
                        try {
                          return JSON.stringify(JSON.parse(jsonContent), null, 2);
                        } catch (_e) {
                          return 'Invalid JSON:\n\n' + jsonContent;
                        }
                      })()
                    ) : (
                      jsonContent
                    )
                  ) : (
                    <span className="text-slate-400 animate-pulse font-sans">Loading JSON...</span>
                  )}
                </div>
              </div>
            )
          ) : (
            <iframe src={url} className="w-full h-full min-h-[60vh] border-0 bg-white" title="Document Preview" />
          )}
        </div>
        {onContinue && (
          <div className="flex justify-end p-4 border-t border-slate-100">
            <Button variant="primary" uppercase onClick={onContinue}>
              Continue <ArrowRight size={16} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AadhaarPreview({ parsedJson }) {
  const { photo } = parsedJson;
  const addressPieces = parsedJson.address
    ? [
        parsedJson.address.careOf, parsedJson.address.house, parsedJson.address.street,
        parsedJson.address.locality, parsedJson.address.vtc, parsedJson.address.district,
        parsedJson.address.state, parsedJson.address.pin,
      ].filter(Boolean).join(', ')
    : 'No address available';

  return (
    <div className="w-full h-full min-h-[60vh] flex flex-col bg-white border border-slate-200 rounded-xl text-slate-700 overflow-hidden text-left overflow-y-auto">
      <div className="p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <div className="shrink-0">
            <img src={`data:image/jpeg;base64,${photo}`} alt="Aadhaar Photo" className="w-28 h-32 object-cover border border-slate-200 rounded-xl" />
          </div>
          <div className="flex-1 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-blue-600 uppercase tracking-wider mb-1.5">
                <ShieldCheck size={14} />
                Verified via DigiLocker
              </div>
              <h4 className="text-2xl font-extrabold text-slate-900">{parsedJson.name || '—'}</h4>
              <p className="text-sm text-slate-500 mt-1">Identity details are verified and fetched directly from Digilocker.</p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-sm font-semibold px-3 py-1 rounded-full">
                <CheckCircle size={14} /> Verified
              </span>
              <p className="text-xs text-slate-400 mt-1">Source: Digilocker</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-brand-blue-100 text-brand-blue-600 flex items-center justify-center shrink-0">
              <Calendar size={16} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Date of Birth</p>
              <p className="font-bold text-slate-800">{parsedJson.dateOfBirth || parsedJson.dob || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-brand-blue-100 text-brand-blue-600 flex items-center justify-center shrink-0">
              <User size={16} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Gender</p>
              <p className="font-bold text-slate-800">{parsedJson.gender || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-brand-blue-100 text-brand-blue-600 flex items-center justify-center shrink-0">
              <CreditCard size={16} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Aadhaar Number</p>
              <p className="font-bold text-slate-800 font-mono tracking-widest">{parsedJson.maskedNumber || '—'}</p>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 bg-slate-50 border border-slate-100 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-brand-blue-100 text-brand-blue-600 flex items-center justify-center shrink-0">
            <MapPin size={16} />
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Address</p>
            <p className="font-semibold text-slate-800 leading-relaxed">{addressPieces}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
