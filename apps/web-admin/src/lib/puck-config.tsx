'use client';

import { Config, Data } from '@measured/puck';
import {
  LayoutGrid,
  Type,
  Image,
  List,
  Table,
  Square,
  Columns,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { CustomApiViewer, CustomApiViewerPreview } from '@/components/puck/custom-api-viewer';

// Component Types
export type ComponentProps = {
  Heading: {
    text: string;
    level: 'h1' | 'h2' | 'h3' | 'h4';
    align: 'left' | 'center' | 'right';
  };
  Text: {
    text: string;
    align: 'left' | 'center' | 'right';
  };
  Button: {
    text: string;
    href: string;
    variant: 'primary' | 'secondary' | 'outline' | 'ghost';
    size: 'sm' | 'md' | 'lg';
  };
  Image: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    rounded?: boolean;
  };
  Card: {
    title: string;
    description: string;
    image?: string;
    link?: string;
  };
  Columns: {
    columns: { span: number }[];
  };
  Container: {
    maxWidth: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    padding: 'none' | 'sm' | 'md' | 'lg';
    background?: string;
  };
  Spacer: {
    size: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  };
  Divider: {
    color?: string;
    margin: 'sm' | 'md' | 'lg';
  };
  DateTable: {
    entitySlug: string;
    columns: string[];
    showPagination: boolean;
    pageSize: number;
  };
  DateList: {
    entitySlug: string;
    displayFields: string[];
    layout: 'list' | 'grid';
  };
  Form: {
    entitySlug: string;
    fields: string[];
    submitText: string;
    successMessage: string;
  };
  Stats: {
    items: {
      label: string;
      value: string;
      icon?: string;
    }[];
  };
  Hero: {
    title: string;
    subtitle: string;
    image?: string;
    ctaText?: string;
    ctaLink?: string;
  };
  CustomApiViewer: {
    apiPath: string;
    params: { key: string; value: string }[];
    displayMode: 'table' | 'list' | 'cards' | 'raw';
    title?: string;
    refreshInterval?: number;
  };
};

// Puck Configuration
export const puckConfig: Config<ComponentProps> = {
  categories: {
    layout: {
      title: 'Layout',
      components: ['Container', 'Columns', 'Spacer', 'Divider'],
    },
    typography: {
      title: 'Texto',
      components: ['Heading', 'Text'],
    },
    media: {
      title: 'Media',
      components: ['Image', 'Card', 'Hero'],
    },
    interactive: {
      title: 'Interactive',
      components: ['Button', 'Form'],
    },
    data: {
      title: 'Dados',
      components: ['DateTable', 'DateList', 'Stats', 'CustomApiViewer'],
    },
  },
  components: {
    Heading: {
      label: 'Title',
      defaultProps: {
        text: 'Title',
        level: 'h2',
        align: 'left',
      },
      fields: {
        text: { type: 'text', label: 'Texto' },
        level: {
          type: 'select',
          label: 'Level',
          options: [
            { label: 'H1', value: 'h1' },
            { label: 'H2', value: 'h2' },
            { label: 'H3', value: 'h3' },
            { label: 'H4', value: 'h4' },
          ],
        },
        align: {
          type: 'radio',
          label: 'Alinhamento',
          options: [
            { label: 'Esquerda', value: 'left' },
            { label: 'Centro', value: 'center' },
            { label: 'Direita', value: 'right' },
          ],
        },
      },
      render: ({ text, level, align }) => {
        const Tag = level;
        const sizes = {
          h1: 'text-4xl font-bold',
          h2: 'text-3xl font-semibold',
          h3: 'text-2xl font-semibold',
          h4: 'text-xl font-medium',
        };
        return (
          <Tag className={`${sizes[level]} text-${align}`}>
            {text}
          </Tag>
        );
      },
    },
    Text: {
      label: 'Texto',
      defaultProps: {
        text: 'Digite seu texto aqui...',
        align: 'left',
      },
      fields: {
        text: { type: 'textarea', label: 'Content' },
        align: {
          type: 'radio',
          label: 'Alinhamento',
          options: [
            { label: 'Esquerda', value: 'left' },
            { label: 'Centro', value: 'center' },
            { label: 'Direita', value: 'right' },
          ],
        },
      },
      render: ({ text, align }) => (
        <p className={`text-base text-muted-foreground text-${align}`}>
          {text}
        </p>
      ),
    },
    Button: {
      label: 'Button',
      defaultProps: {
        text: 'Clique aqui',
        href: '#',
        variant: 'primary',
        size: 'md',
      },
      fields: {
        text: { type: 'text', label: 'Texto' },
        href: { type: 'text', label: 'Link' },
        variant: {
          type: 'select',
          label: 'Variante',
          options: [
            { label: 'Primary', value: 'primary' },
            { label: 'Secondary', value: 'secondary' },
            { label: 'Outline', value: 'outline' },
            { label: 'Ghost', value: 'ghost' },
          ],
        },
        size: {
          type: 'select',
          label: 'Tamanho',
          options: [
            { label: 'Pequeno', value: 'sm' },
            { label: 'Medium', value: 'md' },
            { label: 'Grande', value: 'lg' },
          ],
        },
      },
      render: ({ text, href, variant, size }) => {
        const variants = {
          primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
          secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          outline: 'border border-input bg-background hover:bg-accent',
          ghost: 'hover:bg-accent hover:text-accent-foreground',
        };
        const sizes = {
          sm: 'h-8 px-3 text-sm',
          md: 'h-10 px-4',
          lg: 'h-12 px-6 text-lg',
        };
        return (
          <a
            href={href}
            className={`inline-flex items-center justify-center rounded-md font-medium transition-colors ${variants[variant]} ${sizes[size]}`}
          >
            {text}
          </a>
        );
      },
    },
    Image: {
      label: 'Imagem',
      defaultProps: {
        src: 'https://via.placeholder.com/800x400',
        alt: 'Imagem',
        rounded: false,
      },
      fields: {
        src: { type: 'text', label: 'URL da Imagem' },
        alt: { type: 'text', label: 'Texto Alternactive' },
        width: { type: 'number', label: 'Largura (px)' },
        height: { type: 'number', label: 'Altura (px)' },
        rounded: { type: 'radio', label: 'Arredondado', options: [
          { label: 'Yes', value: true },
          { label: 'No', value: false },
        ]},
      },
      render: ({ src, alt, width, height, rounded }) => (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          className={`max-w-full h-auto ${rounded ? 'rounded-lg' : ''}`}
        />
      ),
    },
    Card: {
      label: 'Card',
      defaultProps: {
        title: 'Title do Card',
        description: 'Description do card aqui...',
      },
      fields: {
        title: { type: 'text', label: 'Title' },
        description: { type: 'textarea', label: 'Description' },
        image: { type: 'text', label: 'URL da Imagem' },
        link: { type: 'text', label: 'Link' },
      },
      render: ({ title, description, image, link }) => (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
          {image && (
            <img src={image} alt={title} className="w-full h-48 object-cover" />
          )}
          <div className="p-6">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground mt-2">{description}</p>
            {link && (
              <a href={link} className="text-primary text-sm mt-4 inline-flex items-center gap-1 hover:underline">
                Saiba mais <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      ),
    },
    Container: {
      label: 'Container',
      defaultProps: {
        maxWidth: 'lg',
        padding: 'md',
      },
      fields: {
        maxWidth: {
          type: 'select',
          label: 'Max Width',
          options: [
            { label: 'Pequeno (640px)', value: 'sm' },
            { label: 'Medium (768px)', value: 'md' },
            { label: 'Grande (1024px)', value: 'lg' },
            { label: 'Extra Grande (1280px)', value: 'xl' },
            { label: 'Completo', value: 'full' },
          ],
        },
        padding: {
          type: 'select',
          label: 'Padding',
          options: [
            { label: 'No', value: 'none' },
            { label: 'Pequeno', value: 'sm' },
            { label: 'Medium', value: 'md' },
            { label: 'Grande', value: 'lg' },
          ],
        },
        background: { type: 'text', label: 'Cor de Fundo (CSS)' },
      },
      render: ({ maxWidth, padding, background, puck }) => {
        const widths = {
          sm: 'max-w-screen-sm',
          md: 'max-w-screen-md',
          lg: 'max-w-screen-lg',
          xl: 'max-w-screen-xl',
          full: 'max-w-full',
        };
        const paddings = {
          none: 'p-0',
          sm: 'p-4',
          md: 'p-6',
          lg: 'p-8',
        };
        return (
          <div
            className={`mx-auto ${widths[maxWidth]} ${paddings[padding]}`}
            style={{ background }}
          >
            {puck.renderDropZone({ zone: 'content' })}
          </div>
        );
      },
    },
    Columns: {
      label: 'Colunas',
      defaultProps: {
        columns: [{ span: 6 }, { span: 6 }],
      },
      fields: {
        columns: {
          type: 'array',
          label: 'Colunas',
          arrayFields: {
            span: {
              type: 'number',
              label: 'Largura (1-12)',
              min: 1,
              max: 12,
            },
          },
        },
      },
      render: ({ columns, puck }) => (
        <div className="grid grid-cols-12 gap-4">
          {columns.map((col, idx) => (
            <div key={idx} style={{ gridColumn: `span ${col.span}` }}>
              {puck.renderDropZone({ zone: `column-${idx}` })}
            </div>
          ))}
        </div>
      ),
    },
    Spacer: {
      label: 'Spacer',
      defaultProps: {
        size: 'md',
      },
      fields: {
        size: {
          type: 'select',
          label: 'Tamanho',
          options: [
            { label: 'Extra Pequeno', value: 'xs' },
            { label: 'Pequeno', value: 'sm' },
            { label: 'Medium', value: 'md' },
            { label: 'Grande', value: 'lg' },
            { label: 'Extra Grande', value: 'xl' },
          ],
        },
      },
      render: ({ size }) => {
        const sizes = {
          xs: 'h-2',
          sm: 'h-4',
          md: 'h-8',
          lg: 'h-16',
          xl: 'h-24',
        };
        return <div className={sizes[size]} />;
      },
    },
    Divider: {
      label: 'Divisor',
      defaultProps: {
        margin: 'md',
      },
      fields: {
        color: { type: 'text', label: 'Cor (CSS)' },
        margin: {
          type: 'select',
          label: 'Margem',
          options: [
            { label: 'Pequena', value: 'sm' },
            { label: 'Medium', value: 'md' },
            { label: 'Grande', value: 'lg' },
          ],
        },
      },
      render: ({ color, margin }) => {
        const margins = {
          sm: 'my-2',
          md: 'my-4',
          lg: 'my-8',
        };
        return (
          <hr
            className={`border-t ${margins[margin]}`}
            style={{ borderColor: color }}
          />
        );
      },
    },
    DateTable: {
      label: 'Tabela de Dados',
      defaultProps: {
        entitySlug: '',
        columns: [],
        showPagination: true,
        pageSize: 10,
      },
      fields: {
        entitySlug: { type: 'text', label: 'Slug da Entity' },
        columns: {
          type: 'array',
          label: 'Colunas',
          arrayFields: {
            field: { type: 'text', label: 'Field' },
          },
        },
        showPagination: { type: 'radio', label: 'Show Pagination', options: [
          { label: 'Yes', value: true },
          { label: 'No', value: false },
        ]},
        pageSize: { type: 'number', label: 'Itens por Page' },
      },
      render: ({ entitySlug }) => (
        <div className="border rounded-lg p-4 bg-muted/50">
          <p className="text-center text-muted-foreground">
            📊 Tabela de dados: <strong>{entitySlug || 'Select an entity'}</strong>
          </p>
          <p className="text-center text-sm text-muted-foreground mt-2">
            (Date will be loaded at runtime)
          </p>
        </div>
      ),
    },
    DateList: {
      label: 'Lista de Dados',
      defaultProps: {
        entitySlug: '',
        displayFields: [],
        layout: 'list',
      },
      fields: {
        entitySlug: { type: 'text', label: 'Slug da Entity' },
        displayFields: {
          type: 'array',
          label: 'Fields a Exibir',
          arrayFields: {
            field: { type: 'text', label: 'Field' },
          },
        },
        layout: {
          type: 'radio',
          label: 'Layout',
          options: [
            { label: 'Lista', value: 'list' },
            { label: 'Grid', value: 'grid' },
          ],
        },
      },
      render: ({ entitySlug, layout }) => (
        <div className="border rounded-lg p-4 bg-muted/50">
          <p className="text-center text-muted-foreground">
            📋 Lista de dados ({layout}): <strong>{entitySlug || 'Select an entity'}</strong>
          </p>
        </div>
      ),
    },
    Form: {
      label: 'Form',
      defaultProps: {
        entitySlug: '',
        fields: [],
        submitText: 'Submit',
        successMessage: 'Enviado com sucesso!',
      },
      fields: {
        entitySlug: { type: 'text', label: 'Slug da Entity' },
        fields: {
          type: 'array',
          label: 'Fields',
          arrayFields: {
            field: { type: 'text', label: 'Field' },
          },
        },
        submitText: { type: 'text', label: 'Texto do Button' },
        successMessage: { type: 'text', label: 'Mensagem de Success' },
      },
      render: ({ entitySlug, submitText }) => (
        <div className="border rounded-lg p-4 bg-muted/50">
          <p className="text-center text-muted-foreground">
            📝 Form: <strong>{entitySlug || 'Select an entity'}</strong>
          </p>
          <div className="flex justify-center mt-4">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
              {submitText}
            </button>
          </div>
        </div>
      ),
    },
    Stats: {
      label: 'Statistics',
      defaultProps: {
        items: [
          { label: 'Total', value: '100' },
          { label: 'Actives', value: '85' },
          { label: 'News', value: '12' },
        ],
      },
      fields: {
        items: {
          type: 'array',
          label: 'Itens',
          arrayFields: {
            label: { type: 'text', label: 'Label' },
            value: { type: 'text', label: 'Valor' },
            icon: { type: 'text', label: 'Icon' },
          },
        },
      },
      render: ({ items }) => (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((item, idx) => (
            <div key={idx} className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-sm text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      ),
    },
    Hero: {
      label: 'Hero',
      defaultProps: {
        title: 'Welcome ao CRM',
        subtitle: 'Gerencie seus clientes de forma simples e eficiente',
        ctaText: 'Get Started',
        ctaLink: '#',
      },
      fields: {
        title: { type: 'text', label: 'Title' },
        subtitle: { type: 'textarea', label: 'Subtitle' },
        image: { type: 'text', label: 'URL da Imagem de Fundo' },
        ctaText: { type: 'text', label: 'Texto do CTA' },
        ctaLink: { type: 'text', label: 'Link do CTA' },
      },
      render: ({ title, subtitle, image, ctaText, ctaLink }) => (
        <div
          className="relative py-20 px-6 text-center rounded-lg overflow-hidden"
          style={{
            backgroundImage: image ? `url(${image})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {image && <div className="absolute inset-0 bg-black/50" />}
          <div className="relative z-10">
            <h1 className={`text-4xl font-bold mb-4 ${image ? 'text-white' : ''}`}>
              {title}
            </h1>
            <p className={`text-lg mb-8 max-w-2xl mx-auto ${image ? 'text-white/90' : 'text-muted-foreground'}`}>
              {subtitle}
            </p>
            {ctaText && (
              <a
                href={ctaLink}
                className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90"
              >
                {ctaText}
              </a>
            )}
          </div>
        </div>
      ),
    },
    CustomApiViewer: {
      label: 'Custom API Viewer',
      defaultProps: {
        apiPath: '',
        params: [],
        displayMode: 'table',
        title: '',
        refreshInterval: 0,
      },
      fields: {
        title: { type: 'text', label: 'Titulo (opcional)' },
        apiPath: {
          type: 'text',
          label: 'Caminho da API (ex: /cliente-reclamacoes)'
        },
        params: {
          type: 'array',
          label: 'Parametros',
          arrayFields: {
            key: { type: 'text', label: 'Nome' },
            value: { type: 'text', label: 'Valor' },
          },
        },
        displayMode: {
          type: 'select',
          label: 'Modo de Exibicao',
          options: [
            { label: 'Tabela', value: 'table' },
            { label: 'Lista', value: 'list' },
            { label: 'Cards', value: 'cards' },
            { label: 'JSON (Raw)', value: 'raw' },
          ],
        },
        refreshInterval: {
          type: 'number',
          label: 'Auto-refresh (segundos, 0 = desabilitado)'
        },
      },
      render: ({ apiPath, params, displayMode, title, refreshInterval, puck }) => {
        // In editor mode, show preview
        if (puck?.isEditing) {
          return (
            <CustomApiViewerPreview
              apiPath={apiPath}
              params={params}
              displayMode={displayMode}
              title={title}
              refreshInterval={refreshInterval}
            />
          );
        }
        // In view mode, render actual component
        return (
          <CustomApiViewer
            apiPath={apiPath}
            params={params}
            displayMode={displayMode}
            title={title}
            refreshInterval={refreshInterval}
          />
        );
      },
    },
  },
};

// Initial data for new pages
export const initialData: Data = {
  content: [],
  root: { props: {} },
};
