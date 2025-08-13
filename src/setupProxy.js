const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/binance-api',
    createProxyMiddleware({
      target: 'https://api.binance.com',
      changeOrigin: true,
      pathRewrite: {
        '^/binance-api': '/api/v3',
      },
      secure: false,
      onError: (err, req, res) => {
        res.status(500).json({ error: 'فشل الاتصال بالخادم الوسيط' });
      }
    })
  );
};