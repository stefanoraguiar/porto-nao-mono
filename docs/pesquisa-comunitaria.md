# Pesquisa comunitária (mapa anónimo)

Retrato anónimo da comunidade: convites de uso único, só agregados, gráficos em Quem Somos.

## Variáveis Netlify

| Variável | Função |
|----------|--------|
| `TURSO_DATABASE_URL` | URL da base Turso / libSQL |
| `TURSO_AUTH_TOKEN` | Token de autenticação Turso |
| `PESQUISA_ADMIN_SECRET` | Palavra-passe para gerar códigos em `/admin/pesquisa-invites` |

## Configurar Turso

1. Cria uma base gratuita em [Turso](https://turso.tech/).
2. Copia a URL (`libsql://…`) e um auth token.
3. Define as três variáveis no site Netlify (Site settings → Environment variables).
4. Faz um novo deploy.

As tabelas (`pesquisa_invites`, `pesquisa_totals`, `pesquisa_aggregates`) são criadas automaticamente na primeira utilização.

## Fluxo

1. Abre `/admin/pesquisa-invites`, autentica com `PESQUISA_ADMIN_SECRET`, gera códigos.
2. Partilha cada código **em privado** (não guardes listas com nomes no servidor).
3. Participantes abrem `/pesquisa`, introduzem o código e respondem.
4. Quando houver pelo menos 10 respostas, os gráficos aparecem em `/quem-somos#comunidade`.

## Páginas

- `/pesquisa` — formulário (noindex)
- `/pesquisa/metodologia` — anonimato e RGPD (noindex)
- `/admin/pesquisa-invites` — gerar códigos (noindex)
- `/quem-somos` — equipa + gráficos públicos

Instrumento versionado: `src/data/pesquisa-instrument.mjs` (`community-v1`).
