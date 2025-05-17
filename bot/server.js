require("dotenv").config();
const express = require("express");
const axios = require("axios"); // Para enviar respostas
const ngrok = require("ngrok");

const { connectDB } = require("./db");
const Client = require("./Client.js");
const Log = require("./Log.js");
const {
  setupStaticCache,
  callGenerateContentWithCache,
} = require("./bot_logic.js");

const app = express();

// Middleware para parsear JSON do corpo das requisições POST da Meta/BSP
app.use(express.json());

let db = null;

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN; // Token que VOCÊ define na Meta/BSP
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN; // Token de acesso permanente gerado
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID; // ID do número de telefone registrado
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID; // ID do aplicativo do Facebook (Meta Cloud API ou BSP)
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET; // Segredo do aplicativo do Facebook (Meta Cloud API ou BSP)
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL; // URL da API do WhatsApp (Meta Cloud API ou BSP)
const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN; // Token de autenticação do ngrok
const PORT = process.env.PORT || 3000; // Porta padrão ou a definida no .env

function checkOpeningHours() {
  const agora = new Date();
  const diaSemana = agora.getDay(); // 0 = Domingo, 6 = Sábado
  const hora = agora.getHours();

  const horarioAberto = {
    // Segunda a Sábado (1 a 6): 7h às 19h
    1: { inicio: 7, fim: 19 },
    2: { inicio: 7, fim: 19 },
    3: { inicio: 7, fim: 19 },
    4: { inicio: 7, fim: 19 },
    5: { inicio: 7, fim: 19 },
    6: { inicio: 7, fim: 19 },
    // Domingo (0): 7h às 13h
    0: { inicio: 7, fim: 14 },
  };

  const hojeAbre = horarioAberto[diaSemana];

  return hojeAbre && hora >= hojeAbre.inicio && hora < hojeAbre.fim;
}

app.get("/webhook", (req, res) => {
  console.log("INFO: Recebido request GET para verificação de webhook");
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode &&
    token &&
    mode === "subscribe" &&
    token === WHATSAPP_VERIFY_TOKEN
  ) {
    console.log("INFO: Webhook verificado com sucesso!");
    res.status(200).send(challenge);
  } else {
    console.warn("WARN: Falha na verificação do webhook.");
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "whatsapp_business_account") {
    // Iterar sobre as entradas (pode haver mais de uma em batch)
    body.entry?.forEach((entry) => {
      entry.changes?.forEach(async (change) => {
        if (change.field === "messages" && change.value.messages) {
          change.value.messages.forEach(async (message) => {
            if (message.type === "text" || message.type === "audio") {
              const senderId = message.from;
              const timestamp = parseInt(message.timestamp, 10) * 1000;
              const dataHora = new Date(timestamp).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              });

              if (message.type === "text") {
                console.log(
                  `INFO: Mensagem recebida de ${senderId} em ${dataHora}: ${message.text.body}`
                );
              } else if (message.type === "audio") {
                console.log(
                  `INFO: Mensagem de áudio recebida de ${senderId} em ${dataHora}`
                );
              }

              try {
                const botResponseText = await processIncomingMessage(
                  senderId,
                  message,
                  message.type,
                  timestamp
                );

                if (botResponseText) {
                  console.log(
                    `INFO: Enviando resposta para ${senderId}: ${botResponseText}`
                  );
                  await sendWhatsAppMessage(senderId, botResponseText);
                } else {
                  console.log(
                    `INFO: Ocorreu um erro ao gerar a resposta para ${senderId}.`
                  );
                }
              } catch (error) {
                console.error(`ERRO no processamento para ${senderId}:`, error);
              }
            } else {
              console.log(
                `INFO: Ignorando mensagem que não é de texto nem de voz de ${senderId} (tipo: ${message.type})`
              );
            }
          });
        }
      });
    });
    res.sendStatus(200);
  } else {
    console.log("WARN: Recebido POST não reconhecido no webhook.");
    res.sendStatus(404);
  }
});

async function processIncomingMessage(
  userId,
  userMessage,
  messageType,
  timestamp
) {
  // if (!checkOpeningHours()) {
  //   return "Desculpe, estamos fechados...";
  // }

  var messageContent = null;

  const client = new Client(userId, db);
  await client.loadData();

  const recentHistory = await client.getRecentHistory();

  if (messageType === "text") {
    messageContent = userMessage.text.body;
  } else if (messageType === "audio") {
    const mediaResponse = await axios.get(
      `${WHATSAPP_API_URL}/${userMessage.audio.id}`,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
        },
      }
    );
    if (!mediaResponse?.data?.url) {
      console.error(`ERRO: Não foi possível obter o áudio para ${userId}.`);
      return null;
    }

    const audioRes = await axios.get(mediaResponse.data.url, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
      },
      responseType: "arraybuffer",
    });

    if (!audioRes.data) {
      console.error(`ERRO: Não foi possível baixar o áudio para ${userId}.`);
      return null;
    }

    const audioBuffer = Buffer.from(audioRes.data);
    messageContent = audioBuffer.toString("base64");
    if (!messageContent) {
      console.error(`ERRO: Não foi possível processar o áudio para ${userId}.`);
      return null;
    }
  }

  const rawLlmResponse = await callGenerateContentWithCache(
    recentHistory,
    messageContent,
    client.name,
    client.address,
    client.preferences,
    messageType,
    timestamp
  );

  if (!rawLlmResponse) {
    console.log(`WARN: Nenhuma resposta gerada pela IA para ${userId}.`);
    return null;
  }

  try {
    const resposta = JSON.parse(rawLlmResponse);

    if (!resposta || typeof resposta.replyToUser !== "string") {
      console.error(
        `ERRO: Resposta JSON da IA inválida ou sem 'replyToUser' para ${userId}. Resposta:`,
        rawLlmResponse
      );
      throw new Error("Formato de resposta JSON inválido da IA.");
    }

    const replyToSend = resposta.replyToUser;

    if (messageType === "audio") {
      messageContent = resposta.transcription
        ? resposta.transcription
        : "mensagem de áudio sem transcrição";
    }

    if (resposta?.updatedData) {
      const log = new Log(db);
      let dataWasUpdated = false;
      if (
        resposta.updatedData.name &&
        client.name !== resposta.updatedData.name
      ) {
        client.name = resposta.updatedData.name;
        await log.adicionarLog(
          userId,
          `Nome atualizado para ${client.name}`,
          "Nome atualizado"
        );
        dataWasUpdated = true;
      }
      if (
        resposta.updatedData.address &&
        client.address !== resposta.updatedData.address
      ) {
        client.address = resposta.updatedData.address;
        await log.adicionarLog(
          userId,
          `Endereço atualizado para ${client.address}`,
          "Endereço atualizado"
        );
        dataWasUpdated = true;
      }
      if (resposta.updatedData.preference) {
        const newPref = resposta.updatedData.preference;
        if (!client.preferences || !client.preferences.includes(newPref)) {
          client.preferences = client.preferences
            ? `${client.preferences}; ${newPref}`
            : newPref;
          await log.adicionarLog(
            userId,
            `Preferências atualizadas para ${client.preferences}`,
            "Preferências atualizado"
          );
          dataWasUpdated = true;
        }
      }
      if (dataWasUpdated)
        console.log(`INFO: Dados atualizados no objeto Client para ${userId}`);
    }
    client.addToHistory(messageContent, replyToSend, timestamp);

    await client.save();

    return replyToSend;
  } catch (error) {
    console.error(
      `ERRO ao processar/parsear resposta JSON da IA ou salvar cliente ${userId}:`,
      error.message || error
    );
    console.error("Resposta crua da IA que causou o erro:", botResponseText);
    return null;
  }
}

async function sendWhatsAppMessage(to, text) {
  const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const headers = {
    Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
    "Content-Type": "application/json",
  };
  const data = {
    messaging_product: "whatsapp",
    to: to,
    type: "text",
    text: { body: text },
  };

  try {
    await axios.post(url, data, { headers: headers });
    console.log(`INFO: Mensagem enviada com sucesso para ${to}`);
  } catch (error) {
    console.error(
      `ERRO ao enviar mensagem para ${to}:`,
      error.response ? error.response.data : error.message
    );
  }
}

async function atualizarWebhookWhatsApp(webhookUrl) {
  try {
    const response = await axios({
      method: "post",
      url: `${WHATSAPP_API_URL}/${FACEBOOK_APP_ID}/subscriptions`,
      params: {
        access_token: `${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`,
      },
      data: {
        object: "whatsapp_business_account",
        callback_url: webhookUrl + "/webhook",
        verify_token: WHATSAPP_VERIFY_TOKEN,
        fields: "messages",
      },
    });
    return response.status === 200;
  } catch (error) {
    console.error(
      "Erro ao atualizar webhook:",
      error.response?.data || error.message
    );
    return false;
  }
}

async function initializeApp() {
  try {
    console.log("INFO: Iniciando conexão com DB...");
    db = await connectDB();
    console.log("INFO: Iniciando configuração do Cache Estático...");
    const staticCacheName = await setupStaticCache();
    console.log("-".repeat(50));

    if (!staticCacheName) {
      console.error("ERRO FATAL: Cache estático não pôde ser criado.");
      process.exit(1);
    }

    app.listen(PORT, async () => {
      console.log(`INFO: Servidor rodando e ouvindo na porta ${PORT}`);
      console.log(
        `INFO: Endpoint do Webhook: http://localhost:${PORT}/webhook`
      );
      try {
        await ngrok.kill();

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const ngrokUrl = await ngrok.connect({
          addr: PORT,
          authtoken: NGROK_AUTH_TOKEN,
        });

        console.log(`Webhook público disponível em: ${ngrokUrl}`);

        const webhookAtualizado = await atualizarWebhookWhatsApp(ngrokUrl);

        if (webhookAtualizado) {
          console.log("Webhook do WhatsApp atualizado com sucesso!");
        } else {
          console.log("Não foi possível atualizar o webhook automaticamente.");
        }
      } catch (error) {
        console.error("Erro ao iniciar ngrok:", error);
      }
    });
  } catch (err) {
    console.error("ERRO FATAL na inicialização:", err);
    process.exit(1);
  }
}

initializeApp();
