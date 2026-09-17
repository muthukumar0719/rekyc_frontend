import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from './ui/Button';
import aionionLogo from '../assets/aionion-logo.png';

export default function Topbar() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-brand-blue-100/60 px-6 py-3 shadow-sm relative">
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brand-blue-500 via-brand-coral-400 to-brand-blue-500 opacity-70" />
      <img src={aionionLogo} alt="Aionion Capital" className="h-16 md:h-20 object-contain drop-shadow-sm" />
      <Button variant="secondary" size="sm" onClick={handleLogout}>
        Logout
      </Button>
    </header>
  );
}
