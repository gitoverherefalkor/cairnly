import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * The primary landing-page CTA: logged-in visitors go to their dashboard,
 * everyone else goes straight to the payment route.
 */
export const useGetStarted = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  return useCallback(() => {
    navigate(user ? '/dashboard' : '/payment');
  }, [navigate, user]);
};
