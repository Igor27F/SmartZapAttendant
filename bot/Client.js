class Client {
  constructor(userId, dbConnection) {
    if (!userId || !dbConnection) {
      throw new Error("Client constructor requires userId and dbConnection");
    }
    this.userId = userId;
    this.db = dbConnection;
    this.name = null;
    this.address = null;
    this.preferences = null;
    this.history = [];
    this.loaded = false;
  }

  async loadData() {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT name, address, preferences FROM clients WHERE user_id = ?",
        [this.userId],
        (err, row) => {
          if (err) {
            console.error(
              `ERRO DB (Client.loadData): Falha ao ler dados para ${this.userId}`,
              err
            );
            return reject(new Error("Falha ao ler dados do cliente do DB"));
          }
          if (row) {
            this.name = row.name;
            this.preferences = row.preferences;
            this.address = row.address;
            this.loaded = true;
            console.log(
              `INFO DB (Client.loadData): Dados carregados para ${this.userId}`
            );
          } else {
            console.log(
              `INFO DB (Client.loadData): Cliente novo ou sem dados prévios ${this.userId}.`
            );
            this.loaded = false;
          }
          resolve(this.loaded);
        }
      );
    });
  }

  async addMessageToHistory(role, text, timestamp = Date.now()) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO message_history (user_id, role, text, timestamp)
         VALUES (?, ?, ?, ?)`,
        [this.userId, role, text, timestamp],
        (err) => {
          if (err) {
            console.error(`ERRO DB (addMessageToHistory):`, err);
            return reject(err);
          }
          resolve();
        }
      );
    });
  }

  async addToHistory(userMessage, modelResponseText, timestamp) {
    await this.addMessageToHistory("user", userMessage, timestamp);
    await this.addMessageToHistory("model", modelResponseText);
  }

  async getRecentHistory(limit = 50) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT role, text FROM message_history
         WHERE user_id = ?
         ORDER BY timestamp DESC
         LIMIT ?`,
        [this.userId, limit],
        (err, rows) => {
          if (err) {
            console.error(
              `ERRO DB: Falha ao buscar histórico de ${this.userId}`,
              err
            );
            return reject(new Error("Falha ao buscar histórico"));
          }

          // Inverte o resultado para ordem cronológica correta
          const history = rows.reverse().map((row) => {
            const dataHora = new Date(row.timestamp).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            });
            return {
              role: row.role,
              parts: [{ text: `[${dataHora}] ${row.text}` }],
            };
          });
          resolve(history);
        }
      );
    });
  }

  async save() {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      this.db.run(
        "INSERT OR REPLACE INTO clients (user_id, name, address, preferences, last_updated) VALUES (?, ?, ?, ?, ?)",
        [this.userId, this.name, this.address, this.preferences, timestamp],
        (err) => {
          if (err) {
            console.error(
              `ERRO DB (Client.save): Falha ao salvar dados para ${this.userId}`,
              err
            );
            return reject(new Error("Falha ao salvar dados do cliente no DB"));
          }
          console.log(
            `INFO DB (Client.save): Dados salvos para ${this.userId}`
          );
          resolve();
        }
      );
    });
  }
}

module.exports = Client;
