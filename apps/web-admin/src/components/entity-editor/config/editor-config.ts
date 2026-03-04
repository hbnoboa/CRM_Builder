import type { EditorConfig } from 'grapesjs';
import { getCanvasStyles } from './theme';

/**
 * Configuracao base do GrapeJS para o editor de entidades.
 * - Sem Style Manager (layout controlado por grid-row/grid-cell)
 * - Sem Layer Manager (campos sao flat)
 * - Storage desabilitado (save via API)
 */
export function createEditorConfig(
  container: HTMLElement | string,
  isDarkMode: boolean,
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

    // Canvas config
    canvas: {
      styles: [getCanvasStyles(isDarkMode)],
    },

    // Bloquear edicao de texto inline no canvas
    // Os campos sao configurados via traits, nao por edicao direta
    richTextEditor: { enable: false },

    // Panels customizados
    panels: {
      defaults: [
        {
          id: 'views',
          el: '.panel__views',
          buttons: {
            defaults: [
              {
                id: 'open-blocks',
                className: 'fa fa-th-large',
                command: 'open-blocks',
                togglable: false,
                active: true,
                label: 'Campos',
              },
            ],
          },
        },
        {
          id: 'options',
          el: '.panel__options',
          buttons: {
            defaults: [
              {
                id: 'undo',
                className: 'fa fa-undo',
                command: 'core:undo',
                label: 'Desfazer',
              },
              {
                id: 'redo',
                className: 'fa fa-repeat',
                command: 'core:redo',
                label: 'Refazer',
              },
              {
                id: 'clear',
                className: 'fa fa-trash',
                command: 'core:canvas-clear',
                label: 'Limpar',
              },
            ],
          },
        },
      ],
    },

    // Bloquear componentes padroes do GrapeJS
    blockManager: {
      appendTo: '.blocks-container',
    },

    // Traits no painel direito
    traitManager: {
      appendTo: '.traits-container',
    },

    // Selector manager - desabilitado
    selectorManager: {
      componentFirst: true,
      custom: true,
    },

    // Desabilitar drag de componentes nativos
    domComponents: {
      storeWrapper: 1,
    },

    // Desabilitar features nativas que nao fazem sentido
    // para editor de entidades
    plugins: [],
    pluginsOpts: {},
  };
}
