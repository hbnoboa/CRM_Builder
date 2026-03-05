import type { EditorConfig } from 'grapesjs';

/**
 * Configuracao base do GrapeJS para o editor de entidades.
 * - Sem Style Manager (layout controlado por grid-row/grid-cell)
 * - Sem Layer Manager (campos sao flat)
 * - Storage desabilitado (save via API)
 */
export function createEditorConfig(
  container: HTMLElement | string,
): EditorConfig {
  return {
    container,
    height: '100%',
    width: 'auto',
    fromElement: false,

    // Desabilitar funcionalidades nao necessarias
    storageManager: false,
    styleManager: { sectors: [] },
    layerManager: { appendTo: '' },

    // Device manager - largura fixa do formulario
    deviceManager: {
      devices: [
        { name: 'Form', width: '800px' },
      ],
    },

    // Canvas config - CSS injetado via onEditor callback (nao data URI)
    canvas: {
      styles: [
        'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      ],
    },

    // Bloquear edicao de texto inline no canvas
    richTextEditor: { enable: false },

    // Panels customizados
    panels: {
      defaults: [],
    },

    // Blocos no painel esquerdo
    blockManager: {
      appendTo: '.blocks-container',
    },

    // Traits no painel direito
    traitManager: {
      appendTo: '.traits-container',
    },

    // Selector manager
    selectorManager: {
      componentFirst: true,
      custom: true,
    },

    domComponents: {
      storeWrapper: 1,
    },

    plugins: [],
    pluginsOpts: {},
  };
}
