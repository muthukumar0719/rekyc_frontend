import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5090/api',
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('rekyc_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('rekyc_token');
      sessionStorage.removeItem('rekyc_account');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const sendOtp = (clientCode) => api.post('/auth/send-otp', { clientCode });

export const verifyOtp = (clientCode, otp) => api.post('/auth/verify-otp', { clientCode, otp });

export const fetchAccount = (clientCode) => api.get(`/client/${clientCode}`);

export const addBankAccount = (clientCode, payload) => api.post(`/client/${clientCode}/bank`, payload);

export const deleteBankAccount = (clientCode) => api.delete(`/client/${clientCode}/bank`);

export const updateNominee = (clientCode, payload) => api.post(`/client/${clientCode}/nominee`, payload);

export const startNomineeEsign = (clientCode) => api.post(`/client/${clientCode}/nominee/esign/start`);

export const updateOthers = (clientCode, payload) => api.post(`/client/${clientCode}/others`, payload);

export const updateDdpi = (clientCode) => api.post(`/client/${clientCode}/ddpi`);

export const createDdpiPaymentOrder = (clientCode) =>
  api.post(`/client/${clientCode}/ddpi/payment/order`);

export const verifyDdpiPayment = (clientCode, payload) =>
  api.post(`/client/${clientCode}/ddpi/payment/verify`, payload);

// Generated (populated) modification PDF for preview / e-sign.
export const previewModificationPdf = (clientCode, operationId) =>
  api.get(`/client/${clientCode}/esign/MODIFICATION/preview?operation_id=${operationId}`, {
    responseType: 'blob',
  });

// Bank flow: after the signature step, move the operation to AWAITING_ESIGN.
export const startBankEsign = (clientCode) =>
  api.post(`/client/${clientCode}/bank/esign/start`);

export const sendEmailChangeIdentityOtp = (clientCode) =>
  api.post(`/client/${clientCode}/email-change/send-identity-otp`);

export const verifyEmailChangeIdentityOtp = (clientCode, otp) =>
  api.post(`/client/${clientCode}/email-change/verify-identity`, { otp });

export const sendEmailChangeOtp = (clientCode, newEmail) =>
  api.post(`/client/${clientCode}/email-change/send-otp`, { newEmail });

export const confirmEmailChange = (clientCode, newEmail, otp) =>
  api.post(`/client/${clientCode}/email-change/confirm`, { newEmail, otp });

export const sendMobileChangeIdentityOtp = (clientCode) =>
  api.post(`/client/${clientCode}/mobile-change/send-identity-otp`);

export const verifyMobileChangeIdentityOtp = (clientCode, otp) =>
  api.post(`/client/${clientCode}/mobile-change/verify-identity`, { otp });

export const sendMobileChangeOtp = (clientCode, newMobile) =>
  api.post(`/client/${clientCode}/mobile-change/send-otp`, { newMobile });

export const confirmMobileChange = (clientCode, newMobile, otp) =>
  api.post(`/client/${clientCode}/mobile-change/confirm`, { newMobile, otp });

export const sendAddressChangeIdentityOtp = (clientCode) =>
  api.post(`/client/${clientCode}/address-change/send-identity-otp`);

export const verifyAddressChangeIdentityOtp = (clientCode, otp) =>
  api.post(`/client/${clientCode}/address-change/verify-identity`, { otp });

// DigiLocker endpoints
export const startDigilocker = (clientCode, redirectUrl) =>
  api.post(`/client/${clientCode}/digilocker/start`, { redirectUrl });

export const getDigilockerStatus = (clientCode, id) =>
  api.get(`/client/${clientCode}/digilocker/status/${id}`);

export const getDigilockerAadhaar = (clientCode, id) =>
  api.get(`/client/${clientCode}/digilocker/aadhaar/${id}`);

export const confirmDigilockerAddress = (clientCode, digilockerRef, newAddress) =>
  api.post(`/client/${clientCode}/digilocker/confirm`, { digilockerRef, newAddress });

export const requestFieldChange = (clientCode, field, newValue) =>
  api.post(`/client/${clientCode}/change-request`, { field, newValue });

// Document Endpoints
export const getDocumentRequirements = (clientCode) => 
  api.get(`/client/${clientCode}/documents/requirements`);
export const startDocumentDigilocker = (clientCode, data) => 
  api.post(`/client/${clientCode}/documents/digilocker/start`, data);
export const fetchDigilockerDocuments = (clientCode, data) => 
  api.post(`/client/${clientCode}/documents/digilocker/fetch`, data);
export const uploadManualDocument = (clientCode, formData) => 
  api.post(`/client/${clientCode}/documents/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const validateSessionComplete = (clientCode) => 
  api.post(`/client/${clientCode}/documents/validate`);

// IPV Endpoints
export const startIpvSession = (clientCode) =>
  api.post(`/client/${clientCode}/ipv/session`);

export const captureIpvImage = (clientCode, formData) =>
  api.post(`/client/${clientCode}/ipv/capture`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export default api;
