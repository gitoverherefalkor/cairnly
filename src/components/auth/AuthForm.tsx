
import React, { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import SocialAuthButtons from './SocialAuthButtons';
import EmailPasswordForm from './EmailPasswordForm';

interface AuthFormProps {
  isLogin: boolean;
}

// Check if purchase data exists (from payment flow)
const hasPurchaseData = () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('email') || urlParams.get('firstName')) return true;
    const stored = localStorage.getItem('purchase_data');
    return !!stored;
  } catch {
    return false;
  }
};

// Get previously used auth method from localStorage
const getLastAuthMethod = (): string | null => {
  try {
    return localStorage.getItem('atlas_auth_method');
  } catch {
    return null;
  }
};

const AuthForm = ({ isLogin }: AuthFormProps) => {
  const [error, setError] = useState('');
  const hasPaymentData = useMemo(() => hasPurchaseData(), []);
  const lastAuthMethod = useMemo(() => getLastAuthMethod(), []);

  // Email/password is collapsed by default to encourage social sign-on.
  // Exception: payment-flow users arrive with prefilled data, so expand for them.
  const [showEmailForm, setShowEmailForm] = useState(hasPaymentData);

  // Show hint about previous auth method
  const lastMethodLabel = lastAuthMethod === 'google' ? 'Google'
    : lastAuthMethod === 'linkedin' ? 'LinkedIn'
    : lastAuthMethod === 'email' ? 'email & password'
    : null;

  return (
    <div className="space-y-4">
      {/* Hint about previous sign-in method */}
      {isLogin && lastMethodLabel && (
        <p className="text-xs text-center" style={{ color: '#6B7F8B' }}>
          You last signed in with{' '}
          <span className="font-semibold" style={{ color: '#122E3B' }}>
            {lastMethodLabel}
          </span>
        </p>
      )}

      {/* Social sign-on — always prominent */}
      <SocialAuthButtons
        onError={setError}
        highlightMethod={isLogin ? lastAuthMethod : null}
      />

      {/* Email/password collapsed behind a chevron for both login and signup */}
      <button
        type="button"
        onClick={() => setShowEmailForm(!showEmailForm)}
        className="w-full flex items-center justify-center gap-3 py-2 text-sm transition-colors"
        style={{ color: '#4B6373' }}
      >
        <div className="flex-1 h-px" style={{ background: 'rgba(75,99,115,0.18)' }} />
        <span className="px-1 flex items-center gap-1 whitespace-nowrap font-medium">
          {isLogin ? 'Or sign in with email' : 'Or continue with email'}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${showEmailForm ? 'rotate-180' : ''}`}
          />
        </span>
        <div className="flex-1 h-px" style={{ background: 'rgba(75,99,115,0.18)' }} />
      </button>

      {showEmailForm && (
        <EmailPasswordForm isLogin={isLogin} />
      )}
    </div>
  );
};

export default AuthForm;
