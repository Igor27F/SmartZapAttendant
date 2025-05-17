# 🤖 SmartZap Attendant

**SmartZap Attendant** é um bot inteligente de atendimento via WhatsApp, desenvolvido durante a Imersão da Alura. Ele utiliza inteligência artificial (Gemini) para responder dúvidas de clientes com base nas regras e informações da sua loja.

---

## 🚀 Funcionalidades

- Atendimento automatizado e contextualizado via WhatsApp
- Resposta para mensagens de texto e áudio
- Memória de conversas e preferências dos clientes
- Histórico de mensagens e logs de interações
- Fácil personalização das regras de negócio
- Armazenamento local com SQLite
- Integração com a API Gemini da Google

---

## 🎥 Demonstração em vídeo

[![Clique para assistir ao vídeo](https://img.youtube.com/vi/mKghIDJBKYs/hqdefault.jpg)](https://youtu.be/mKghIDJBKYs)

👉 [Clique aqui para assistir no YouTube](https://youtu.be/mKghIDJBKYs)

---

## 🛠️ Como usar

### 1. Clone ou baixe o repositório

**Via Git:**

```bash
git clone https://github.com/Igor27F/SmartZapAttendant.git
```

**Ou baixe o ZIP diretamente no botão verde `Code > Download ZIP`.**

---

### 2. Instale o Node.js

Se ainda não tiver o Node.js instalado, baixe pelo site oficial:

🔗 [https://nodejs.org/](https://nodejs.org/)

Ou siga este [guia da Alura](https://www.alura.com.br/artigos/como-instalar-node-js-windows-linux-macos).

---

### 3. Instale as dependências

Abra o terminal na pasta do projeto e execute:

```bash
cd bot
npm install
```

---

### 4. Configure os arquivos de cache

O bot precisa de informações da sua loja para responder com precisão. Essas informações são carregadas na memória da IA.

Dentro da pasta `cache`, edite os arquivos:

- `contexto.txt`: coloque informações gerais sobre sua empresa, regras de atendimento, horário de funcionamento etc.
- `produtos.txt`: liste os produtos disponíveis e seus respectivos preços.

> 💡 Quanto mais conteúdo você incluir, melhor será a base de conhecimento da IA.
> Esses arquivos precisam ter um mínimo de tokens para serem salvos no cache do Gemini

---

### 5. Crie o arquivo `.env`

Na pasta `bot`, crie um arquivo `.env` com as seguintes variáveis:

```env
GEMINI_API_KEY=Sua chave da API Gemini (Google AI Studio)
FACEBOOK_APP_ID=ID do seu app criado no Facebook Developer
FACEBOOK_APP_SECRET=Segredo do seu app no Facebook Developer
WHATSAPP_API_TOKEN=Token de acesso à API do WhatsApp (Meta)
WHATSAPP_PHONE_NUMBER_ID=ID do número de telefone configurado na Meta
WHATSAPP_VERIFY_TOKEN=Token de verificação que você definir
WHATSAPP_API_URL=https://graph.facebook.com/v22.0
PORT=3000
NGROK_AUTH_TOKEN=Seu token do Ngrok
```

### 🔎 Como obter essas variáveis?

| Variável                                         | Onde conseguir                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `GEMINI_API_KEY`                                 | [Google AI Studio](https://aistudio.google.com/app/apikey)                    |
| `FACEBOOK_APP_ID` e `FACEBOOK_APP_SECRET`        | [Meta for Developers](https://developers.facebook.com/) ao criar um app       |
| `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | No painel da [Meta Cloud API](https://developers.facebook.com/docs/whatsapp/) |
| `WHATSAPP_VERIFY_TOKEN`                          | Você define o valor que quiser para esse token                                |
| `WHATSAPP_API_URL`                               | Use `https://graph.facebook.com/v22.0` (ou a versão mais recente da Meta API) |
| `PORT`                                           | Porta de execução local (padrão: 3000)                                        |
| `NGROK_AUTH_TOKEN`                               | [Ngrok Dashboard](https://dashboard.ngrok.com/) após criar uma conta gratuita |

---

### 6. Execute o bot

No terminal, dentro da pasta `bot`, execute:

```bash
node server.js
```

Se tudo estiver certo, o bot estará rodando e pronto para receber mensagens!

---

## 💬 Como testar

1. Use o número de telefone configurado no app da Meta(pode ser o número de teste).
2. Envie uma mensagem via WhatsApp para esse número.
3. O bot responderá com base no contexto e nos produtos fornecidos.

---

## 📂 Estrutura do projeto

```
SmartZapAttendant/
├── bot/
│   ├── node_modules/
│   ├── .env
│   ├── .gitignore
│   ├── bot_logic.js
│   ├── Client.js
│   ├── db.js
│   ├── package-lock.json
│   ├── package.json
│   └── server.js
├── cache/
│   ├── contexto.txt
│   └── produtos.txt
└── README.md
```

---

## 🧠 Tecnologias utilizadas

- [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/)
- [SQLite3](https://www.sqlite.org/index.html)
- [Ngrok](https://ngrok.com/)
- [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/)
- [Gemini API (Google AI)](https://aistudio.google.com/)

---

## 📌 Contribuição

Sinta-se à vontade para contribuir com melhorias, ajustes e novas funcionalidades!

---

## 👨‍💻 Autor

Desenvolvido por **Igor Henrique F. da Rocha**, engenheiro da computação e entusiasta em IA e automações.

---

## 🏆 Projeto participante da Imersão Alura

Este projeto faz parte da **Imersão Alura**, um evento para desenvolvedores que buscam criar soluções reais e impactantes com tecnologia moderna.
