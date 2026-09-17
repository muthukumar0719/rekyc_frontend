import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOtp, verifyOtp } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import aionionLogo from '../assets/aionion-logo.png';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState('code'); // 'code' | 'otp'
  const [clientCode, setClientCode] = useState('');
  const [otp, setOtp] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [maskedMobile, setMaskedMobile] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!clientCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await sendOtp(clientCode.trim());
      setMaskedEmail(data.maskedEmail);
      setMaskedMobile(data.maskedMobile);
      setDevOtp(data.devOtp || '');
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await verifyOtp(clientCode.trim(), otp.trim());
      login(data.data, data.token);
      navigate('/account');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell contentClassName="min-h-screen flex flex-col items-center justify-center px-4">
      <Card className="w-full max-w-md p-10 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border-white">
        <div className="flex flex-col items-center mb-10">
          <img src={aionionLogo} alt="Aionion Capital" className="h-28 md:h-32 object-contain drop-shadow-md mb-2" />
          <p className="text-sm font-medium text-slate-500 tracking-wide uppercase">Client Re-KYC Portal</p>
          <div className="mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-brand-blue-600 to-brand-coral-500" />
        </div>

        {step === 'code' && (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <div className="group">
              <label className="block text-xs font-bold text-slate-600 mb-2 group-focus-within:text-brand-blue-600 transition-colors">CLIENT CODE</label>
              <Input
                type="text"
                value={clientCode}
                onChange={(e) => setClientCode(e.target.value.toUpperCase())}
                placeholder="Enter your Client ID"
                autoFocus
              />
            </div>

            {error && <p className="text-sm text-red-500 font-medium bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}

            <Button type="submit" disabled={loading} fullWidth uppercase>
              {loading ? 'Sending OTP…' : 'Send OTP'}
            </Button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="bg-brand-blue-50/60 border border-brand-blue-100 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-600">
                OTP sent to your registered email
                {maskedEmail ? <> (<span className="font-bold text-brand-blue-800">{maskedEmail}</span>)</> : ''}
                {' '}and mobile
                {maskedMobile ? <> (<span className="font-bold text-brand-blue-800">{maskedMobile}</span>)</> : ''}
              </p>
            </div>

            <div className="group">
              <label className="block text-xs font-bold text-slate-600 mb-2 group-focus-within:text-brand-blue-600 transition-colors">ENTER OTP</label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="tracking-[1em] text-center text-xl font-bold"
                autoFocus
              />
            </div>

            {devOtp && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                Dev mode (SMTP not configured) — OTP: <strong className="text-lg">{devOtp}</strong>
              </p>
            )}

            {error && <p className="text-sm text-red-500 font-medium bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}

            <Button type="submit" disabled={loading || otp.length < 6} fullWidth uppercase>
              {loading ? 'Verifying…' : 'Verify OTP'}
            </Button>

            <Button
              type="button"
              variant="link"
              fullWidth
              onClick={() => {
                setStep('code');
                setOtp('');
                setError('');
              }}
              className="text-slate-400 hover:text-slate-600 no-underline"
            >
              ← Back to Client Code
            </Button>
          </form>
        )}
      </Card>
    </PageShell>
  );
}
