-- ============================================================================
-- 003_onboarding.sql  —  WebComms & Pay  (THE SPINE)
-- On new auth user, bind them to a tenant+role IFF a valid invitation exists for
-- their email AND the invite token carried through OTP matches the SAME row.
--
--   * The token is the authorization PROOF, not decoration: possession of the
--     invited inbox (OTP) PLUS the unguessable token are BOTH required.
--   * No matching token => no profile row => no access (fail closed), surfaced
--     to the user as "ask your school for an invite".
--   * Also links any students the admin pre-created for this parent's email
--     (fixes the chicken/egg: child created before the parent had an account).
--
-- SECURITY DEFINER + empty search_path so it runs with table-owner rights
-- (bypassing RLS for the bind) while every reference is fully qualified.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE inv public.invitations;
BEGIN
  -- Match on token AND email AND validity — fail closed if absent/wrong/expired.
  SELECT * INTO inv FROM public.invitations
    WHERE token = NEW.raw_user_meta_data->>'invite_token'
      AND email = NEW.email
      AND accepted_at IS NULL
      AND expires_at > now()
    LIMIT 1;

  IF inv.id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, tenant_id, role, status)
    VALUES (NEW.id, NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            inv.tenant_id, inv.role, 'active')
    ON CONFLICT (id) DO UPDATE
      SET tenant_id = EXCLUDED.tenant_id, role = EXCLUDED.role;

    UPDATE public.invitations SET accepted_at = now() WHERE id = inv.id;

    -- Link any pre-created students for this parent's email, scoped to the tenant.
    IF inv.role = 'parent' THEN
      UPDATE public.students
        SET parent_id = NEW.id
        WHERE parent_email = NEW.email
          AND tenant_id = inv.tenant_id
          AND parent_id IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
