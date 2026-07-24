import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIntakeChatOptional } from './intake/IntakeChatContext';

/**
 * The primary landing-page CTA: logged-in visitors go to their dashboard.
 * On the homepage (where IntakeChatProvider is mounted) logged-out visitors
 * are scrolled to the pricing card so they see the offer and buy from there;
 * anywhere else they go straight to payment. The intake chat is an opt-in
 * taste via the hero pills, so "Get started" no longer drops them into it.
 */
export const useGetStarted = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const intakeChat = useIntakeChatOptional();
  return useCallback(() => {
    if (user) {
      navigate('/dashboard');
    } else if (intakeChat) {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigate('/payment');
    }
  }, [navigate, user, intakeChat]);
};
