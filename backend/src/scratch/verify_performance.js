
const checkEndpoint = async (url, name) => {
  const start = Date.now();
  try {
    const res = await fetch(url);
    const data = await res.json();
    const duration = Date.now() - start;
    console.log(`[${name}] Status: ${res.status} | Time: ${duration}ms | Data: ${JSON.stringify(data).slice(0, 100)}...`);
    return { name, duration, success: res.ok, count: data.data?.length || data.total };
  } catch (err) {
    console.error(`[${name}] FAILED:`, err.message);
    return { name, success: false };
  }
};

async function runTests() {
  console.log('🧪 Starting AlphaAI Signal Engine Verification...');
  
  await checkEndpoint('http://localhost:3000/health', 'Health Check');
  const pairs = await checkEndpoint('http://localhost:3000/api/market/pairs', 'Market Pairs (Bulk)');
  await checkEndpoint('http://localhost:3000/api/signals', 'Active Signals (Cached)');
  await checkEndpoint('http://localhost:3000/api/signals/history', 'History (Cached)');

  if (pairs.count !== 80) {
    console.error(`⚠️ Universe Discrepancy: Expected 80 pairs, got ${pairs.count}`);
  } else {
    console.log('✅ Universe Correct: 80/80 pairs found.');
  }
}

runTests();
