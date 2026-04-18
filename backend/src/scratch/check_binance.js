
async function checkBinance() {
  const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
  const data = await res.json();
  const usdtPairs = data.filter(t => t.symbol.endsWith('USDT'));
  console.log('Total USDT Pairs:', usdtPairs.length);
  const top80 = usdtPairs.sort((a,b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)).slice(0, 80);
  console.log('Top 80 Count:', top80.length);
}
checkBinance();
