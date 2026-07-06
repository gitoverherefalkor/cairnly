import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * Primary CTA for the Encore landing page: logged-in visitors go to their
 * dashboard, everyone else goes to the Encore checkout. Mirrors
 * src/components/starter/useStarterGetStarted.ts but targets /encore.
 */
export const useEncoreGetStarted = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  return useCallback(() => {
    navigate(user ? '/dashboard' : '/encore/payment');
  }, [navigate, user]);
};
