import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { account } = useAuth();
  if (!account) return <Navigate to="/login" replace />;
  return children;
}
