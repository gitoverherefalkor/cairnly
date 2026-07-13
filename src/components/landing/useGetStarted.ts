import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIntakeChatOptional } from './intake/IntakeChatContext';

/**
 * The primary landing-page CTA: logged-in visitors go to their dashboard.
 * On the homepage (where IntakeChatProvider is mounted) logged-out visitors
 * get the intake chat first; anywhere else they go straight to payment.
 */
export const useGetStarted = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const intakeChat = useIntakeChatOptional();
  return useCallback(() => {
    if (user) {
      navigate('/dashboard');
    } else if (intakeChat) {
      intakeChat.openFromCta();
    } else {
      navigate('/payment');
    }
  }, [navigate, user, intakeChat]);
};
