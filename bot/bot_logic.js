const {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} = require("@google/genai");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
require("dotenv").config();

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const modelName = "gemini-2.0-flash";

let staticCacheName = null; // Armazenará o objeto do cache retornado pela API

const responseSchema = {
  type: "object",
  properties: {
    replyToUser: {
      type: "string",
      description: "Resposta para o usuário",
      nullable: false,
    },
    updatedData: {
      type: "object",
      description:
        "Passar aqui somente os dados que precisam ser atualizados(apenas quando o dado que o cliente informar for diferente do dado salvo)",
      nullable: true,
      properties: {
        name: {
          type: "string",
          description: "Nome do cliente",
          nullable: true,
        },
        address: {
          type: "string",
          description: "Endereço do cliente(precisa ter rua e número)",
          nullable: true,
        },
        preference: {
          type: "string",
          description: "Preferência do cliente",
          nullable: true,
        },
      },
    },
    transcription: {
      type: "string",
      description: "Transcrição do áudio enviado pelo cliente",
      nullable: true,
    },
  },
  required: ["replyToUser"],
};

function horarioFechamento() {
  const agora = new Date();
  const fechamento = new Date(agora);
  fechamento.setHours(20, 0, 0, 0); // Define o horário de fechamento para 20:00:00

  if (agora > fechamento) {
    fechamento.setDate(fechamento.getDate() + 1);
  }
  return fechamento;
}

function getLocalFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  const hexHash = hashSum.digest("hex");
  return Buffer.from(hexHash).toString("base64");
}

async function setupStaticCache() {
  console.log("INFO: Configurando Cache de Contexto Estático via Files API...");
  try {
    let produtosFileObject, contextoFileObject;

    let savedCaches = await genAI.caches.list();
    if (
      savedCaches &&
      savedCaches.pageInternal.length > 0 &&
      savedCaches.pageInternal.some((c) => c.displayName === "Cache Estático")
    ) {
      staticCacheName = savedCaches.pageInternal.find(
        (c) => c.displayName === "Cache Estático"
      ).name;
      console.log("DEBUG: Cache encontrado:", staticCacheName);
    } else {
      console.log("DEBUG: Nenhum cache encontrado, criando um novo...");
      const produtosApiName = "files/produtos";
      const produtosLocalPath = path.join(__dirname, "../cache/produtos.txt");
      const contextoApiName = "files/contexto";
      const contextoLocalPath = path.join(__dirname, "../cache/contexto.txt");
      console.log(
        `INFO: Verificando/uploading ${produtosLocalPath} como ${produtosApiName}...`
      );
      try {
        produtosFileObject = await genAI.files.get({ name: produtosApiName });
        console.log(`INFO: Arquivo ${produtosApiName} encontrado.`);
        const localHash = getLocalFileHash(produtosLocalPath);
        const hashFromAPI = produtosFileObject.sha256Hash;
        if (localHash !== hashFromAPI) {
          // caso o arquivo tenha sido alterado, refazer o upload
          await genAI.files.delete({ name: produtosApiName });
          throw new Error(`Arquivo ${produtosApiName} desatualizado.`);
        }
      } catch (e) {
        if (
          e.message &&
          (e.message.includes(
            "You do not have permission to access the File produtos or it may not exist."
          ) ||
            e.message === `Arquivo ${produtosApiName} desatualizado.`)
        ) {
          console.log(
            `INFO: Arquivo ${produtosApiName} não encontrado ou desatualizado, fazendo upload...`
          );
          produtosFileObject = await genAI.files.upload({
            file: produtosLocalPath,
            config: {
              mimeType: "text/plain",
              name: "produtos",
              expireTime: horarioFechamento(),
            },
          });
          console.log(
            "INFO: Upload de produtos concluído:",
            produtosFileObject.name
          );
        } else {
          throw new Error(
            `Erro ao verificar arquivo ${produtosApiName}: ${e.message}`
          );
        }
      }
      try {
        contextoFileObject = await genAI.files.get({
          name: contextoApiName,
        });
        console.log(`INFO: Arquivo ${contextoApiName} encontrado.`);
        const localHash = getLocalFileHash(contextoLocalPath);
        const hashFromAPI = contextoFileObject.sha256Hash;
        if (localHash !== hashFromAPI) {
          // caso o arquivo tenha sido alterado, refazer o upload
          await genAI.files.delete({ name: contextoApiName });
          throw new Error(`Arquivo ${contextoApiName} desatualizado.`);
        }
      } catch (e) {
        if (
          (e.message &&
            e.message.includes(
              "You do not have permission to access the File contexto or it may not exist."
            )) ||
          e.message === `Arquivo ${contextoApiName} desatualizado.`
        ) {
          console.log(
            `INFO: Arquivo ${contextoApiName} não encontrado ou desatualizado, fazendo upload...`
          );
          contextoFileObject = await genAI.files.upload({
            file: contextoLocalPath,
            config: {
              mimeType: "text/plain",
              name: "contexto",
              expireTime: horarioFechamento(),
            },
          });
          console.log(
            "INFO: Upload de contexto concluído:",
            contextoFileObject.name
          );
        } else {
          throw new Error(
            `Erro ao verificar arquivo ${produtosApiName}: ${e.message}`
          );
        }
      }

      if (
        !produtosFileObject ||
        !produtosFileObject.uri ||
        !contextoFileObject ||
        !contextoFileObject.uri
      ) {
        throw new Error(
          "Falha ao obter URIs válidas para os arquivos na API Files."
        );
      }

      const produtosContentPart = createPartFromUri(
        produtosFileObject.uri,
        produtosFileObject.mimeType
      );

      const contextContentPart = createPartFromUri(
        contextoFileObject.uri,
        contextoFileObject.mimeType
      );

      const contents = [
        createUserContent(produtosContentPart),
        createUserContent(contextContentPart),
      ];

      console.log("INFO: Criando o cache com systemInstruction e contents...");
      const cache = await genAI.caches.create({
        model: modelName,
        config: {
          contents: contents,
          displayName: "Cache Estático",
          description: "Cache de contexto estático para o bot da loja.",
          systemInstruction:
            "Voce é um atendente virtual de loja e deve responder o cliente. Seja sempre gentil e educado. Caso não tenha dados do nome e do endereço do cliente peça quando for conveniente educadamente para ele informar.",
          expireTime: horarioFechamento(),
        },
      });

      if (!cache || !cache.name) {
        throw new Error("Falha ao criar cache estático ou obter o nome.");
      }
      staticCacheName = cache.name;
      console.log(
        `INFO: Cache Estático criado/atualizado com sucesso! Nome: ${staticCacheName}`
      );
    }
    return staticCacheName;
  } catch (error) {
    console.error(
      "ERRO CRÍTICO ao criar/atualizar Cache Estático:",
      error.message || error
    );
    staticCacheName = null;
  }
}

async function callGenerateContentWithCache(
  userHistory,
  userMessage,
  nomeCliente,
  address,
  preferences,
  messageType,
  timestamp
) {
  if (!staticCacheName) {
    console.warn("AVISO: Cache Estático não disponível.");
    return null;
  }

  let retrievedCache;
  try {
    console.log(`DEBUG: Tentando recuperar cache com nome: ${staticCacheName}`);
    retrievedCache = await genAI.caches.get({ name: staticCacheName });
    console.log(
      `DEBUG: Cache recuperado com sucesso. Nome confirmado: ${retrievedCache.name}`
    );

    if (!retrievedCache || !retrievedCache.name) {
      throw new Error("Objeto de cache recuperado é inválido.");
    }
  } catch (error) {
    console.error(
      `ERRO ao recuperar o cache '${staticCacheName}':`,
      error.message || error
    );
    return null;
  }

  try {
    const dataHora = new Date(timestamp).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
    let textoResposta = "";
    let dadosCliente = "";
    var parts = [];

    if (nomeCliente) {
      dadosCliente += `Nome: ${nomeCliente}. `;
    }
    if (address) {
      dadosCliente += `Endereço Conhecido: ${address}. `;
    }
    if (preferences) {
      dadosCliente += `Preferências Anotadas: ${preferences}. `;
    }
    if (dadosCliente == "") {
      textoResposta = "Nenhum dado disponível.";
    } else {
      textoResposta = `Dados do cliente: ${dadosCliente}.`;
    }
    textoResposta += `\nData e Hora da mensagem: ${dataHora}.`;
    if (messageType === "text") {
      textoResposta += `\nMensagem do cliente: ${userMessage}`;
    } else if (messageType === "audio") {
      textoResposta += `\nMensagem do cliente enviada em áudio.`;
      const inlineData = {
        mimeType: "audio/ogg",
        data: userMessage,
      };
      parts.push({ inlineData: inlineData });
    }
    parts.push({ text: textoResposta });

    const currentTurnContent = {
      role: "user",
      parts: parts,
    };
    const fullContentsForGeneration = [...userHistory, currentTurnContent];

    const result = await genAI.models.generateContent({
      model: modelName,
      contents: fullContentsForGeneration,
      config: {
        cachedContent: retrievedCache.name,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
      // Outras configs como safetySettings podem ser adicionadas aqui se necessário
    });

    const response = result.candidates[0].content.parts[0]; // Resposta do bot
    console.log("DEBUG: Resposta do bot:", response);
    if (!response || !response.text || typeof response.text !== "string") {
      throw new Error("Resposta da API inválida.");
    }
    return response.text;
  } catch (error) {
    console.error(
      "Erro durante generateContent com cache:",
      error.message || error
    );
    return null;
  }
}

module.exports = {
  callGenerateContentWithCache,
  setupStaticCache,
};
