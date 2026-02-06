# SistemaBote

Painel SaaS para bots de automacao (WhatsApp/SMS/Email), com planos e cobranca via Mercado Pago.

## Requisitos
- Node.js 20+
- Firebase (Auth + Firestore)
- Twilio (WhatsApp + SMS)
- Mercado Pago (Pix)
- Docker (opcional, para Postgres/Redis)

## Estrutura
- `apps/api` - Fastify API (webhooks, pagamentos)
- `apps/web` - Next.js painel (cadastro, bots, planos)
- `packages/db` - notas de schema

## Setup rapido (Windows)
1. Instalar deps:
   - `npm.cmd install`

2. Configurar envs:

`apps/web/.env.local`
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_MP_PUBLIC_KEY=...
```

`apps/api/.env`
```bash
PORT=4000
APP_BASE_URL=http://localhost:4000

TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+5511999999999
TWILIO_SMS_NUMBER=+5511999999999

MP_ACCESS_TOKEN=...
MP_PUBLIC_KEY=...
MP_CLIENT_ID=...
MP_CLIENT_SECRET=...

# Firebase Admin (1 das opcoes)
FIREBASE_SERVICE_ACCOUNT=...          # JSON inteiro em uma linha
# ou
FIREBASE_SERVICE_ACCOUNT_BASE64=...   # JSON base64

# MVP simples: vincula todas mensagens a 1 usuario
DEFAULT_TENANT_UID=SEU_UID
```

3. Regras do Firestore (MVP por usuario):
```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

4. Subir API e Web:
   - `npm.cmd run dev:api`
   - `npm.cmd run dev:web`

## Fluxo MVP
1. **Criar conta** em `/signup` e escolher plano.
2. **Bots** em `/bots`:
   - Selecionar bot (limite do plano).
   - Iniciar/Pausar bot.
   - Configurar bot (mensagens, horarios, canais).
3. **Conectar canais** na tela de configuracao do bot:
   - Informar numero do Twilio (WhatsApp/SMS).
   - Copiar UID e colocar em `DEFAULT_TENANT_UID`.
4. **Twilio Webhook**:
   - URL: `https://SEU_DOMINIO/webhooks/twilio`
   - Em local: use ngrok.
5. **Pagamento Pix**:
   - Notificacao aparece quando `paymentDueAt/nextBillingAt` estiver proximo.

## Observacoes importantes
- Se PowerShell bloquear `npm`, use `npm.cmd`.
- WhatsApp no Twilio exige prefixo `whatsapp:+`.
- Se bots nao aparecerem, clique em **Recriar bots padrao** na lista.

## Troubleshooting
- `permission-denied` no Firestore:
  - Regras nao permitem subcolecoes (ver regra acima).
- Bots sumiram:
  - Recriar bots padrao na tela `/bots`.
- Webhook responde “Servico nao configurado”:
  - Falta `FIREBASE_SERVICE_ACCOUNT` no `apps/api/.env`.
