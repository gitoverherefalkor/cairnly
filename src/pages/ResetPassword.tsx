
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setValidSession(true);
      } else {
        setError('Invalid or expired reset link. Please request a new password reset.');
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/auth');
      }, 2000);
    } catch (error) {
      console.error('Password reset error:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls =
    'pl-10 pr-10 bg-[#FFFDF5] border-[rgba(201,182,144,0.8)] text-[#122E3B] placeholder:text-[#9CA3AF] focus-visible:ring-atlas-teal/40';
  const labelCls = 'block text-[13px] font-semibold mb-1.5';
  const labelStyle = { color: '#122E3B' };
  const primaryBtn =
    'w-full rounded-full bg-atlas-teal text-white hover:bg-atlas-teal/90 font-bold text-[14.5px] py-[13px] shadow-[0_10px_24px_-8px_rgba(39,161,161,0.55)]';

  return (
    <AuthShell
      eyebrow="Reset password"
      title={success ? 'Password Reset Successful!' : 'Set new password'}
    >
      {success ? (
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <div
              className="h-[72px] w-[72px] rounded-full flex items-center justify-center border"
              style={{
                background: 'rgba(34,197,94,0.12)',
                borderColor: 'rgba(34,197,94,0.32)',
              }}
            >
              <CheckCircle className="h-8 w-8" style={{ color: '#16A34A' }} />
            </div>
          </div>
          <Alert className="bg-transparent">
            <AlertDescription className="text-center" style={{ color: '#1F2937' }}>
              Your password has been reset successfully. You can now sign in with your new password.
            </AlertDescription>
          </Alert>
          <p className="text-sm text-center" style={{ color: '#4B6373' }}>
            Redirecting to sign in…
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {!validSession ? (
            <>
              <div className="flex justify-center mb-2">
                <div
                  className="h-[72px] w-[72px] rounded-full flex items-center justify-center border"
                  style={{
                    background: 'rgba(220,38,38,0.10)',
                    borderColor: 'rgba(220,38,38,0.28)',
                  }}
                >
                  <Lock className="h-7 w-7" style={{ color: '#DC2626' }} />
                </div>
              </div>
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className={primaryBtn}
              >
                Request New Reset Link
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-center" style={{ color: '#4B6373' }}>
                Please enter your new password below.
              </p>

              <div>
                <label htmlFor="password" className={labelCls} style={labelStyle}>
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls}
                    placeholder="Enter new password"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B6373]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11.5px] font-medium mt-1.5" style={{ color: '#6B7F8B' }}>
                  Password must be at least 8 characters long
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className={labelCls} style={labelStyle}>
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputCls}
                    placeholder="Confirm new password"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B6373]"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={isLoading} className={primaryBtn}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resetting password…
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </>
          )}
        </form>
      )}
    </AuthShell>
  );
};

export default ResetPassword;
