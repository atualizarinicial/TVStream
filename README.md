# IPTV Player

Um player IPTV moderno e completo para assistir canais ao vivo, filmes e séries.

## Funcionalidades

- 📺 Reprodução de canais ao vivo
- 🎬 Catálogo de filmes e séries
- 📱 Interface responsiva para desktop e mobile
- 🌐 Suporte a múltiplos servidores IPTV
- 🔍 Busca e filtragem de conteúdo
- ⭐ Gerenciamento de favoritos
- 📋 Guia de programação eletrônica (EPG)
- 🕒 Histórico de visualização
- 🌙 Tema escuro
- 🌎 Suporte a múltiplos idiomas

## Tecnologias

- React
- TypeScript
- Vite
- Zustand
- React Router
- Dexie.js (IndexedDB)
- Axios
- HLS.js
- i18next

## Requisitos

- Node.js 16+
- npm ou yarn

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/iptv-player.git
cd iptv-player
```

2. Instale as dependências:
```bash
npm install
# ou
yarn
```

## Executando o projeto

Para iniciar o projeto em modo de desenvolvimento:

```bash
npm run dev
# ou
yarn dev
```

Isso iniciará:
- O servidor de desenvolvimento Vite na porta 5173
- O servidor de proxy na porta 3000

Acesse o aplicativo em: http://localhost:5173

### Credenciais de teste

Em modo de desenvolvimento, você pode usar as seguintes credenciais para login:

- **Usuário**: demo
- **Senha**: demo

## Construindo para produção

Para construir o projeto para produção:

```bash
npm run build
# ou
yarn build
```

Os arquivos serão gerados na pasta `dist`.

## Estrutura do projeto

```
src/
├── components/       # Componentes React
├── lib/
│   ├── hooks/        # Hooks personalizados
│   ├── services/     # Serviços (API, player, etc.)
│   ├── db.ts         # Configuração do banco de dados
│   └── i18n.ts       # Configuração de internacionalização
├── assets/           # Recursos estáticos
└── App.tsx           # Componente principal
```

## Licença

MIT 