
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'app.db');
const fs = require('fs');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive:true});

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    plan TEXT DEFAULT 'gratuito',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_message TEXT,
    bot_reply TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = {
  createUser: (name, email, password, plan) => {
    const stmt = db.prepare('INSERT INTO users (name, email, password, plan) VALUES (?,?,?,?)');
    const info = stmt.run(name, email, password, plan);
    stmt.finalize();
    return info.lastID;
  },
  getUserByEmail: (email) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  getUserById: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, name, email, plan FROM users WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  saveChat: (userId, userMsg, botReply) => {
    const stmt = db.prepare('INSERT INTO chats (user_id, user_message, bot_reply) VALUES (?,?,?)');
    stmt.run(userId, userMsg, botReply);
    stmt.finalize();
  },
  getAllUsers: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT id, name, email, plan, created_at FROM users', (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
};
