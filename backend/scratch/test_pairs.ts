import { fetchTopFuturesPairs } from './src/services/marketData/binanceService';

async function test() {
  try {
    console.log('Fetching top pairs...');
    const pairs = await fetchTopFuturesPairs(80);
    console.log(`Success! Found ${pairs.length} pairs.`);
    console.log('First 5:', pairs.slice(0, 5));
  } catch (err: any) {
    console.error('FAILED:', err.name, err.message);
    if (err.cause) console.error('CAUSE:', err.cause);
  }
}

test();
