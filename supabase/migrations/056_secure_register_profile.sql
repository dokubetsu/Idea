-- Migration: Secure register_profile RPC by revoking default execute privileges
-- from authenticated/anon roles and granting it only to service_role.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.register_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.register_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMIT;
