import { useEffect, useRef } from 'react';
import { useIntakeChat } from './IntakeChatContext';

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Handles the magic-link email: `/?intake=<token>` reopens the intake chat
 * with the saved conversation, then cleans the token out of the URL.
 */
const IntakeResumeParam: React.FC = () => {
  const { openFromToken } = useIntakeChat();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('intake');
    if (!token || !TOKEN_RE.test(token)) return;
    openFromToken(token);
    params.delete('intake');
    const query = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
  }, [openFromToken]);

  return null;
};

export default IntakeResumeParam;
