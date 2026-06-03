const app    = require('./app');
const fs     = require('fs');
const PORT   = process.env.PORT   || 3000;
const SOCKET = process.env.SOCKET || null;

const target = SOCKET || PORT;

if (SOCKET && fs.existsSync(SOCKET)) fs.unlinkSync(SOCKET);

const server = app.listen(target, () => {
  if (SOCKET) fs.chmodSync(SOCKET, '777');  // allow Apache to write
  console.log(`[MoK] Server listening on ${SOCKET ? 'socket ' + SOCKET : 'port ' + PORT} — ${new Date().toISOString()}`);
});
