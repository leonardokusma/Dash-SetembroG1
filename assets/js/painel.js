/* Desenha o painel a partir de window.DADOS (dados/dados.js) e dos cálculos de calculos.js. */
(function () {
  const root = document.querySelector('.g1');
  if (!window.DADOS || !window.d3) {
    root.insertAdjacentHTML('afterbegin', '<div class="erro">Não encontrei os dados do painel. Rode <code>python scripts/gerar_dados.py "caminho/da/planilha.xlsx"</code> para gerar <code>dados/dados.js</code> e abra o index.html de novo.</div>');
    return;
  }
  const D = window.montarPainel(window.DADOS);

  /* ---------- formatos ---------- */
  const LOC = 'pt-BR';
  const F = {
    brl: (v) => v.toLocaleString(LOC, { style: 'currency', currency: 'BRL' }),
    brl0: (v) => v.toLocaleString(LOC, { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
    k: (v) => 'R$ ' + new Intl.NumberFormat(LOC, { notation: 'compact', maximumFractionDigits: 1 }).format(v),
    int: (v) => v.toLocaleString(LOC),
    dec1: (v) => v.toLocaleString(LOC, { maximumFractionDigits: 1, minimumFractionDigits: 1 }),
    t: (v) => v.toLocaleString(LOC, { maximumFractionDigits: 0 }) + ' t',
    pct: (v) => v.toLocaleString(LOC, { style: 'percent', maximumFractionDigits: 1, minimumFractionDigits: 1 }),
    dm: (d) => d.slice(8, 10) + '/' + d.slice(5, 7),
  };
  const sinal = (v) => (v >= 0 ? '+' : '−') + F.k(Math.abs(v));
  const CAT = {
    alp: { nome: 'Repasse ALP', cor: 'var(--g1-alp)' },
    comb: { nome: 'Combustível', cor: 'var(--g1-comb)' },
    parc: { nome: 'Parcela', cor: 'var(--g1-parc)' },
    manut: { nome: 'Manutenção, IPVA e seguro', cor: 'var(--g1-manut)' },
    sienge: { nome: 'Custos do Sienge', cor: 'var(--g1-sienge)' },
    ajuste: { nome: 'Ajuste manual', cor: 'var(--g1-ajuste)' },
    res: { nome: 'Resultado', cor: 'var(--g1-blue)' },
  };

  /* ---------- estado ---------- */
  const placas = D.by_placa.map((p) => p.placa);
  const doHash = decodeURIComponent(location.hash.slice(1));
  const state = { placa: placas.includes(doHash) ? doHash : 'Todas' };
  const setPlaca = (p) => {
    state.placa = p && p !== state.placa ? p : 'Todas';
    history.replaceState(null, '', state.placa === 'Todas' ? location.pathname + location.search : '#' + encodeURIComponent(state.placa));
    render();
  };

  /* ---------- utilidades ---------- */
  const el = (tag, attrs = {}, text) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (text != null) n.textContent = text;
    return n;
  };
  function legend(id, itens) {
    document.getElementById(id).replaceChildren(...itens.map(([nome, cor]) => {
      const s = el('span'); const i = el('i'); i.style.background = cor; s.append(i, nome); return s;
    }));
  }
  function tip(id, ev, head, rows) {
    const t = document.getElementById(id);
    const card = t.closest('.card');
    t.replaceChildren(el('div', { class: 't-h' }, head), ...rows.map(([nome, valor, cor]) => {
      const r = el('div', { class: 't-r' }); const a = el('span');
      if (cor) { const i = el('i'); i.style.background = cor; a.append(i); }
      a.append(nome); r.append(a, el('b', {}, valor)); return r;
    }));
    t.hidden = false;
    const cb = card.getBoundingClientRect();
    let x = ev.clientX - cb.left + 14; let y = ev.clientY - cb.top + 14;
    if (x + t.offsetWidth > cb.width - 8) x = ev.clientX - cb.left - t.offsetWidth - 14;
    if (y + t.offsetHeight > cb.height - 8) y = ev.clientY - cb.top - t.offsetHeight - 14;
    t.style.left = Math.max(8, x) + 'px'; t.style.top = Math.max(8, y) + 'px';
  }
  const hideTip = (id) => { document.getElementById(id).hidden = true; };
  function textW(svg, strs, cls) {
    const g = svg.append('g').attr('opacity', 0); let m = 0;
    strs.forEach((s) => { m = Math.max(m, g.append('text').attr('class', cls || '').text(s).node().getComputedTextLength()); });
    g.remove(); return m;
  }
  function svgIn(id, h) {
    const box = document.getElementById(id);
    box.replaceChildren();
    const w = Math.max(280, box.clientWidth);
    return [d3.select(box).append('svg').attr('width', '100%').attr('height', h).attr('viewBox', `0 0 ${w} ${h}`), w];
  }
  const eixoX = (svg, x, y, alturaGrade, larguraUtil) => svg.append('g').attr('class', 'grid').attr('transform', `translate(0,${y})`)
    .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(larguraUtil / 90))).tickSize(-alturaGrade).tickFormat((v) => F.k(v)))
    .attr('font-size', null).attr('font-family', null).call((g) => g.select('.domain').remove());
  const hit = (svg, y, w, h, onMove, tipId, onClick) => {
    const r = svg.append('rect').attr('class', 'hit').attr('x', 0).attr('y', y).attr('width', w).attr('height', h).style('fill', 'transparent')
      .on('mousemove', onMove).on('mouseleave', () => hideTip(tipId));
    if (onClick) r.on('click', onClick);
    return r;
  };

  /* ---------- cabeçalho, filtro, KPIs ---------- */
  function drawCabecalho() {
    document.getElementById('eyebrow').textContent = `Operação ALP · GLP · ${window.DADOS.mes}`;
    document.title = `G1 · Painel ALP · ${window.DADOS.mes}`;
    document.querySelectorAll('.periodo-sienge').forEach((n) => { n.textContent = window.DADOS.periodo_sienge; });
    document.getElementById('nome-planilha').textContent = window.DADOS.planilha;
    document.getElementById('gerado-em').textContent = window.DADOS.gerado_em;
  }
  function drawFiltro() {
    const mk = (val, label, sub) => {
      const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(state.placa === val) });
      b.append(label); if (sub) b.append(el('small', {}, sub));
      b.addEventListener('click', () => setPlaca(val === 'Todas' ? null : val));
      return b;
    };
    document.getElementById('filtro').replaceChildren(el('span', { class: 'lbl' }, 'Ver:'), mk('Todas', 'Frota toda', placas.length + ' cavalos'),
      ...D.by_placa.slice().sort((a, b) => b.faturamento - a.faturamento).map((p) => mk(p.placa, p.placa, p.motorista)));
  }
  function drawTotais(t, todas) {
    root.querySelectorAll('#kpis [data-field]').forEach((n) => { n.textContent = F[n.dataset.fmt](t[n.dataset.field]); });
    root.querySelectorAll('tfoot [data-total]').forEach((n) => { n.textContent = F[n.dataset.fmt](todas[n.dataset.total]); });
    document.getElementById('kpi-resultado').classList.toggle('neg-bg', t.resultado < 0);
  }
  function drawFrase(t) {
    const b = (txt) => el('b', {}, txt);
    const parts = [];
    if (t.escopo === 'Todas') {
      parts.push(`Os ${t.placas} cavalos da operação ALP faturaram `, b(F.k(t.faturamento)), ` em ${F.int(t.fretes)} fretes. Depois do repasse à ALP, combustível, parcelas, manutenção e dos custos lançados no Sienge, o resultado é `, b(F.k(t.resultado)), `, ${F.pct(t.margem)} do faturamento.`);
    } else {
      const p = D.by_placa.find((x) => x.placa === t.escopo);
      parts.push('A placa ', b(p.placa), ` (${p.motorista}) faturou `, b(F.k(t.faturamento)), ` em ${F.int(t.fretes)} fretes e fechou com resultado de `, b(F.k(t.resultado)), `, ${F.pct(t.margem)} do faturamento. O combustível levou ${F.pct(t.comb_pct)} do que a placa faturou.`);
    }
    if (t.ajuste_planilha) parts.push(` Esse número inclui ${F.k(t.ajuste_planilha)} de ajuste manual na planilha (veja os pontos de atenção).`);
    document.getElementById('takeaway').replaceChildren(...parts);
  }

  /* ---------- cascata ---------- */
  function drawCascata(rows) {
    const n = rows.length; const rowH = 30; const bottom = 26; const h = 6 + n * rowH + bottom;
    const [svg, w] = svgIn('ch-cascata', h);
    const lw = Math.min(w * 0.42, textW(svg, rows.map((r) => r.etapa), 'lbl strong') + 12);
    const vals = rows.map((r) => (r.tipo === 'total' ? F.k(r.valor) : sinal(r.valor)));
    const vw = textW(svg, vals, 'strong') + 10;
    const x = d3.scaleLinear([0, d3.max(rows, (r) => Math.max(r.inicio, r.fim))], [lw, w - vw]);
    const y = (i) => 6 + i * rowH;
    eixoX(svg, x, h - bottom, n * rowH, w - lw - vw);
    const cor = (r) => (r.cat === 'fat' || r.cat === 'res' ? 'var(--g1-blue)' : r.cat === 'livre' ? 'var(--fg)' : CAT[r.cat].cor);
    rows.forEach((r, i) => {
      if (i < n - 1 && rows[i + 1].tipo !== 'total') {
        svg.append('line').attr('x1', x(r.fim)).attr('x2', x(r.fim)).attr('y1', y(i) + rowH - 7).attr('y2', y(i + 1) + 7)
          .style('stroke', 'var(--ref)').attr('stroke-dasharray', '2 2');
      }
      const x0 = x(Math.min(r.inicio, r.fim)); const x1 = x(Math.max(r.inicio, r.fim));
      svg.append('text').attr('class', r.tipo === 'total' ? 'lbl strong' : 'lbl').attr('x', 0).attr('y', y(i) + rowH / 2).attr('dy', '0.35em').text(r.etapa);
      svg.append('rect').attr('x', x0).attr('y', y(i) + 6).attr('width', Math.max(2, x1 - x0)).attr('height', rowH - 12).attr('rx', 3).style('fill', cor(r));
      svg.append('text').attr('class', 'strong').attr('x', x1 + 6).attr('y', y(i) + rowH / 2).attr('dy', '0.35em').text(vals[i]);
      hit(svg, y(i), w, rowH, (ev) => tip('tip-cascata', ev, `${r.etapa} · ${r.fonte}`, [['Valor', F.brl(r.valor)], ['Sobra depois desta etapa', F.brl(r.fim)]]), 'tip-cascata');
    });
  }

  /* ---------- composição por placa ---------- */
  function drawComp() {
    const rows = D.by_placa.slice().sort((a, b) => b.resultado - a.resultado);
    const segs = [['alp', 'repasse_alp'], ['comb', 'combustivel'], ['parc', 'parcela'], ['manut', 'manutencao'], ['sienge', 'custos_sienge'], ['res', 'resultado']];
    const rowH = 34; const bottom = 24; const h = 4 + rows.length * rowH + bottom;
    const [svg, w] = svgIn('ch-comp', h);
    const labels = rows.map((r) => r.placa + (r.ajuste_planilha ? '*' : ''));
    const lw = textW(svg, labels, 'lbl strong') + 12;
    const rw = textW(svg, rows.map((r) => F.pct(r.margem)), 'strong') + 10;
    const x = d3.scaleLinear([0, d3.max(rows, (r) => r.faturamento + r.ajuste_planilha)], [lw, w - rw]);
    eixoX(svg, x, h - bottom, rows.length * rowH, w - lw - rw);
    rows.forEach((r, i) => {
      const yy = 4 + i * rowH;
      const g = svg.append('g').attr('opacity', state.placa === 'Todas' || state.placa === r.placa ? 1 : 0.3);
      g.append('text').attr('class', 'lbl strong').attr('x', 0).attr('y', yy + rowH / 2).attr('dy', '0.35em').text(labels[i]);
      let acc = 0;
      segs.forEach(([cat, f]) => {
        const v = Math.max(0, r[f]); if (!v) return;
        g.append('rect').attr('x', x(acc)).attr('y', yy + 7).attr('width', Math.max(0, x(acc + v) - x(acc) - 1)).attr('height', rowH - 14).attr('rx', 2).style('fill', CAT[cat].cor);
        acc += v;
      });
      g.append('text').attr('class', 'strong').attr('x', x(acc) + 6).attr('y', yy + rowH / 2).attr('dy', '0.35em').style('fill', r.resultado < 0 ? 'var(--bad)' : null).text(F.pct(r.margem));
      hit(svg, yy, w, rowH, (ev) => tip('tip-comp', ev, `${r.placa} · ${r.motorista} · faturou ${F.brl(r.faturamento)}`, [
        ...segs.map(([cat, f]) => [CAT[cat].nome, `${F.brl(r[f])} · ${F.pct(r[f] / r.faturamento)}`, CAT[cat].cor]),
        ...(r.ajuste_planilha ? [['Ajuste manual (entrada)', F.brl(r.ajuste_planilha), CAT.ajuste.cor]] : []),
      ]), 'tip-comp', () => setPlaca(r.placa));
    });
  }

  /* ---------- tabelas ordenáveis ---------- */
  const TEXTO = ['placa', 'motorista', 'cavalo', 'cte', 'carreta', 'origem', 'destino', 'data'];
  const sortState = { 'tb-placas': { key: 'resultado', dir: -1 }, 'tb-viagens': { key: 'data', dir: 1 } };
  function wireSort(id, redraw) {
    document.querySelectorAll(`#${id} thead th`).forEach((th) => th.querySelector('button').addEventListener('click', () => {
      const s = sortState[id]; const k = th.dataset.field;
      s.dir = s.key === k ? -s.dir : (TEXTO.includes(k) ? 1 : -1);
      s.key = k; redraw();
    }));
  }
  function ordena(id, rows) {
    const { key, dir } = sortState[id];
    document.querySelectorAll(`#${id} thead th`).forEach((th) => th.setAttribute('aria-sort', th.dataset.field === key ? (dir > 0 ? 'ascending' : 'descending') : 'none'));
    return rows.slice().sort((a, b) => {
      const va = a[key] ?? -Infinity; const vb = b[key] ?? -Infinity;
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), LOC)) * dir;
    });
  }
  function drawTabelaPlacas() {
    const maxRes = d3.max(D.by_placa, (r) => Math.abs(r.resultado)) || 1;
    document.querySelector('#tb-placas tbody').replaceChildren(...ordena('tb-placas', D.by_placa).map((r) => {
      const tr = el('tr', { class: 'click' + (state.placa === r.placa ? ' sel' : '') });
      const td = (txt, cls) => el('td', cls ? { class: cls } : {}, txt);
      const res = el('td'); const bc = el('span', { class: 'bar-cell' }); const bar = el('i', r.resultado < 0 ? { class: 'neg' } : {});
      bar.style.width = (Math.abs(r.resultado) / maxRes) * 2.5 + 'rem';
      bc.append(bar, el('span', {}, F.brl(r.resultado))); res.append(bc);
      tr.append(td(r.placa + (r.ajuste_planilha ? '*' : ''), 'placa'), td(r.motorista, 'l'), td(F.int(r.fretes)), td(F.dec1(r.peso_t), 'hide-sm'), td(F.brl(r.faturamento)),
        td(F.brl(r.repasse_alp), 'hide-sm'), td(F.brl(r.combustivel), 'hide-sm'), td(F.pct(r.comb_pct), 'hide-sm'), td(F.brl(r.parcela), 'hide-sm'), td(F.brl(r.manutencao), 'hide-sm'),
        td(F.brl(r.livre_g1)), td(F.brl(r.custos_sienge)), res, td(F.pct(r.margem), r.margem < 0 ? 'neg' : ''));
      tr.addEventListener('click', () => setPlaca(r.placa));
      return tr;
    }));
  }
  function drawTabelaViagens() {
    const q = document.getElementById('busca-viagens').value.trim().toLowerCase();
    const rows = D.viagens.filter((v) => (state.placa === 'Todas' || v.cavalo === state.placa) &&
      (!q || [v.destino, v.motorista, v.cte, v.carreta, v.cavalo, v.origem, F.dm(v.data)].join(' ').toLowerCase().includes(q)));
    document.querySelector('#tb-viagens tbody').replaceChildren(...ordena('tb-viagens', rows).map((v) => {
      const tr = el('tr');
      const td = (txt, cls) => el('td', cls ? { class: cls } : {}, txt);
      tr.append(td(F.dm(v.data)), td(v.cavalo, 'l placa'), td(v.motorista, 'l'), td(v.cte, 'l'), td(v.carreta, 'l hide-sm'), td(v.origem, 'l hide-sm'), td(v.destino, 'l'),
        td(v.quantidade_kg ? F.int(v.quantidade_kg) : (v.quantidade_original || '—')), td(F.brl(v.valor_frete)));
      return tr;
    }));
    const total = rows.reduce((a, v) => a + v.valor_frete, 0);
    document.getElementById('viagens-count').textContent = `${rows.length} frete${rows.length === 1 ? '' : 's'} · ${F.brl(total)}`;
  }

  /* ---------- faturamento por dia ---------- */
  function drawDia(rows) {
    const h = Math.max(240, D.por_destino.filter((r) => r.escopo === state.placa).length * 26 - 20); const top = 10; const bottom = 24;
    const [svg, w] = svgIn('ch-dia', h);
    const y = d3.scaleLinear([0, d3.max(rows, (r) => r.valor) || 1], [h - bottom, top]).nice();
    const ticks = y.ticks(4);
    const left = textW(svg, ticks.map((v) => F.k(v))) + 10;
    const x = d3.scaleBand(rows.map((r) => r.dia), [left, w - 4]).padding(0.25);
    svg.append('g').attr('class', 'grid').attr('transform', `translate(${left},0)`)
      .call(d3.axisLeft(y).tickValues(ticks).tickSize(-(w - left - 4)).tickFormat((v) => F.k(v)))
      .attr('font-size', null).attr('font-family', null).call((g) => g.select('.domain').remove()).call((g) => g.selectAll('text').attr('x', -6));
    const passo = w < 480 ? 7 : 3;
    svg.append('g').attr('transform', `translate(0,${h - bottom})`)
      .call(d3.axisBottom(x).tickValues(rows.map((r) => r.dia).filter((_, i) => i % passo === 0)).tickSize(0).tickFormat(F.dm))
      .attr('font-size', null).attr('font-family', null)
      .call((g) => g.select('.domain').style('stroke', 'var(--axis)')).call((g) => g.selectAll('text').attr('dy', '1.1em'));
    rows.forEach((r) => {
      if (r.valor > 0) svg.append('rect').attr('x', x(r.dia)).attr('width', x.bandwidth()).attr('y', y(r.valor)).attr('height', y(0) - y(r.valor))
        .attr('rx', Math.min(4, x.bandwidth() / 2)).style('fill', 'var(--g1-blue)');
      svg.append('rect').attr('class', 'hit').attr('x', x(r.dia) - (x.step() * x.paddingInner()) / 2).attr('width', x.step()).attr('y', top).attr('height', h - bottom - top)
        .style('fill', 'transparent')
        .on('mousemove', (ev) => tip('tip-dia', ev, F.dm(r.dia) + '/' + r.dia.slice(0, 4), [['Fretes', F.int(r.fretes)], ['Faturamento', F.brl(r.valor)]]))
        .on('mouseleave', () => hideTip('tip-dia'));
    });
  }

  /* ---------- barras horizontais simples (destinos) ---------- */
  function drawDestinos(rows) {
    const rowH = 26; const h = rows.length * rowH + 4;
    const [svg, w] = svgIn('ch-dest', h);
    const labels = rows.map((r) => `${r.destino} · ${r.fretes}`);
    const lw = Math.min(w * 0.45, textW(svg, labels, 'lbl') + 10);
    const vw = textW(svg, rows.map((r) => F.k(r.valor)), 'strong') + 8;
    const x = d3.scaleLinear([0, d3.max(rows, (r) => r.valor) || 1], [lw, w - vw]);
    rows.forEach((r, i) => {
      const yy = i * rowH;
      svg.append('text').attr('class', 'lbl').attr('x', 0).attr('y', yy + rowH / 2).attr('dy', '0.35em').text(labels[i]);
      svg.append('rect').attr('x', lw).attr('y', yy + 6).attr('width', Math.max(2, x(r.valor) - lw)).attr('height', rowH - 12).attr('rx', 3)
        .style('fill', i === 0 ? 'var(--g1-blue)' : 'var(--chart-muted)');
      svg.append('text').attr('class', 'strong').attr('x', x(r.valor) + 6).attr('y', yy + rowH / 2).attr('dy', '0.35em').text(F.k(r.valor));
      hit(svg, yy, w, rowH, (ev) => tip('tip-dest', ev, r.destino, [['Fretes', F.int(r.fretes)], ['Faturamento', F.brl(r.valor)], ['Média por frete', F.brl(r.valor / r.fretes)]]), 'tip-dest');
    });
  }

  /* ---------- Sienge por conta ---------- */
  function drawConta(rows) {
    const rowH = 30; const h = Math.max(1, rows.length) * rowH + 4;
    const [svg, w] = svgIn('ch-conta', h);
    const lw = Math.min(w * 0.48, textW(svg, rows.map((r) => r.conta), 'lbl') + 10);
    const vw = textW(svg, rows.map((r) => F.k(r.total)), 'strong') + 8;
    const x = d3.scaleLinear([0, d3.max(rows, (r) => r.total) || 1], [lw, w - vw]);
    rows.forEach((r, i) => {
      const yy = i * rowH;
      svg.append('text').attr('class', 'lbl').attr('x', 0).attr('y', yy + rowH / 2).attr('dy', '0.35em').text(r.conta);
      if (r.setembro > 0) svg.append('rect').attr('x', lw).attr('y', yy + 7).attr('width', Math.max(1, x(r.setembro) - lw - (r.outubro > 0 ? 1 : 0))).attr('height', rowH - 14).attr('rx', 2)
        .style('fill', 'var(--g1-sienge)').style('opacity', 0.5);
      if (r.outubro > 0) svg.append('rect').attr('x', x(r.setembro)).attr('y', yy + 7).attr('width', Math.max(1, x(r.total) - x(r.setembro))).attr('height', rowH - 14).attr('rx', 2)
        .style('fill', 'var(--g1-sienge)');
      svg.append('text').attr('class', 'strong').attr('x', x(r.total) + 6).attr('y', yy + rowH / 2).attr('dy', '0.35em').text(F.k(r.total));
      hit(svg, yy, w, rowH, (ev) => tip('tip-conta', ev, `${r.conta} · ${r.grupo}`, [['Setembro', F.brl(r.setembro)], ['Outubro', F.brl(r.outubro)], ['Total', F.brl(r.total)]]), 'tip-conta');
    });
  }

  /* ---------- conciliação planilha × Sienge ---------- */
  function drawConc(tot) {
    document.getElementById('conc-note').textContent = `Mesma placa, duas fontes. No total, Livre G1 de ${F.brl(tot.livre_g1)} contra ${F.brl(tot.receita_sienge)} de receita no Sienge; por placa a distribuição é bem diferente. O número à direita é Sienge menos planilha.`;
    const rows = D.by_placa.slice().sort((a, b) => (b.receita_sienge - b.livre_g1) - (a.receita_sienge - a.livre_g1));
    const rowH = 36; const bottom = 22; const h = rows.length * rowH + bottom;
    const [svg, w] = svgIn('ch-conc', h);
    const lw = textW(svg, rows.map((r) => r.placa), 'lbl strong') + 10;
    const dif = rows.map((r) => r.receita_sienge - r.livre_g1);
    const vw = textW(svg, dif.map(sinal), 'strong') + 10;
    const x = d3.scaleLinear([0, d3.max(rows, (r) => Math.max(r.livre_g1, r.receita_sienge))], [lw, w - vw]);
    eixoX(svg, x, h - bottom, rows.length * rowH, w - lw - vw);
    rows.forEach((r, i) => {
      const yy = i * rowH;
      const g = svg.append('g').attr('opacity', state.placa === 'Todas' || state.placa === r.placa ? 1 : 0.3);
      g.append('text').attr('class', 'lbl strong').attr('x', 0).attr('y', yy + rowH / 2).attr('dy', '0.35em').text(r.placa);
      g.append('rect').attr('x', lw).attr('y', yy + 6).attr('width', Math.max(1, x(r.livre_g1) - lw)).attr('height', 10).attr('rx', 3).style('fill', 'var(--g1-blue)');
      g.append('rect').attr('x', lw).attr('y', yy + 19).attr('width', Math.max(1, x(r.receita_sienge) - lw)).attr('height', 10).attr('rx', 3).style('fill', 'var(--g1-sienge)');
      g.append('text').attr('class', 'strong').attr('x', x(Math.max(r.livre_g1, r.receita_sienge)) + 6).attr('y', yy + rowH / 2).attr('dy', '0.35em')
        .style('fill', Math.abs(dif[i]) > 5000 ? 'var(--warn)' : null).text(sinal(dif[i]));
      hit(svg, yy, w, rowH, (ev) => tip('tip-conc', ev, `${r.placa} · centro de custo ${r.centro_custo}`, [
        ['Livre G1 (planilha)', F.brl(r.livre_g1), 'var(--g1-blue)'], ['Receita no Sienge', F.brl(r.receita_sienge), 'var(--g1-sienge)'], ['Diferença', F.brl(dif[i])],
      ]), 'tip-conc', () => setPlaca(r.placa));
    });
  }

  /* ---------- pontos de atenção ---------- */
  function drawAlertas() {
    const rank = { alto: 0, medio: 1, baixo: 2 }; const nome = { alto: 'Alto', medio: 'Médio', baixo: 'Baixo' };
    const vis = D.alertas.filter((a) => state.placa === 'Todas' || !a.placa || a.placa.split(',').includes(state.placa)).sort((a, b) => rank[a.nivel] - rank[b.nivel]);
    const box = document.getElementById('lista-alertas');
    box.replaceChildren(...vis.map((a) => {
      const li = el('li');
      li.append(el('span', { class: 'pill ' + a.nivel }, nome[a.nivel]), el('strong', {}, a.titulo), el('p', {}, a.detalhe));
      return li;
    }));
    if (!vis.length) box.replaceChildren(el('li', {}, 'Nenhum ponto de atenção para esta placa.'));
  }

  /* ---------- tema claro/escuro ---------- */
  const btnTema = document.getElementById('tema');
  const escuroAgora = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const rotuloTema = () => { btnTema.textContent = escuroAgora() ? 'Tema claro' : 'Tema escuro'; };
  try { const salvo = localStorage.getItem('g1-tema'); if (salvo) document.documentElement.dataset.theme = salvo; } catch (e) { /* sem storage */ }
  btnTema.addEventListener('click', () => {
    const novo = escuroAgora() ? 'light' : 'dark';
    document.documentElement.dataset.theme = novo;
    try { localStorage.setItem('g1-tema', novo); } catch (e) { /* sem storage */ }
    rotuloTema();
  });
  rotuloTema();

  /* ---------- render ---------- */
  function render() {
    const e = state.placa;
    const todas = D.totais.find((r) => r.escopo === 'Todas');
    const t = D.totais.find((r) => r.escopo === e) || todas;
    drawFiltro();
    drawTotais(t, todas);
    drawFrase(t);
    const ajust = D.by_placa.filter((p) => p.ajuste_planilha);
    const best = D.by_placa.slice().sort((a, b) => b.resultado - a.resultado);
    document.getElementById('placas-note').textContent =
      `Melhor resultado: ${best[0].placa} (${F.brl(best[0].resultado)}); menor: ${best[best.length - 1].placa} (${F.brl(best[best.length - 1].resultado)}).` +
      (ajust.length ? ` * ${ajust.map((p) => `${p.placa} inclui ajuste manual de ${F.brl(p.ajuste_planilha)}`).join('; ')} na planilha.` : '') +
      ' Clique numa placa para filtrar o painel inteiro.';
    drawCascata(D.cascata.filter((r) => r.escopo === e));
    drawComp();
    drawTabelaPlacas();
    drawDia(D.por_dia.filter((r) => r.escopo === e));
    drawDestinos(D.por_destino.filter((r) => r.escopo === e));
    drawConta(D.sienge_conta.filter((r) => r.escopo === e));
    drawConc(todas);
    drawTabelaViagens();
    drawAlertas();
  }

  drawCabecalho();
  legend('leg-cascata', [['Faturamento e resultado', 'var(--g1-blue)'], ['Repasse ALP', CAT.alp.cor], ['Combustível', CAT.comb.cor], ['Parcela', CAT.parc.cor],
    ['Manutenção, IPVA e seguro', CAT.manut.cor], ['Ajuste manual', CAT.ajuste.cor], ['Custos do Sienge', CAT.sienge.cor]]);
  legend('leg-comp', ['alp', 'comb', 'parc', 'manut', 'sienge', 'res'].map((k) => [CAT[k].nome, CAT[k].cor]));
  legend('leg-conta', [['Setembro', 'color-mix(in srgb, var(--g1-sienge) 50%, transparent)'], ['Outubro', 'var(--g1-sienge)']]);
  legend('leg-conc', [['Livre G1 (planilha)', 'var(--g1-blue)'], ['Receita no Sienge', 'var(--g1-sienge)']]);
  wireSort('tb-placas', drawTabelaPlacas);
  wireSort('tb-viagens', drawTabelaViagens);
  document.getElementById('busca-viagens').addEventListener('input', drawTabelaViagens);
  let larguraAnterior = root.clientWidth;
  window.addEventListener('resize', () => {
    clearTimeout(window.__g1resize);
    window.__g1resize = setTimeout(() => { if (root.clientWidth !== larguraAnterior) { larguraAnterior = root.clientWidth; render(); } }, 150);
  });
  render();
})();
