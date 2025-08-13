import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  sma,
  rsi,
  macd,
  bollingerbands,
  stochastic
} from 'technicalindicators';
import { Chart } from 'chart.js/auto';
import {
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Constants for configuration
const CONFIG = {
  api: {
    baseUrl: 'https://api.binance.com/api/v3/klines',
    defaultLimit: 300,
    rateLimit: 1000 // ms between requests
  },
  indicators: {
    minDataPoints: Math.max(200, 34, 18) // Max of all indicator requirements
  },
  analysis: {
    weights: {
      trend: 30,
      rsi: 20,
      smaCrossover: 20,
      macd: 15,
      volume: 15,
      bb: 10,
      stochastic: 10
    },
    thresholds: {
      buy: 0.5, // 50% of max score
      sell: -0.5
    }
  }
};

const Bb = () => {
  // State variables
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [lastRequestTime, setLastRequestTime] = useState(0);

  // Refs
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const cachedData = useRef({});

  // Trading pairs and timeframes options
  const tradingPairs = [
    { value: 'BTCUSDT', label: 'BTC/USDT' },
    { value: 'ETHUSDT', label: 'ETH/USDT' },
    { value: 'BNBUSDT', label: 'BNB/USDT' },
    { value: 'SOLUSDT', label: 'SOL/USDT' },
    { value: 'XRPUSDT', label: 'XRP/USDT' },
    { value: 'ADAUSDT', label: 'ADA/USDT' },
    { value: 'DOGEUSDT', label: 'DOGE/USDT' }
  ];

  const timeframes = [
    { value: '15m', label: '15 دقيقة' },
    { value: '1h', label: '1 ساعة' },
    { value: '4h', label: '4 ساعات' },
    { value: '1d', label: '1 يوم' }
  ];

  // --- Data Fetching ---
  const fetchKlines = useCallback(async (symbol, interval, limit) => {
    const cacheKey = `${symbol}-${interval}-${limit}`;
    
    // Check cache first
    if (cachedData.current[cacheKey]) {
      return cachedData.current[cacheKey];
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < CONFIG.api.rateLimit) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.api.rateLimit - timeSinceLastRequest));
    }

    const apiUrl = `${CONFIG.api.baseUrl}?symbol=${symbol}&interval=${interval}&limit=${limit}`;

    try {
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`فشل في جلب البيانات: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      // Cache the data
      cachedData.current[cacheKey] = data;
      setLastRequestTime(Date.now());
      
      return data;

    } catch (error) {
      console.error('Error fetching klines:', error);
      throw error;
    }
  }, [lastRequestTime]);

  // --- Indicator Calculation ---
  const calculateIndicators = useCallback((klines) => {
    const closePrices = klines.map(k => parseFloat(k[4]));
    const volumes = klines.map(k => parseFloat(k[5]));
    const highPrices = klines.map(k => parseFloat(k[2]));
    const lowPrices = klines.map(k => parseFloat(k[3]));

    if (closePrices.length < CONFIG.indicators.minDataPoints) {
      console.warn(`Not enough data (${closePrices.length}) for all indicators. Minimum needed: ${CONFIG.indicators.minDataPoints}`);
    }

    if (closePrices.some(isNaN) || volumes.some(isNaN) || highPrices.some(isNaN) || lowPrices.some(isNaN)) {
      console.error("Detected NaN values in price or volume data!");
    }

    // Calculate all indicators in parallel (simulated with Promise.all)
    const indicators = {
      sma20: closePrices.length >= 20 ? sma({ values: closePrices, period: 20 }) || [] : [],
      sma50: closePrices.length >= 50 ? sma({ values: closePrices, period: 50 }) || [] : [],
      sma200: closePrices.length >= 200 ? sma({ values: closePrices, period: 200 }) || [] : [],
      rsi: closePrices.length >= 14 ? rsi({ values: closePrices, period: 14 }) || [] : [],
      macd: closePrices.length >= 34 ? macd({
        values: closePrices,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
      }) : null,
      bollingerbands: closePrices.length >= 20 ? bollingerbands({
        values: closePrices,
        period: 20,
        stdDev: 2
      }) : null,
      stochastic: (highPrices.length >= 18 && lowPrices.length >= 18 && closePrices.length >= 18) ? stochastic({
        high: highPrices,
        low: lowPrices,
        close: closePrices,
        period: 14,
        signalPeriod: 3,
        simpleMA: false
      }) : null,
      volumeSma20: volumes.length >= 20 ? sma({ values: volumes, period: 20 }) || [] : []
    };

    // Structure the results with current values
    return {
      sma20: { values: indicators.sma20, current: indicators.sma20.length > 0 ? indicators.sma20[indicators.sma20.length - 1] : undefined },
      sma50: { values: indicators.sma50, current: indicators.sma50.length > 0 ? indicators.sma50[indicators.sma50.length - 1] : undefined },
      sma200: { values: indicators.sma200, current: indicators.sma200.length > 0 ? indicators.sma200[indicators.sma200.length - 1] : undefined },
      rsi: { values: indicators.rsi, current: indicators.rsi.length > 0 ? indicators.rsi[indicators.rsi.length - 1] : undefined },
      macd: indicators.macd ? {
        MACD: indicators.macd.MACD || [],
        signal: indicators.macd.signal || [],
        histogram: indicators.macd.histogram || [],
        currentMACD: indicators.macd.MACD?.length > 0 ? indicators.macd.MACD[indicators.macd.MACD.length - 1] : undefined,
        currentSignal: indicators.macd.signal?.length > 0 ? indicators.macd.signal[indicators.macd.signal.length - 1] : undefined,
        currentHistogram: indicators.macd.histogram?.length > 0 ? indicators.macd.histogram[indicators.macd.histogram.length - 1] : undefined,
      } : {},
      bollingerbands: indicators.bollingerbands ? {
        upper: indicators.bollingerbands.upper || [],
        middle: indicators.bollingerbands.middle || [],
        lower: indicators.bollingerbands.lower || [],
        currentUpper: indicators.bollingerbands.upper?.length > 0 ? indicators.bollingerbands.upper[indicators.bollingerbands.upper.length - 1] : undefined,
        currentMiddle: indicators.bollingerbands.middle?.length > 0 ? indicators.bollingerbands.middle[indicators.bollingerbands.middle.length - 1] : undefined,
        currentLower: indicators.bollingerbands.lower?.length > 0 ? indicators.bollingerbands.lower[indicators.bollingerbands.lower.length - 1] : undefined,
      } : {},
      stochastic: indicators.stochastic ? {
        k: indicators.stochastic.k || [],
        d: indicators.stochastic.d || [],
        currentK: indicators.stochastic.k?.length > 0 ? indicators.stochastic.k[indicators.stochastic.k.length - 1] : undefined,
        currentD: indicators.stochastic.d?.length > 0 ? indicators.stochastic.d[indicators.stochastic.d.length - 1] : undefined,
      } : {},
      volumeSma20: { values: indicators.volumeSma20, current: indicators.volumeSma20.length > 0 ? indicators.volumeSma20[indicators.volumeSma20.length - 1] : undefined },
      currentVolume: volumes.length > 0 ? volumes[volumes.length - 1] : undefined
    };
  }, []);

  // --- Analysis Logic ---
  const performAnalysis = useCallback((indicators, currentPrice, previousPrice) => {
    const analysis = {
      signals: [],
      score: 0,
      decision: 'neutral',
      confidence: 0
    };

    const weights = CONFIG.analysis.weights;
    const maxPossibleScore = Object.values(weights).reduce((sum, weight) => sum + weight, 0);

    // 1. Trend analysis
    if (indicators.sma50?.current !== undefined && indicators.sma200?.current !== undefined) {
      const isUptrend = indicators.sma50.current > indicators.sma200.current && currentPrice > indicators.sma50.current;
      const isDowntrend = indicators.sma50.current < indicators.sma200.current && currentPrice < indicators.sma50.current;

      if (isUptrend) {
        analysis.signals.push({ name: 'الاتجاه (SMAs)', value: 'صاعد', signal: 'buy', weight: weights.trend });
        analysis.score += weights.trend;
      } else if (isDowntrend) {
        analysis.signals.push({ name: 'الاتجاه (SMAs)', value: 'هابط', signal: 'sell', weight: weights.trend });
        analysis.score -= weights.trend;
      } else {
        analysis.signals.push({ name: 'الاتجاه (SMAs)', value: 'جانبي', signal: 'neutral', weight: 0 });
      }
    } else {
      analysis.signals.push({ name: 'الاتجاه (SMAs)', value: 'بيانات غير كافية', signal: 'neutral', weight: 0 });
    }

    // 2. RSI analysis
    if (indicators.rsi?.current !== undefined) {
      if (indicators.rsi.current < 30) {
        analysis.signals.push({ name: 'RSI', value: indicators.rsi.current.toFixed(2), signal: 'buy', weight: weights.rsi });
        analysis.score += weights.rsi;
      } else if (indicators.rsi.current > 70) {
        analysis.signals.push({ name: 'RSI', value: indicators.rsi.current.toFixed(2), signal: 'sell', weight: weights.rsi });
        analysis.score -= weights.rsi;
      } else {
        analysis.signals.push({ name: 'RSI', value: indicators.rsi.current.toFixed(2), signal: 'neutral', weight: 0 });
      }
    } else {
      analysis.signals.push({ name: 'RSI', value: 'بيانات غير كافية', signal: 'neutral', weight: 0 });
    }

    // 3. Moving averages crossover (20/50)
    if (indicators.sma20?.current !== undefined && indicators.sma20.values.length > 1 &&
        indicators.sma50?.current !== undefined && indicators.sma50.values.length > 1) {
      const previousSma20 = indicators.sma20.values[indicators.sma20.values.length - 2];
      const previousSma50 = indicators.sma50.values[indicators.sma50.values.length - 2];

      if (previousSma20 !== undefined && previousSma50 !== undefined && !isNaN(previousSma20) && !isNaN(previousSma50)) {
        if (indicators.sma20.current > indicators.sma50.current && previousSma20 <= previousSma50) {
          analysis.signals.push({ name: 'تقاطع المتوسطات (20/50)', value: 'إيجابي (تقاطع صعودي)', signal: 'buy', weight: weights.smaCrossover });
          analysis.score += weights.smaCrossover;
        } else if (indicators.sma20.current < indicators.sma50.current && previousSma20 >= previousSma50) {
          analysis.signals.push({ name: 'تقاطع المتوسطات (20/50)', value: 'سلبي (تقاطع هبوطي)', signal: 'sell', weight: weights.smaCrossover });
          analysis.score -= weights.smaCrossover;
        } else {
          analysis.signals.push({ name: 'تقاطع المتوسطات (20/50)', value: 'لا يوجد تقاطع واضح', signal: 'neutral', weight: 0 });
        }
      } else {
        analysis.signals.push({ name: 'تقاطع المتوسطات (20/50)', value: 'بيانات سابقة غير كافية أو غير صالحة', signal: 'neutral', weight: 0 });
      }
    } else {
      analysis.signals.push({ name: 'تقاطع المتوسطات (20/50)', value: 'بيانات غير كافية', signal: 'neutral', weight: 0 });
    }

    // 4. MACD analysis - الجزء المصحح
    if (indicators.macd?.MACD?.length > 1 &&
        indicators.macd.signal?.length > 1 &&
        indicators.macd.histogram?.length > 1) {

      const previousMACD = indicators.macd.MACD[indicators.macd.MACD.length - 2];
      const previousSignal = indicators.macd.signal[indicators.macd.signal.length - 2];
      const currentMACD = indicators.macd.currentMACD;
      const currentSignal = indicators.macd.currentSignal;
      const currentHistogram = indicators.macd.histogram[indicators.macd.histogram.length - 1];
      const previousHistogram = indicators.macd.histogram[indicators.macd.histogram.length - 2];

      if (currentMACD !== undefined && currentSignal !== undefined && 
          previousMACD !== undefined && previousSignal !== undefined &&
          currentHistogram !== undefined && previousHistogram !== undefined &&
          !isNaN(currentMACD) && !isNaN(currentSignal)) {

        if (currentMACD > currentSignal && previousMACD <= previousSignal) {
          analysis.signals.push({ name: 'MACD', value: 'تقاطع إيجابي', signal: 'buy', weight: weights.macd * 0.7 });
          analysis.score += weights.macd * 0.7;
        } else if (currentMACD < currentSignal && previousMACD >= previousSignal) {
          analysis.signals.push({ name: 'MACD', value: 'تقاطع سلبي', signal: 'sell', weight: weights.macd * 0.7 });
          analysis.score -= weights.macd * 0.7;
        } else if (currentHistogram > 0 && previousHistogram <= 0) {
          analysis.signals.push({ name: 'MACD', value: 'تزايد الزخم الصعودي (هستوجرام)', signal: 'buy', weight: weights.macd * 0.3 });
          analysis.score += weights.macd * 0.3;
        } else if (currentHistogram < 0 && previousHistogram >= 0) {
          analysis.signals.push({ name: 'MACD', value: 'تزايد الزخم الهبوطي (هستوجرام)', signal: 'sell', weight: weights.macd * 0.3 });
          analysis.score -= weights.macd * 0.3;
        } else {
          analysis.signals.push({ name: 'MACD', value: 'محايد', signal: 'neutral', weight: 0 });
        }
      } else {
        analysis.signals.push({ name: 'MACD', value: 'بيانات سابقة غير كافية أو غير صالحة', signal: 'neutral', weight: 0 });
      }
    } else {
      analysis.signals.push({ name: 'MACD', value: 'بيانات غير كافية', signal: 'neutral', weight: 0 });
    }

    // 5. Volume analysis
    if (indicators.volumeSma20?.current !== undefined &&
        currentPrice !== undefined && previousPrice !== undefined &&
        !isNaN(currentPrice) && !isNaN(previousPrice)) {
      const volumeRatio = indicators.currentVolume !== undefined ? indicators.currentVolume / indicators.volumeSma20.current : 0;
      const priceIncreased = currentPrice > previousPrice;
      const priceDecreased = currentPrice < previousPrice;

      if (volumeRatio > 1.5 && priceIncreased) {
        analysis.signals.push({ name: 'حجم التداول', value: `مرتفع (${volumeRatio.toFixed(2)}x Avg) مع صعود`, signal: 'buy', weight: weights.volume });
        analysis.score += weights.volume;
      } else if (volumeRatio > 1.5 && priceDecreased) {
        analysis.signals.push({ name: 'حجم التداول', value: `مرتفع (${volumeRatio.toFixed(2)}x Avg) مع هبوط`, signal: 'sell', weight: weights.volume });
        analysis.score -= weights.volume;
      } else {
        analysis.signals.push({ name: 'حجم التداول', value: `طبيعي (${volumeRatio.toFixed(2)}x Avg)`, signal: 'neutral', weight: 0 });
      }
    } else {
      analysis.signals.push({ name: 'حجم التداول', value: 'بيانات غير كافية أو غير صالحة', signal: 'neutral', weight: 0 });
    }

    // Determine Final Decision
    const buyThreshold = maxPossibleScore * CONFIG.analysis.thresholds.buy;
    const sellThreshold = maxPossibleScore * CONFIG.analysis.thresholds.sell;

    if (analysis.score >= buyThreshold) {
      analysis.decision = 'buy';
      const confidenceRange = maxPossibleScore - buyThreshold;
      analysis.confidence = confidenceRange > 0 ? Math.min(1, (analysis.score - buyThreshold) / confidenceRange) : 1;
    } else if (analysis.score <= sellThreshold) {
      analysis.decision = 'sell';
      const confidenceRange = maxPossibleScore - Math.abs(sellThreshold);
      analysis.confidence = confidenceRange > 0 ? Math.min(1, (Math.abs(analysis.score) - Math.abs(sellThreshold)) / confidenceRange) : 1;
    } else {
      analysis.decision = 'neutral';
      analysis.confidence = 0;
    }

    return analysis;
  }, []);

  // --- Charting ---
  const drawChart = useCallback((klines, indicators) => {
    if (!chartRef.current) {
      console.error("Chart canvas ref is null. Cannot draw chart.");
      return;
    }

    const ctx = chartRef.current.getContext('2d');

    // Prepare chart data
    const labels = klines.map((k) => {
      const date = new Date(k[0]);
      return timeframe === '1d' ? date.toLocaleDateString() : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    });

    const closePrices = klines.map(k => parseFloat(k[4]));

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    // Create datasets array dynamically
    const datasets = [
      {
        label: 'سعر الإغلاق',
        data: closePrices,
        borderColor: '#f0b90b',
        borderWidth: 2,
        fill: false,
        yAxisID: 'y-price',
        pointRadius: 0,
        tension: 0.1
      }
    ];

    // Add SMAs if they exist
    if (indicators.sma20?.values?.length > 0) {
      datasets.push({
        label: 'SMA 20',
        data: indicators.sma20.values,
        borderColor: '#28a745',
        borderWidth: 1,
        fill: false,
        yAxisID: 'y-price',
        pointRadius: 0,
        tension: 0.1
      });
    }

    if (indicators.sma50?.values?.length > 0) {
      datasets.push({
        label: 'SMA 50',
        data: indicators.sma50.values,
        borderColor: '#17a2b8',
        borderWidth: 1,
        fill: false,
        yAxisID: 'y-price',
        pointRadius: 0,
        tension: 0.1
      });
    }

    if (indicators.sma200?.values?.length > 0) {
      datasets.push({
        label: 'SMA 200',
        data: indicators.sma200.values,
        borderColor: '#dc3545',
        borderWidth: 1,
        fill: false,
        yAxisID: 'y-price',
        pointRadius: 0,
        tension: 0.1
      });
    }

    // Add Bollinger Bands if they exist
    if (indicators.bollingerbands?.upper?.length > 0) {
      datasets.push({
        label: 'BB Upper',
        data: indicators.bollingerbands.upper,
        borderColor: '#ffc107',
        borderWidth: 1,
        borderDash: [5, 5],
        fill: false,
        yAxisID: 'y-price',
        pointRadius: 0,
        tension: 0.1
      });
    }

    if (indicators.bollingerbands?.lower?.length > 0) {
      datasets.push({
        label: 'BB Lower',
        data: indicators.bollingerbands.lower,
        borderColor: '#ffc107',
        borderWidth: 1,
        borderDash: [5, 5],
        fill: false,
        yAxisID: 'y-price',
        pointRadius: 0,
        tension: 0.1
      });
    }

    // Create new chart
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `${symbol} - ${timeframe} تحليل فني`,
            font: { size: 16 }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          },
          legend: {
            display: true,
            position: 'top',
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'الوقت',
            },
          },
          'y-price': {
            type: 'linear',
            position: 'right',
            display: true,
            title: {
              display: true,
              text: 'السعر (USDT)',
            }
          }
        },
      },
    });
  }, [symbol, timeframe]);

  // --- Main Analysis Function ---
  const analyzeMarket = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const klines = await fetchKlines(symbol, timeframe, CONFIG.api.defaultLimit);

      if (!klines || klines.length < CONFIG.indicators.minDataPoints) {
        throw new Error(`بيانات غير كافية. تم جلب ${klines ? klines.length : 0} شمعة. الحد الأدنى المطلوب ${CONFIG.indicators.minDataPoints}`);
      }

      const prices = klines.map(k => parseFloat(k[4]));
      const currentPrice = prices.length > 0 ? prices[prices.length - 1] : undefined;
      const previousPrice = prices.length > 1 ? prices[prices.length - 2] : undefined;

      if (currentPrice === undefined || previousPrice === undefined || prices.some(isNaN)) {
        throw new Error("فشل في معالجة بيانات الأسعار");
      }

      const indicators = calculateIndicators(klines);
      const analysis = performAnalysis(indicators, currentPrice, previousPrice);

      setResults({
        symbol,
        currentPrice,
        indicators,
        analysis,
        klines
      });

    } catch (error) {
      console.error('Error during market analysis:', error);
      setError(`حدث خطأ أثناء التحليل: ${error.message || 'خطأ غير معروف'}`);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, timeframe, fetchKlines, calculateIndicators, performAnalysis]);

  // --- Effects ---
  useEffect(() => {
    if (results) {
      if (chartRef.current && results.klines && results.indicators) {
        drawChart(results.klines, results.indicators);
      }
    } else {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [results, timeframe, symbol, drawChart]);

  // --- Render ---
  return (
    <div className="container">
      <h1>نظام التداول الآلي المحسن</h1>
      <p style={{ textAlign: 'center', color: '#555' }}>
        * نظام متطور للتحليل الفني مع تحسينات الأداء والوظائف
      </p>

      {/* Controls Panel */}
      <div className="panel controls-panel">
        <div className="control-group">
          <label htmlFor="symbol">اختر زوج التداول:</label>
          <select
            id="symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          >
            {tradingPairs.map(pair => (
              <option key={pair.value} value={pair.value}>{pair.label}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="timeframe">الإطار الزمني:</label>
          <select
            id="timeframe"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
          >
            {timeframes.map(tf => (
              <option key={tf.value} value={tf.value}>{tf.label}</option>
            ))}
          </select>
        </div>

        <button onClick={analyzeMarket} disabled={isLoading}>
          {isLoading ? 'جاري التحليل...' : 'تحليل السوق'}
        </button>
      </div>

      {/* Loading and Error Messages */}
      {isLoading && (
        <div className="panel loading-panel">
          <p>جاري تحليل بيانات السوق... قد يستغرق هذا بضع ثوانٍ</p>
          <div className="loading-bar"></div>
        </div>
      )}

      {error && (
        <div className="panel error-panel">
          <p>{error}</p>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div id="resultsPanel">
          <SignalPanel
            analysis={results.analysis}
            currentPrice={results.currentPrice}
            symbol={results.symbol}
          />

          <div className="panel chart-panel">
            <h2>الرسم البياني مع المؤشرات</h2>
            <div className="chart-container">
              <canvas ref={chartRef}></canvas>
            </div>
          </div>

          <div className="panel details-panel">
            <h2>تفاصيل التحليل</h2>
            <AnalysisDetails signals={results.analysis.signals} />
          </div>
        </div>
      )}

      <p style={{ fontSize: '0.8em', color: '#888', textAlign: 'center', marginTop: '30px' }}>
        إخلاء مسؤولية: هذا التطبيق هو لأغراض توضيحية وتعليمية فقط. لا يعتبر أي تحليل أو إشارة مقدمة توصية مالية.
      </p>
    </div>
  );
};

// --- Helper Components ---
const SignalPanel = ({ analysis, currentPrice, symbol }) => {
  if (!analysis) return null;

  const signalClass = `${analysis.decision}-signal`;

  return (
    <div className={`panel signal-panel ${signalClass}`}>
      <h2>توصية التداول</h2>
      {analysis.decision === 'buy' ? (
        <div>
          <h3 style={{ color: '#28a745' }}>إشارة شراء قوية!</h3>
          <p>السعر الحالي: {currentPrice !== undefined ? currentPrice.toFixed(4) : 'N/A'} USDT</p>
          <p>ثقة النظام: {Math.round(analysis.confidence * 100)}%</p>
          <p>إشارات إيجابية: {analysis.signals.filter(s => s.signal === 'buy').length}/{analysis.signals.length}</p>
          {currentPrice !== undefined && <p>اقتراح: شراء {symbol.replace('USDT', '')} مع وقف خسارة عند {(currentPrice * 0.95).toFixed(4)} (-5%)</p>}
        </div>
      ) : analysis.decision === 'sell' ? (
        <div>
          <h3 style={{ color: '#dc3545' }}>إشارة بيع قوية!</h3>
          <p>السعر الحالي: {currentPrice !== undefined ? currentPrice.toFixed(4) : 'N/A'} USDT</p>
          <p>ثقة النظام: {Math.round(analysis.confidence * 100)}%</p>
          <p>إشارات سلبية: {analysis.signals.filter(s => s.signal === 'sell').length}/{analysis.signals.length}</p>
          {currentPrice !== undefined && <p>اقتراح: بيع {symbol.replace('USDT', '')} مع وقف خسارة عند {(currentPrice * 1.05).toFixed(4)} (+5%)</p>}
        </div>
      ) : (
        <div>
          <h3 style={{ color: '#17a2b8' }}>لا توجد إشارة واضحة</h3>
          <p>السعر الحالي: {currentPrice !== undefined ? currentPrice.toFixed(4) : 'N/A'} USDT</p>
          <p>ثقة النظام: {Math.round(analysis.confidence * 100)}%</p>
          <p>إشارات متضاربة أو غير حاسمة</p>
          <p>اقتراح: الانتظار حتى تظهر إشارة أكثر وضوحاً</p>
        </div>
      )}
    </div>
  );
};

const AnalysisDetails = ({ signals }) => {
  if (!signals) return null;

  return (
    <div className="analysis-details-table">
      <table>
        <thead>
          <tr>
            <th>المؤشر</th>
            <th>القيمة</th>
            <th>التفسير</th>
            <th>الإشارة</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((signal, index) => (
            <tr key={index}>
              <td>{signal.name}</td>
              <td>{signal.value !== undefined ? signal.value : 'N/A'}</td>
              <td>
                {signal.name === 'الاتجاه (SMAs)' ? (
                  signal.value === 'صاعد' ? 'اتجاه صعودي قوي' :
                  signal.value === 'هابط' ? 'اتجاه هبوطي قوي' : 'اتجاه غير محدد'
                ) : signal.name === 'RSI' ? (
                  signal.value !== 'بيانات غير كافية' ? (
                    parseFloat(signal.value) < 30 ? 'ذروة بيع محتملة' :
                    parseFloat(signal.value) > 70 ? 'ذروة شراء محتملة' : 'في النطاق المحايد'
                  ) : 'بيانات غير كافية'
                ) : signal.name === 'تقاطع المتوسطات (20/50)' ? (
                  signal.signal === 'buy' ? 'تقاطع صعودي بين المتوسطات' :
                  signal.signal === 'sell' ? 'تقاطع هبوطي بين المتوسطات' : 'لا يوجد تقاطع حديث'
                ) : signal.name === 'MACD' ? (
                  signal.signal === 'buy' ? 'زخم صعودي' :
                  signal.signal === 'sell' ? 'زخم هبوطي' : 'زخم محايد'
                ) : signal.name === 'حجم التداول' ? (
                  signal.signal === 'buy' ? 'حجم مرتفع مع صعود' :
                  signal.signal === 'sell' ? 'حجم مرتفع مع هبوط' : 'حجم طبيعي'
                ) : signal.name === 'Bollinger Bands' ? (
                  signal.value.includes('علوي') ? 'سعر مرتفع جداً' :
                  signal.value.includes('سفلي') ? 'سعر منخفض جداً' :
                  signal.value.includes('صعودي') ? 'اختراق صعودي' :
                  signal.value.includes('هبوطي') ? 'اختراق هبوطي' : 'داخل النطاق'
                ) : signal.name === 'Stochastic' ? (
                  signal.value.includes('بيع') ? 'ذروة بيع' :
                  signal.value.includes('شراء') ? 'ذروة شراء' : 'في النطاق المحايد'
                ) : signal.name === 'Stochastic Crossover' ? (
                  signal.signal === 'buy' ? 'تقاطع صعودي' :
                  signal.signal === 'sell' ? 'تقاطع هبوطي' : 'لا يوجد تقاطع'
                ) : '---'}
              </td>
              <td>
                {signal.signal === 'buy' ? (
                  <span className="positive">شراء</span>
                ) : signal.signal === 'sell' ? (
                  <span className="negative">بيع</span>
                ) : 'محايد'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Bb;