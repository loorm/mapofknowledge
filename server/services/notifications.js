const db = require('../db');

const TYPE_COLOR = {
  welcome:          'terra',
  knobit_complete:  'sage',
  unit_complete:    'amber',
  credential:       'amber',
  test_result:      'lavender',
  goal_complete:    'sage',
  knowledge_marked: 'terra',
  admin:            'lavender',
  badge:            'amber',
  streak:           'amber',
};

async function notify(userId, type, title, body) {
  if (!userId) return;
  const iconColor = TYPE_COLOR[type] || 'terra';
  try {
    await db.execute(
      `INSERT INTO notifications (user_id, type, title, body, icon_color)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, type, title, body || null, iconColor]
    );
  } catch (err) {
    console.error('[notifications]', err.message);
  }
}

module.exports = { notify };
