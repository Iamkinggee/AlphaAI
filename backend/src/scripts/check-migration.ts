
import { getSupabaseClient } from '../services/supabaseClient';

async function migrate() {
  const db = getSupabaseClient();
  console.log('🚀 Checking columns in signals table...');
  
  const { data, error } = await db.from('signals').select('*').limit(1);
  if (error) {
    console.error('❌ Error fetching signals:', error.message);
    return;
  }
  
  if (data && data[0]) {
    console.log('✅ Columns found:', Object.keys(data[0]));
  } else {
    console.log('ℹ️ No data in signals table to check columns.');
  }
}

migrate();
