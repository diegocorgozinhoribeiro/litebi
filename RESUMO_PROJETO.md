# LiteBI — Resumo do Projeto

## Visão geral

O LiteBI é uma plataforma web de Business Intelligence voltada para transformar planilhas em dashboards interativos sem exigir programação, SQL ou conhecimento avançado em análise de dados.

O usuário envia uma base em Excel ou CSV, descreve o significado das informações e pode montar o relatório manualmente ou utilizar inteligência artificial para criar uma estrutura analítica completa. Os dashboards podem ser personalizados, exportados como HTML independente, publicados por link e compartilhados com outras pessoas ou equipes.

## Proposta de valor

O projeto busca reduzir o caminho entre uma planilha e um relatório apresentável. Em vez de configurar bancos, consultas, ferramentas complexas e servidores de visualização, o usuário realiza todo o processo em uma única plataforma:

1. Envia a base de dados.
2. Confirma os tipos e significados das colunas.
3. Define o objetivo da análise.
4. Organiza o relatório em até oito abas temáticas.
5. Gera os indicadores com IA ou monta os componentes manualmente.
6. Personaliza a identidade visual.
7. Exporta ou publica o resultado.

## Principais funcionalidades

### Importação e interpretação de dados

- Suporte a arquivos `.xlsx`, `.xls` e `.csv`.
- Limite visual de upload de até 30 MB.
- Detecção automática de números, moedas, percentuais, datas, categorias e textos.
- Prévia dos registros antes da criação do dashboard.
- Campos para descrever a base, o foco da análise e o significado de cada coluna.
- Persistência local de bases maiores por meio de IndexedDB.

### Relatórios organizados por abas

- Cada relatório pode ter entre uma e oito abas.
- Uma aba chamada **Visão geral** é criada por padrão.
- O usuário pode definir os nomes antes de enviar o contexto para a IA.
- No editor manual é possível adicionar, renomear e excluir abas.
- Cada componente pertence a uma aba específica.
- A base de dados e os filtros permanecem compartilhados entre as abas.
- Dashboards antigos são migrados para uma única aba ao serem abertos no editor.

### Geração com inteligência artificial

- A chave da OpenAI permanece exclusivamente no backend.
- O navegador envia somente contexto compacto: esquema, descrições, foco e pequenas amostras.
- A IA organiza cada aba em torno de um assunto analítico distinto.
- Para cada aba, o contrato atual solicita três KPIs, quatro gráficos e uma tabela.
- A geração evita repetir o mesmo indicador em assuntos diferentes.
- Nomes técnicos são interpretados em linguagem de negócio.
- Exemplo: `home_goals` pode ser apresentado como **Total de gols do mandante**.
- Descrições fornecidas pelo usuário possuem prioridade na nomenclatura.
- Caso a IA retorne componentes incompatíveis, o frontend valida a resposta e utiliza alternativas locais quando possível.

### Editor manual de dashboards

- Criação de KPIs, gráficos, tabelas e filtros.
- Grid de seis colunas com movimentação e redimensionamento.
- Bandeja de componentes ainda não posicionados.
- Duplicação, edição, remoção e reorganização de componentes.
- Salvamento automático no navegador.
- Componentes novos são inseridos na aba atualmente selecionada.
- Perfis de acesso como dono, editor e visualizador.

### Indicadores e visualizações

- KPIs de soma, média, mínimo, máximo, contagem e valores distintos.
- Indicadores de diferença, crescimento, redução e destaque por categoria.
- Gráficos de linha, coluna, barras e pizza.
- Tabelas com seleção de colunas, ordenação e limite de registros.
- Filtros para números, datas e textos.
- Nomenclatura semântica em títulos, subtítulos, legendas e cabeçalhos.

### Personalização visual

- Escolha de cores principal e secundária.
- Seleção da fonte do relatório.
- Título e subtítulo personalizados.
- Upload de logo da empresa.
- Light mode e dark mode na aplicação.
- Interface responsiva para desktop e dispositivos móveis.
- Identidade visual baseada no azul e turquesa da marca LiteBI.

### Exportação e publicação

- Exportação do dashboard como um único arquivo HTML.
- Dados, estilos, estrutura de abas e logo incorporados ao arquivo.
- O relatório exportado pode ser aberto fora da plataforma.
- Publicação de dashboards em URLs no formato `/d/:slug`.
- Dashboards públicos podem ser acessados por qualquer pessoa com o link.
- Dashboards privados exigem autenticação e permissão.
- Relatórios publicados exibem um acesso de retorno ao LiteBI.
- Proteções adicionais evitam alterações indevidas dos scripts por serviços de proxy.

### Contas e autenticação

- Cadastro por e-mail e senha.
- Login com Google OAuth 2.0.
- Senhas protegidas com bcrypt.
- Sessões armazenadas no PostgreSQL.
- Perfil com nome, biografia e imagem.
- Pesquisa de usuários e sistema de amizades.
- Exclusão definitiva da conta e dos dados relacionados.

### Equipes e colaboração

- Criação e exclusão de equipes.
- Inclusão e remoção de integrantes.
- Papéis e permissões por equipe.
- Compartilhamento de dashboards com acesso de visualização ou edição.
- Donos controlam publicação, exclusão e compartilhamentos.

### LGPD e documentos legais

- Páginas de Termos de Uso e Política de Privacidade.
- Aceite obrigatório no cadastro tradicional e no primeiro acesso pelo Google.
- Registro da data e da versão dos documentos aceitos.
- Acesso aos documentos pelo cadastro e pelo perfil.
- Exclusão da conta disponível ao titular.

Os textos legais funcionam como modelos operacionais e devem passar por revisão jurídica antes de um lançamento comercial definitivo.

## Praticidade e experiência de uso

O LiteBI foi estruturado para atender usuários que conhecem seus dados, mas não necessariamente sabem desenvolver consultas ou configurar ferramentas tradicionais de BI.

Os principais pontos de praticidade são:

- Fluxo guiado desde o upload até a publicação.
- Detecção automática dos tipos de coluna.
- Explicações editáveis para ajudar a IA a interpretar a base.
- Geração completa em vez de criação manual obrigatória.
- Organização por assuntos através de abas.
- Edição visual com arrastar, soltar e redimensionar.
- Salvamento automático durante o trabalho.
- Exportação portátil sem instalação adicional.
- Publicação rápida por link.
- Navegação, componentes e identidade visual compartilhados entre as páginas da aplicação.

## Arquitetura técnica

### Frontend

- HTML, CSS e JavaScript sem framework obrigatório.
- Builder principal em `public/index.html`.
- SheetJS para leitura de Excel e CSV.
- Chart.js para renderização dos gráficos.
- LocalStorage para o estado comum do editor.
- IndexedDB para armazenar bases que excedem a capacidade prática do LocalStorage.
- HTML exportado com runtime próprio e independente.
- Componentes auxiliares separados para navegação, tema, publicação, equipes e perfil.

### Backend

- Node.js 18 ou superior.
- Express para páginas, autenticação e APIs.
- PostgreSQL como banco principal.
- Passport para autenticação local e Google OAuth.
- `connect-pg-simple` para armazenamento das sessões.
- Integração com a OpenAI Responses API para geração dos dashboards.
- Compressão, Helmet e limitação de requisições.

### Banco de dados

O banco mantém, entre outras informações:

- Usuários e dados de perfil.
- Credenciais locais protegidas.
- Aceites legais e versões dos documentos.
- Sessões autenticadas.
- Dashboards, HTML publicado e estado do editor.
- Amizades.
- Equipes e integrantes.
- Compartilhamentos e permissões.

## Segurança e confiabilidade

- Cookies de sessão `httpOnly`.
- Cookies seguros em produção.
- Segredo de sessão obrigatório no ambiente produtivo.
- Senhas nunca armazenadas em texto puro.
- Rate limiting nas rotas de autenticação, IA e publicação.
- Validação de tamanho e estrutura dos dashboards.
- Política de segurança específica para relatórios publicados.
- Chaves de banco, Google e OpenAI mantidas no servidor.
- Endpoint `/healthz` para monitoramento da aplicação e do banco.
- Encerramento controlado do servidor em reinicializações.

## Limites atuais

- Até oito abas por dashboard.
- Até 150 componentes por dashboard.
- Até 100 mil linhas na validação do payload publicado.
- HTML publicado limitado a aproximadamente 12 MB.
- A IA recebe até 60 colunas e três pequenas amostras de registros.
- O desempenho final depende do tamanho da base, da quantidade de componentes e do navegador do usuário.

## Escalabilidade

A aplicação é adequada para uma primeira operação com múltiplos usuários simultâneos porque mantém o servidor sem estado local permanente: sessões e dados ficam no PostgreSQL, permitindo executar mais de uma instância do backend.

Para crescer com segurança, os próximos passos recomendados são:

- Adicionar testes automatizados de integração e interface.
- Separar o builder em módulos menores.
- Adotar fila de processamento para gerações de IA mais longas.
- Armazenar arquivos e HTMLs maiores em object storage.
- Criar cache distribuído para galerias e relatórios públicos.
- Implementar observabilidade com logs estruturados, métricas e alertas.
- Revisar índices e consultas do PostgreSQL conforme o volume real.
- Versionar os formatos de payload e do runtime exportado.

## Estrutura principal do projeto

```text
server.js                     Servidor Express, APIs, publicação e viewer
auth.js                       Autenticação local e Google OAuth
db.js                         PostgreSQL, pool e inicialização das tabelas
legal.js                      Versões dos documentos legais
public/index.html             Builder e runtime dos relatórios
public/cloud.js               Publicação e integração da conta no builder
public/app.css                Sistema visual compartilhado
public/theme.js               Light mode e dark mode
public/dashboards.html        Área inicial e dashboards do usuário
public/profile.html           Perfil, conexões e exclusão da conta
public/termos.html            Termos de Uso
public/privacidade.html       Política de Privacidade
.interface-design/system.md   Padrões visuais e de interação do produto
render.yaml                   Configuração de deploy no Render
```

## Posicionamento do produto

O LiteBI se posiciona como uma alternativa simples e rápida para pessoas e pequenas equipes que precisam transformar dados tabulares em relatórios profissionais. O diferencial está na combinação entre geração assistida por IA, edição visual, relatórios com múltiplas abas, exportação portátil e publicação integrada.

Em sua forma atual, o projeto já funciona como uma plataforma SaaS inicial de criação e hospedagem de dashboards. A evolução natural é fortalecer testes, modularização, observabilidade, cobrança, governança de dados e infraestrutura para arquivos maiores.
