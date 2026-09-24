import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { startIpvSession, captureIpvImage, validateSessionComplete, getDocumentRequirements } from '../services/api';
import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import aionionLogo from '../assets/aionion-logo.png';
import { appUrl } from '../utils/basePath';

export default function IpvCapture() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [landmarker, setLandmarker] = useState(null);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');

  const [sessionId, setSessionId] = useState(null);
  const [remainingAttempts, setRemainingAttempts] = useState(3);

  // States: 'detecting', 'preview', 'uploading', 'success', 'rate_limited'
  const [captureState, setCaptureState] = useState('detecting');
  const [previewImage, setPreviewImage] = useState(null);
  const [capturedFile, setCapturedFile] = useState(null);

  // Face detection feedback
  const [faceDetected, setFaceDetected] = useState(false);
  const [eyesOpen, setEyesOpen] = useState(false);
  const [multipleFaces, setMultipleFaces] = useState(false);
  const [faceMsg, setFaceMsg] = useState('Initializing...');
  const [locationError, setLocationError] = useState('');

  // Animation frame ref
  const reqFrame = useRef(null);

  const fetchSession = async () => {
    try {
      const res = await startIpvSession(clientId);
      setSessionId(res.data.session_id);
      setError('');
      setCaptureState('detecting');
    } catch (err) {
      if (err.response?.status === 429) {
         setError(err.response.data.message || 'Rate limited. Try again later.');
         setCaptureState('rate_limited');
      } else {
         setError(err.response?.data?.message || 'Failed to start session');
      }
    }
  };

  // On mount, grab a session
  useEffect(() => {
    fetchSession();
  }, [clientId]);

  // Load models and init camera
  useEffect(() => {
    let activeStream = null;

    const loadModelsAndCamera = async () => {
      try {
        setFaceMsg('Loading models locally...');
        // Load locally from public/models (WASM copied here)
        const filesetResolver = await FilesetResolver.forVisionTasks(appUrl('models'));
        const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: appUrl('models/face_landmarker.task'),
            delegate: 'CPU'
          },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          // 2, not 1 — we need to actually see a second face to reject it
          // ("double face" / multiple-person capture), not just detect one.
          numFaces: 2
        });
        setLandmarker(faceLandmarker);

        setFaceMsg('Requesting camera permission...');
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }
        });
        setStream(activeStream);
        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
        }

        // Location is mandatory — the capture records where it actually
        // happened, same as the eSign flow. No silent fallback.
        if (!navigator.geolocation) {
          setLocationError('Your browser does not support location access, which is required to capture your photo.');
        } else {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              setLocationError('');
            },
            (err) => {
              setLocationError(
                err.code === err.PERMISSION_DENIED
                  ? 'Location access was denied. Please allow location access and try again — it is required to capture your photo.'
                  : 'Could not determine your location. Please try again — it is required to capture your photo.'
              );
            },
            { timeout: 10000, enableHighAccuracy: true }
          );
        }

        setFaceMsg('Detecting face...');
      } catch (err) {
        setError('Camera or model loading failed: ' + err.message);
        setFaceMsg('Camera error');
      }
    };

    loadModelsAndCamera();

    return () => {
      if (activeStream) activeStream.getTracks().forEach(t => t.stop());
      if (reqFrame.current) cancelAnimationFrame(reqFrame.current);
    };
  }, []);

  // Run face detection loop
  useEffect(() => {
    if (!landmarker || !stream || captureState !== 'detecting' || !videoRef.current) return;

    let lastVideoTime = -1;

    const detect = async () => {
      const video = videoRef.current;
      if (video && video.currentTime !== lastVideoTime && video.readyState >= 2) {
        lastVideoTime = video.currentTime;

        try {
          const results = landmarker.detectForVideo(video, performance.now());
          const faceCount = results.faceLandmarks?.length || 0;

          if (faceCount > 1) {
            // "Double face" — more than one person in frame. Reject outright,
            // don't fall through to eyes-open scoring on whichever face is first.
            setFaceDetected(false);
            setEyesOpen(false);
            setMultipleFaces(true);
            setFaceMsg('Multiple faces detected. Please ensure only your face is visible.');
          } else if (faceCount === 1) {
            setFaceDetected(true);
            setMultipleFaces(false);
            const blendshapes = results.faceBlendshapes[0].categories;
            const leftBlink = blendshapes.find(b => b.categoryName === 'eyeBlinkLeft')?.score || 0;
            const rightBlink = blendshapes.find(b => b.categoryName === 'eyeBlinkRight')?.score || 0;

            // MediaPipe eyeBlink > ~0.4 usually means eyes closed
            const isEyesOpen = (leftBlink < 0.3 && rightBlink < 0.3);
            setEyesOpen(isEyesOpen);

            if (!isEyesOpen) {
              setFaceMsg('Face detected, but please open your eyes.');
            } else if (locationError) {
              setFaceMsg(locationError);
            } else if (!location) {
              setFaceMsg('Waiting for location access…');
            } else {
              setFaceMsg('Perfect! Keep still.');
            }
          } else {
            setFaceDetected(false);
            setEyesOpen(false);
            setMultipleFaces(false);
            setFaceMsg('No face detected. Please ensure your face is fully visible.');
          }
        } catch (e) {
           console.error("Landmarker error:", e);
        }
      }
      reqFrame.current = requestAnimationFrame(detect);
    };

    reqFrame.current = requestAnimationFrame(detect);
    return () => {
      if (reqFrame.current) cancelAnimationFrame(reqFrame.current);
    };
  }, [landmarker, stream, captureState, location, locationError]);

  const handleCapture = () => {
    if (!faceDetected || !eyesOpen || multipleFaces || !location) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    // We want to crop to a square aspect ratio matching the circular frame
    const minDim = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - minDim) / 2;
    const startY = (video.videoHeight - minDim) / 2;

    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    // Draw the cropped square (exact 600x600 resolution required by backend)
    ctx.drawImage(video, startX, startY, minDim, minDim, 0, 0, 600, 600);

    // Convert to JPEG as required by magic-byte checking
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPreviewImage(dataUrl);

    canvas.toBlob((blob) => {
      const file = new File([blob], `ipv_capture_${Date.now()}.jpeg`, { type: 'image/jpeg' });
      setCapturedFile(file);
    }, 'image/jpeg', 0.9);

    setCaptureState('preview');
  };

  const handleRetry = () => {
    fetchSession(); // Re-fetch session token on retry!
    setPreviewImage(null);
    setCapturedFile(null);
  };

  const handleSubmit = async () => {
    if (!capturedFile || !sessionId) return;
    if (!location) {
      setError(locationError || 'Location is required to submit your photo.');
      return;
    }

    try {
      setCaptureState('uploading');
      setError('');

      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('image', capturedFile);
      // We no longer append documentType since the endpoint is implicitly for IPV
      formData.append('lat', location.lat);
      formData.append('lng', location.lng);

      await captureIpvImage(clientId, formData);

      setCaptureState('success');
      setError('Photo captured successfully');

      // The live photo is normally the last document a personal-details
      // change needs — go straight to the eSign preview instead of dropping
      // back onto the dashboard's step wizard. If something else is still
      // required (e.g. Bank Proof), validation fails and we fall back to
      // the dashboard so the client can finish that step.
      setTimeout(async () => {
        try {
          const { data } = await validateSessionComplete(clientId);
          navigate(`/esign/${clientId}?operation_id=${data.operationId}`);
        } catch {
          // Validation can fail either because something else is genuinely
          // still missing (e.g. Bank Proof) — fall back to the dashboard so
          // the client can finish that step — or because it had already
          // succeeded earlier (status moved past IN_PROGRESS). Tell those
          // two cases apart before deciding where to send the client.
          try {
            const { data } = await getDocumentRequirements(clientId);
            if (data.operationStatus === 'AWAITING_ESIGN') {
              navigate(`/esign/${clientId}?operation_id=${data.operationId}`);
              return;
            }
          } catch {
            // fall through to the dashboard below
          }
          navigate('/account');
        }
      }, 1500);

    } catch (err) {
      if (err.response?.status === 400 && err.response.data.remaining !== undefined) {
         setRemainingAttempts(err.response.data.remaining);
         setError(err.response.data.message || 'Face match failed');
         if (err.response.data.remaining > 0) {
            setCaptureState('preview'); // Allow them to retry
         } else {
            setCaptureState('rate_limited'); // Exhausted 3 attempts
         }
      } else if (err.response?.status === 429 || err.response?.status === 401) {
         setError(err.response?.data?.message || 'Session expired or rate limited. Please try again later.');
         setCaptureState('rate_limited');
      } else {
         setError(err.response?.data?.message || 'Failed to upload IPV');
         setCaptureState('preview');
      }
    }
  };

  const canCapture = faceDetected && eyesOpen && !multipleFaces && !!location && captureState === 'detecting' && sessionId;

  return (
    <PageShell contentClassName="min-h-screen flex flex-col items-center py-6 px-4">
      {/* Header */}
      <div className="w-full max-w-5xl flex justify-center mb-2">
        <img src={aionionLogo} alt="Aionion Capital" className="h-16 md:h-20 object-contain drop-shadow-sm" />
      </div>

      <Card className="w-full max-w-xl flex flex-col overflow-hidden p-6 md:p-12 shadow-xl mt-2">

        <div className="flex-1 flex flex-col items-center justify-center">

          <div className="relative mb-6">
             {/* Corner brackets */}
             <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-blue-400 rounded-tl-xl" />
             <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-coral-400 rounded-tr-xl" />
             <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-coral-400 rounded-bl-xl" />
             <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-blue-400 rounded-br-xl" />

             {/* Circular Dashed Border */}
             <div className={`relative p-2 rounded-full border-8 border-dashed ${canCapture ? 'border-emerald-500' : 'border-brand-coral-500'} transition-colors duration-300 z-10 m-4`}>
                <div className="w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden bg-slate-800 relative shadow-inner">

                   {captureState === 'detecting' && (
                     <video
                       ref={videoRef}
                       autoPlay
                       playsInline
                       muted
                       className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full object-cover scale-x-[-1]"
                     />
                   )}

                   {(captureState === 'preview' || captureState === 'uploading' || captureState === 'success' || captureState === 'rate_limited') && previewImage && (
                     <img
                       src={previewImage}
                       alt="Captured IPV"
                       className="w-full h-full object-cover scale-x-[-1]"
                     />
                   )}

                   {captureState === 'detecting' && !stream && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
                        <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                   )}
                </div>
             </div>
          </div>

          {captureState === 'detecting' && (
            <div className="flex items-center justify-center gap-1.5 mb-3 text-xs font-semibold">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {location ? (
                <span className="text-emerald-600">
                  Location captured ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})
                </span>
              ) : locationError ? (
                <span className="text-red-600">{locationError}</span>
              ) : (
                <span className="text-amber-600">Waiting for location…</span>
              )}
            </div>
          )}

          <div className="h-16 flex items-center justify-center mb-6 px-4 text-center">
            {captureState === 'success' ? (
              <p className={`font-medium text-sm ${error.includes('manual review') ? 'text-amber-600' : 'text-emerald-600'}`}>
                {error}
              </p>
            ) : error ? (
              <p className="text-red-600 font-medium text-sm">{error}</p>
            ) : captureState === 'detecting' ? (
              <p className={`font-medium text-sm ${canCapture ? 'text-emerald-600' : 'text-brand-coral-600'}`}>
                {faceMsg}
              </p>
            ) : captureState === 'uploading' ? (
              <p className="text-brand-blue-600 font-medium text-sm animate-pulse">Uploading your capture securely...</p>
            ) : captureState === 'rate_limited' ? (
               <p className="text-red-600 font-medium text-sm">Please return to the dashboard.</p>
            ) : (
              <p className="text-slate-700 font-medium text-sm">Review your captured image.</p>
            )}
          </div>

          <div className="flex gap-4 w-full justify-center">
            {captureState === 'detecting' && (
              <>
                <Button variant="danger" size="lg" className="w-40" onClick={() => navigate('/account')}>
                  Cancel
                </Button>
                <Button variant="primary" size="lg" className="w-40" onClick={handleCapture} disabled={!canCapture}>
                  Capture
                </Button>
              </>
            )}

            {(captureState === 'preview' || captureState === 'uploading') && (
              <>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-40 flex-col"
                  onClick={handleRetry}
                  disabled={captureState !== 'preview'}
                >
                  <span>Retry</span>
                  {remainingAttempts < 3 && remainingAttempts > 0 && (
                     <span className="text-xs font-normal">({remainingAttempts} left)</span>
                  )}
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-40"
                  onClick={handleSubmit}
                  disabled={captureState !== 'preview'}
                >
                  Submit
                </Button>
              </>
            )}

            {captureState === 'rate_limited' && (
               <Button variant="secondary" size="lg" className="w-40" onClick={() => navigate('/account')}>
                  Return
                </Button>
            )}
          </div>

          {/* Hidden canvas for extraction */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </Card>
    </PageShell>
  );
}
