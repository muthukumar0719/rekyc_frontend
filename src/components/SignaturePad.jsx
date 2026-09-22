import { useRef, useState, useEffect } from 'react';
import { Eraser, CheckCircle, PenLine, Upload } from 'lucide-react';
import { uploadManualDocument } from '../services/api';
import Button from './ui/Button';

export default function SignaturePad({ clientId, existingRecord, onUploaded, onView, onSave, allowUpload = true }) {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);
  const lastPoint = useRef(null);

  const [mode, setMode] = useState('draw'); // 'draw' | 'upload'
  const [isEmpty, setIsEmpty] = useState(true);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedPreview, setUploadedPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== 'draw') return;
    // Match canvas backing resolution to its displayed size for crisp strokes.
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b';
  }, [mode]);

  const getPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    drawing.current = true;
    lastPoint.current = getPoint(e);
  };

  const draw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const point = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
    hasStroke.current = true;
    setIsEmpty(false);
  };

  const endDraw = () => {
    drawing.current = false;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStroke.current = false;
    setIsEmpty(true);
    setError('');
  };

  const handleModeSwitch = (next) => {
    setMode(next);
    setError('');
    if (next === 'draw') {
      setUploadedFile(null);
      setUploadedPreview(null);
    } else {
      handleClear();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setUploadedPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleSave = () => {
    if (mode === 'upload') {
      if (!uploadedFile) {
        setError('Please choose a signature image first.');
        return;
      }
      setLoading(true);
      setError('');
      uploadSignature(uploadedFile);
      return;
    }

    if (isEmpty) {
      setError('Please sign before saving.');
      return;
    }
    setLoading(true);
    setError('');
    canvasRef.current.toBlob((blob) => {
      const file = new File([blob], `signature_${Date.now()}.png`, { type: 'image/png' });
      uploadSignature(file);
    }, 'image/png');
  };

  // `onSave`, when provided, takes over where the signature goes (e.g. the
  // DDPI e-sign flow stamps it straight onto that form's PDF) instead of the
  // default generic document upload.
  const uploadSignature = async (file) => {
    try {
      if (onSave) {
        await onSave(file);
        onUploaded?.(file);
        return;
      }
      const formData = new FormData();
      formData.append('documentType', 'SIGNATURE');
      formData.append('signatureSource', mode);
      formData.append('file', file);
      const { data } = await uploadManualDocument(clientId, formData);
      onUploaded(data.document);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save signature.');
    } finally {
      setLoading(false);
    }
  };

  if (existingRecord) {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <p className="text-sm font-medium text-slate-700">Signature captured</p>
        <div className="flex gap-3">
          {existingRecord.viewUrl && (
            <Button variant="secondary" size="sm" onClick={() => onView(existingRecord.viewUrl)}>
              View
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onUploaded(null)}>
            Re-sign
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Mode toggle — only when an upload alternative is actually offered */}
      {allowUpload && (
      <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
        <button
          type="button"
          onClick={() => handleModeSwitch('draw')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            mode === 'draw' ? 'bg-white text-brand-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <PenLine size={14} /> Signature Pad
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch('upload')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            mode === 'upload' ? 'bg-white text-brand-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Upload size={14} /> Upload Signature
        </button>
      </div>
      )}

      {mode === 'draw' ? (
        <>
          <p className="text-sm text-slate-500 text-center">Sign inside the box below using your finger, stylus, or mouse.</p>
          <div className="w-full max-w-md border-2 border-dashed border-brand-blue-200 rounded-2xl bg-white overflow-hidden touch-none">
            <canvas
              ref={canvasRef}
              className="w-full h-48 touch-none cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-500 text-center">Upload a photo or scan of your signature.</p>
          <div className="w-full max-w-md aspect-[2.5/1] border-2 border-dashed border-brand-blue-200 rounded-2xl bg-white overflow-hidden flex items-center justify-center">
            {uploadedPreview ? (
              <img src={uploadedPreview} alt="Signature preview" className="max-w-full max-h-full object-contain" />
            ) : (
              <Upload size={28} className="text-slate-300" />
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} /> Choose Image
          </Button>
        </>
      )}

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
      <div className="flex gap-3">
        {mode === 'draw' && (
          <Button variant="secondary" size="sm" onClick={handleClear} disabled={loading}>
            <Eraser size={14} /> Clear
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={loading || (mode === 'draw' ? isEmpty : !uploadedFile)}
        >
          {loading ? 'Saving…' : 'Save Signature'}
        </Button>
      </div>
    </div>
  );
}
