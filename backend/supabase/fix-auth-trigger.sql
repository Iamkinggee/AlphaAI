-- ═══════════════════════════════════════════════════════════════
-- AlphaAI — Fix Auth Trigger (Run in Supabase Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════════
-- This fixes the handle_new_user() trigger that was trying to insert
-- 'display_name' (column doesn't exist) and missing 'email' (NOT NULL).
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Fix the trigger function to match the live profiles schema
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'displayName',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Ensure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Fix RLS policies — the old migration only had SELECT+UPDATE, no INSERT
-- Drop the old restrictive policies
DROP POLICY IF EXISTS "Users can view their own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own" ON public.profiles;

-- Create a single permissive policy for user's own data
CREATE POLICY "profiles_own"
  ON public.profiles FOR ALL
  USING (auth.uid() = id);

-- Allow service_role full access (needed for admin API operations)
DROP POLICY IF EXISTS "profiles_service_role" ON public.profiles;
CREATE POLICY "profiles_service_role"
  ON public.profiles FOR ALL
  USING (auth.role() = 'service_role');
