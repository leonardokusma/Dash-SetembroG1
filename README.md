# Painel ALP · G1 Transportes

Painel de resultado da frota que roda para a ALP (transporte de GLP). Cruza a planilha de faturamento por viagem com os custos por centro de custo do Sienge e mostra, por cavalo, quanto sobra depois do repasse da ALP, combustível, parcela, manutenção e custos de pessoal.

## Como abrir

Dê dois cliques em `index.html`. Abre em qualquer navegador e não precisa de servidor nem de internet; sem internet, só a fonte troca por uma do sistema.

O que tem na tela:

- Filtro por placa no topo. Clicar numa barra ou linha da tabela também filtra. O link com `#PLACA` no final (ex.: `index.html#SEI2B55`) já abre filtrado.
- Indicadores do mês, cascata do faturamento até o resultado, composição por placa, tabela ordenável, faturamento por dia e por destino, custos do Sienge por conta, comparação entre o Livre G1 da planilha e a receita no Sienge, lista de viagens com busca e pontos de atenção.
- Botão de tema claro/escuro.

## Como atualizar para um novo mês

Precisa de Python 3 instalado.

1. Instale a dependência (só na primeira vez):
   ```
   pip install -r requirements.txt
   ```
2. Atualize `dados/sienge.json` com os valores do relatório do Sienge "Fluxo de Caixa por Plano de Contas" (uma linha por conta analítica e por placa; veja o formato abaixo).
3. Gere os dados a partir da planilha:
   ```
   python scripts/gerar_dados.py "C:/caminho/FaturamentoG1ALP.xlsx" --mes "Outubro 2026" --periodo-sienge "22/10/2026 a 07/11/2026"
   ```
   O script avisa se o número de fretes ou o faturamento da aba "Base" não bate com a aba "Faturamento por Placa", ou se alguma placa está sem centro de custo no Sienge.
4. Abra o `index.html` de novo.

### Formato de `dados/sienge.json`

```json
{"centro_custo": "29", "placa": "SEI2B55", "tipo": "Saída", "grupo": "Mão de obra",
 "codigo": "2.01.03.01", "conta": "Salários e Ordenados", "setembro": 0, "outubro": 7346.93, "total": 7346.93}
```

- `tipo`: `Receita` ou `Saída`.
- `grupo` (só saídas): `Mão de obra`, `Veículos`, `Materiais` ou `Tributos`.
- `setembro` / `outubro`: as duas colunas de mês do relatório. Se o período mudar de mês, mantenha os nomes dos campos (o primeiro mês em `setembro`, o segundo em `outubro`) ou ajuste os rótulos em `assets/js/painel.js`.

## Como o resultado é calculado

```
Livre G1  = Faturamento − Repasse ALP (25%) − Combustível − Parcela − Manutenção/IPVA/seguro   (planilha)
Resultado = Livre G1 − saídas do Sienge da mesma placa
```

Premissas:

- Os lançamentos do Sienge (salários, ajuda de custo, pneus, peças, lavagem, materiais, PIS) não estão dentro da coluna "Manutenção e IPVA/seguro" da planilha. Se estiverem, esses custos entram duas vezes.
- O período do Sienge pode pegar lançamentos do mês seguinte (a folha de pagamento, por exemplo).
- Quando o Livre G1 da planilha não bate com a conta acima (ex.: um `+10000` digitado na fórmula), a diferença aparece como "Ajuste manual" na cascata e nos pontos de atenção.

## Estrutura

```
index.html                 página do painel
assets/css/painel.css      visual (cores da G1, tema claro e escuro)
assets/js/calculos.js      cruzamento planilha × Sienge e regras dos pontos de atenção
assets/js/painel.js        gráficos, tabelas e filtro
assets/vendor/             d3 v7.9.0 (cópia local, para funcionar sem internet)
assets/img/logo-g1.png     logo
dados/sienge.json          custos do Sienge (preenchido à mão a partir do PDF)
dados/viagens.json         gerado pelo script
dados/faturamento_placa.json  gerado pelo script
dados/dados.js             gerado pelo script; é o arquivo que a página carrega
scripts/gerar_dados.py     lê a planilha e gera os arquivos acima
```

Os dados são financeiros e têm nomes de motoristas: mantenha o repositório **privado**.
