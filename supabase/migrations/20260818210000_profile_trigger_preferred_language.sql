-- Teach handle_new_user() to carry the signup language into the profile.
--
-- The trigger inserted every profile WITHOUT preferred_language, so each row
-- took the column DEFAULT 'en'. The client-side insert in useAuth.ensureProfile
-- that would have written i18n.language sits behind `if (!existingProfile)`,
-- which can never be true because this trigger already created the row. Result:
-- all 36 production profiles read 'en' and not one reads 'nl'.
--
-- That value is not cosmetic. WF9 writes the résumé body in it, and
-- save-chat-response and wrap-up-extract read it to pick the language of the
-- chat and wrap-up copy. A Dutch candidate arriving through a partner link with
-- ?lang=nl therefore received English generated content behind a Dutch UI.
--
-- signup-with-access-code now passes the language in user_metadata. Read it
-- here, normalise a regional code ('nl-NL' -> 'nl'), and fall back to 'en' for
-- any provider that supplies none (Google, LinkedIn). Validating against the
-- supported set matters because this column is fed into LLM prompts downstream.
--
-- Existing rows are deliberately left alone: they belong to English users, and
-- anyone who wants Dutch gets it written back the moment they use the language
-- switcher (useLanguage persists on every languageChanged).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, auth_provider, first_name, last_name, preferred_language, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    COALESCE(NEW.raw_user_meta_data->>'given_name', NEW.raw_user_meta_data->>'first_name', split_part(NEW.raw_user_meta_data->>'full_name', ' ', 1), split_part(NEW.raw_user_meta_data->>'name', ' ', 1)),
    COALESCE(NEW.raw_user_meta_data->>'family_name', NEW.raw_user_meta_data->>'last_name',
      CASE
        WHEN NEW.raw_user_meta_data->>'full_name' IS NOT NULL AND position(' ' in NEW.raw_user_meta_data->>'full_name') > 0
        THEN substring(NEW.raw_user_meta_data->>'full_name' from position(' ' in NEW.raw_user_meta_data->>'full_name') + 1)
        WHEN NEW.raw_user_meta_data->>'name' IS NOT NULL AND position(' ' in NEW.raw_user_meta_data->>'name') > 0
        THEN substring(NEW.raw_user_meta_data->>'name' from position(' ' in NEW.raw_user_meta_data->>'name') + 1)
        ELSE NULL
      END
    ),
    CASE left(lower(COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en')), 2)
      WHEN 'nl' THEN 'nl'
      ELSE 'en'
    END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
