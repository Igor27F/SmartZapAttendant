class Log {
  constructor(dbConnection) {
    if (!dbConnection) {
      throw new Error("Log constructor requires dbConnection");
    }
    this.db = dbConnection;
  }

  async adicionarLog(clientId, texto, tipo) {
    const timestamp = Date.now();
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT INTO logs (user_id, log, type, timestamp) VALUES (?, ?, ?, ?)",
        [clientId, texto, tipo, timestamp],
        (err) => {
          if (err) {
            console.error(`ERRO DB (Log.adicionarLog):`, err);
            return reject(new Error("Falha ao inserir log no banco"));
          }
          console.log(
            `INFO DB (Log.adicionarLog): Log inserido para ${clientId}`
          );
          resolve();
        }
      );
    });
  }

  async listarLogs(clientId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT * FROM logs WHERE user_id = ? ORDER BY timestamp DESC",
        [clientId],
        (err, rows) => {
          if (err) {
            console.error(`ERRO DB (Log.listarLogs):`, err);
            return reject(new Error("Falha ao buscar logs"));
          }
          resolve(rows);
        }
      );
    });
  }
}

module.exports = Log;
