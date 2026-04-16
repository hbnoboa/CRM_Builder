const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const tiposCarreta = ['Baú', 'Graneleira', 'Sider', 'Refrigerada', 'Tanque', 'Porta Container', 'Cegonha'];

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
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

  console.log('\n🔍 Buscando entity Sinistros...');
  const entity = await prisma.entity.findFirst({
    where: { tenantId: tenant.id, slug: 'sinistros' },
  });

  if (!entity) {
    throw new Error('Entity Sinistros não encontrada');
  }

  console.log('\n📝 Buscando todos os sinistros...');
  const sinistros = await prisma.entityData.findMany({
    where: {
      tenantId: tenant.id,
      entityId: entity.id,
    },
  });

  console.log(`✅ ${sinistros.length} sinistros encontrados`);

  console.log('\n🔄 Atualizando sinistros com TODOS os campos faltantes...');
  let updated = 0;

  for (const sinistro of sinistros) {
    const currentData = sinistro.data;
    const dataEvento = new Date(currentData['Data/Hora do Evento']);

    // Gerar datas de envio dos documentos (entre o evento e hoje)
    const now = new Date();
    const dataNF = randomDate(dataEvento, now);
    const dataCTE = randomDate(dataEvento, now);
    const dataMDFE = randomDate(dataEvento, now);
    const dataAverbacao = randomDate(dataEvento, now);
    const dataCNH = randomDate(dataEvento, now);
    const dataBO = randomDate(dataEvento, now);
    const dataBOFurto = randomDate(dataEvento, now);
    const dataDeclMotorista = randomDate(dataEvento, now);
    const dataDocsVeiculo = randomDate(dataEvento, now);
    const dataTacografo = randomDate(dataEvento, now);
    const dataDocTerceiros = randomDate(dataEvento, now);
    const dataFotos = randomDate(dataEvento, now);
    const dataRelMonitoramento = randomDate(dataEvento, now);
    const dataRelReguladora = randomDate(dataEvento, now);

    // Dados completos com TODOS os campos
    const updatedData = {
      ...currentData,
      // Carretas 2, 3, 4 (campos que faltavam)
      'Placa': currentData['Placa'] || generatePlaca(), // Carreta 1 (já existe)
      'Ano': currentData['Ano'] || randomNumber(2015, 2024),
      'Tipo da Carreta': currentData['Tipo da Carreta'] || randomItem(tiposCarreta),

      // Carreta 2 (campos 29, 30, 31)
      'Placa.1': generatePlaca(),
      'Ano.1': randomNumber(2015, 2024),
      'Tipo da Carreta.1': randomItem(tiposCarreta),

      // Carreta 3 (campos 32, 33, 34)
      'Placa.2': generatePlaca(),
      'Ano.2': randomNumber(2015, 2024),
      'Tipo da Carreta.2': randomItem(tiposCarreta),

      // Carreta 4 (campos 35, 36, 37 - mas 37 é na verdade campo 28 repetido)
      'Placa.3': generatePlaca(),
      'Ano.3': randomNumber(2015, 2024),

      // Documentos e datas de envio (14 documentos x 2 = 28 campos)
      'NF': `/uploads/sinistros/${sinistro.id}/nf-${randomNumber(1000, 9999)}.pdf`,
      'Data Envio NF': dataNF.toISOString(),

      'CTE': `/uploads/sinistros/${sinistro.id}/cte-${randomNumber(1000, 9999)}.pdf`,
      'Data Envio CTE': dataCTE.toISOString(),

      'MDFE': `/uploads/sinistros/${sinistro.id}/mdfe-${randomNumber(1000, 9999)}.pdf`,
      'Data Envio MDFE': dataMDFE.toISOString(),

      'Averbação': `/uploads/sinistros/${sinistro.id}/averbacao-${randomNumber(1000, 9999)}.pdf`,
      'Data Envio Averbação': dataAverbacao.toISOString(),

      'CNH': `/uploads/sinistros/${sinistro.id}/cnh-${randomNumber(1000, 9999)}.pdf`,
      'Data Envio CNH': dataCNH.toISOString(),

      'Boletim de Ocorrência': `/uploads/sinistros/${sinistro.id}/bo-${randomNumber(1000, 9999)}.pdf`,
      'Data Envio BO': dataBO.toISOString(),

      'Boletim de Ocorrência de Furto': `/uploads/sinistros/${sinistro.id}/bo-furto-${randomNumber(1000, 9999)}.pdf`,
      'Data Envio BO Furto': dataBOFurto.toISOString(),

      'Declaração do Motorista': `/uploads/sinistros/${sinistro.id}/declaracao-motorista-${randomNumber(1000, 9999)}.pdf`,
      'Data Envio Decl. Motorista': dataDeclMotorista.toISOString(),

      'Documentos do Veículo': `/uploads/sinistros/${sinistro.id}/docs-veiculo-${randomNumber(1000, 9999)}.pdf`,
      'Data Envio Docs Veículo': dataDocsVeiculo.toISOString(),

      'Tacógrafo': `/uploads/sinistros/${sinistro.id}/tacografo-${randomNumber(1000, 9999)}.pdf`,
      'Data Envio Tacógrafo': dataTacografo.toISOString(),

      'Documento de Terceiros': `/uploads/sinistros/${sinistro.id}/doc-terceiros-${randomNumber(1000, 9999)}.pdf`,
      'Data Envio Doc. Terceiros': dataDocTerceiros.toISOString(),

      'Fotos do Sinistro': `/uploads/sinistros/${sinistro.id}/fotos-${randomNumber(1000, 9999)}.zip`,
      'Data Envio Fotos': dataFotos.toISOString(),

      'Relatórios de Monitoramento': `/uploads/sinistros/${sinistro.id}/rel-monitoramento-${randomNumber(1000, 9999)}.pdf`,
      'Data Envio Rel. Monitoramento': dataRelMonitoramento.toISOString(),

      'Relatório da Reguladora': `/uploads/sinistros/${sinistro.id}/rel-reguladora-${randomNumber(1000, 9999)}.pdf`,
      'Data Envio Rel. Reguladora': dataRelReguladora.toISOString(),
    };

    await prisma.entityData.update({
      where: { id: sinistro.id },
      data: { data: updatedData },
    });

    updated++;
    if (updated % 10 === 0) {
      console.log(`   ✓ ${updated}/${sinistros.length} sinistros atualizados...`);
    }
  }

  console.log(`\n✅ ${updated} sinistros atualizados com TODOS os 75 campos!`);

  // Verificar um sinistro atualizado
  const sampleSinistro = await prisma.entityData.findFirst({
    where: {
      tenantId: tenant.id,
      entityId: entity.id,
    },
  });

  console.log(`\n📊 Campos preenchidos no sinistro de exemplo: ${Object.keys(sampleSinistro.data).length}`);
  console.log('\nCampos incluídos:');
  Object.keys(sampleSinistro.data).sort().forEach((key, idx) => {
    console.log(`  ${idx + 1}. ${key}`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
