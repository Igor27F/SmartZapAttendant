const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "bot_database.db");
let db;

function connectDB() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("ERRO ao conectar ao banco:", err.message);
        reject(err);
        return;
      }

      console.log(`INFO: Conectado ao banco: ${dbPath}`);

      const createClientsTable = `
        CREATE TABLE IF NOT EXISTS clients (
          user_id TEXT PRIMARY KEY,
          name TEXT,
          address TEXT,
          preferences TEXT,
          last_updated INTEGER NOT NULL
        );
      `;

      const createMessageHistoryTable = `
        CREATE TABLE IF NOT EXISTS message_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          role TEXT CHECK(role IN ('user', 'model', 'staff')) NOT NULL,
          text TEXT NOT NULL,
          timestamp INTEGER DEFAULT (strftime('%s','now')),
          FOREIGN KEY (user_id) REFERENCES clients(user_id) ON DELETE CASCADE
        );
      `;

      const createLogsTable = `
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT,
          log TEXT NOT NULL,
          type TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES clients(user_id)
        );
      `;

      db.serialize(() => {
        db.exec(createClientsTable, (createErr) => {
          if (createErr) {
            console.error("ERRO ao criar tabela 'clients':", createErr.message);
            return reject(createErr);
          }
          console.log("INFO: Tabela 'clients' pronta.");
        });
        db.exec(createMessageHistoryTable, (createErr) => {
          if (createErr) {
            console.error(
              "ERRO ao criar tabela 'message_history':",
              createErr.message
            );
            return reject(createErr);
          }
          console.log("INFO: Tabela 'message_history' pronta.");
        });
        db.exec(createLogsTable, (createErr) => {
          if (createErr) {
            console.error("ERRO ao criar tabela 'logs':", createErr.message);
            return reject(createErr);
          }
          console.log("INFO: Tabela 'logs' pronta.");

          resolve(db);
        });
      });
    });
  });
}

module.exports = { connectDB };
