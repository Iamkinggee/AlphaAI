/**
 * One-shot script: Fix the handle_new_user() trigger in Supabase.
 * Run with: npx ts-node src/scripts/fix-trigger.ts
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fixTrigger() {
  console.log('🔧 Fixing handle_new_user() trigger...\n');

  // We can't run raw SQL via the REST API.
  // Instead, we'll verify the fix is needed and instruct the user.
  
  // Step 1: Check if profile insert with the correct columns works
  console.log('📋 Checking current profiles table schema...');
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('❌ Error reading profiles:', error.message);
  } else {
    console.log('✅ Profiles table accessible. Current rows:', data?.length ?? 0);
  }

  // Step 2: Try creating a test user to verify the trigger
  console.log('\n🧪 Testing user creation...');
  const testEmail = `test_trigger_${Date.now()}@alphaai-test.com`;
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'TestPass123!',
    email_confirm: true,
    user_metadata: {
      displayName: 'Trigger Test',
      full_name: 'Trigger Test',
    },
  });

  if (userError) {
    console.error('❌ User creation failed:', userError.message);
    console.log('\n⚠️  The handle_new_user() trigger is still broken.');
    console.log('   You need to run this SQL in the Supabase Dashboard → SQL Editor:\n');
    console.log(`
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
    `);
    process.exit(1);
  }

  console.log('✅ Test user created:', userData.user?.id);
  
  // Check if profile was auto-created
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userData.user!.id)
    .single();

  if (profile) {
    console.log('✅ Profile auto-created by trigger:', JSON.stringify(profile, null, 2));
    console.log('\n🎉 Trigger is working correctly!');
  } else {
    console.log('⚠️  Profile not auto-created — trigger may be broken.');
  }

  // Clean up test user
  console.log('\n🧹 Cleaning up test user...');
  await supabase.auth.admin.deleteUser(userData.user!.id);
  console.log('✅ Test user cleaned up.');
}

fixTrigger().catch(console.error);
