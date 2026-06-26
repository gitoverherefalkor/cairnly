
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import i18n from '@/i18n';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Keys that store user-specific data and must be cleared between sessions
const USER_STORAGE_KEYS = [
  'assessment_session',
  'resume_parsed_data',
  'resume_parsed_timestamp',
  'pre_survey_upload_complete',
  'n8n-chat/sessionId',
  'n8n-chat/sessionTimestamp',
  // NOTE: purchase_data is NOT in this list — it must persist through
  // sign-up so the Assessment page can pre-fill the access code.
  // It is cleared explicitly after access code verification.
  'payment_country',
];

// Clear all user-specific localStorage when signing out or switching users
function clearUserStorage() {
  USER_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
  // Also clear dynamic keys (chat messages, section indices, survey progress).
  // survey_session_* holds a user's full survey answers — it MUST be cleared on
  // a user switch, otherwise the next person on this browser restores it.
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (
      key.startsWith('n8n-chat/') ||
      key.startsWith('chat_section_index_') ||
      key.startsWith('resume_prefilled_') ||
      key.startsWith('survey_session_')
    ) {
      localStorage.removeItem(key);
    }
  });
}

// Check if localStorage data belongs to a different user and clear if so
function handleUserSwitch(userId: string) {
  const storedUserId = localStorage.getItem('atlas_current_user');
  if (storedUserId && storedUserId !== userId) {
    // Different user signed in — wipe the previous user's data
    clearUserStorage();
  }
  localStorage.setItem('atlas_current_user', userId);
}

// Ensure profile exists for authenticated user.
// Sets a short-lived localStorage flag so redirect logic can route new users to /payment.
async function ensureProfile(user: User) {
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!existingProfile) {
    // Signal for post-auth redirect: new user → /payment
    localStorage.setItem('atlas_is_new_user', 'true');

    // Extract name from user metadata (OAuth providers)
    const metadata = user.user_metadata || {};
    const firstName = metadata.given_name || metadata.first_name ||
      (metadata.full_name ? metadata.full_name.split(' ')[0] : null) ||
      (metadata.name ? metadata.name.split(' ')[0] : null);
    const lastName = metadata.family_name || metadata.last_name ||
      (metadata.full_name && metadata.full_name.includes(' ') ? metadata.full_name.split(' ').slice(1).join(' ') : null) ||
      (metadata.name && metadata.name.includes(' ') ? metadata.name.split(' ').slice(1).join(' ') : null);

    const { error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        first_name: firstName,
        last_name: lastName,
        auth_provider: user.app_metadata?.provider || 'email',
        preferred_language: i18n.language || 'en',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as any);

    if (error && error.code !== '23505') { // Ignore duplicate key errors
      console.error('Failed to create profile:', error);
    }
  }
}

// Consume the new-user flag (read once, then clear).
// Returns '/payment' for new users, '/dashboard' for returning users.
export function getPostAuthRedirect(): string {
  // An explicit destination (e.g. set by /ops before sending the user to log
  // in) takes priority so they land back where they started.
  const explicit = localStorage.getItem('post_auth_redirect');
  if (explicit) {
    localStorage.removeItem('post_auth_redirect');
    return explicit;
  }

  const isNew = localStorage.getItem('atlas_is_new_user');
  if (isNew) {
    localStorage.removeItem('atlas_is_new_user');
    return '/payment';
  }
  return '/dashboard';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        // On sign-in, detect if a different user is logging in and clear stale data
        // (We do NOT clear on sign-out — same user signing back in should keep their progress)
        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          handleUserSwitch(session.user.id);
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(() => ensureProfile(session.user), 0);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      // Also ensure profile on initial load
      if (session?.user) {
        setTimeout(() => ensureProfile(session.user), 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
