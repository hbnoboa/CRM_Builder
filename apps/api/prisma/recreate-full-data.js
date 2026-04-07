const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Dados de exemplo expandidos
const razoesSociais = [
  'Transportes Martins Ltda', 'Logística Silva & Cia', 'Cargas Brasil S.A.', 'Expresso Santos Transportes',
  'RodoLog Logística Ltda', 'TransCarga Express S.A.', 'Distribuidora Lima Ltda', 'Mega Transportes SA',
  'Nacional Cargas Ltda', 'Premium Logística S.A.', 'Rápido Norte Transportes', 'Sul Express Logística',
  'Atlântico Cargas Ltda', 'Pacífico Transportes S.A.', 'Continental Log Ltda', 'Global Cargas Express',
  'União Transportes Ltda', 'Aliança Logística S.A.', 'Líder Cargas Ltda', 'Vanguarda Transportes SA',
  'Estrela Logística Ltda', 'Horizonte Cargas S.A.', 'Progresso Transportes', 'Futuro Logística Ltda',
  'Ideal Cargas S.A.', 'Master Transportes Ltda', 'Elite Logística SA', 'Top Cargas Ltda', 'Prime Log S.A.', 'Super Transportes Ltda'
];

const nomesPessoas = [
  'João Silva Santos', 'Maria Oliveira Costa', 'Pedro Henrique Souza', 'Ana Paula Ferreira',
  'Carlos Eduardo Lima', 'Juliana Mendes Almeida', 'Lucas Gabriel Rocha', 'Fernanda Cristina Dias',
  'Ricardo Alexandre Martins', 'Patrícia Rodrigues Cardoso', 'Bruno Cesar Gomes', 'Camila Aparecida Torres',
  'Rafael Augusto Ribeiro', 'Beatriz Helena Pereira', 'Thiago Vinícius Castro', 'Amanda Carolina Barbosa',
  'Felipe Leonardo Araújo', 'Larissa Fernanda Carvalho', 'Gustavo Henrique Monteiro', 'Isabela Cristiane Correia',
  'Diego Fernando Nunes', 'Gabriela Mariana Pinto', 'Rodrigo Matheus Freitas', 'Aline Beatriz Moura',
  'Marcelo Antonio Soares', 'Vanessa Regina Teixeira', 'Leonardo José Nascimento', 'Carolina Maria Cavalcanti',
  'André Luís Azevedo', 'Juliana Aparecida Reis'
];

const cidades = [
  'São Paulo/SP', 'Rio de Janeiro/RJ', 'Belo Horizonte/MG', 'Curitiba/PR', 'Porto Alegre/RS',
  'Salvador/BA', 'Brasília/DF', 'Fortaleza/CE', 'Recife/PE', 'Manaus/AM',
  'Goiânia/GO', 'Belém/PA', 'Guarulhos/SP', 'Campinas/SP', 'São Bernardo do Campo/SP',
  'Santo André/SP', 'Osasco/SP', 'São José dos Campos/SP', 'Ribeirão Preto/SP', 'Sorocaba/SP'
];

const marcasVeiculos = ['Mercedes-Benz', 'Volvo', 'Scania', 'Iveco', 'Ford', 'Volkswagen', 'DAF'];
const modelosVeiculos = ['Actros', 'Axor', 'FH', 'FM', 'R440', 'Stralis', 'Cargo', 'Daily'];
const tiposCarreta = ['Baú', 'Graneleira', 'Sider', 'Refrigerada', 'Tanque', 'Porta Container', 'Cegonha'];

const causas = ['Roubo de Carga', 'Acidente de Trânsito', 'Incêndio', 'Colisão', 'Tombamento', 'Alagamento', 'Avaria', 'Furto'];
const classificacoes = ['Roubo', 'Furto', 'Acidente', 'Incêndio', 'Colisão', 'Avaria', 'Perda Total', 'Danos Parciais'];
const mercadorias = ['Eletrônicos', 'Alimentos', 'Medicamentos', 'Roupas', 'Materiais de Construção', 'Móveis', 'Automóveis', 'Químicos', 'Bebidas', 'Cosméticos'];
const ramos = ['Transportes', 'RCF-DC', 'Responsabilidade Civil', 'Carga', 'Frota', 'Riscos Operacionais'];
const ramosAtividade = ['Transportes', 'Logística', 'Comércio', 'Indústria', 'Serviços', 'Agronegócio', 'Varejo', 'Distribuição'];
const statusSinistro = ['Aberto', 'Em Análise', 'Aguardando Documentação', 'Em Regulação', 'Aguardando Perícia', 'Deferido', 'Indeferido Parcial', 'Pago Parcialmente', 'Pago', 'Cancelado'];
const tiposContato = ['Telefone', 'E-mail', 'WhatsApp', 'Presencial', 'Sistema', 'Videoconferência'];
const prioridades = ['Baixa', 'Normal', 'Alta', 'Urgente'];

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateCNPJ() {
  return `${randomNumber(10, 99)}.${randomNumber(100, 999)}.${randomNumber(100, 999)}/${randomNumber(1000, 9999)}-${randomNumber(10, 99)}`;
}

function generateCPF() {
  return `${randomNumber(100, 999)}.${randomNumber(100, 999)}.${randomNumber(100, 999)}-${randomNumber(10, 99)}`;
}

function generatePhone() {
  return `(${randomNumber(11, 99)}) ${randomNumber(9, 9)}${randomNumber(1000, 9999)}-${randomNumber(1000, 9999)}`;
}

function generatePlaca() {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return `${letras[randomNumber(0, 25)]}${letras[randomNumber(0, 25)]}${letras[randomNumber(0, 25)]}-${randomNumber(1, 9)}${letras[randomNumber(0, 25)]}${randomNumber(10, 99)}`;
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
    }
  }

  // DELETAR dados antigos
  console.log('\n🗑️  Deletando dados antigos...');
  await prisma.entityData.deleteMany({
    where: {
      tenantId: tenant.id,
      entityId: { in: Object.values(entities).map(e => e.id) }
    }
  });
  console.log('✅ Dados antigos deletados');

  // 1. Criar Seguradoras (20) - TODOS OS CAMPOS
  console.log('\n📝 Criando 20 Seguradoras (COMPLETO)...');
  const seguradoras = [];
  for (let i = 0; i < 20; i++) {
    const razaoSocial = `${razoesSociais[i % 30]} Seguros S.A.`;
    const cidade = randomItem(cidades);
    const [cidadeNome, estado] = cidade.split('/');

    const data = await prisma.entityData.create({
      data: {
        entityId: entities['seguradoras'].id,
        tenantId: tenant.id,
        data: {
          'Razao Social': razaoSocial,
          'CNPJ': generateCNPJ(),
          'Telefone': generatePhone(),
          'Email': `contato@${razaoSocial.toLowerCase().replace(/\s/g, '').replace(/&/g, '').substring(0, 20)}.com.br`,
          'Estado': estado,
          'Cidade': cidadeNome,
          'Endereco': `Rua ${randomItem(['Comercial', 'Industrial', 'das Empresas', 'dos Seguros', 'Financeira'])}, ${randomNumber(100, 9999)} - Sala ${randomNumber(101, 999)}\nCEP: ${randomNumber(10000, 99999)}-${randomNumber(100, 999)}\n${cidadeNome}/${estado}`,
        },
      },
    });
    seguradoras.push(data);
  }
  console.log(`✅ ${seguradoras.length} seguradoras criadas`);

  // 2. Criar Corretores (20) - TODOS OS CAMPOS
  console.log('\n📝 Criando 20 Corretores (COMPLETO)...');
  const corretores = [];
  for (let i = 0; i < 20; i++) {
    const nome = `${razoesSociais[i % 30]} Corretora`;
    const cidade = randomItem(cidades);
    const [cidadeNome, estado] = cidade.split('/');

    const data = await prisma.entityData.create({
      data: {
        entityId: entities['corretores'].id,
        tenantId: tenant.id,
        data: {
          'Nome': nome,
          'Email': `corretor${i + 1}@${nome.toLowerCase().replace(/\s/g, '').substring(0, 15)}.com.br`,
          'Telefone': generatePhone(),
          'Estado': estado,
          'Cidade': cidadeNome,
          'Endereco': `Av. ${randomItem(['Principal', 'Central', 'Comercial', 'das Seguradoras', 'dos Corretores'])}, ${randomNumber(100, 5000)} - ${randomNumber(1, 20)}º andar\nCEP: ${randomNumber(10000, 99999)}-${randomNumber(100, 999)}\n${cidadeNome}/${estado}`,
        },
      },
    });
    corretores.push(data);
  }
  console.log(`✅ ${corretores.length} corretores criados`);

  // 3. Criar Transportadoras (20) - TODOS OS CAMPOS
  console.log('\n📝 Criando 20 Transportadoras (COMPLETO)...');
  const transportadoras = [];
  for (let i = 0; i < 20; i++) {
    const razaoSocial = razoesSociais[i];

    const data = await prisma.entityData.create({
      data: {
        entityId: entities['transportadoras'].id,
        tenantId: tenant.id,
        data: {
          'Razao Social': razaoSocial,
          'CNPJ/CPF': generateCNPJ(),
          'Email': `transportadora${i + 1}@${razaoSocial.toLowerCase().replace(/\s/g, '').replace(/&/g, '').substring(0, 15)}.com.br`,
          'RNTRC': `${randomNumber(10000000, 99999999)}`,
        },
      },
    });
    transportadoras.push(data);
  }
  console.log(`✅ ${transportadoras.length} transportadoras criadas`);

  // 4. Criar Reguladoras (20) - TODOS OS CAMPOS
  console.log('\n📝 Criando 20 Reguladoras (COMPLETO)...');
  const reguladoras = [];
  for (let i = 0; i < 20; i++) {
    const nome = `${razoesSociais[i % 30]} Regulação e Perícias`;

    const data = await prisma.entityData.create({
      data: {
        entityId: entities['reguladoras'].id,
        tenantId: tenant.id,
        data: {
          'Nome': nome,
          'CNPJ': generateCNPJ(),
          'Telefone': generatePhone(),
          'Email': `regulacao${i + 1}@${nome.toLowerCase().replace(/\s/g, '').substring(0, 15)}.com.br`,
        },
      },
    });
    reguladoras.push(data);
  }
  console.log(`✅ ${reguladoras.length} reguladoras criadas`);

  // 5. Criar Gerenciadores de Risco (20) - TODOS OS CAMPOS
  console.log('\n📝 Criando 20 Gerenciadores de Risco (COMPLETO)...');
  const gerenciadores = [];
  for (let i = 0; i < 20; i++) {
    const nome = `${razoesSociais[i % 30]} Gerenciamento`;

    const data = await prisma.entityData.create({
      data: {
        entityId: entities['gerenciadores-risco'].id,
        tenantId: tenant.id,
        data: {
          'Nome': nome,
          'CNPJ': generateCNPJ(),
          'Telefone': generatePhone(),
          'Email': `gerenciamento${i + 1}@${nome.toLowerCase().replace(/\s/g, '').substring(0, 15)}.com.br`,
        },
      },
    });
    gerenciadores.push(data);
  }
  console.log(`✅ ${gerenciadores.length} gerenciadores de risco criados`);

  // 6. Criar Segurados (25) - TODOS OS CAMPOS
  console.log('\n📝 Criando 25 Segurados (COMPLETO)...');
  const segurados = [];
  for (let i = 0; i < 25; i++) {
    const razaoSocial = `${razoesSociais[i % 30]}`;
    const cidade = randomItem(cidades);
    const [cidadeNome, estado] = cidade.split('/');

    const data = await prisma.entityData.create({
      data: {
        entityId: entities['segurados'].id,
        tenantId: tenant.id,
        data: {
          'Razao Social': razaoSocial,
          'Nome Fantasia': razaoSocial.split(' ')[0] + (i % 2 === 0 ? ' Express' : ' Premium'),
          'CNPJ': generateCNPJ(),
          'Email': `comercial@${razaoSocial.toLowerCase().replace(/\s/g, '').replace(/&/g, '').substring(0, 15)}.com.br`,
          'Estado': estado,
          'Cidade': cidadeNome,
          'Endereco': `Rua ${randomItem(['Industrial', 'das Fábricas', 'Comercial', 'Empresarial', 'Logística'])}, ${randomNumber(100, 5000)}\nBairro: ${randomItem(['Centro', 'Industrial', 'Comercial', 'Empresarial'])}\nCEP: ${randomNumber(10000, 99999)}-${randomNumber(100, 999)}\n${cidadeNome}/${estado}`,
          'Ramo de Atividade': randomItem(ramosAtividade),
        },
      },
    });
    segurados.push(data);
  }
  console.log(`✅ ${segurados.length} segurados criados`);

  // 7. Criar 54 Sinistros - TODOS OS CAMPOS
  console.log('\n📝 Criando 54 Sinistros (COMPLETO COM TODOS OS CAMPOS)...');
  const sinistros = [];
  for (let i = 0; i < 54; i++) {
    const dataEvento = randomDate(new Date(2024, 0, 1), new Date());
    const dataAviso = new Date(dataEvento.getTime() + randomNumber(1, 72) * 60 * 60 * 1000);
    const valorNota = randomNumber(50000, 800000);
    const prejuizo = randomNumber(Math.floor(valorNota * 0.3), valorNota);
    const valorIndenizado = randomNumber(Math.floor(prejuizo * 0.7), prejuizo);
    const franquia = randomNumber(1000, 10000);
    const salvados = randomNumber(0, Math.floor(prejuizo * 0.2));
    const despesas = randomNumber(2000, 15000);
    const anoVeiculo = randomNumber(2015, 2024);

    const segurado = randomItem(segurados);
    const seguradoData = segurado.data;

    const sinistro = await prisma.entityData.create({
      data: {
        entityId: entities['sinistros'].id,
        tenantId: tenant.id,
        data: {
          'Corretor': randomItem(corretores).id,
          'Seguradora': randomItem(seguradoras).id,
          'Segurado': segurado.id,
          'CNPJ Segurado': seguradoData['CNPJ'] || generateCNPJ(),
          'Nº Apólice': `APL-${randomNumber(2024, 2026)}-${String(randomNumber(1, 999999)).padStart(6, '0')}`,
          'Ramo': randomItem(ramos),
          'Reguladora': randomItem(reguladoras).id,
          'Gerenciadora de Risco': randomItem(gerenciadores).id,
          'Nº Seguradora': `SEG-${String(randomNumber(1, 999999)).padStart(6, '0')}`,
          'Nº Reguladora': `REG-${String(randomNumber(1, 999999)).padStart(6, '0')}`,
          'Valor Nota': valorNota,
          'Prejuízo': prejuizo,
          'Valor Indenizado': valorIndenizado,
          'Franquia/POS': franquia,
          'Salvados': salvados,
          'Despesas de Regulação': despesas,
          'Causa': randomItem(causas),
          'Classificação': randomItem(classificacoes),
          'Mercadoria': randomItem(mercadorias),
          'Data/Hora do Evento': dataEvento.toISOString(),
          'Data/Hora do Aviso': dataAviso.toISOString(),
          'Local do Evento': `${randomItem(['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'PE'])} - ${randomItem(['Rod. Anchieta', 'Rod. Bandeirantes', 'Rod. Dutra', 'Rod. Castelo Branco', 'Rod. Régis Bittencourt', 'Rod. Fernão Dias', 'Rod. Raposo Tavares'])} KM ${randomNumber(10, 500)}`,
          'Transportadora': randomItem(transportadoras).id,
          'Marca do Veículo': randomItem(marcasVeiculos),
          'Modelo do Veículo': randomItem(modelosVeiculos),
          'Placa': generatePlaca(),
          'Ano': anoVeiculo,
          'Tipo da Carreta': randomItem(tiposCarreta),
          'Motorista': randomItem(nomesPessoas),
          'CPF Motorista': generateCPF(),
          'Ano Nascimento': randomNumber(1970, 1995),
          'Remetente': randomItem(segurados).data['Razao Social'] || 'Empresa Remetente Ltda',
          'Local de Origem': randomItem(cidades),
          'Destinatário': randomItem(segurados).data['Razao Social'] || 'Empresa Destinatária Ltda',
          'Local de Destino': randomItem(cidades),
          'Descrição': `Sinistro do tipo ${randomItem(causas)} ocorrido em ${dataEvento.toLocaleDateString('pt-BR')}. Mercadoria: ${randomItem(mercadorias)}. Veículo ${randomItem(marcasVeiculos)} ${randomItem(modelosVeiculos)} placa ${generatePlaca()}.`,
          'Observações': `Prejuízo estimado em R$ ${prejuizo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Regulação em andamento. ${randomItem(['Documentação completa.', 'Aguardando laudo pericial.', 'Perícia realizada.', 'Vistoria agendada.'])}`,
          'Status': randomItem(statusSinistro),
        },
      },
    });
    sinistros.push(sinistro);
  }
  console.log(`✅ ${sinistros.length} sinistros criados`);

  // 8. Criar Follow Ups (3-5 por sinistro) - TODOS OS CAMPOS
  console.log('\n📝 Criando Follow Ups (COMPLETO)...');
  let totalFollowUps = 0;
  for (const sinistro of sinistros) {
    const numFollowUps = randomNumber(3, 5);
    const sinistroData = sinistro.data;
    const dataEvento = new Date(sinistroData['Data/Hora do Evento']);

    for (let i = 0; i < numFollowUps; i++) {
      const dataFollowUp = new Date(dataEvento.getTime() + (i + 1) * randomNumber(1, 7) * 24 * 60 * 60 * 1000);
      const dataPrevista = new Date(dataFollowUp.getTime() + randomNumber(1, 15) * 24 * 60 * 60 * 1000);
      const tipoContato = randomItem(tiposContato);

      await prisma.entityData.create({
        data: {
          entityId: entities['sinistro-followups'].id,
          tenantId: tenant.id,
          parentRecordId: sinistro.id,
          data: {
            'Data/Hora': dataFollowUp.toISOString(),
            'Tipo de Contato': tipoContato,
            'Prioridade': randomItem(prioridades),
            'Contato': randomItem(nomesPessoas),
            'Telefone/E-mail': tipoContato === 'E-mail' ? `${randomItem(nomesPessoas).toLowerCase().replace(/\s/g, '.')}@email.com` : generatePhone(),
            'Descrição': randomItem([
              'Contato com segurado para solicitar documentação complementar',
              'Vistoria do veículo realizada pela reguladora',
              'Análise técnica do sinistro concluída',
              'Envio de documentação para a seguradora',
              'Reunião com gerenciadora de risco para definição de estratégia',
              'Laudo pericial recebido e analisado',
              'Aprovação parcial da indenização',
              'Aguardando manifestação do segurado sobre proposta',
              'Documentos complementares recebidos e validados',
              'Perícia técnica agendada para próxima semana',
            ]),
            'Próxima Ação': randomItem([
              'Aguardar retorno do segurado',
              'Solicitar documentos adicionais',
              'Agendar nova vistoria',
              'Enviar relatório para seguradora',
              'Realizar follow-up em 48h',
              'Acompanhar processo de pagamento',
              'Validar documentação recebida',
              'Agendar reunião com reguladora',
            ]),
            'Data Prevista': dataPrevista.toISOString().split('T')[0],
          },
        },
      });
      totalFollowUps++;
    }
  }
  console.log(`✅ ${totalFollowUps} follow ups criados`);

  console.log('\n🎉 Dados COMPLETOS criados com sucesso!');
  console.log('\n📊 Resumo Final:');
  console.log(`   - Seguradoras: ${seguradoras.length} (todos os campos preenchidos)`);
  console.log(`   - Corretores: ${corretores.length} (todos os campos preenchidos)`);
  console.log(`   - Transportadoras: ${transportadoras.length} (todos os campos preenchidos)`);
  console.log(`   - Reguladoras: ${reguladoras.length} (todos os campos preenchidos)`);
  console.log(`   - Gerenciadores de Risco: ${gerenciadores.length} (todos os campos preenchidos)`);
  console.log(`   - Segurados: ${segurados.length} (todos os campos preenchidos)`);
  console.log(`   - Sinistros: ${sinistros.length} (TODOS OS CAMPOS preenchidos - incluindo valores, datas, documentos, veículos, etc.)`);
  console.log(`   - Follow Ups: ${totalFollowUps} (todos os campos preenchidos)`);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
