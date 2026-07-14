# LiteBI — Servidor de login e hospedagem de dashboards

Servidor Node/Express que permite cadastrar/entrar (e-mail+senha ou Google), publicar dashboards do LiteBI como **públicos** ou **privados** e compartilhar por link.

## Como funciona

- O builder (`public/index.html`) cria o dashboard no navegador.
- Ao clicar em **✨ Publicar**, o app envia o estado (JSON) + o HTML standalone para o servidor.
- O servidor guarda no Postgres (Neon) e serve em `/d/:slug`.
  - **Público:** qualquer pessoa com o link vê.
  - **Privado:** apenas o dono (logado) vê.

## Estrutura

```
server.js        Express: rotas de auth, API e viewer
db.js            Pool do Postgres + criação das tabelas
auth.js          Passport: e-mail+senha e Google OAuth
public/          Frontend (builder + login/cadastro + meus dashboards + cloud.js)
render.yaml      Blueprint de deploy no Render
.env.example     Modelo das variáveis de ambiente
```

## Rodar localmente

```bash
npm install
cp .env.example .env     # preencha os valores
npm start                # http://localhost:3000
```

Gere o `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | Connection string do Neon (Postgres). |
| `SESSION_SECRET` | sim | Valor aleatório longo para assinar a sessão. |
| `BASE_URL` | sim (p/ Google) | URL pública do site, sem barra final. |
| `NODE_ENV` | recomendado | Use `production` no Render. |
| `PORT` | não | Injetada pelo Render; 3000 localmente. |
| `GOOGLE_CLIENT_ID` | opcional | Habilita login com Google. |
| `GOOGLE_CLIENT_SECRET` | opcional | Habilita login com Google. |

> As tabelas (`users`, `dashboards`, `session`) são criadas automaticamente no primeiro start.

## Deploy no Render

1. Suba este projeto para um repositório Git (GitHub/GitLab).
2. No Render: **New > Blueprint** e aponte para o repositório (usa `render.yaml`).
   - Ou **New > Web Service** com Build `npm install` e Start `npm start`.
3. Em **Environment**, defina:
   - `DATABASE_URL` = sua connection string do Neon.
   - `BASE_URL` = a URL do serviço, ex.: `https://litebi.onrender.com`.
   - `NODE_ENV` = `production`.
   - `SESSION_SECRET` (o Blueprint gera; ou defina manualmente).
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (se for usar Google).
4. Deploy. Acesse a `BASE_URL`.

## Configurar Google OAuth

1. Acesse <https://console.cloud.google.com/apis/credentials>.
2. **Create Credentials > OAuth client ID > Web application**.
3. **Authorized JavaScript origins:** sua `BASE_URL` (ex.: `https://litebi.onrender.com`).
4. **Authorized redirect URIs:** `BASE_URL` + `/auth/google/callback`.
5. Copie o Client ID e Secret para as variáveis de ambiente.

## Segurança

- Senhas são salvas com **bcrypt** (hash, nunca em texto puro).
- Sessões ficam no Postgres (`connect-pg-simple`), com cookie `httpOnly` e `secure` em produção.
- **Nunca** versione o arquivo `.env`. Se uma credencial vazar, rotacione-a (no Neon: Reset password).

## Endpoints principais

| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Builder de dashboards. |
| GET | `/login`, `/signup` | Páginas de acesso. |
| GET | `/dashboards` | Lista os dashboards do usuário (logado). |
| GET | `/d/:slug` | Viewer público/privado do dashboard. |
| POST | `/auth/signup`, `/auth/login`, `/auth/logout` | Autenticação. |
| GET | `/auth/google`, `/auth/google/callback` | OAuth Google. |
| GET | `/api/me` | Usuário atual + flags. |
| POST | `/api/dashboards` | Publica um dashboard. |
| GET | `/api/dashboards` | Lista dashboards do usuário. |
| PATCH | `/api/dashboards/:id` | Atualiza título/visibilidade. |
| DELETE | `/api/dashboards/:id` | Exclui um dashboard. |

### IA OpenAI

O botão de montagem automática usa o endpoint `/api/ai/dashboard`. Configure `OPENAI_API_KEY` e, opcionalmente, `OPENAI_MODEL` (padrão `gpt-5.4-nano`). A chave nunca é enviada ao navegador. O cliente envia somente o esquema da planilha, o foco informado e até três linhas curtas de amostra; a montagem só é concluída quando a IA retorna os componentes válidos.

### Colaboração

Usuários autenticados podem criar equipes, convidar outros usuários pelo e-mail e compartilhar dashboards com permissão de visualização ou edição. A página `/home` reúne dashboards próprios e compartilhados; somente donos e editores podem abrir um dashboard no builder, e somente o dono pode excluir ou gerenciar compartilhamentos.
