import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import AccountDetails from './pages/AccountDetails';
import DigilockerCallback from './pages/DigilockerCallback';
import IpvCapture from './pages/IpvCapture';
import EsignSelectionPage from './pages/EsignSelectionPage';
import AddBankAccount from './pages/AddBankAccount';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/digilocker-callback"
            element={
              <ProtectedRoute>
                <DigilockerCallback />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ipv-capture/:clientId"
            element={
              <ProtectedRoute>
                <IpvCapture />
              </ProtectedRoute>
            }
          />
          <Route
            path="/esign/:clientId"
            element={
              <ProtectedRoute>
                <EsignSelectionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/add-bank"
            element={
              <ProtectedRoute>
                <AddBankAccount />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
