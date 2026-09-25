import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import Topbar from '../components/Topbar';
import Sidebar from '../components/Sidebar';
import AccountHeader from '../components/AccountHeader';
import PersonalTab from '../components/tabs/PersonalTab';
import BankTab from '../components/tabs/BankTab';
import NomineeTab from '../components/tabs/NomineeTab';
import OthersTab from '../components/tabs/OthersTab';
import DocumentWizard from '../components/tabs/DocumentWizard';
import PageShell from '../components/ui/PageShell';
import { useAuth } from '../context/AuthContext';

const TAB_COMPONENTS = {
  personal: PersonalTab,
  bank: BankTab,
  nominee: NomineeTab,
  others: OthersTab,
  document: DocumentWizard,
};

// Fixed forward order of the flow. `others` is the DDPI step.
const STEP_ORDER = ['personal', 'bank', 'nominee', 'others', 'document'];
const NEXT_TAB = { personal: 'bank', bank: 'nominee', nominee: 'others', others: 'document' };

const STEP_KEY = 'rekyc_active_tab';
const COMPLETED_KEY = 'rekyc_completed_steps';

function loadActiveTab() {
  const saved = sessionStorage.getItem(STEP_KEY);
  return STEP_ORDER.includes(saved) ? saved : 'personal';
}

function loadCompleted() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(COMPLETED_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// Steps the account data itself already proves are done — so progress survives
// even if the per-tab session flags were cleared (e.g. after a fresh login the
// user resumes an in-flight operation).
function derivedCompletion(account) {
  if (!account) return {};
  const pc = account.personal?.pendingChanges || {};
  const done = {};

  // Personal: the only mandatory field on this step is Annual Income.
  if (account.others?.annualIncome || pc.annual_income) done.personal = true;

  // Bank: a bank account was added through the re-KYC flow.
  if (Array.isArray(account.bank) && account.bank.some((b) => b.source === 'rekyc')) done.bank = true;

  // Nominee: a nominee change was submitted.
  if (account.nominee?.option === 'YES' || account.nominee?.status || pc.nominee) done.nominee = true;

  // DDPI: activation submitted or already active.
  if (pc.ddpi || account.others?.ddpi === 'Yes') done.others = true;

  // Document: the operation has moved past the document stage.
  if (['AWAITING_ESIGN', 'PENDING_VERIFICATION', 'COMPLETED'].includes(account.operationStatus)) done.document = true;

  return done;
}

export default function AccountDetails() {
  const { account } = useAuth();
  // The active step lives in the URL (/account?step=nominee) so the sidebar
  // highlight and the rendered tab are always driven by the current route.
  // Without a ?step= (e.g. navigate('/account') from Add Bank / eSign) it falls
  // back to the step persisted in sessionStorage, so a route round-trip or a
  // page refresh does NOT reset the user to Personal.
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const stepParam = searchParams.get('step');
  const [fallbackTab] = useState(loadActiveTab);
  const activeTab = STEP_ORDER.includes(stepParam) ? stepParam : fallbackTab;
  const [completedSession, setCompletedSession] = useState(loadCompleted);
  const [stepError, setStepError] = useState('');

  // Mobile / E-mail / Address changes must finish their own DigiLocker +
  // e-Sign (the Document step) before Bank/Nominee/DDPI can be touched. Not
  // set (false) when none of those three fields are being changed, in which
  // case the flow below is completely unchanged.
  const personalGatePending = !!account?.personal?.digilockerGatePending;

  useEffect(() => {
    sessionStorage.setItem(STEP_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    sessionStorage.setItem(COMPLETED_KEY, JSON.stringify(completedSession));
  }, [completedSession]);

  const completed = useMemo(
    () => ({ ...derivedCompletion(account), ...completedSession }),
    [account, completedSession]
  );

  const setActiveTab = useCallback((id) => {
    setStepError('');
    // replace: switching steps must not add browser-history entries (the
    // navigation flow is unchanged); keep any route state (e.g. the
    // DigiLocker address handed back to the Personal tab).
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('step', id);
        return next;
      },
      { replace: true, state: location.state }
    );
  }, [setSearchParams, location.state]);

  const markCompleted = useCallback((step) => {
    setCompletedSession((prev) => (prev[step] ? prev : { ...prev, [step]: true }));
  }, []);

  // The current step must be satisfied before it can be left. Personal / bank /
  // nominee / ddpi changes are all optional — reviewing the step and clicking
  // NEXT completes it. Any change made in a step is captured by
  // derivedCompletion above.
  const validateStep = useCallback(() => ({ ok: true }), []);

  // Clear the step error as soon as the current step becomes valid — e.g. right
  // after the user adds their Annual Income, without waiting for navigation.
  useEffect(() => {
    setStepError((prev) => (prev && validateStep(activeTab).ok ? '' : prev));
  }, [activeTab, validateStep]);

  // Wired to every tab's existing "Next" button.
  const handleNext = () => {
    const result = validateStep(activeTab);
    if (!result.ok) {
      setStepError(result.message);
      return;
    }
    markCompleted(activeTab);
    // Personal Details changed → the next stop is the Document step (DigiLocker
    // + e-Sign), not Bank — Bank/Nominee/DDPI are gated until that completes.
    const next = (activeTab === 'personal' && personalGatePending) ? 'document' : NEXT_TAB[activeTab];
    if (next) setActiveTab(next);
  };

  // Drives only the Sidebar's dimmed "locked" style (navigation is free, see
  // handleSelect). The one real lock: Bank / Nominee / DDPI stay locked until
  // the pending Personal Details DigiLocker + e-Sign is complete. Steps are
  // NOT dimmed just because the previous step wasn't changed — every change is
  // optional, so e.g. Nominee must look normal even when Bank was skipped.
  const canAccess = useCallback(
    (step) => !(personalGatePending && ['bank', 'nominee', 'others'].includes(step)),
    [personalGatePending]
  );

  // Left-side step navigation — the sidebar is now freely clickable, so this
  // just switches the tab directly instead of gating on canAccess(). canAccess
  // itself is unchanged and still drives the Sidebar's "locked" visual style.
  const handleSelect = (step) => {
    setActiveTab(step);
  };

  if (!account) return null;

  const TabComponent = TAB_COMPONENTS[activeTab];

  return (
    <PageShell>
      <Topbar />
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col md:flex-row gap-6">
        <Sidebar active={activeTab} completed={completed} canAccess={canAccess} onSelect={handleSelect} />
        <div className="flex-1 min-w-0">
          <AccountHeader account={account} />
          {['AWAITING_ESIGN', 'PENDING_VERIFICATION'].includes(account.operationStatus) && (
            <div role="status" className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              {account.operationStatus === 'AWAITING_ESIGN'
                ? 'Please complete e-sign for your current request. Further changes are locked until KYC team approval.'
                : 'Your request is awaiting KYC team approval. You can make another Personal, Bank, Nominee or DDPI change after approval.'}
            </div>
          )}
          {personalGatePending && activeTab !== 'personal' && (
            <div className="mb-4 text-sm text-amber-700 font-medium bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              Your Personal Details change (Mobile / E-mail / Address) needs DigiLocker verification and e-Sign first. Please complete it below — Bank, Nominee and DDPI stay locked until then.
            </div>
          )}
          {stepError && (
            <div className="mb-4 text-sm text-red-600 font-medium bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              {stepError}
            </div>
          )}
          <TabComponent account={account} onNext={handleNext} />
        </div>
      </div>
    </PageShell>
  );
}
