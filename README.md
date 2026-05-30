<div align="center">

<img src="public/hawk.svg" alt="Hawk Driver Logo" width="120" />

# Hawk Driver

**Plataforma inteligente de gestão financeira para motoristas de aplicativo**

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![Firebase](https://img.shields.io/badge/Firebase-11.0-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Google Gemini](https://img.shields.io/badge/Gemini_AI-SDK-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)

</div>

---

## Sobre o Projeto

**Hawk Driver** é um dashboard financeiro completo voltado para motoristas de aplicativo (Uber, 99 App e similares) no Brasil. Desenvolvido com foco na realidade do motorista autônomo, o sistema oferece controle total sobre ganhos, despesas, cartões de crédito, patrimônio e saúde financeira, com análises geradas por Inteligência Artificial (Google Gemini).

A plataforma resolve um problema crítico do motorista de app: **entender o real lucro líquido** após todos os custos operacionais (manutenção, combustível, impostos, despesas pessoais e da empresa), separar automaticamente os ganhos em "caixinhas" de destinação e receber insights inteligentes sobre quando e quanto trabalhar.

---

## Funcionalidades

### Ganhos (Uber / Ganhos)
- Registro diário de corridas com km rodados, ganho bruto, gastos e horas trabalhadas
- Seleção de categorias de corrida: UberX, Comfort, Black, 99 App, Flash e Moto
- Cronômetro de jornada integrado com pause/retomada/encerramento
- Distribuição automática dos ganhos em **Caixinhas** configuráveis:
  - Emergência (10% do bruto)
  - Manutenção (10% do bruto)
  - Empresa (30% do líquido)
  - Livre (10% do líquido)
  - Contas (20% do líquido)
  - A Receber (saldo retido pelos apps)
- Gráfico de linha mensal com ganhos, gastos e número de viagens
- Gráfico de pizza com distribuição das caixinhas
- Histórico de registros agrupado por mês
- Painel de consistência para validação dos dados
- Modal de repasse semanal dos valores pendentes dos apps

### Análise Uber & IA
- Chat com IA (Google Gemini) com contexto completo dos dados financeiros do motorista
- Métricas macro: ganho por hora e ganho por km
- Análise de rentabilidade por dia da semana (gráfico com destaque para fins de semana)
- Ranking de turnos por ganho/hora (Manhã, Tarde, Noite, Madrugada)
- Sugestões de perguntas rápidas para guiar a conversa com a IA
- Exportação de dados históricos como CSV
- Filtro e análise por mês específico

### Termômetro Financeiro
- Dashboard de saúde financeira em tempo real com visual intuitivo
- Indicador "Paz de Espírito": quanto sobraria se todas as contas fossem pagas hoje
- Barra de saúde da empresa com indicador de meses de custo pré-pagos
- Barra de saúde pessoal com detalhamento de despesas por responsável
- Navegação entre meses para análise histórica

### Patrimônio
- Visão consolidada do patrimônio líquido total
- Separação entre patrimônio pessoal e da empresa
- Gerenciamento de saldo bancário e saldo retido nos apps
- Extrato de transações por caixinha com histórico completo
- Modal de depósito/saque com data e motivo

### Despesas Fixas
- CRUD completo de despesas mensais recorrentes
- 13 categorias padrão + categorias personalizadas
- Controle de recorrência com data de início e fim
- Classificação por natureza: Pessoal, Empresa ou Esposa
- Rastreamento de pagamento por mês (pago/não pago)
- Gráfico de distribuição por categoria
- Vinculação a cartões de crédito específicos

### Gastos Variáveis
- Registro de despesas avulsas e esporádicas
- Mesmas funcionalidades de natureza e pagamento das despesas fixas
- Inclusão automática nos cálculos do Termômetro

### Cartões de Crédito
- Cadastro de múltiplos cartões (Mastercard, Visa, Elo, Amex)
- Configuração de limite, data de fechamento e vencimento
- Faturas mensais por cartão com status de pagamento
- Sistema de rateio: distribui o pagamento entre caixinhas (empresa/pessoal/esposa)

### Observações
- Área de anotações livres para insights, metas e registros do dia a dia

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend | React | 18.3.1 |
| Build | Vite | 6.0.0 |
| Estilização | Tailwind CSS | 3.4.17 |
| Backend/DB | Firebase (Auth + Firestore) | 11.0.0 |
| IA | Google Gemini AI SDK | 0.24.1 |
| Gráficos | Recharts | 2.15.0 |
| Markdown | react-markdown | 9.1.0 |
| Calendário | react-calendar | 5.1.0 |
| Email | EmailJS Browser | 4.4.1 |
| Testes | Vitest + Testing Library | 4.1.7 |

---

## Estrutura do Projeto

```
hawk-driver/
├── public/
│   └── hawk.svg                    # Logo da aplicação
├── src/
│   ├── components/
│   │   ├── uber/                   # Subcomponentes do módulo de ganhos
│   │   │   ├── BancoCaixinhas.jsx  # Exibição e configuração das caixinhas
│   │   │   ├── DailyForm.jsx       # Formulário de registro diário
│   │   │   ├── DailySummary.jsx    # Card de resumo do dia selecionado
│   │   │   ├── HistoricoRegistros.jsx # Histórico agrupado por mês
│   │   │   ├── JornadaTimer.jsx    # Cronômetro de jornada
│   │   │   ├── MonthlyChart.jsx    # Gráfico de linha mensal
│   │   │   ├── MonthlySummary.jsx  # Resumo do mês
│   │   │   ├── MotivationalBanner.jsx # Banner com frases motivacionais
│   │   │   ├── PieDistribution.jsx # Gráfico de pizza das caixinhas
│   │   │   └── RepasseModal.jsx    # Modal de repasse semanal
│   │   ├── AnaliseTab.jsx          # Análise IA e métricas avançadas
│   │   ├── CartoesTab.jsx          # Gestão de cartões de crédito
│   │   ├── ConsistenciaPanel.jsx   # Validação de consistência dos dados
│   │   ├── ContasTab.jsx           # Termômetro financeiro
│   │   ├── DespesasFixasTab.jsx    # Despesas mensais recorrentes
│   │   ├── GastosVariaveisTab.jsx  # Gastos avulsos
│   │   ├── ModalCategorias.jsx     # Modal de gerenciamento de categorias
│   │   ├── ModalPagamento.jsx      # Modal de confirmação de pagamento
│   │   ├── NavegacaoMes.jsx        # Navegação entre meses
│   │   ├── ObservacoesTab.jsx      # Anotações livres
│   │   ├── PatrimonioTab.jsx       # Gestão de patrimônio
│   │   ├── SeletorNatureza.jsx     # Seletor Pessoal/Empresa/Todos
│   │   └── UberTab.jsx             # Módulo principal de ganhos
│   ├── contexts/
│   │   └── AuthContext.jsx         # Contexto de autenticação Google
│   ├── tests/
│   │   ├── helpers.test.js         # Testes unitários dos utilitários
│   │   └── setup.js                # Configuração do ambiente de testes
│   ├── utils/
│   │   └── helpers.js              # Funções utilitárias e constantes
│   ├── App.jsx                     # Shell da aplicação com roteamento por abas
│   ├── firebase.js                 # Inicialização do Firebase
│   ├── main.jsx                    # Ponto de entrada React
│   └── index.css                   # Estilos globais
├── .env.example                    # Template de variáveis de ambiente
├── firebase.json                   # Configuração do Firebase CLI
├── firestore.indexes.json          # Índices compostos do Firestore
├── firestore.rules                 # Regras de segurança do Firestore
├── index.html                      # Template HTML
├── package.json                    # Dependências e scripts
├── postcss.config.js               # Configuração PostCSS
├── tailwind.config.js              # Tema customizado Tailwind
└── vite.config.js                  # Configuração Vite + Vitest
```

---

## Modelo de Dados (Firestore)

Todos os dados são isolados por usuário em `usuarios/{uid}/`:

```
usuarios/{uid}/
├── registros/{YYYY-MM-DD}          # Registro diário de ganhos
│   ├── km, totalBruto, gastosGerais
│   ├── totalLiquido, viagens, horarioRodado
│   ├── horaInicio, horaFim, categorias[]
│   └── manutencaoValor, caixinhasEnviadas
├── saldos/atual                    # Snapshot de saldo atual
│   ├── saldoConta, saldoRetidoApps
│   └── emergencia, manutencao, empresa, livre, contas
├── despesas_fixas/{id}             # Despesas mensais recorrentes
│   ├── descricao, categoria, valor, vencimento
│   ├── recorrente, mesFim, anoFim
│   ├── natureza, isEsposa, cartaoId
│   └── pagoPorMes{}
├── despesas_variaveis/{id}         # Gastos avulsos
│   ├── descricao, categoria, valor, data
│   ├── mes, ano, natureza, isEsposa
│   └── cartaoId, pago
├── cartoes/{id}                    # Cartões de crédito
│   ├── nome, bandeira, limiteTotal
│   └── diaFechamento, diaVencimento, cor
├── transacoes_patrimonio/{id}      # Ledger de transações
│   ├── caixinhaId, caixinhaNome
│   ├── tipo (ENTRADA/SAIDA), valor
│   └── motivo, data, criadoEm
└── configuracoes/
    ├── caixinhas                   # Percentuais das caixinhas
    │   └── pctEmergencia, pctManutencao, pctEmpresa, pctLivre, pctContas
    └── ia                          # Configurações da IA
        └── apiKey, tipoVeiculo
```

---

## Pré-requisitos

- **Node.js** 18 ou superior
- **npm** 9 ou superior
- Conta no **Firebase** com projeto configurado (Authentication + Firestore)
- Chave de API do **Google Gemini** (para funcionalidades de IA)

---

## Instalação e Configuração

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd hawk-driver
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Copie o arquivo de exemplo e preencha com seus dados:

```bash
cp .env.example .env
```

Edite o `.env` com as credenciais do seu projeto Firebase:

```env
VITE_FIREBASE_API_KEY=sua_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu_projeto_id
VITE_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
VITE_FIREBASE_APP_ID=seu_app_id
```

### 4. Configure o Firebase

No Console do Firebase, ative:
- **Authentication** > Provedor Google
- **Firestore Database** no modo de produção

Faça o deploy das regras de segurança:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,firestore:indexes
```

### 5. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`.

---

## Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento na porta 3000 |
| `npm run build` | Gera o build de produção em `/dist` |
| `npm run preview` | Visualiza o build de produção localmente |
| `npm run test` | Executa todos os testes uma vez |
| `npm run test:watch` | Executa os testes em modo watch |
| `npm run test:coverage` | Gera relatório de cobertura de testes |

---

## Configuração da IA (Google Gemini)

A funcionalidade de análise com IA requer uma chave de API do Google Gemini:

1. Acesse o [Google AI Studio](https://aistudio.google.com)
2. Gere uma chave de API gratuita
3. Na aba **Análise Uber & IA** do Hawk Driver, clique no ícone de configuração
4. Insira sua chave de API e selecione o tipo de veículo
5. A IA terá acesso aos seus dados e oferecerá insights personalizados

---

## Autenticação

O Hawk Driver utiliza **Google OAuth via Firebase Authentication**. Cada usuário tem seus dados completamente isolados no Firestore através do `uid` da conta Google. Não há compartilhamento de dados entre usuários.

---

## Testes

O projeto usa **Vitest** com **Testing Library** para testes unitários das funções utilitárias:

```bash
# Executar testes
npm run test

# Modo watch (durante desenvolvimento)
npm run test:watch

# Relatório de cobertura
npm run test:coverage
```

Os testes cobrem as funções críticas de cálculo e formatação em `src/utils/helpers.js`.

---

## Deploy

O projeto está configurado para deploy na **Vercel** ou qualquer plataforma que suporte aplicações Vite/React estáticas.

### Deploy na Vercel

1. Conecte o repositório à sua conta Vercel
2. Configure as variáveis de ambiente no painel da Vercel (as mesmas do `.env`)
3. O build será executado automaticamente com `npm run build`

### Deploy manual

```bash
npm run build
# O conteúdo de /dist pode ser servido por qualquer servidor estático
```

---

## Segurança

As regras do Firestore garantem que cada usuário acesse apenas seus próprios dados:

```javascript
// firestore.rules
match /usuarios/{userId}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

Nenhum dado de um usuário é acessível por outro.

---

## Design System

O tema visual do Hawk Driver é baseado em um esquema **dark** com paleta customizada:

| Token | Cor | Uso |
|---|---|---|
| `hawk-green` | `#00d4aa` | Destaques positivos, ganhos |
| `hawk-purple` | `#6c5ce7` | Ações primárias, botões |
| `hawk-red` | `#ff6b6b` | Alertas, gastos, saldo negativo |
| `hawk-yellow` | `#fdcb6e` | Avisos, informações neutras |
| `hawk-blue` | `#74b9ff` | Informações, links |
| `hawk-bg` | `#0a0a0f` | Fundo principal |
| `hawk-card` | `#12121a` | Fundo de cards |

Animações customizadas: `fade-in`, `fade-up`, `float`, `spin-slow`, `pulse-slow`, com efeitos de glow para cards.

---

## Licença

Este projeto é de uso privado. Todos os direitos reservados ao autor.

---

<div align="center">
  Desenvolvido com dedicação para motoristas que constroem seu futuro com trabalho e inteligência.
</div>
