const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Dados de exemplo
const nomesPessoas = ['João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa', 'Carlos Souza', 'Julia Ferreira', 'Lucas Almeida', 'Fernanda Lima', 'Ricardo Martins', 'Patricia Rocha', 'Bruno Cardoso', 'Camila Dias', 'Rafael Torres', 'Beatriz Gomes', 'Thiago Ribeiro', 'Amanda Pereira', 'Felipe Castro', 'Larissa Mendes', 'Gustavo Barbosa', 'Isabela Araújo', 'Diego Carvalho', 'Gabriela Fernandes', 'Rodrigo Monteiro', 'Aline Correia', 'Marcelo Nunes', 'Vanessa Pinto', 'Leonardo Freitas', 'Carolina Moura', 'André Soares', 'Juliana Teixeira'];

const nomesSeguradoras = ['Porto Seguro', 'SulAmérica', 'Bradesco Seguros', 'Itaú Seguros', 'Mapfre', 'Allianz', 'Liberty Seguros', 'HDI Seguros', 'Tokio Marine', 'Zurich', 'AXA Seguros', 'Sompo Seguros', 'Chubb Seguros', 'ACE Seguradora', 'Azul Seguros', 'Mitsui Sumitomo', 'Argo Seguros', 'Fairfax Brasil', 'Too Seguros', 'Alfa Seguros'];

const nomesCorretoras = ['Corretora Premium', 'Total Seguros', 'Seguro Fácil', 'MasterBroker', 'ProteçãoMax', 'SeguroCerto', 'BrasilSeguros', 'TopBroker', 'ExcelênciaCorretora', 'LíderSeguros', 'CorretaPlus', 'SegurosUnidos', 'PrimeiraSeguros', 'GlobalBroker', 'SeguroTotal', 'MegaCorretora', 'SuperBroker', 'EliteCorretora', 'VanguardaSeguros', 'DiamanteBroker'];

const nomesTransportadoras = ['TransporteRápido Ltda', 'LogísticaBrasil S.A.', 'CargaSegura Transportes', 'ExpressoNacional', 'MegaFrete Logística', 'RodoviárioPlus', 'TransBrasil Cargas', 'LogiExpress S.A.', 'CargaSul Transportes', 'NorteFretes Ltda', 'BrasilCarga Express', 'TransContinental', 'LogísticaPrima', 'ExpressoCentro', 'CargaLeste Transportes', 'SuperFrete Logística', 'TransMundo S.A.', 'RápidoSul Cargas', 'LogiNorte Express', 'CargaVerde Transportes'];

const nomesReguladoras = ['RegulaSeg Peritos', 'AvaliaçãoExpress Ltda', 'PericiaTotal S.A.', 'RegulaBrasil Peritos', 'ExpertRegulação', 'AvaliaMax Peritos', 'TecnoPericias Ltda', 'RegulaSul S.A.', 'PericiaRápida', 'AvaliaçãoPro Peritos', 'RegulaPrime Ltda', 'PeríciaExpress S.A.', 'TécnicoPeritos', 'AvaliaPlus Regulação', 'RegulaNorte Peritos', 'ExpertAvaliação Ltda', 'PericiaLeste S.A.', 'RegulaCentro Peritos', 'AvaliaTop Ltda', 'SuperPerícia S.A.'];

const tiposSinistro = ['Roubo de Carga', 'Acidente de Trânsito', 'Incêndio', 'Colisão', 'Tombamento', 'Alagamento', 'Avaria de Mercadoria', 'Furto Simples', 'Danos Materiais', 'Perda Total'];

const statusSinistro = ['Aberto', 'Em Análise', 'Aguardando Documentação', 'Em Regulação', 'Deferido', 'Indeferido', 'Pago', 'Cancelado'];

const statusFollowUp = ['Pendente', 'Em Andamento', 'Concluído', 'Aguardando Resposta'];

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('🔍 Buscando tenant Marisa Dilda...');
  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'Marisa', mode: 'insensitive' } },
  });

  if (!tenant) {
    throw new Error('Tenant não encontrado');
  }
  console.log(`✅ Tenant: ${tenant.name}`);

  // Buscar entities
  const entities = {};
  const slugs = ['sinistros', 'seguradoras', 'corretores', 'transportadoras', 'reguladoras', 'gerenciadores-risco', 'segurados', 'sinistro-followups'];

  for (const slug of slugs) {
    const entity = await prisma.entity.findFirst({
      where: { tenantId: tenant.id, slug },
    });
    if (entity) {
      entities[slug] = entity;
      console.log(`✅ Entity: ${entity.name} (${entity.slug})`);
    }
  }

  // 1. Criar Seguradoras (20)
  console.log('\n📝 Criando 20 Seguradoras...');
  const seguradoras = [];
  for (let i = 0; i < 20; i++) {
    const data = await prisma.entityData.create({
      data: {
        entityId: entities['seguradoras'].id,
        tenantId: tenant.id,
        data: {
          nome: nomesSeguradoras[i],
          cnpj: `${randomNumber(10, 99)}.${randomNumber(100, 999)}.${randomNumber(100, 999)}/${randomNumber(1000, 9999)}-${randomNumber(10, 99)}`,
          telefone: `(11) ${randomNumber(9000, 9999)}-${randomNumber(1000, 9999)}`,
          email: `contato@${nomesSeguradoras[i].toLowerCase().replace(/\s/g, '')}.com.br`,
        },
      },
    });
    seguradoras.push(data);
  }
  console.log(`✅ ${seguradoras.length} seguradoras criadas`);

  // 2. Criar Corretores (20)
  console.log('\n📝 Criando 20 Corretores...');
  const corretores = [];
  for (let i = 0; i < 20; i++) {
    const data = await prisma.entityData.create({
      data: {
        entityId: entities['corretores'].id,
        tenantId: tenant.id,
        data: {
          nome: nomesCorretoras[i],
          cnpj: `${randomNumber(10, 99)}.${randomNumber(100, 999)}.${randomNumber(100, 999)}/${randomNumber(1000, 9999)}-${randomNumber(10, 99)}`,
          telefone: `(11) ${randomNumber(9000, 9999)}-${randomNumber(1000, 9999)}`,
          email: `contato@${nomesCorretoras[i].toLowerCase().replace(/\s/g, '')}.com.br`,
          susep: `${randomNumber(100000, 999999)}`,
        },
      },
    });
    corretores.push(data);
  }
  console.log(`✅ ${corretores.length} corretores criados`);

  // 3. Criar Transportadoras (20)
  console.log('\n📝 Criando 20 Transportadoras...');
  const transportadoras = [];
  for (let i = 0; i < 20; i++) {
    const data = await prisma.entityData.create({
      data: {
        entityId: entities['transportadoras'].id,
        tenantId: tenant.id,
        data: {
          nome: nomesTransportadoras[i],
          cnpj: `${randomNumber(10, 99)}.${randomNumber(100, 999)}.${randomNumber(100, 999)}/${randomNumber(1000, 9999)}-${randomNumber(10, 99)}`,
          telefone: `(11) ${randomNumber(9000, 9999)}-${randomNumber(1000, 9999)}`,
          email: `contato@${nomesTransportadoras[i].toLowerCase().replace(/\s/g, '').replace(/\./g, '')}.com.br`,
        },
      },
    });
    transportadoras.push(data);
  }
  console.log(`✅ ${transportadoras.length} transportadoras criadas`);

  // 4. Criar Reguladoras (20)
  console.log('\n📝 Criando 20 Reguladoras...');
  const reguladoras = [];
  for (let i = 0; i < 20; i++) {
    const data = await prisma.entityData.create({
      data: {
        entityId: entities['reguladoras'].id,
        tenantId: tenant.id,
        data: {
          nome: nomesReguladoras[i],
          cnpj: `${randomNumber(10, 99)}.${randomNumber(100, 999)}.${randomNumber(100, 999)}/${randomNumber(1000, 9999)}-${randomNumber(10, 99)}`,
          telefone: `(11) ${randomNumber(9000, 9999)}-${randomNumber(1000, 9999)}`,
          email: `contato@${nomesReguladoras[i].toLowerCase().replace(/\s/g, '')}.com.br`,
        },
      },
    });
    reguladoras.push(data);
  }
  console.log(`✅ ${reguladoras.length} reguladoras criadas`);

  // 5. Criar Gerenciadores de Risco (20)
  console.log('\n📝 Criando 20 Gerenciadores de Risco...');
  const gerenciadores = [];
  for (let i = 0; i < 20; i++) {
    const data = await prisma.entityData.create({
      data: {
        entityId: entities['gerenciadores-risco'].id,
        tenantId: tenant.id,
        data: {
          nome: nomesPessoas[i],
          email: `${nomesPessoas[i].toLowerCase().replace(/\s/g, '.')}@risco.com.br`,
          telefone: `(11) ${randomNumber(9000, 9999)}-${randomNumber(1000, 9999)}`,
        },
      },
    });
    gerenciadores.push(data);
  }
  console.log(`✅ ${gerenciadores.length} gerenciadores de risco criados`);

  // 6. Criar Segurados (25)
  console.log('\n📝 Criando 25 Segurados...');
  const segurados = [];
  for (let i = 0; i < 25; i++) {
    const data = await prisma.entityData.create({
      data: {
        entityId: entities['segurados'].id,
        tenantId: tenant.id,
        data: {
          nome: nomesPessoas[i % 30],
          cpf: `${randomNumber(100, 999)}.${randomNumber(100, 999)}.${randomNumber(100, 999)}-${randomNumber(10, 99)}`,
          telefone: `(11) ${randomNumber(9000, 9999)}-${randomNumber(1000, 9999)}`,
          email: `${nomesPessoas[i % 30].toLowerCase().replace(/\s/g, '.')}@email.com`,
          endereco: `Rua ${randomNumber(1, 100)}, ${randomNumber(1, 999)} - São Paulo/SP`,
        },
      },
    });
    segurados.push(data);
  }
  console.log(`✅ ${segurados.length} segurados criados`);

  // 7. Criar 54 Sinistros
  console.log('\n📝 Criando 54 Sinistros...');
  const sinistros = [];
  for (let i = 0; i < 54; i++) {
    const dataOcorrencia = randomDate(new Date(2024, 0, 1), new Date());
    const valorSinistro = randomNumber(5000, 500000);

    const sinistro = await prisma.entityData.create({
      data: {
        entityId: entities['sinistros'].id,
        tenantId: tenant.id,
        data: {
          numeroSinistro: `SIN-${String(i + 1).padStart(6, '0')}`,
          tipoSinistro: randomItem(tiposSinistro),
          dataOcorrencia: dataOcorrencia.toISOString(),
          status: randomItem(statusSinistro),
          valorEstimado: valorSinistro,
          descricao: `Sinistro ${randomItem(tiposSinistro)} ocorrido em ${dataOcorrencia.toLocaleDateString('pt-BR')}`,
          localOcorrencia: `${randomItem(['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'PE'])} - ${randomItem(['Rod. Anchieta', 'Rod. Bandeirantes', 'Rod. Dutra', 'Rod. Castelo Branco', 'Rod. Régis Bittencourt'])} KM ${randomNumber(10, 500)}`,
          seguradoraId: randomItem(seguradoras).id,
          corretorId: randomItem(corretores).id,
          transportadoraId: randomItem(transportadoras).id,
          reguladoraId: randomItem(reguladoras).id,
          seguradoId: randomItem(segurados).id,
        },
      },
    });
    sinistros.push(sinistro);
  }
  console.log(`✅ ${sinistros.length} sinistros criados`);

  // 8. Criar Follow Ups (2-4 por sinistro = ~150 follow ups)
  console.log('\n📝 Criando Follow Ups...');
  let totalFollowUps = 0;
  for (const sinistro of sinistros) {
    const numFollowUps = randomNumber(2, 4);
    for (let i = 0; i < numFollowUps; i++) {
      await prisma.entityData.create({
        data: {
          entityId: entities['sinistro-followups'].id,
          tenantId: tenant.id,
          parentRecordId: sinistro.id,
          data: {
            data: randomDate(new Date(2024, 0, 1), new Date()).toISOString(),
            descricao: randomItem([
              'Contato com segurado realizado',
              'Documentação solicitada',
              'Vistoria agendada',
              'Laudo técnico recebido',
              'Aprovação da reguladora',
              'Pagamento em processamento',
              'Aguardando documentação adicional',
              'Análise técnica concluída',
            ]),
            responsavel: randomItem(nomesPessoas),
            status: randomItem(statusFollowUp),
            observacoes: `Follow up ${i + 1} do sinistro`,
          },
        },
      });
      totalFollowUps++;
    }
  }
  console.log(`✅ ${totalFollowUps} follow ups criados`);

  console.log('\n🎉 Dados criados com sucesso!');
  console.log('\n📊 Resumo:');
  console.log(`   - Seguradoras: ${seguradoras.length}`);
  console.log(`   - Corretores: ${corretores.length}`);
  console.log(`   - Transportadoras: ${transportadoras.length}`);
  console.log(`   - Reguladoras: ${reguladoras.length}`);
  console.log(`   - Gerenciadores de Risco: ${gerenciadores.length}`);
  console.log(`   - Segurados: ${segurados.length}`);
  console.log(`   - Sinistros: ${sinistros.length}`);
  console.log(`   - Follow Ups: ${totalFollowUps}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
