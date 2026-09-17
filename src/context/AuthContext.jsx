import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(() => {
    const stored = sessionStorage.getItem('rekyc_account');
    return stored ? JSON.parse(stored) : null;
  });

  const login = (accountData, token) => {
    setAccount(accountData);
    sessionStorage.setItem('rekyc_account', JSON.stringify(accountData));
    if (token) sessionStorage.setItem('rekyc_token', token);
    // Fresh session — start the step flow from the beginning.
    sessionStorage.removeItem('rekyc_active_tab');
    sessionStorage.removeItem('rekyc_completed_steps');
  };

  const updateAccount = (accountData) => {
    setAccount(accountData);
    sessionStorage.setItem('rekyc_account', JSON.stringify(accountData));
  };

  const logout = () => {
    setAccount(null);
    sessionStorage.removeItem('rekyc_account');
    sessionStorage.removeItem('rekyc_token');
    sessionStorage.removeItem('rekyc_active_tab');
    sessionStorage.removeItem('rekyc_completed_steps');
  };

  return (
    <AuthContext.Provider value={{ account, login, updateAccount, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
