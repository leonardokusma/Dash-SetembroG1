/* Cruzamento da planilha de faturamento com os centros de custo do Sienge.
   Funções puras: recebem window.DADOS e devolvem as tabelas que o painel desenha. */
(function () {
  const r2 = (x) => Math.round(x * 100) / 100;
  const soma = (rows, f) => r2(rows.reduce((a, r) => a + (typeof f === 'function' ? f(r) : r[f]), 0));

  /* Uma linha por placa: planilha + saídas/receita do Sienge + motorista */
  function porPlaca(fat, sienge, viagens) {
    return fat.map((f) => {
      const s = sienge.filter((r) => r.placa === f.placa);
      const saida = (grupo) => soma(s.filter((r) => r.tipo === 'Saída' && (!grupo || r.grupo === grupo)), 'total');
      const custos = saida();
      const resultado = r2(f.livre_g1 - custos);
      return {
        placa: f.placa,
        motorista: [...new Set(viagens.filter((v) => v.cavalo === f.placa).map((v) => v.motorista))].join(', '),
        centro_custo: s.length ? s[0].centro_custo : '',
        fretes: f.fretes,
        peso_t: f.peso_kg / 1000,
        faturamento: f.faturamento,
        repasse_alp: f.repasse_alp,
        combustivel: f.combustivel,
        parcela: f.parcela,
        manutencao: f.manutencao_ipva_seguro,
        ajuste_planilha: f.ajuste_planilha,
        livre_g1: f.livre_g1,
        mao_de_obra: saida('Mão de obra'),
        veiculos_sienge: saida('Veículos'),
        materiais: saida('Materiais'),
        tributos: saida('Tributos'),
        custos_sienge: custos,
        receita_sienge: soma(s.filter((r) => r.tipo === 'Receita'), 'total'),
        resultado,
        margem: resultado / f.faturamento,
        comb_pct: f.combustivel / f.faturamento,
      };
    });
  }

  /* Totais da frota (escopo "Todas") e de cada placa */
  function totais(byPlaca) {
    const campos = ['fretes', 'peso_t', 'faturamento', 'repasse_alp', 'combustivel', 'parcela', 'manutencao', 'ajuste_planilha', 'livre_g1',
      'mao_de_obra', 'veiculos_sienge', 'materiais', 'tributos', 'custos_sienge', 'receita_sienge', 'resultado'];
    const linha = (escopo, rows) => {
      const o = { escopo, placas: rows.length };
      campos.forEach((c) => { o[c] = soma(rows, c); });
      o.ticket_medio = o.faturamento / o.fretes;
      o.margem = o.resultado / o.faturamento;
      o.livre_pct = o.livre_g1 / o.faturamento;
      o.comb_pct = o.combustivel / o.faturamento;
      return o;
    };
    return [linha('Todas', byPlaca), ...byPlaca.map((r) => linha(r.placa, [r]))];
  }

  /* Etapas do faturamento até o resultado, com início e fim de cada barra */
  function cascata(tots) {
    const out = [];
    tots.forEach((t) => {
      const passos = [
        ['Faturamento bruto', 'total', 'fat', t.faturamento, 'Planilha'],
        ['Repasse ALP (25%)', 'saida', 'alp', -t.repasse_alp, 'Planilha'],
        ['Combustível', 'saida', 'comb', -t.combustivel, 'Planilha'],
        ['Parcela do cavalo', 'saida', 'parc', -t.parcela, 'Planilha'],
        ['Manutenção, IPVA e seguro', 'saida', 'manut', -t.manutencao, 'Planilha'],
        ['Ajuste manual na planilha', 'entrada', 'ajuste', t.ajuste_planilha, 'Planilha'],
        ['Livre G1', 'total', 'livre', t.livre_g1, 'Planilha'],
        ['Mão de obra', 'saida', 'sienge', -t.mao_de_obra, 'Sienge'],
        ['Pneus, peças e veículo', 'saida', 'sienge', -t.veiculos_sienge, 'Sienge'],
        ['Materiais', 'saida', 'sienge', -t.materiais, 'Sienge'],
        ['PIS', 'saida', 'sienge', -t.tributos, 'Sienge'],
        ['Resultado final', 'total', 'res', t.resultado, 'Cálculo'],
      ];
      let acc = 0;
      let ordem = 0;
      passos.forEach(([etapa, tipo, cat, valor, fonte]) => {
        if (tipo !== 'total' && Math.abs(valor) < 0.005) return;
        const inicio = tipo === 'total' ? 0 : acc;
        const fim = tipo === 'total' ? valor : r2(acc + valor);
        acc = fim;
        out.push({ escopo: t.escopo, ordem: ordem++, etapa, tipo, cat, valor, inicio, fim, fonte });
      });
    });
    return out;
  }

  /* Faturamento por dia, com os dias sem frete zerados */
  function porDia(viagens) {
    const dias = [...new Set(viagens.map((v) => v.data))].sort();
    const todos = [];
    const last = new Date(dias[dias.length - 1] + 'T00:00:00Z');
    for (let d = new Date(dias[0] + 'T00:00:00Z'); d <= last; d.setUTCDate(d.getUTCDate() + 1)) todos.push(d.toISOString().slice(0, 10));
    const out = [];
    ['Todas', ...new Set(viagens.map((v) => v.cavalo))].forEach((e) => todos.forEach((dia) => {
      const vs = viagens.filter((v) => v.data === dia && (e === 'Todas' || v.cavalo === e));
      out.push({ escopo: e, dia, fretes: vs.length, valor: soma(vs, 'valor_frete') });
    }));
    return out;
  }

  function porDestino(viagens) {
    const out = [];
    ['Todas', ...new Set(viagens.map((v) => v.cavalo))].forEach((e) => {
      const m = new Map();
      viagens.filter((v) => e === 'Todas' || v.cavalo === e).forEach((v) => {
        const o = m.get(v.destino) || { escopo: e, destino: v.destino, fretes: 0, valor: 0 };
        o.fretes += 1;
        o.valor = r2(o.valor + v.valor_frete);
        m.set(v.destino, o);
      });
      out.push(...[...m.values()].sort((a, b) => b.valor - a.valor));
    });
    return out;
  }

  function siengePorConta(sienge) {
    const saidas = sienge.filter((r) => r.tipo === 'Saída');
    const out = [];
    ['Todas', ...new Set(saidas.map((r) => r.placa))].forEach((e) => {
      const m = new Map();
      saidas.filter((r) => e === 'Todas' || r.placa === e).forEach((r) => {
        const o = m.get(r.conta) || { escopo: e, conta: r.conta, grupo: r.grupo, setembro: 0, outubro: 0, total: 0 };
        o.setembro = r2(o.setembro + r.setembro);
        o.outubro = r2(o.outubro + r.outubro);
        o.total = r2(o.setembro + o.outubro);
        m.set(r.conta, o);
      });
      out.push(...[...m.values()].sort((a, b) => b.total - a.total));
    });
    return out;
  }

  /* Regras de conferência entre as fontes */
  function alertas(viagens, byPlaca) {
    const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dm = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
    const out = [];
    byPlaca.filter((p) => Math.abs(p.ajuste_planilha) > 0.005).forEach((p) => out.push({
      id: 'ajuste-' + p.placa, nivel: 'alto', placa: p.placa,
      titulo: `Livre G1 da ${p.placa} tem ${brl(p.ajuste_planilha)} somados direto na fórmula`,
      detalhe: `A fórmula da aba Faturamento por Placa soma esse valor fixo${p.parcela === 0 ? ' e a parcela dessa placa está zerada' : ''}. Sem esse ajuste, o Livre G1 seria ${brl(p.livre_g1 - p.ajuste_planilha)}. Confirme se o valor é um crédito real.`,
    }));
    const porCte = new Map();
    viagens.forEach((v) => porCte.set(v.cte, [...(porCte.get(v.cte) || []), v]));
    porCte.forEach((vs, cte) => {
      if (vs.length > 1) out.push({
        id: 'cte-' + cte, nivel: 'medio', placa: vs.map((v) => v.cavalo).join(','),
        titulo: `CT-e ${cte} aparece ${vs.length} vezes`,
        detalhe: vs.map((v) => `${v.cavalo} (${v.motorista}, ${dm(v.data)}, ${v.destino}, ${brl(v.valor_frete)})`).join(' e ') + '.',
      });
    });
    viagens.filter((v) => !v.quantidade_kg && v.destino !== 'Toco').forEach((v) => out.push({
      id: 'peso-' + v.id, nivel: 'baixo', placa: v.cavalo,
      titulo: `Frete sem peso: ${v.cavalo} em ${dm(v.data)} para ${v.destino}`,
      detalhe: `CT-e ${v.cte}, ${brl(v.valor_frete)}. A quantidade está ${v.quantidade_original ? `como "${v.quantidade_original}"` : 'em branco'} na base.`,
    }));
    const tocos = new Map();
    viagens.filter((v) => v.destino === 'Toco' && v.quantidade_kg > 0).forEach((v) => tocos.set(v.cavalo, [...(tocos.get(v.cavalo) || []), v]));
    tocos.forEach((vs, placa) => out.push({
      id: 'toco-' + placa, nivel: 'medio', placa,
      titulo: `${vs.length} lançamento${vs.length > 1 ? 's' : ''} "toco" da ${placa} com peso`,
      detalhe: `Somam ${vs.reduce((a, v) => a + v.quantidade_kg, 0).toLocaleString('pt-BR')} kg ao peso total da placa (CT-e ${vs.map((v) => v.cte).join(', ')}). Os outros "toco" da base estão sem peso.`,
    }));
    const tl = soma(byPlaca, 'livre_g1');
    const ts = soma(byPlaca, 'receita_sienge');
    const maior = byPlaca.slice().sort((a, b) => Math.abs(b.receita_sienge - b.livre_g1) - Math.abs(a.receita_sienge - a.livre_g1))[0];
    if (maior && Math.abs(maior.receita_sienge - maior.livre_g1) > 1000) out.push({
      id: 'conciliacao', nivel: 'medio', placa: '',
      titulo: 'Receita no Sienge distribuída diferente da planilha',
      detalhe: `No total, o Sienge tem ${brl(ts)} de receita e a planilha ${brl(tl)} de Livre G1. Por placa a diferença chega a ${brl(maior.receita_sienge - maior.livre_g1)} na ${maior.placa}. Vale conferir o rateio da receita entre os centros de custo.`,
    });
    return out;
  }

  window.montarPainel = function (D) {
    const byPlaca = porPlaca(D.faturamento_placa, D.sienge, D.viagens);
    const tots = totais(byPlaca);
    return {
      by_placa: byPlaca,
      totais: tots,
      cascata: cascata(tots),
      por_dia: porDia(D.viagens),
      por_destino: porDestino(D.viagens),
      sienge_conta: siengePorConta(D.sienge),
      alertas: alertas(D.viagens, byPlaca),
      viagens: D.viagens,
    };
  };
})();
