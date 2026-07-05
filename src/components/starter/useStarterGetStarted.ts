import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * Primary CTA for the Starter landing page: logged-in visitors go to their
 * dashboard, everyone else goes to the Starter checkout. Mirrors
 * src/components/landing/useGetStarted.ts but targets the /starter funnel.
 */
export const useStarterGetStarted = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  return useCallback(() => {
    navigate(user ? '/dashboard' : '/starter/payment');
  }, [navigate, user]);
};
