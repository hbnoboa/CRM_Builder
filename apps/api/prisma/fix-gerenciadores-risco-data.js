#!/usr/bin/env node

/**
 * Script para corrigir os dados da entidade gerenciadores-risco
 *
 * Problema: os dados foram salvos com chaves Nome/CNPJ/Email/Telefone
 * mas os slugs dos campos são name/cnpj/email/phone
 */

async function main() {
  // Importar dinamicamente após certificar que está no diretório correto
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    // Buscar a entidade
    const entity = await prisma.entity.findFirst({
      where: { slug: 'gerenciadores-risco' },
    });

    if (!entity) {
      console.error('Entidade gerenciadores-risco não encontrada');
      process.exit(1);
    }

    console.log(`✓ Entidade encontrada: ${entity.name} (${entity.id})`);

    // Buscar todos os registros dessa entidade
    const records = await prisma.entityData.findMany({
      where: { entityId: entity.id },
      select: { id: true, data: true },
    });

    console.log(`✓ Encontrados ${records.length} registros`);

    if (records.length === 0) {
      console.log('Nenhum registro para corrigir');
      return;
    }

    // Mapeamento de chaves antigas → novas
    const keyMapping = {
      'Nome': 'name',
      'CNPJ': 'cnpj',
      'Email': 'email',
      'Telefone': 'phone',
    };

    let updatedCount = 0;
    let skippedCount = 0;

    for (const record of records) {
      const oldData = record.data || {};
      const newData = {};
      let hasChanges = false;

      // Processar cada chave dos dados antigos
      for (const [oldKey, value] of Object.entries(oldData)) {
        const newKey = keyMapping[oldKey] || oldKey;

        if (newKey !== oldKey) {
          hasChanges = true;
          console.log(`  Mapeando "${oldKey}" → "${newKey}" no registro ${record.id}`);
        }

        newData[newKey] = value;
      }

      if (hasChanges) {
        // Atualizar no banco
        await prisma.entityData.update({
          where: { id: record.id },
          data: { data: newData },
        });
        updatedCount++;
        console.log(`  ✓ Registro ${record.id} atualizado`);
      } else {
        skippedCount++;
      }
    }

    console.log(`\n✓ Concluído!`);
    console.log(`  - ${updatedCount} registros atualizados`);
    console.log(`  - ${skippedCount} registros já estavam corretos`);

  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
