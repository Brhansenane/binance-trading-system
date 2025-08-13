import React, { useState, useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';

const BinanceTradingSystem = () => {
  // State variables
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1d');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  
  // Refs
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // Trading pairs
  const tradingPairs = [
    { value: 'BTCUSDT', label: 'BTC/USDT' },
    { value: 'ETHUSDT', label: 'ETH/USDT' },
    { value: 'BNBUSDT', label: 'BNB/USDT' }
  ];

  // Timeframes
  const timeframes = [
    { value: '1d', label: '1 يوم' },
    { value: '4h', label: '4 ساعات' },
    { value: '1h', label: '1 ساعة' }
  ];

  // Fetch data through multiple endpoints
  const fetchKlines = async (symbol, interval, limit) => {
    const endpoints = [
      'https://api.binance.com',
      'https://api1.binance.com',
      'https://api2.binance.com',
      'https://api3.binance.com'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(
          `${endpoint}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
          {
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              'Accept': 'application/json'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data && data.length >= 50) {
            return data;
          }
        }
      } catch (error) {
        console.warn(`Failed with ${endpoint}, trying next...`);
      }
    }
    throw new Error('جميع نقاط الوصول غير متوفرة في موقعك الجغرافي');
  };

  // Main analysis function
  const analyzeMarket = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const klines = await fetchKlines(symbol, timeframe, 200);
      const prices = klines.map(k => parseFloat(k[4])).filter(Boolean);
      const volumes = klines.map(k => parseFloat(k[5])).filter(Boolean);

      if (prices.length < 50 || volumes.length < 50) {
        throw new Error('بيانات غير كافية للتحليل');
      }

      const currentPrice = prices[prices.length - 1];
      const previousPrice = prices[prices.length - 2];
      
      // ... (أضف هنا دوال حساب المؤشرات الفنية حسب حاجتك)
      
      setResults({
        symbol,
        currentPrice,
        klines,
        dataPoints: prices.length
      });

      drawChart(klines, prices);

    } catch (error) {
      console.error('Analysis error:', error);
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  // Error message handler
  const getErrorMessage = (error) => {
    if (error.message.includes('غير متوفرة في موقعك الجغرافي')) {
      return (
        <div>
          <h4>الخدمة غير متاحة في منطقتك</h4>
          <p>لحل هذه المشكلة:</p>
          <ol>
            <li>استخدم VPN متصل ببلد غير مقيد (مثل سويسرا أو سنغافورة)</li>
            <li>جرب تحديث الصفحة بعد تفعيل VPN</li>
            <li>إذا استمرت المشكلة، تواصل مع دعم Binance</li>
          </ol>
        </div>
      );
    }
    return error.message;
  };

  // Draw chart
  const drawChart = (klines, prices) => {
    const ctx = chartRef.current?.getContext('2d');
    if (!ctx) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const labels = klines.map(k => {
      return new Date(k[0]).toLocaleDateString();
    });

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'سعر الإغلاق',
          data: prices,
          borderColor: '#f0b90b',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'الرسم البياني لسعر الإغلاق'
          }
        }
      }
    });
  };

  // UI Components
  const RegionWarning = () => (
    <div className="region-warning">
      <h3>تنبيه جغرافي</h3>
      <p>للاستمرار في استخدام التطبيق:</p>
      <ul>
        <li>استخدم VPN (مثل NordVPN أو ExpressVPN)</li>
        <li>جرب سيرفرات بديلة</li>
        <li>تواصل مع الدعم الفني</li>
      </ul>
    </div>
  );

  return (
    <div className="container" style={{ 
      fontFamily: 'Arial', 
      direction: 'rtl', 
      padding: '20px',
      maxWidth: '1000px',
      margin: '0 auto'
    }}>
      <h1 style={{ color: '#f0b90b', textAlign: 'center' }}>
        نظام التداول الآلي
      </h1>
      
      <div className="panel" style={{ 
        background: '#f9f9f9', 
        padding: '15px', 
        borderRadius: '5px',
        margin: '20px 0'
      }}>
        <label style={{ fontWeight: 'bold' }}>اختر زوج التداول:</label>
        <select 
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          style={{ 
            padding: '8px',
            margin: '0 10px',
            borderRadius: '4px'
          }}
        >
          {tradingPairs.map(pair => (
            <option key={pair.value} value={pair.value}>
              {pair.label}
            </option>
          ))}
        </select>
        
        <label style={{ fontWeight: 'bold' }}>الإطار الزمني:</label>
        <select 
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          style={{ 
            padding: '8px',
            margin: '0 10px',
            borderRadius: '4px'
          }}
        >
          {timeframes.map(tf => (
            <option key={tf.value} value={tf.value}>
              {tf.label}
            </option>
          ))}
        </select>
        
        <button 
          onClick={analyzeMarket}
          style={{ 
            background: '#f0b90b',
            color: 'white',
            border: 'none',
            padding: '10px 15px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          تحليل السوق
        </button>
      </div>
      
      {isLoading && (
        <div className="panel" style={{ textAlign: 'center' }}>
          <p>جاري تحميل البيانات وتحليلها...</p>
        </div>
      )}
      
      {error && (
        <div className="panel" style={{ 
          background: '#ffebee',
          borderLeft: '5px solid #f44336',
          color: '#d32f2f'
        }}>
          {typeof error === 'string' ? error : <RegionWarning />}
        </div>
      )}
      
      {results && (
        <div className="results">
          <div className="panel" style={{ 
            background: '#e6f7ee',
            borderLeft: '5px solid #28a745'
          }}>
            <h2>نتائج التحليل</h2>
            <p>الزوج: {results.symbol}</p>
            <p>السعر الحالي: {results.currentPrice.toFixed(2)} USDT</p>
            <p>عدد نقاط البيانات: {results.dataPoints}</p>
          </div>
          
          <div className="panel">
            <h2>الرسم البياني</h2>
            <div style={{ height: '300px', margin: '20px 0' }}>
              <canvas ref={chartRef}></canvas>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BinanceTradingSystem;