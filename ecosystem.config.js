module.exports = {
  apps: [{
    name:        'mok-server',
    script:      'server/index.js',
    instances:   1,
    autorestart: true,
    watch:       false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT:     3000,
    },
    error_file:  '/home/virt147958/logs/mok-error.log',
    out_file:    '/home/virt147958/logs/mok-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
