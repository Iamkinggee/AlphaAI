/**
 * AlphaAI — Analyse Screen v3
 * TradingView Lightweight Charts with canvas overlay:
 *   • SMC Zones (OB, FVG, entry boxes) drawn directly on chart
 *   • TP1/TP2/TP3/SL/Entry labeled with pill-style labels on canvas
 *   • Stays aligned on scroll, zoom, resize
 *   • Timeframes, tools, 50+ searchable pairs
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type WebViewType from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useSignals } from '@/src/hooks';
import { apiClient } from '@/src/services/apiClient';

// ── Pairs ───────────────────────────────────────────────────────────
const ALL_PAIRS = [
  'BTC/USDT','ETH/USDT','BNB/USDT','XRP/USDT','SOL/USDT',
  'ADA/USDT','AVAX/USDT','DOT/USDT','ATOM/USDT','NEAR/USDT',
  'FTM/USDT','APT/USDT','SUI/USDT','INJ/USDT','SEI/USDT',
  'TON/USDT','TRX/USDT','ETC/USDT','LTC/USDT','BCH/USDT',
  'OP/USDT','ARB/USDT','MATIC/USDT','IMX/USDT','LINK/USDT',
  'UNI/USDT','AAVE/USDT','MKR/USDT','SNX/USDT','COMP/USDT',
  'FET/USDT','RENDER/USDT','OCEAN/USDT','GRT/USDT','CHZ/USDT',
  'DOGE/USDT','SHIB/USDT','PEPE/USDT','WIF/USDT','BONK/USDT',
  'AXS/USDT','MANA/USDT','SAND/USDT','GALA/USDT','APE/USDT',
  'TIA/USDT','JUP/USDT','PYTH/USDT','FIL/USDT','HBAR/USDT',
  'ALGO/USDT','ICP/USDT','VET/USDT','EOS/USDT','FLOW/USDT',
];
const POPULAR = ['BTC/USDT','ETH/USDT','SOL/USDT','BNB/USDT','XRP/USDT','LINK/USDT','AVAX/USDT','OP/USDT','ARB/USDT','INJ/USDT'];

const TIMEFRAMES = [
  { label:'1m', interval:'1m' },{ label:'5m', interval:'5m' },
  { label:'15m',interval:'15m'},{ label:'30m',interval:'30m'},
  { label:'1H', interval:'1h' },{ label:'4H', interval:'4h' },
  { label:'1D', interval:'1d' },{ label:'1W', interval:'1w' },
];

// ── Replace BASE_SETUPS: all analysis is live from backend ───────────
// (BASE_SETUPS removed — see backend/src/routes/signals.ts POST /analyse)
interface SMCSetup {
  direction: 'LONG'|'SHORT';
  entry: number; sl: number;
  tp1: number; tp2: number; tp3: number;
  zoneLow: number; zoneHigh: number;
  fvgLow: number;  fvgHigh: number;
  score: number; setupType: string;
  hasFvg: boolean; hasOb: boolean; hasSweep: boolean;
  text: string;
}


// ── Chart HTML with canvas overlay ─────────────────────────────────
function buildHtml(pair: string, isDark: boolean, interval: string): string {
  const symbol = pair.replace('/', '').toUpperCase();
  const bg     = isDark ? '#090E1A' : '#F0F4FA';
  const grid   = isDark ? '#1A2636' : '#DDE4EF';
  const txt    = isDark ? '#C8D6E8' : '#2A3B52';
  const accent = '#00F0A0';

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:100%;height:100%;background:${bg};overflow:hidden;font-family:-apple-system,sans-serif;}
  #wrap{position:relative;width:100vw;height:100vh;}
  #chart{width:100%;height:100%;}
  #overlay{position:absolute;top:0;left:0;pointer-events:none;z-index:5;}
  #spinner{
    display:flex;position:absolute;top:50%;left:50%;
    transform:translate(-50%,-50%);z-index:10;
    flex-direction:column;align-items:center;gap:10px;
  }
  .ring{width:32px;height:32px;border-radius:50%;border:3px solid ${grid};border-top-color:${accent};animation:spin .8s linear infinite;}
  .ring-label{color:${txt};font-size:12px;opacity:0.7;}
  @keyframes spin{to{transform:rotate(360deg)}}
</style>
</head><body>
<div id="wrap">
  <div id="chart"></div>
  <canvas id="overlay"></canvas>
  <div id="spinner"><div class="ring"></div><div class="ring-label">Loading ${pair}...</div></div>
</div>
<script src="https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js"></script>
<script>
(function(){
  var wrap   = document.getElementById('wrap');
  var canvas = document.getElementById('overlay');
  var ctx    = canvas.getContext('2d');
  var spinner= document.getElementById('spinner');

  function resize(){
    canvas.width  = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
  }
  resize();
  window.addEventListener('resize', function(){ resize(); chart.applyOptions({width:wrap.clientWidth,height:wrap.clientHeight}); redrawOverlay(); });

  /* ── Chart setup ── */
  var chart = LightweightCharts.createChart(document.getElementById('chart'),{
    layout:{background:{color:'${bg}'},textColor:'${txt}',fontSize:13},
    grid:{vertLines:{color:'${grid}'},horzLines:{color:'${grid}'}},
    crosshair:{mode:LightweightCharts.CrosshairMode.Normal},
    rightPriceScale:{borderColor:'${grid}',scaleMargins:{top:0.08,bottom:0.12}},
    leftPriceScale:{visible:false},
    timeScale:{borderColor:'${grid}',timeVisible:true,secondsVisible:false},
    handleScroll:true,handleScale:true
  });

  var candleSeries = chart.addCandlestickSeries({
    upColor:'#00F0A0',downColor:'#FF3366',
    borderUpColor:'#00F0A0',borderDownColor:'#FF3366',
    wickUpColor:'#00F0A0',wickDownColor:'#FF3366'
  });

  var volSeries = chart.addHistogramSeries({
    color:'${accent}22',priceFormat:{type:'volume'},
    priceScaleId:'vol'
  });
  chart.priceScale('vol').applyOptions({scaleMargins:{top:0.85,bottom:0}});

  /* ── Canvas drawing helpers ── */
  function pxRoundRect(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
  }

  function fmtPrice(p){
    if(p>=100000)return '$'+Math.round(p).toLocaleString();
    if(p>=10000) return '$'+p.toFixed(0);
    if(p>=1000)  return '$'+p.toFixed(1);
    if(p>=1)     return '$'+p.toFixed(3);
    return '$'+p.toFixed(5);
  }

  /* ── Auto-level engine (ATR-based from real candle data) ── */
  function computeATR(cd, period){
    if(cd.length < period+1) return (cd[cd.length-1].high - cd[cd.length-1].low);
    var sum = 0;
    for(var i = cd.length - period; i < cd.length; i++){
      var prev = cd[i-1].close;
      var tr   = Math.max(
        cd[i].high - cd[i].low,
        Math.abs(cd[i].high - prev),
        Math.abs(cd[i].low  - prev)
      );
      sum += tr;
    }
    return sum / period;
  }

  /* Identify recent structure direction using SMA50 */
  function detectDirection(cd){
    if(cd.length < 50) return 'LONG';
    var sum = 0;
    for(var i = cd.length - 50; i < cd.length; i++) sum += cd[i].close;
    var sma50 = sum / 50;
    return cd[cd.length-1].close > sma50 ? 'LONG' : 'SHORT';
  }

  /* Find last unmitigated Order Block */
  function findOBZone(cd, direction, entry, atr){
    var obHigh, obLow;
    if(direction === 'LONG'){
      for(var i = cd.length - 3; i > cd.length - 20 && i > 0; i--){
        if(cd[i].close < cd[i].open){
          obHigh = cd[i].open;
          obLow  = cd[i].close;
          if(obHigh - obLow >= atr * 0.25) break;
        }
      }
      if(!obHigh){ obLow = entry - atr * 0.6; obHigh = entry; }
    } else {
      for(var i = cd.length - 3; i > cd.length - 20 && i > 0; i--){
        if(cd[i].close > cd[i].open){
          obLow  = cd[i].open;
          obHigh = cd[i].close;
          if(obHigh - obLow >= atr * 0.25) break;
        }
      }
      if(!obLow){ obLow = entry; obHigh = entry + atr * 0.6; }
    }
    return { low: obLow, high: obHigh };
  }

  /* Find Fair Value Gap near recent price action */
  function findFVG(cd, direction, atr){
    for(var i = cd.length - 2; i > cd.length - 30 && i > 1; i--){
      var prev = cd[i-1], next = cd[i+1];
      if(direction === 'LONG'){
        if(prev && next && prev.high < next.low && (next.low - prev.high) >= atr * 0.15){
          return { low: prev.high, high: next.low };
        }
      } else {
        if(prev && next && prev.low > next.high && (prev.low - next.high) >= atr * 0.15){
          return { low: next.high, high: prev.low };
        }
      }
    }
    return null;
  }

  function computeAutoLevels(cd){
    var atr14     = computeATR(cd, 14);
    var direction = detectDirection(cd);
    var last      = cd[cd.length - 1];
    var entry     = last.close;
    var isLong    = direction === 'LONG';

    /* ATR-scaled levels */
    var slDist  = atr14 * 1.8;   // SL: 1.8 × ATR
    var tp1Dist = atr14 * 2.0;   // TP1: ~1:1.1 R:R
    var tp2Dist = atr14 * 4.2;   // TP2: ~1:2.3 R:R
    var tp3Dist = atr14 * 7.5;   // TP3: ~1:4.2 R:R

    var sl, tp1, tp2, tp3;
    if(isLong){
      sl = entry - slDist; tp1 = entry + tp1Dist; tp2 = entry + tp2Dist; tp3 = entry + tp3Dist;
    } else {
      sl = entry + slDist; tp1 = entry - tp1Dist; tp2 = entry - tp2Dist; tp3 = entry - tp3Dist;
    }

    var ob  = findOBZone(cd, direction, entry, atr14);
    var fvg = findFVG(cd, direction, atr14);

    return { direction:direction, entry:entry, sl:sl, tp1:tp1, tp2:tp2, tp3:tp3, ob:ob, fvg:fvg, atr:atr14 };
  }

  function levelsToSMC(lv){
    var isLong     = lv.direction === 'LONG';
    var entryColor = isLong ? '#00F0A0' : '#FF3366';
    var obColor    = isLong ? '#00AAFF' : '#FF6B35';
    var zones = [];
    zones.push({ label: isLong ? 'Demand OB' : 'Supply OB', high: lv.ob.high, low: lv.ob.low, color: obColor });
    if(lv.fvg) zones.push({ label: 'FVG', high: lv.fvg.high, low: lv.fvg.low, color: '#FFB800' });
    return {
      zones: zones,
      levels: [
        { label:'Entry', price:lv.entry, color:entryColor,   solid:true,  width:2.5 },
        { label:'SL',    price:lv.sl,    color:'#FF3366',    solid:true,  width:2   },
        { label:'TP1',   price:lv.tp1,   color:'#FFD700',    solid:false, width:1.5 },
        { label:'TP2',   price:lv.tp2,   color:'#FFA500BB',  solid:false, width:1.2 },
        { label:'TP3',   price:lv.tp3,   color:'#FF850066',  solid:false, width:1   },
      ]
    };
  }

  /* ── SMC data state ── */
  var smcData    = null;
  var rawCandles = [];
  var RIGHT_OFFSET = 75;

  function redrawOverlay(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(!smcData) return;

    var cw = canvas.width  - RIGHT_OFFSET;
    var ch = canvas.height - 28;

    /* === Draw zones === */
    if(smcData.zones){
      smcData.zones.forEach(function(zone){
        var yH = candleSeries.priceToCoordinate(zone.high);
        var yL = candleSeries.priceToCoordinate(zone.low);
        if(yH===null||yL===null) return;
        if(yH>yL){var t=yH;yH=yL;yL=t;}
        var zh = Math.max(4, yL - yH);

        ctx.globalAlpha = 0.12;
        ctx.fillStyle   = zone.color;
        ctx.fillRect(0, yH, cw, zh);
        ctx.globalAlpha = 1;

        ctx.strokeStyle = zone.color;
        ctx.lineWidth   = 1;
        ctx.setLineDash([5,3]);
        ctx.beginPath(); ctx.moveTo(0,yH); ctx.lineTo(cw,yH); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,yL); ctx.lineTo(cw,yL); ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = 'bold 9px -apple-system,sans-serif';
        var tw = ctx.measureText(zone.label).width;
        var pw = tw + 10, ph = 14;
        ctx.globalAlpha = 0.82;
        ctx.fillStyle   = zone.color;
        pxRoundRect(8, yH + 3, pw, ph, 3); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#000';
        ctx.fillText(zone.label, 13, yH + 13);
      });
    }

    /* === Draw level lines === */
    if(smcData.levels){
      smcData.levels.forEach(function(level){
        var y = candleSeries.priceToCoordinate(level.price);
        if(y===null || y < -20 || y > ch + 20) return;

        /* Main line */
        ctx.strokeStyle = level.color;
        ctx.lineWidth   = level.width || (level.solid ? 2 : 1.5);
        ctx.setLineDash(level.solid ? [] : [10,6]);
        ctx.globalAlpha = level.solid ? 1 : 0.88;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cw, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        /* Left tick dot */
        ctx.fillStyle   = level.color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(4, y, 3, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;

        /* Label pill — right aligned */
        var priceTxt = level.label + '  ' + fmtPrice(level.price);
        ctx.font = 'bold 10px -apple-system,sans-serif';
        var tw   = ctx.measureText(priceTxt).width;
        var pw   = tw + 16, ph = 19;
        var px   = cw - pw - 2;
        var py   = y - ph / 2;

        ctx.globalAlpha = 0.96;
        ctx.fillStyle   = level.color;
        pxRoundRect(px, py, pw, ph, 5); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = level.color === '#FFD700' || level.color === '#00F0A0' ? '#000' : '#fff';
        if(level.color === '#FF3366') ctx.fillStyle = '#fff';
        ctx.fillText(priceTxt, px + 8, py + 13);
      });
    }
  }

  /* Redraw on scroll, scale, crosshair */
  chart.timeScale().subscribeVisibleLogicalRangeChange(redrawOverlay);
  chart.timeScale().subscribeVisibleTimeRangeChange(redrawOverlay);
  chart.subscribeCrosshairMove(redrawOverlay);

  /* ── Data loading ── */
  var curPair     = '${symbol}';
  var curInterval = '${interval}';

  function showSpinner(v){ spinner.style.display = v ? 'flex' : 'none'; }

  function loadData(sym, intv){
    showSpinner(true);
    smcData    = null;
    rawCandles = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    fetch('https://api.binance.com/api/v3/klines?symbol='+sym+'&interval='+intv+'&limit=300')
      .then(function(r){ return r.json(); })
      .then(function(raw){
        if(!Array.isArray(raw)){ showSpinner(false); return; }

        rawCandles = raw.map(function(k){
          return { time:Math.floor(k[0]/1000), open:+k[1], high:+k[2], low:+k[3], close:+k[4] };
        });
        var vd = raw.map(function(k){
          return { time:Math.floor(k[0]/1000), value:+k[5],
                   color:+k[4]>=+k[1]?'${accent}33':'#FF336633' };
        });

        candleSeries.setData(rawCandles);
        volSeries.setData(vd);
        chart.timeScale().fitContent();
        showSpinner(false);

        /* Auto-compute ATR-based levels immediately after data load */
        try {
          var lv  = computeAutoLevels(rawCandles);
          smcData = levelsToSMC(lv);
          setTimeout(redrawOverlay, 350);

          if(window.ReactNativeWebView){
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type:'auto_levels', pair:sym, interval:intv,
              direction:lv.direction, entry:lv.entry,
              sl:lv.sl, tp1:lv.tp1, tp2:lv.tp2, tp3:lv.tp3, atr:lv.atr
            }));
          }
        } catch(e){ console.error('Level compute error', e); }

        if(window.ReactNativeWebView){
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'loaded',pair:sym,interval:intv}));
        }
      })
      .catch(function(err){ showSpinner(false); });
  }

  loadData(curPair, curInterval);

  /* ── Public API ── */
  window.setTimeframe = function(intv){ curInterval=intv; loadData(curPair,intv); };
  window.loadPair     = function(sym){  curPair=sym;      loadData(sym,curInterval); };

  window.addSMCZones = function(jsonStr){
    try{ smcData = typeof jsonStr==='string' ? JSON.parse(jsonStr) : jsonStr; }
    catch(e){ console.error('addSMCZones parse error', e); return; }
    setTimeout(redrawOverlay, 200);
  };

  window.clearSMCZones = function(){
    if(rawCandles.length > 0){
      try{ var lv=computeAutoLevels(rawCandles); smcData=levelsToSMC(lv); }
      catch(e){ smcData=null; }
    } else { smcData=null; }
    redrawOverlay();
  };

  window.fitContent = function(){ chart.timeScale().fitContent(); };

  window.setTool = function(tool){
    chart.applyOptions({
      crosshair:{ mode: tool==='magnet'
        ? LightweightCharts.CrosshairMode.Magnet
        : LightweightCharts.CrosshairMode.Normal }
    });
  };

})();
</script></body></html>`;
}

// ── Build zone + level payload from a setup ─────────────────────────
function buildSMCPayload(s: SMCSetup) {
  const isLong = s.direction === 'LONG';
  const obColor = isLong ? '#00B4FF' : '#FF3366';
  const entryColor = isLong ? '#00F0A0' : '#FF3366';

  return {
    zones: [
      // Order Block
      {
        label: isLong ? 'Demand OB' : 'Supply OB',
        high: s.zoneHigh, low: s.zoneLow,
        color: obColor,
      },
      // FVG (only if detected)
      ...(s.hasFvg ? [{
        label: 'FVG',
        high: s.fvgHigh, low: s.fvgLow,
        color: '#FFB800',
      }] : []),
    ],
    levels: [
      { label: 'Entry', price: s.entry, color: entryColor, solid: true   },
      { label: 'SL',    price: s.sl,    color: '#FF3366',  solid: true   },
      { label: 'TP1',   price: s.tp1,   color: '#FFB800',  solid: false  },
      { label: 'TP2',   price: s.tp2,   color: '#FFB80099',solid: false  },
      { label: 'TP3',   price: s.tp3,   color: '#FFB80066',solid: false  },
    ],
  };
}

// ── Main Component ──────────────────────────────────────────────────
export default function AnalyseScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ pair?: string }>();

  const [pair,       setPair]       = useState(params.pair ?? 'BTC/USDT');
  const [timeframe,  setTimeframe]  = useState('4h');
  const [search,     setSearch]     = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [aiText,     setAiText]     = useState('');
  const [aiLoading,  setAiLoading]  = useState(false);
  const [setup,      setSetup]      = useState<SMCSetup | null>(null);
  const [showLevels, setShowLevels] = useState(true);
  const [activeTool, setActiveTool] = useState<'crosshair'|'magnet'>('crosshair');
  // Auto-computed levels from WebView ATR engine (no button needed)
  const [autoLevels, setAutoLevels] = useState<{
    direction: 'LONG'|'SHORT'; entry: number;
    sl: number; tp1: number; tp2: number; tp3: number; atr: number;
  } | null>(null);

  const webviewRef = useRef<WebViewType>(null);
  const { signals } = useSignals();

  const existingSignal = useMemo(
    () => signals.find(s => s.pair === pair && (s.status === 'active' || s.status === 'approaching')),
    [signals, pair]
  );

  const html = useMemo(() => buildHtml(pair, isDark, timeframe), [pair, isDark]);

  // Helper to format prices in the level bar
  const fmtLv = (n: number) => {
    if (n >= 100000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (n >= 1000)   return n.toFixed(1);
    if (n >= 1)      return n.toFixed(3);
    return n.toFixed(5);
  };

  const inject = useCallback((js: string) => {
    webviewRef.current?.injectJavaScript(js + '; true;');
  }, []);

  // ── After WebView loads, overlay existing signal levels if any ──
  const onChartLoaded = useCallback(() => {
    if (existingSignal) {
      const s = existingSignal;
      const isLong = s.direction === 'LONG';
      const payload = {
        zones: [{
          label: isLong ? 'Demand OB' : 'Supply OB',
          high: s.entryZone.high, low: s.entryZone.low,
          color: isLong ? '#00B4FF' : '#FF3366',
        }],
        levels: [
          { label:'Entry', price: s.entryZone.low,         color: isLong ? '#00F0A0' : '#FF3366', solid: true  },
          { label:'SL',    price: s.stopLoss,               color: '#FF3366', solid: true  },
          { label:'TP1',   price: s.takeProfit1.price,      color: '#FFB800', solid: false },
          { label:'TP2',   price: s.takeProfit2.price,      color: '#FFB80099', solid: false },
          { label:'TP3',   price: s.takeProfit3.price,      color: '#FFB80066', solid: false },
        ],
      };
      setTimeout(() => inject(`window.addSMCZones(${JSON.stringify(JSON.stringify(payload))})`), 1800);
    }
  }, [existingSignal, inject]);

  // ── Timeframe ───────────────────────────────────────────────────
  const handleTimeframe = (tf: { label: string; interval: string }) => {
    setTimeframe(tf.interval);
    setAiText('');
    setSetup(null);
    setAutoLevels(null); // will refresh from new data
    inject(`window.setTimeframe('${tf.interval}')`);
  };

  // ── WebView → React Native message handler ─────────────────────
  const onWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'auto_levels') {
        setAutoLevels({
          direction: msg.direction,
          entry:     msg.entry,
          sl:        msg.sl,
          tp1:       msg.tp1,
          tp2:       msg.tp2,
          tp3:       msg.tp3,
          atr:       msg.atr,
        });
      }
    } catch { /* ignore non-JSON */ }
  }, []);

  // ── Tool toggle ────────────────────────────────────────────────
  const handleTool = (tool: 'crosshair'|'magnet') => {
    setActiveTool(tool);
    inject(`window.setTool('${tool}')`);
  };

  // ── Level toggle ───────────────────────────────────────────────
  const handleToggleLevels = () => {
    const next = !showLevels;
    setShowLevels(next);
    if (!next) {
      inject('window.clearSMCZones()');
    } else if (setup) {
      const payload = buildSMCPayload(setup);
      inject(`window.addSMCZones(${JSON.stringify(JSON.stringify(payload))})`);
    }
  };

  // ── Pair selection ─────────────────────────────────────────────
  const selectPair = (p: string) => {
    setPair(p);
    setSearch('');
    setShowSearch(false);
    setAiText('');
    setSetup(null);
    setAutoLevels(null); // will refresh from new data
    inject(`window.loadPair('${p.replace('/','').toUpperCase()}')`);
  };

  // ── AI Analysis — powered by Groq via live ATR levels ─────────
  const handleAI = useCallback(async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiText('');

    // Use live auto-levels if available; otherwise estimate from current pair
    const lvl = autoLevels ?? {
      direction: 'LONG' as const,
      entry: 0, sl: 0, tp1: 0, tp2: 0, tp3: 0, atr: 0,
    };

    if (!lvl.entry) {
      setAiText('⏳ Chart is still loading — please wait for price data then try again.');
      setAiLoading(false);
      return;
    }

    try {
      const res = await apiClient.post<{ success: boolean; data: SMCSetup & { text: string; atr?: number } }>(
        '/signals/analyse',
        {
          pair,
          timeframe,
          direction:    lvl.direction,
          entry:        lvl.entry,
          sl:           lvl.sl,
          tp1:          lvl.tp1,
          tp2:          lvl.tp2,
          tp3:          lvl.tp3,
          currentPrice: lvl.entry,
          atr:          lvl.atr,
        }
      );

      if (res.success && res.data) {
        const d = res.data;
        setSetup(d);
        setAiText(d.text ?? '');
        if (showLevels) {
          const payload = buildSMCPayload(d);
          inject(`window.addSMCZones(${JSON.stringify(JSON.stringify(payload))})`);
        }
      } else {
        setAiText('Analysis unavailable — backend returned an error.');
      }
    } catch (err) {
      console.error('[Analyse] AI request failed:', err);
      setAiText('⚠️ Could not reach the analysis server. Check your connection.');
    } finally {
      setAiLoading(false);
    }
  }, [pair, timeframe, autoLevels, showLevels, inject, aiLoading]);

  const filteredPairs = useMemo(() =>
    search.length > 0 ? ALL_PAIRS.filter(p => p.toLowerCase().includes(search.toLowerCase())) : POPULAR,
    [search]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>Analyse</Text>
        <Pressable
          onPress={() => setShowSearch(!showSearch)}
          style={[styles.pairBadge, { backgroundColor: theme.accentPrimaryDim, borderColor: theme.accentPrimary + '50' }]}
        >
          <Ionicons name="search" size={13} color={theme.accentPrimary} />
          <Text style={[styles.pairText, { color: theme.accentPrimary, fontFamily: 'Inter-Bold' }]}>{pair}</Text>
          <Ionicons name={showSearch ? 'chevron-up' : 'chevron-down'} size={12} color={theme.accentPrimary} />
        </Pressable>
        <Pressable onPress={() => inject('window.fitContent()')}
          style={[styles.iconBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="scan-outline" size={17} color={theme.textSecondary} />
        </Pressable>
      </View>

      {/* Search drawer */}
      {showSearch && (
        <Animated.View entering={FadeInDown.duration(180)}
          style={[styles.searchDrawer, { backgroundColor: theme.cardElevated, borderBottomColor: theme.border }]}>
          <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="search" size={15} color={theme.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary, fontFamily: 'Inter-Regular' }]}
              placeholder="Search any token (BTC, ETH, SOL…)"
              placeholderTextColor={theme.textTertiary}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="characters"
              autoFocus
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={15} color={theme.textTertiary} />
              </Pressable>
            )}
          </View>
          <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
            <View style={styles.pairGrid}>
              {filteredPairs.map(p => (
                <Pressable key={p} onPress={() => selectPair(p)}
                  style={[styles.pairChip, {
                    backgroundColor: pair === p ? theme.accentPrimaryDim : theme.card,
                    borderColor: pair === p ? theme.accentPrimary + '60' : theme.border,
                  }]}>
                  <Text style={[styles.pairChipText, { color: pair === p ? theme.accentPrimary : theme.textSecondary, fontFamily: 'Inter-SemiBold' }]}>
                    {p.replace('/USDT','')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {/* Timeframe bar */}
      <View style={[styles.tfRow, { borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tfScroll}>
          {TIMEFRAMES.map(tf => {
            const active = tf.interval === timeframe;
            return (
              <Pressable key={tf.interval} onPress={() => handleTimeframe(tf)}
                style={[styles.tfBtn, { backgroundColor: active ? theme.accentPrimary : 'transparent' }]}>
                <Text style={[styles.tfLabel, { color: active ? '#000' : theme.textTertiary, fontFamily: active ? 'Inter-Bold' : 'Inter-Regular' }]}>
                  {tf.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {/* Chart tools */}
        <View style={styles.tools}>
          <Pressable onPress={() => handleTool('crosshair')} style={[styles.toolBtn, { backgroundColor: activeTool === 'crosshair' ? theme.accentPrimaryDim : 'transparent' }]}>
            <Ionicons name="add-outline" size={16} color={activeTool === 'crosshair' ? theme.accentPrimary : theme.textTertiary} />
          </Pressable>
          <Pressable onPress={() => handleTool('magnet')} style={[styles.toolBtn, { backgroundColor: activeTool === 'magnet' ? theme.accentPrimaryDim : 'transparent' }]}>
            <Ionicons name="magnet-outline" size={14} color={activeTool === 'magnet' ? theme.accentPrimary : theme.textTertiary} />
          </Pressable>
          <Pressable onPress={handleToggleLevels} style={[styles.toolBtn, { backgroundColor: showLevels ? theme.accentPrimaryDim : 'transparent' }]}>
            <Ionicons name="layers-outline" size={14} color={showLevels ? theme.accentPrimary : theme.textTertiary} />
          </Pressable>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chart}>
        <WebView
          ref={webviewRef}
          source={{ html }}
          style={styles.webview}
          javaScriptEnabled
          scrollEnabled={false}
          originWhitelist={['*']}
          mixedContentMode="always"
          onLoad={onChartLoaded}
          onMessage={onWebViewMessage}
          onError={(e) => console.warn('[WebView]', e.nativeEvent.description)}
          renderError={() => (
            <View style={[styles.errState, { backgroundColor: theme.background }]}>
              <Ionicons name="wifi-outline" size={36} color={theme.textTertiary} />
              <Text style={[styles.errText, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>Internet required for live charts</Text>
            </View>
          )}
        />
      </View>

      {/* Level legend bar — shows auto-levels immediately, AI levels when available */}
      {showLevels && (autoLevels || setup) && (() => {
        const lv = setup ?? autoLevels!;
        const isLong = lv.direction === 'LONG';
        const dirColor = isLong ? theme.bullish : theme.bearish;
        // Compute R:R label
        const slDist = Math.abs(lv.entry - lv.sl);
        const rr1 = slDist > 0 ? (Math.abs(lv.tp1 - lv.entry) / slDist).toFixed(1) : '–';
        const rr2 = slDist > 0 ? (Math.abs(lv.tp2 - lv.entry) / slDist).toFixed(1) : '–';
        const rr3 = slDist > 0 ? (Math.abs(lv.tp3 - lv.entry) / slDist).toFixed(1) : '–';
        const items = [
          { label: 'Dir',   value: lv.direction, color: dirColor },
          { label: 'Entry', value: fmtLv(lv.entry), color: dirColor },
          { label: 'SL',    value: fmtLv(lv.sl),    color: theme.bearish },
          { label: 'TP1',   value: `${fmtLv(lv.tp1)} (1:${rr1})`, color: '#FFD700' },
          { label: 'TP2',   value: `${fmtLv(lv.tp2)} (1:${rr2})`, color: '#FFA500' },
          { label: 'TP3',   value: `${fmtLv(lv.tp3)} (1:${rr3})`, color: '#FF8500' },
        ];
        return (
          <Animated.View entering={FadeInDown.duration(300)}
            style={[styles.levelBar, { backgroundColor: theme.cardElevated, borderTopColor: theme.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelScroll}>
              {items.map((item, i, arr) => (
                <View key={item.label} style={[styles.levelItem, i < arr.length - 1 && { borderRightWidth: 1, borderRightColor: theme.border }]}>
                  <Text style={[styles.levelLabel, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>{item.label}</Text>
                  <Text style={[styles.levelValue, { color: item.color, fontFamily: 'Inter-SemiBold' }]} numberOfLines={1}>{item.value}</Text>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        );
      })()}

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        {existingSignal ? (
          <View style={[styles.sigBadge, {
            backgroundColor: existingSignal.direction === 'LONG' ? theme.bullishDim : theme.bearishDim,
            borderColor: (existingSignal.direction === 'LONG' ? theme.bullish : theme.bearish) + '40',
          }]}>
            <Ionicons name={existingSignal.direction === 'LONG' ? 'trending-up' : 'trending-down'} size={12} color={existingSignal.direction === 'LONG' ? theme.bullish : theme.bearish} />
            <Text style={[styles.sigText, { color: existingSignal.direction === 'LONG' ? theme.bullish : theme.bearish, fontFamily: 'Inter-SemiBold' }]} numberOfLines={1}>
              {existingSignal.status === 'approaching' ? 'Approaching' : 'Active'} {existingSignal.direction}
            </Text>
          </View>
        ) : setup ? (
          <View style={[styles.sigBadge, {
            backgroundColor: setup.direction === 'LONG' ? theme.bullishDim : theme.bearishDim,
            borderColor: (setup.direction === 'LONG' ? theme.bullish : theme.bearish) + '40',
          }]}>
            <Ionicons name="sparkles" size={12} color={setup.direction === 'LONG' ? theme.bullish : theme.bearish} />
            <Text style={[styles.sigText, { color: setup.direction === 'LONG' ? theme.bullish : theme.bearish, fontFamily: 'Inter-SemiBold' }]} numberOfLines={1}>
              AI {setup.direction} · {setup.setupType.split(' ').slice(0,2).join(' ')} · {setup.score}/100
            </Text>
          </View>
        ) : (
          <Text style={[styles.noSig, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]} numberOfLines={1}>
            Run AI Analysis to scan {pair}
          </Text>
        )}

        <Pressable onPress={handleAI} disabled={aiLoading}
          style={[styles.aiBtn, { backgroundColor: theme.accentPrimary, opacity: aiLoading ? 0.85 : 1 }]}>
          {aiLoading
            ? <ActivityIndicator size="small" color="#000" />
            : <Ionicons name="sparkles" size={14} color="#000" />
          }
          <Text style={[styles.aiBtnTxt, { fontFamily: 'Inter-Bold' }]}>
            {aiLoading ? 'Scanning…' : 'AI Analysis'}
          </Text>
        </Pressable>
      </View>

      {/* AI result card */}
      {aiText.length > 0 && (
        <Animated.View entering={FadeInDown.duration(280)}
          style={[styles.aiCard, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
          <View style={styles.aiCardHead}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sparkles" size={13} color={theme.accentPrimary} />
              <Text style={[styles.aiCardTitle, { color: theme.accentPrimary, fontFamily: 'Inter-SemiBold' }]}>SMC Analysis</Text>
              {setup && (
                <View style={[styles.scorePill, { backgroundColor: setup.score >= 80 ? theme.bullishDim : theme.approachingDim }]}>
                  <Text style={[styles.scorePillTxt, { color: setup.score >= 80 ? theme.bullish : theme.approaching, fontFamily: 'Inter-Bold' }]}>{setup.score}</Text>
                </View>
              )}
            </View>
            <Pressable onPress={() => { setAiText(''); setSetup(null); inject('window.clearSMCZones()'); }}>
              <Ionicons name="close" size={16} color={theme.textTertiary} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 140 }} showsVerticalScrollIndicator={false}>
            <Text style={[styles.aiTxt, { color: theme.textPrimary, fontFamily: 'Inter-Regular' }]}>{aiText}</Text>
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title:        { flex: 1, fontSize: 22 },
  pairBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  pairText:     { fontSize: 16 },
  iconBtn:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  searchDrawer: { borderBottomWidth: 1, padding: 12, gap: 10 },
  searchBar:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9 },
  searchInput:  { flex: 1, fontSize: 16, padding: 0 },
  pairGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  pairChip:     { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  pairChipText: { fontSize: 15 },
  tfRow:        { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingRight: 6 },
  tfScroll:     { paddingHorizontal: 10, gap: 2, paddingVertical: 5 },
  tfBtn:        { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 7 },
  tfLabel:      { fontSize: 14 },
  tools:        { flexDirection: 'row', gap: 2 },
  toolBtn:      { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  chart:        { flex: 1 },
  webview:      { flex: 1, backgroundColor: 'transparent' },
  errState:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errText:      { fontSize: 16 },
  levelBar:     { borderTopWidth: StyleSheet.hairlineWidth },
  levelScroll:  { paddingHorizontal: 8, paddingVertical: 8, gap: 0 },
  levelItem:    { alignItems: 'center', paddingHorizontal: 14, gap: 2 },
  levelLabel:   { fontSize: 12 },
  levelValue:   { fontSize: 14 },
  bottomBar:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  sigBadge:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1 },
  sigText:      { fontSize: 14, flex: 1 },
  noSig:        { flex: 1, fontSize: 14 },
  aiBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  aiBtnTxt:     { fontSize: 16, color: '#000' },
  aiCard:       { marginHorizontal: 12, marginBottom: 8, padding: 14, borderRadius: 16, borderWidth: 1 },
  aiCardHead:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  aiCardTitle:  { fontSize: 15 },
  scorePill:    { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  scorePillTxt: { fontSize: 13 },
  aiTxt:        { fontSize: 15, lineHeight: 21 },
});
