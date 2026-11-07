MUNDO DO ESOTERISMO — PRIMEIROS PASSOS

FICHEIROS
- index.html: estrutura da loja
- style.css: visual roxo, preto e dourado
- app.js: catálogo, carrinho, login e encomendas
- config.js: URL/chave pública do Supabase e número WhatsApp
- supabase.sql: tabelas, políticas e função para criar encomendas
- netlify.toml: configuração básica do Netlify

PASSO 1 — CONFIGURAR config.js
Substitui:
COLOCA_AQUI_O_PROJECT_URL
COLOCA_AQUI_A_PUBLISHABLE_KEY
244900000000
pelos teus dados reais. O número WhatsApp deve incluir indicativo do país, apenas algarismos. Exemplo de formato: 2449XXXXXXXX.
A Publishable Key é adequada para uso público no navegador com RLS corretamente configurado. Nunca uses Secret Key ou service_role no site.

PASSO 2 — CONFIGURAR SUPABASE
1. Abre o projeto Supabase.
2. Vai a SQL Editor > New query.
3. Copia todo o conteúdo de supabase.sql, cola e carrega em Run.
4. Regista a tua conta na loja depois de publicar.
5. No SQL Editor, executa o UPDATE comentado no fim do supabase.sql, substituindo TEU_EMAIL_AQUI pelo email da tua conta. Isto dá-te o papel de administrador. Não dês este papel a clientes.

PASSO 3 — PUBLICAR
1. Envia todos estes ficheiros para a raiz do repositório GitHub.
2. No Netlify escolhe Add new site > Import an existing project.
3. Liga o GitHub e escolhe mundo-do-esoterismo.
4. Publish directory: . (ponto). Não é necessário comando de build.
5. Publica e abre o endereço fornecido pelo Netlify.

PAGAMENTOS
Esta versão cria encomendas pendentes. O cliente contacta pelo WhatsApp para receber as instruções de transferência. O administrador deve confirmar o dinheiro na conta bancária antes de marcar a encomenda como paga. Não aceites apenas uma captura de ecrã como prova final.

IMPORTANTE SOBRE DOWNLOADS
O SQL prepara a estrutura de produtos e encomendas, mas a entrega automática de ficheiros ainda não está ativada. Antes de vender ebooks reais, é necessário configurar o bucket privado, a autorização de compra e links temporários de download. Não publiques ficheiros pagos num bucket público.

MOEDA E PREÇOS
Em config.js podes definir CURRENCY como USD ou AOA. Usa a mesma moeda nos preços dos produtos e informa claramente o cliente sobre taxas e dados bancários.

Esta é uma base inicial funcional, não uma loja pronta para receber pagamentos automaticamente. Testa registo, login, catálogo e encomenda com produtos de teste antes de anunciar a loja.
