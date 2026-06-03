const app  = require('./app');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[MoK] Server listening on port ${PORT} — ${new Date().toISOString()}`);
});
