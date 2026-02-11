require('dotenv').config();

const app = require('./app');

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[startup] huntress listening on port ${PORT} (env=${process.env.NODE_ENV || 'development'})`);
});
