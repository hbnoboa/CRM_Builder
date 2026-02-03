'use client';

import { Config, Data } from '@measured/puck';
import { ArrowRight } from 'lucide-react';
import { CustomApiViewer, CustomApiViewerPreview } from '@/components/puck/custom-api-viewer';

// Layout Components
import {
  Row, RowProps,
  Section, SectionProps,
  FlexRow, FlexRowProps,
  Grid, GridProps,
  LAYOUT_OPTIONS,
} from '@/components/puck/row-col';

// Form Field Components
import {
  TextInput, TextInputProps,
  TextAreaField, TextAreaProps,
  NumberInput, NumberInputProps,
  SelectField, SelectFieldProps,
  CheckboxField, CheckboxFieldProps,
  DatePickerField, DatePickerProps,
  FileUploadField, FileUploadProps,
  ImageUploadField, ImageUploadProps,
  MapPickerField, MapPickerProps,
  EmailInput, EmailInputProps,
  PhoneInput, PhoneInputProps,
  CurrencyInput, CurrencyInputProps,
  TagsInput, TagsInputProps,
  RatingField, RatingFieldProps,
  SwitchField, SwitchFieldProps,
} from '@/components/puck/form-fields';

// UI Components
import { Tabs, TabsPreview, TabsProps } from '@/components/puck/tabs';
import { KanbanBoard, KanbanBoardPreview, KanbanBoardProps } from '@/components/puck/kanban-board';
import { Timeline, TimelinePreview, TimelineProps } from '@/components/puck/timeline';
import { Alert, AlertPreview, AlertProps } from '@/components/puck/alert';
import { Progress, ProgressPreview, ProgressProps } from '@/components/puck/progress';
import { BarChart, LineChart, PieChart, BarChartPreview, LineChartPreview, PieChartPreview, ChartProps } from '@/components/puck/charts';
import { RelatedRecords, RelatedRecordsPreview, RelatedRecordsProps } from '@/components/puck/related-records';
import { Accordion, AccordionPreview, AccordionProps } from '@/components/puck/accordion';
import { Badge, BadgePreview, BadgeProps } from '@/components/puck/badge';
import { Avatar, AvatarPreview, AvatarProps } from '@/components/puck/avatar';
import { CalendarView, CalendarViewPreview, CalendarViewProps } from '@/components/puck/calendar-view';
import { MetricCard, MetricCardPreview, MetricCardProps } from '@/components/puck/metric-card';
import { DetailView, DetailViewPreview, DetailViewProps } from '@/components/puck/detail-view';
import { TreeView, TreeViewPreview, TreeViewProps } from '@/components/puck/tree-view';
import { Steps, StepsPreview, StepsProps } from '@/components/puck/steps';
import { LinkList, LinkListPreview, LinkListProps } from '@/components/puck/link-list';
import { MapView, MapViewPreview, MapViewProps } from '@/components/puck/map-view';
import { Testimonial, TestimonialPreview, TestimonialProps } from '@/components/puck/testimonial';
import { PricingTable, PricingTablePreview, PricingTableProps } from '@/components/puck/pricing-table';

// Component Types
export type ComponentProps = {
  // ========== LAYOUT COMPONENTS ==========
  Row: RowProps;
  Section: SectionProps;
  FlexRow: FlexRowProps;
  Grid: GridProps;
  Spacer: {
    size: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  };
  Divider: {
    color?: string;
    margin: 'sm' | 'md' | 'lg';
  };

  // ========== FORM FIELDS ==========
  TextInput: TextInputProps;
  TextAreaField: TextAreaProps;
  NumberInput: NumberInputProps;
  SelectField: SelectFieldProps;
  CheckboxField: CheckboxFieldProps;
  DatePickerField: DatePickerProps;
  FileUploadField: FileUploadProps;
  ImageUploadField: ImageUploadProps;
  MapPickerField: MapPickerProps;
  EmailInput: EmailInputProps;
  PhoneInput: PhoneInputProps;
  CurrencyInput: CurrencyInputProps;
  TagsInput: TagsInputProps;
  RatingField: RatingFieldProps;
  SwitchField: SwitchFieldProps;

  // ========== BASIC COMPONENTS ==========
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
  // New Components - using simplified types for Puck compatibility
  Tabs: {
    tabs: { label: string; content?: string }[];
    defaultTab?: number;
    variant?: 'default' | 'pills' | 'underline';
  };
  KanbanBoard: {
    columns: { id: string; title: string; color?: string }[];
    entitySlug?: string;
    statusField?: string;
  };
  Timeline: {
    items: { title: string; description?: string; date?: string; status?: 'completed' | 'current' | 'pending' | 'error' }[];
    variant?: 'default' | 'alternate' | 'compact';
  };
  Alert: {
    title?: string;
    description: string;
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
    dismissible?: boolean;
  };
  Progress: {
    value: number;
    max?: number;
    label?: string;
    showValue?: boolean;
    variant?: 'default' | 'success' | 'warning' | 'error';
    size?: 'sm' | 'md' | 'lg';
    type?: 'bar' | 'circle';
  };
  BarChart: ChartProps;
  LineChart: ChartProps;
  PieChart: ChartProps;
  RelatedRecords: RelatedRecordsProps;
  Accordion: AccordionProps;
  Badge: BadgeProps;
  Avatar: AvatarProps;
  CalendarView: CalendarViewProps;
  MetricCard: MetricCardProps;
  DetailView: DetailViewProps;
  TreeView: TreeViewProps;
  Steps: StepsProps;
  LinkList: LinkListProps;
  MapView: MapViewProps;
  Testimonial: TestimonialProps;
  PricingTable: PricingTableProps;
};

// Puck Configuration
export const puckConfig: Config<ComponentProps> = {
  categories: {
    estrutura: {
      title: 'Estrutura',
      components: ['Section', 'Row', 'Grid', 'FlexRow', 'Spacer', 'Divider'],
      defaultExpanded: true,
    },
    campos: {
      title: 'Campos de Formulario',
      components: [
        'TextInput',
        'TextAreaField',
        'NumberInput',
        'SelectField',
        'CheckboxField',
        'SwitchField',
        'DatePickerField',
        'EmailInput',
        'PhoneInput',
        'CurrencyInput',
        'FileUploadField',
        'ImageUploadField',
        'MapPickerField',
        'TagsInput',
        'RatingField',
      ],
      defaultExpanded: true,
    },
    texto: {
      title: 'Texto',
      components: ['Heading', 'Text'],
    },
    media: {
      title: 'Media',
      components: ['Image', 'Card', 'Hero', 'Avatar', 'Badge'],
    },
    interativo: {
      title: 'Interativo',
      components: ['Button', 'Form', 'Tabs', 'Accordion', 'Steps', 'LinkList'],
    },
    dados: {
      title: 'Dados',
      components: ['DateTable', 'DateList', 'Stats', 'CustomApiViewer', 'RelatedRecords', 'DetailView'],
    },
    graficos: {
      title: 'Graficos',
      components: ['BarChart', 'LineChart', 'PieChart', 'MetricCard', 'Progress'],
    },
    feedback: {
      title: 'Feedback',
      components: ['Alert', 'Timeline'],
    },
    avancado: {
      title: 'Avancado',
      components: ['KanbanBoard', 'CalendarView', 'TreeView', 'MapView'],
    },
    marketing: {
      title: 'Marketing',
      components: ['Testimonial', 'PricingTable'],
    },
  },
  components: {
    // ========== FORM FIELD COMPONENTS ==========

    TextInput: {
      label: 'Campo de Texto',
      defaultProps: {
        label: 'Nome',
        placeholder: '',
        required: false,
        helpText: '',
        fieldName: '',
      },
      fields: {
        label: { type: 'text', label: 'Label' },
        placeholder: { type: 'text', label: 'Placeholder' },
        fieldName: { type: 'text', label: 'Nome do Campo (para API)' },
        required: { type: 'radio', label: 'Obrigatorio', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
        helpText: { type: 'text', label: 'Texto de Ajuda' },
      },
      render: (props) => <TextInput {...props} />,
    },

    TextAreaField: {
      label: 'Area de Texto',
      defaultProps: {
        label: 'Descricao',
        placeholder: '',
        required: false,
        rows: 3,
        helpText: '',
        fieldName: '',
      },
      fields: {
        label: { type: 'text', label: 'Label' },
        placeholder: { type: 'text', label: 'Placeholder' },
        fieldName: { type: 'text', label: 'Nome do Campo' },
        rows: { type: 'number', label: 'Linhas' },
        required: { type: 'radio', label: 'Obrigatorio', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
        helpText: { type: 'text', label: 'Texto de Ajuda' },
      },
      render: (props) => <TextAreaField {...props} />,
    },

    NumberInput: {
      label: 'Campo Numerico',
      defaultProps: {
        label: 'Quantidade',
        placeholder: '0',
        required: false,
        min: undefined,
        max: undefined,
        step: 1,
        helpText: '',
        fieldName: '',
      },
      fields: {
        label: { type: 'text', label: 'Label' },
        placeholder: { type: 'text', label: 'Placeholder' },
        fieldName: { type: 'text', label: 'Nome do Campo' },
        min: { type: 'number', label: 'Valor Minimo' },
        max: { type: 'number', label: 'Valor Maximo' },
        step: { type: 'number', label: 'Incremento' },
        required: { type: 'radio', label: 'Obrigatorio', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
        helpText: { type: 'text', label: 'Texto de Ajuda' },
      },
      render: (props) => <NumberInput {...props} />,
    },

    SelectField: {
      label: 'Select (Dropdown)',
      defaultProps: {
        label: 'Opcao',
        placeholder: 'Selecione...',
        required: false,
        options: [
          { label: 'Opcao 1', value: 'opcao1' },
          { label: 'Opcao 2', value: 'opcao2' },
          { label: 'Opcao 3', value: 'opcao3' },
        ],
        helpText: '',
        fieldName: '',
      },
      fields: {
        label: { type: 'text', label: 'Label' },
        placeholder: { type: 'text', label: 'Placeholder' },
        fieldName: { type: 'text', label: 'Nome do Campo' },
        options: {
          type: 'array',
          label: 'Opcoes',
          arrayFields: {
            label: { type: 'text', label: 'Texto' },
            value: { type: 'text', label: 'Valor' },
          },
        },
        required: { type: 'radio', label: 'Obrigatorio', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
        helpText: { type: 'text', label: 'Texto de Ajuda' },
      },
      render: (props) => <SelectField {...props} />,
    },

    CheckboxField: {
      label: 'Checkbox',
      defaultProps: {
        label: 'Aceito os termos',
        description: '',
        required: false,
        fieldName: '',
      },
      fields: {
        label: { type: 'text', label: 'Label' },
        description: { type: 'text', label: 'Descricao' },
        fieldName: { type: 'text', label: 'Nome do Campo' },
        required: { type: 'radio', label: 'Obrigatorio', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
      },
      render: (props) => <CheckboxField {...props} />,
    },

    SwitchField: {
      label: 'Switch (Toggle)',
      defaultProps: {
        label: 'Ativar notificacoes',
        description: '',
        defaultChecked: false,
        fieldName: '',
      },
      fields: {
        label: { type: 'text', label: 'Label' },
        description: { type: 'text', label: 'Descricao' },
        fieldName: { type: 'text', label: 'Nome do Campo' },
        defaultChecked: { type: 'radio', label: 'Ativo por Padrao', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
      },
      render: (props) => <SwitchField {...props} />,
    },

    DatePickerField: {
      label: 'Data',
      defaultProps: {
        label: 'Data',
        placeholder: '',
        required: false,
        includeTime: false,
        helpText: '',
        fieldName: '',
      },
      fields: {
        label: { type: 'text', label: 'Label' },
        placeholder: { type: 'text', label: 'Placeholder' },
        fieldName: { type: 'text', label: 'Nome do Campo' },
        includeTime: { type: 'radio', label: 'Incluir Hora', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
        required: { type: 'radio', label: 'Obrigatorio', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
        helpText: { type: 'text', label: 'Texto de Ajuda' },
      },
      render: (props) => <DatePickerField {...props} />,
    },

    EmailInput: {
      label: 'Email',
      defaultProps: {
        label: 'Email',
        placeholder: 'email@exemplo.com',
        required: false,
        helpText: '',
        fieldName: '',
      },
      fields: {
        label: { type: 'text', label: 'Label' },
        placeholder: { type: 'text', label: 'Placeholder' },
        fieldName: { type: 'text', label: 'Nome do Campo' },
        required: { type: 'radio', label: 'Obrigatorio', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
        helpText: { type: 'text', label: 'Texto de Ajuda' },
      },
      render: (props) => <EmailInput {...props} />,
    },

    PhoneInput: {
      label: 'Telefone',
      defaultProps: {
        label: 'Telefone',
        placeholder: '(00) 00000-0000',
        required: false,
        helpText: '',
        fieldName: '',
      },
      fields: {
        label: { type: 'text', label: 'Label' },
        placeholder: { type: 'text', label: 'Placeholder' },
        fieldName: { type: 'text', label: 'Nome do Campo' },
        required: { type: 'radio', label: 'Obrigatorio', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
        helpText: { type: 'text', label: 'Texto de Ajuda' },
      },
      render: (props) => <PhoneInput {...props} />,
    },

    CurrencyInput: {
      label: 'Moeda/Valor',
      defaultProps: {
        label: 'Valor',
        placeholder: '0,00',
        required: false,
        currency: 'R$',
        helpText: '',
        fieldName: '',
      },
      fields: {
        label: { type: 'text', label: 'Label' },
        placeholder: { type: 'text', label: 'Placeholder' },
        fieldName: { type: 'text', label: 'Nome do Campo' },
        currency: { type: 'text', label: 'Simbolo da Moeda' },
        required: { type: 'radio', label: 'Obrigatorio', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
        helpText: { type: 'text', label: 'Texto de Ajuda' },
      },
      render: (props) => <CurrencyInput {...props} />,
    },

    FileUploadField: {
      label: 'Upload de Arquivo',
      defaultProps: {
        label: 'Documento',
        required: false,
        accept: '.pdf,.doc,.docx',
        multiple: false,
        maxSize: 10,
        helpText: '',
        fieldName: '',
      },
      fields: {
        label: { type: 'text', label: 'Label' },
        fieldName: { type: 'text', label: 'Nome do Campo' },
        accept: { type: 'text', label: 'Tipos Aceitos (ex: .pdf,.doc)' },
        multiple: { type: 'radio', label: 'Multiplos Arquivos', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
        maxSize: { type: 'number', label: 'Tamanho Maximo (MB)' },
        required: { type: 'radio', label: 'Obrigatorio', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
        helpText: { type: 'text', label: 'Texto de Ajuda' },
      },
      render: (props) => <FileUploadField {...props} />,
    },

    ImageUploadField: {
      label: 'Upload de Imagem',
      defaultProps: {
        label: 'Foto',
        required: false,
        multiple: false,
        maxSize: 5,
        helpText: '',
        fieldName: '',
      },
      fields: {
        label: { type: 'text', label: 'Label' },
        fieldName: { type: 'text', label: 'Nome do Campo' },
        multiple: { type: 'radio', label: 'Multiplas Imagens', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
        maxSize: { type: 'number', label: 'Tamanho Maximo (MB)' },
        required: { type: 'radio', label: 'Obrigatorio', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
        helpText: { type: 'text', label: 'Texto de Ajuda' },
      },
      render: (props) => <ImageUploadField {...props} />,
    },

    MapPickerField: {
      label: 'Mapa/Localizacao',
      defaultProps: {
        label: 'Localizacao',
        required: false,
        defaultLat: -23.5505,
        defaultLng: -46.6333,
        zoom: 12,
        helpText: '',
        fieldName: '',
      },
      fields: {
        label: { type: 'text', label: 'Label' },
        fieldName: { type: 'text', label: 'Nome do Campo' },
        defaultLat: { type: 'number', label: 'Latitude Inicial' },
        defaultLng: { type: 'number', label: 'Longitude Inicial' },
        zoom: { type: 'number', label: 'Zoom Inicial (1-20)' },
        required: { type: 'radio', label: 'Obrigatorio', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
        helpText: { type: 'text', label: 'Texto de Ajuda' },
      },
      render: (props) => <MapPickerField {...props} />,
    },

    TagsInput: {
      label: 'Tags/Multiplos Valores',
      defaultProps: {
        label: 'Tags',
        placeholder: 'Digite e pressione Enter...',
        required: false,
        helpText: '',
        fieldName: '',
      },
      fields: {
        label: { type: 'text', label: 'Label' },
        placeholder: { type: 'text', label: 'Placeholder' },
        fieldName: { type: 'text', label: 'Nome do Campo' },
        required: { type: 'radio', label: 'Obrigatorio', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
        helpText: { type: 'text', label: 'Texto de Ajuda' },
      },
      render: (props) => <TagsInput {...props} />,
    },

    RatingField: {
      label: 'Avaliacao (Estrelas)',
      defaultProps: {
        label: 'Avaliacao',
        required: false,
        maxStars: 5,
        helpText: '',
        fieldName: '',
      },
      fields: {
        label: { type: 'text', label: 'Label' },
        fieldName: { type: 'text', label: 'Nome do Campo' },
        maxStars: { type: 'number', label: 'Numero de Estrelas' },
        required: { type: 'radio', label: 'Obrigatorio', options: [
          { label: 'Sim', value: true },
          { label: 'Nao', value: false },
        ]},
        helpText: { type: 'text', label: 'Texto de Ajuda' },
      },
      render: (props) => <RatingField {...props} />,
    },

    // ========== BASIC COMPONENTS ==========

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
    // ========== LAYOUT COMPONENTS ==========

    Section: {
      label: 'Section',
      defaultProps: {
        background: 'none',
        paddingY: 'md',
        maxWidth: 'lg',
      },
      fields: {
        background: {
          type: 'select',
          label: 'Fundo',
          options: [
            { label: 'Nenhum', value: 'none' },
            { label: 'Cinza', value: 'muted' },
            { label: 'Primario', value: 'primary' },
            { label: 'Secundario', value: 'secondary' },
            { label: 'Gradiente', value: 'gradient' },
            { label: 'Customizado', value: 'custom' },
          ],
        },
        customBackground: { type: 'text', label: 'CSS (se customizado)' },
        paddingY: {
          type: 'select',
          label: 'Espacamento Vertical',
          options: [
            { label: 'Nenhum', value: 'none' },
            { label: 'Pequeno', value: 'sm' },
            { label: 'Medio', value: 'md' },
            { label: 'Grande', value: 'lg' },
            { label: 'Extra Grande', value: 'xl' },
          ],
        },
        maxWidth: {
          type: 'select',
          label: 'Largura Maxima',
          options: [
            { label: 'Pequeno (640px)', value: 'sm' },
            { label: 'Medio (768px)', value: 'md' },
            { label: 'Grande (1024px)', value: 'lg' },
            { label: 'Extra Grande (1280px)', value: 'xl' },
            { label: 'Completo', value: 'full' },
          ],
        },
      },
      render: (props) => <Section {...props} />,
    },

    Row: {
      label: 'Row (Colunas)',
      defaultProps: {
        layout: '2-equal',
        gap: 'md',
        verticalAlign: 'stretch',
      },
      fields: {
        layout: {
          type: 'select',
          label: 'Layout',
          options: LAYOUT_OPTIONS,
        },
        customColumns: {
          type: 'array',
          label: 'Colunas Customizadas (se layout=custom)',
          arrayFields: {
            size: { type: 'number', label: 'Tamanho (1-12)' },
          },
        },
        gap: {
          type: 'select',
          label: 'Espacamento',
          options: [
            { label: 'Nenhum', value: 'none' },
            { label: 'Pequeno', value: 'sm' },
            { label: 'Medio', value: 'md' },
            { label: 'Grande', value: 'lg' },
          ],
        },
        verticalAlign: {
          type: 'select',
          label: 'Alinhamento Vertical',
          options: [
            { label: 'Topo', value: 'top' },
            { label: 'Centro', value: 'center' },
            { label: 'Base', value: 'bottom' },
            { label: 'Esticar', value: 'stretch' },
          ],
        },
      },
      render: (props) => <Row {...props} />,
    },

    Grid: {
      label: 'Grid',
      defaultProps: {
        columns: 3,
        gap: 'md',
      },
      fields: {
        columns: {
          type: 'select',
          label: 'Colunas',
          options: [
            { label: '2 colunas', value: 2 },
            { label: '3 colunas', value: 3 },
            { label: '4 colunas', value: 4 },
            { label: '5 colunas', value: 5 },
            { label: '6 colunas', value: 6 },
          ],
        },
        columnsMd: {
          type: 'select',
          label: 'Colunas (Tablet)',
          options: [
            { label: 'Igual', value: undefined },
            { label: '2 colunas', value: 2 },
            { label: '3 colunas', value: 3 },
            { label: '4 colunas', value: 4 },
          ],
        },
        columnsLg: {
          type: 'select',
          label: 'Colunas (Desktop)',
          options: [
            { label: 'Igual', value: undefined },
            { label: '3 colunas', value: 3 },
            { label: '4 colunas', value: 4 },
            { label: '5 colunas', value: 5 },
            { label: '6 colunas', value: 6 },
          ],
        },
        gap: {
          type: 'select',
          label: 'Espacamento',
          options: [
            { label: 'Nenhum', value: 'none' },
            { label: 'Pequeno', value: 'sm' },
            { label: 'Medio', value: 'md' },
            { label: 'Grande', value: 'lg' },
          ],
        },
      },
      render: (props) => <Grid {...props} />,
    },

    FlexRow: {
      label: 'Flex Row',
      defaultProps: {
        justify: 'start',
        align: 'center',
        wrap: false,
        gap: 'md',
      },
      fields: {
        justify: {
          type: 'select',
          label: 'Distribuicao Horizontal',
          options: [
            { label: 'Inicio', value: 'start' },
            { label: 'Centro', value: 'center' },
            { label: 'Fim', value: 'end' },
            { label: 'Espaco Entre', value: 'between' },
            { label: 'Espaco Ao Redor', value: 'around' },
            { label: 'Espaco Igual', value: 'evenly' },
          ],
        },
        align: {
          type: 'select',
          label: 'Alinhamento Vertical',
          options: [
            { label: 'Topo', value: 'start' },
            { label: 'Centro', value: 'center' },
            { label: 'Base', value: 'end' },
            { label: 'Esticar', value: 'stretch' },
          ],
        },
        wrap: {
          type: 'radio',
          label: 'Quebrar Linha',
          options: [
            { label: 'Sim', value: true },
            { label: 'Nao', value: false },
          ],
        },
        gap: {
          type: 'select',
          label: 'Espacamento',
          options: [
            { label: 'Nenhum', value: 'none' },
            { label: 'Pequeno', value: 'sm' },
            { label: 'Medio', value: 'md' },
            { label: 'Grande', value: 'lg' },
          ],
        },
      },
      render: (props) => <FlexRow {...props} />,
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
      render: ({ items }) => {
        const safeItems = Array.isArray(items) ? items : [];
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {safeItems.map((item, idx) => (
              <div key={idx} className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{item?.value || '-'}</p>
                <p className="text-sm text-muted-foreground">{item?.label || ''}</p>
              </div>
            ))}
          </div>
        );
      },
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
    
    // ========== NEW COMPONENTS ==========
    
    Tabs: {
      label: 'Abas',
      defaultProps: {
        tabs: [
          { label: 'Aba 1', content: 'Conteúdo da primeira aba' },
          { label: 'Aba 2', content: 'Conteúdo da segunda aba' },
        ],
        variant: 'default',
        defaultTab: 0,
      },
      fields: {
        tabs: {
          type: 'array',
          label: 'Abas',
          arrayFields: {
            label: { type: 'text', label: 'Título' },
            content: { type: 'textarea', label: 'Conteúdo' },
          },
        },
        variant: {
          type: 'select',
          label: 'Variante',
          options: [
            { label: 'Padrão', value: 'default' },
            { label: 'Pills', value: 'pills' },
            { label: 'Sublinhado', value: 'underline' },
          ],
        },
        defaultTab: { type: 'number', label: 'Aba Ativa (índice)' },
      },
      render: ({ tabs, variant, defaultTab, puck }) => {
        if (puck?.isEditing) {
          return <TabsPreview tabs={tabs} variant={variant} defaultTab={defaultTab} />;
        }
        return <Tabs tabs={tabs} variant={variant} defaultTab={defaultTab} />;
      },
    },

    KanbanBoard: {
      label: 'Kanban',
      defaultProps: {
        columns: [
          { id: 'todo', title: 'A Fazer', color: '#6366f1' },
          { id: 'doing', title: 'Em Andamento', color: '#f59e0b' },
          { id: 'done', title: 'Concluído', color: '#22c55e' },
        ],
        entitySlug: '',
        statusField: 'status',
      },
      fields: {
        columns: {
          type: 'array',
          label: 'Colunas',
          arrayFields: {
            id: { type: 'text', label: 'ID' },
            title: { type: 'text', label: 'Título' },
            color: { type: 'text', label: 'Cor (hex)' },
          },
        },
        entitySlug: { type: 'text', label: 'Entidade (slug)' },
        statusField: { type: 'text', label: 'Campo de Status' },
      },
      render: ({ columns, entitySlug, statusField, puck }) => {
        if (puck?.isEditing) {
          return <KanbanBoardPreview columns={columns} entitySlug={entitySlug} statusField={statusField} />;
        }
        return <KanbanBoard columns={columns} entitySlug={entitySlug} statusField={statusField} />;
      },
    },

    Timeline: {
      label: 'Linha do Tempo',
      defaultProps: {
        items: [
          { title: 'Evento 1', description: 'Descrição', date: new Date().toISOString(), status: 'completed' },
          { title: 'Evento 2', description: 'Descrição', date: new Date().toISOString(), status: 'current' },
        ],
        variant: 'default',
      },
      fields: {
        items: {
          type: 'array',
          label: 'Itens',
          arrayFields: {
            title: { type: 'text', label: 'Título' },
            description: { type: 'textarea', label: 'Descrição' },
            date: { type: 'text', label: 'Data' },
            status: { 
              type: 'select', 
              label: 'Status',
              options: [
                { label: 'Concluído', value: 'completed' },
                { label: 'Atual', value: 'current' },
                { label: 'Pendente', value: 'pending' },
                { label: 'Erro', value: 'error' },
              ],
            },
          },
        },
        variant: {
          type: 'select',
          label: 'Variante',
          options: [
            { label: 'Padrão', value: 'default' },
            { label: 'Alternado', value: 'alternate' },
            { label: 'Compacto', value: 'compact' },
          ],
        },
      },
      render: ({ items, variant, puck }) => {
        if (puck?.isEditing) {
          return <TimelinePreview items={items} variant={variant} />;
        }
        return <Timeline items={items} variant={variant} />;
      },
    },

    Alert: {
      label: 'Alerta',
      defaultProps: {
        variant: 'info',
        title: 'Informação',
        description: 'Esta é uma mensagem de alerta.',
        dismissible: false,
      },
      fields: {
        variant: {
          type: 'select',
          label: 'Variante',
          options: [
            { label: 'Padrão', value: 'default' },
            { label: 'Sucesso', value: 'success' },
            { label: 'Aviso', value: 'warning' },
            { label: 'Erro', value: 'error' },
            { label: 'Informação', value: 'info' },
          ],
        },
        title: { type: 'text', label: 'Título' },
        description: { type: 'textarea', label: 'Descrição' },
        dismissible: { type: 'radio', label: 'Dispensável', options: [
          { label: 'Sim', value: true },
          { label: 'Não', value: false },
        ]},
      },
      render: ({ variant, title, description, dismissible, puck }) => {
        if (puck?.isEditing) {
          return <AlertPreview variant={variant} title={title} description={description} dismissible={dismissible} />;
        }
        return <Alert variant={variant} title={title} description={description} dismissible={dismissible} />;
      },
    },

    Progress: {
      label: 'Progresso',
      defaultProps: {
        value: 60,
        max: 100,
        type: 'bar',
        showValue: true,
        variant: 'default',
        size: 'md',
      },
      fields: {
        value: { type: 'number', label: 'Valor' },
        max: { type: 'number', label: 'Máximo' },
        type: {
          type: 'select',
          label: 'Tipo',
          options: [
            { label: 'Barra', value: 'bar' },
            { label: 'Círculo', value: 'circle' },
          ],
        },
        showValue: { type: 'radio', label: 'Mostrar %', options: [
          { label: 'Sim', value: true },
          { label: 'Não', value: false },
        ]},
        variant: {
          type: 'select',
          label: 'Cor',
          options: [
            { label: 'Padrão', value: 'default' },
            { label: 'Sucesso', value: 'success' },
            { label: 'Aviso', value: 'warning' },
            { label: 'Erro', value: 'error' },
          ],
        },
        size: {
          type: 'select',
          label: 'Tamanho',
          options: [
            { label: 'Pequeno', value: 'sm' },
            { label: 'Médio', value: 'md' },
            { label: 'Grande', value: 'lg' },
          ],
        },
        label: { type: 'text', label: 'Rótulo' },
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <ProgressPreview {...props} />;
        }
        return <Progress {...props} />;
      },
    },

    BarChart: {
      label: 'Gráfico de Barras',
      defaultProps: {
        data: [
          { label: 'Jan', value: 65 },
          { label: 'Fev', value: 59 },
          { label: 'Mar', value: 80 },
          { label: 'Abr', value: 81 },
        ],
        title: 'Vendas Mensais',
        height: 300,
        showLegend: true,
      },
      fields: {
        title: { type: 'text', label: 'Título' },
        data: {
          type: 'array',
          label: 'Dados',
          arrayFields: {
            label: { type: 'text', label: 'Rótulo' },
            value: { type: 'number', label: 'Valor' },
          },
        },
        height: { type: 'number', label: 'Altura (px)' },
        showLegend: { type: 'radio', label: 'Mostrar Legenda', options: [
          { label: 'Sim', value: true },
          { label: 'Não', value: false },
        ]},
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <BarChartPreview {...props} />;
        }
        return <BarChart {...props} />;
      },
    },

    LineChart: {
      label: 'Gráfico de Linha',
      defaultProps: {
        data: [
          { label: 'Jan', value: 30 },
          { label: 'Fev', value: 45 },
          { label: 'Mar', value: 35 },
          { label: 'Abr', value: 60 },
        ],
        title: 'Tendência',
        height: 300,
        showLegend: true,
      },
      fields: {
        title: { type: 'text', label: 'Título' },
        data: {
          type: 'array',
          label: 'Dados',
          arrayFields: {
            label: { type: 'text', label: 'Rótulo' },
            value: { type: 'number', label: 'Valor' },
          },
        },
        height: { type: 'number', label: 'Altura (px)' },
        showLegend: { type: 'radio', label: 'Mostrar Legenda', options: [
          { label: 'Sim', value: true },
          { label: 'Não', value: false },
        ]},
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <LineChartPreview {...props} />;
        }
        return <LineChart {...props} />;
      },
    },

    PieChart: {
      label: 'Gráfico de Pizza',
      defaultProps: {
        data: [
          { label: 'A', value: 30 },
          { label: 'B', value: 45 },
          { label: 'C', value: 25 },
        ],
        title: 'Distribuição',
        height: 300,
        showLegend: true,
      },
      fields: {
        title: { type: 'text', label: 'Título' },
        data: {
          type: 'array',
          label: 'Dados',
          arrayFields: {
            label: { type: 'text', label: 'Rótulo' },
            value: { type: 'number', label: 'Valor' },
          },
        },
        height: { type: 'number', label: 'Altura (px)' },
        showLegend: { type: 'radio', label: 'Mostrar Legenda', options: [
          { label: 'Sim', value: true },
          { label: 'Não', value: false },
        ]},
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <PieChartPreview {...props} />;
        }
        return <PieChart {...props} />;
      },
    },

    RelatedRecords: {
      label: 'Registros Relacionados',
      defaultProps: {
        entitySlug: '',
        relationField: '',
        displayFields: ['id'],
        layout: 'list',
        title: 'Registros Relacionados',
      },
      fields: {
        title: { type: 'text', label: 'Título' },
        entitySlug: { type: 'text', label: 'Entidade (slug)' },
        relationField: { type: 'text', label: 'Campo de Relação' },
        displayFields: {
          type: 'array',
          label: 'Campos a Exibir',
          arrayFields: {
            field: { type: 'text', label: 'Campo' },
          },
        },
        layout: {
          type: 'select',
          label: 'Layout',
          options: [
            { label: 'Lista', value: 'list' },
            { label: 'Tabela', value: 'table' },
            { label: 'Cards', value: 'cards' },
          ],
        },
        limit: { type: 'number', label: 'Limite de Itens' },
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <RelatedRecordsPreview {...props} />;
        }
        return <RelatedRecords {...props} />;
      },
    },

    Accordion: {
      label: 'Acordeão',
      defaultProps: {
        items: [
          { title: 'Seção 1', content: 'Conteúdo da seção 1' },
          { title: 'Seção 2', content: 'Conteúdo da seção 2' },
        ],
        variant: 'default',
        allowMultiple: false,
      },
      fields: {
        items: {
          type: 'array',
          label: 'Itens',
          arrayFields: {
            title: { type: 'text', label: 'Título' },
            content: { type: 'textarea', label: 'Conteúdo' },
            icon: { type: 'text', label: 'Ícone' },
          },
        },
        variant: {
          type: 'select',
          label: 'Variante',
          options: [
            { label: 'Padrão', value: 'default' },
            { label: 'Com Borda', value: 'bordered' },
            { label: 'Separado', value: 'separated' },
          ],
        },
        allowMultiple: { type: 'radio', label: 'Múltiplos Abertos', options: [
          { label: 'Sim', value: true },
          { label: 'Não', value: false },
        ]},
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <AccordionPreview {...props} />;
        }
        return <Accordion {...props} />;
      },
    },

    Badge: {
      label: 'Badge',
      defaultProps: {
        text: 'Badge',
        variant: 'primary',
        size: 'md',
      },
      fields: {
        text: { type: 'text', label: 'Texto' },
        variant: {
          type: 'select',
          label: 'Variante',
          options: [
            { label: 'Padrão', value: 'default' },
            { label: 'Primário', value: 'primary' },
            { label: 'Sucesso', value: 'success' },
            { label: 'Aviso', value: 'warning' },
            { label: 'Erro', value: 'error' },
            { label: 'Outline', value: 'outline' },
          ],
        },
        size: {
          type: 'select',
          label: 'Tamanho',
          options: [
            { label: 'Pequeno', value: 'sm' },
            { label: 'Médio', value: 'md' },
            { label: 'Grande', value: 'lg' },
          ],
        },
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <BadgePreview {...props} />;
        }
        return <Badge {...props} />;
      },
    },

    Avatar: {
      label: 'Avatar',
      defaultProps: {
        fallback: 'U',
        size: 'md',
      },
      fields: {
        src: { type: 'text', label: 'URL da Imagem' },
        alt: { type: 'text', label: 'Alt' },
        fallback: { type: 'text', label: 'Fallback (iniciais)' },
        size: {
          type: 'select',
          label: 'Tamanho',
          options: [
            { label: 'Extra Pequeno', value: 'xs' },
            { label: 'Pequeno', value: 'sm' },
            { label: 'Médio', value: 'md' },
            { label: 'Grande', value: 'lg' },
            { label: 'Extra Grande', value: 'xl' },
          ],
        },
        status: {
          type: 'select',
          label: 'Status',
          options: [
            { label: 'Nenhum', value: '' },
            { label: 'Online', value: 'online' },
            { label: 'Offline', value: 'offline' },
            { label: 'Ocupado', value: 'busy' },
            { label: 'Ausente', value: 'away' },
          ],
        },
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <AvatarPreview {...props} />;
        }
        return <Avatar {...props} />;
      },
    },

    CalendarView: {
      label: 'Calendário',
      defaultProps: {
        view: 'month',
        events: [],
        entitySlug: '',
        dateField: 'date',
      },
      fields: {
        view: {
          type: 'select',
          label: 'Visualização',
          options: [
            { label: 'Mês', value: 'month' },
            { label: 'Semana', value: 'week' },
            { label: 'Agenda', value: 'agenda' },
          ],
        },
        entitySlug: { type: 'text', label: 'Entidade (slug)' },
        dateField: { type: 'text', label: 'Campo de Data' },
        titleField: { type: 'text', label: 'Campo de Título' },
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <CalendarViewPreview {...props} />;
        }
        return <CalendarView {...props} />;
      },
    },

    MetricCard: {
      label: 'Card de Métrica',
      defaultProps: {
        title: 'Total de Vendas',
        value: 'R$ 45.231',
        change: 12.5,
        changeLabel: 'vs mês anterior',
        variant: 'default',
      },
      fields: {
        title: { type: 'text', label: 'Título' },
        value: { type: 'text', label: 'Valor' },
        subtitle: { type: 'text', label: 'Subtítulo' },
        change: { type: 'number', label: 'Variação (%)' },
        changeLabel: { type: 'text', label: 'Rótulo da Variação' },
        icon: { type: 'text', label: 'Ícone' },
        variant: {
          type: 'select',
          label: 'Variante',
          options: [
            { label: 'Padrão', value: 'default' },
            { label: 'Primário', value: 'primary' },
            { label: 'Sucesso', value: 'success' },
            { label: 'Aviso', value: 'warning' },
            { label: 'Erro', value: 'error' },
          ],
        },
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <MetricCardPreview {...props} />;
        }
        return <MetricCard {...props} />;
      },
    },

    DetailView: {
      label: 'Detalhes',
      defaultProps: {
        layout: 'horizontal',
        fields: [
          { label: 'Nome', value: 'João Silva', type: 'text' },
          { label: 'Email', value: 'joao@email.com', type: 'email' },
          { label: 'Telefone', value: '(11) 99999-9999', type: 'phone' },
        ],
        columns: 2,
        showBorders: true,
      },
      fields: {
        title: { type: 'text', label: 'Título' },
        layout: {
          type: 'select',
          label: 'Layout',
          options: [
            { label: 'Horizontal', value: 'horizontal' },
            { label: 'Vertical', value: 'vertical' },
            { label: 'Card', value: 'card' },
          ],
        },
        fields: {
          type: 'array',
          label: 'Campos',
          arrayFields: {
            label: { type: 'text', label: 'Rótulo' },
            value: { type: 'text', label: 'Valor' },
            type: { 
              type: 'select', 
              label: 'Tipo',
              options: [
                { label: 'Texto', value: 'text' },
                { label: 'Email', value: 'email' },
                { label: 'Telefone', value: 'phone' },
                { label: 'URL', value: 'url' },
                { label: 'Data', value: 'date' },
                { label: 'Usuário', value: 'user' },
              ],
            },
          },
        },
        columns: { type: 'number', label: 'Colunas (2-4)' },
        showBorders: { type: 'radio', label: 'Mostrar Bordas', options: [
          { label: 'Sim', value: true },
          { label: 'Não', value: false },
        ]},
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <DetailViewPreview {...props} />;
        }
        return <DetailView {...props} />;
      },
    },

    TreeView: {
      label: 'Árvore',
      defaultProps: {
        nodes: [
          { id: '1', label: 'Pasta 1', icon: 'folder', children: [
            { id: '1-1', label: 'Arquivo 1', icon: 'file' },
            { id: '1-2', label: 'Arquivo 2', icon: 'fileText' },
          ]},
          { id: '2', label: 'Pasta 2', icon: 'folder' },
        ],
        showIcons: true,
        variant: 'default',
      },
      fields: {
        nodes: {
          type: 'array',
          label: 'Nós',
          arrayFields: {
            id: { type: 'text', label: 'ID' },
            label: { type: 'text', label: 'Rótulo' },
            icon: { type: 'text', label: 'Ícone' },
            href: { type: 'text', label: 'Link' },
          },
        },
        showIcons: { type: 'radio', label: 'Mostrar Ícones', options: [
          { label: 'Sim', value: true },
          { label: 'Não', value: false },
        ]},
        variant: {
          type: 'select',
          label: 'Variante',
          options: [
            { label: 'Padrão', value: 'default' },
            { label: 'Compacto', value: 'compact' },
            { label: 'Com Borda', value: 'bordered' },
          ],
        },
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <TreeViewPreview />;
        }
        return <TreeView {...props} />;
      },
    },

    Steps: {
      label: 'Passos',
      defaultProps: {
        steps: [
          { title: 'Passo 1', description: 'Descrição' },
          { title: 'Passo 2', description: 'Descrição' },
          { title: 'Passo 3', description: 'Descrição' },
        ],
        currentStep: 1,
        direction: 'horizontal',
        size: 'md',
      },
      fields: {
        steps: {
          type: 'array',
          label: 'Passos',
          arrayFields: {
            title: { type: 'text', label: 'Título' },
            description: { type: 'text', label: 'Descrição' },
          },
        },
        currentStep: { type: 'number', label: 'Passo Atual (0-based)' },
        direction: {
          type: 'select',
          label: 'Direção',
          options: [
            { label: 'Horizontal', value: 'horizontal' },
            { label: 'Vertical', value: 'vertical' },
          ],
        },
        size: {
          type: 'select',
          label: 'Tamanho',
          options: [
            { label: 'Pequeno', value: 'sm' },
            { label: 'Médio', value: 'md' },
            { label: 'Grande', value: 'lg' },
          ],
        },
        variant: {
          type: 'select',
          label: 'Variante',
          options: [
            { label: 'Padrão', value: 'default' },
            { label: 'Simples', value: 'simple' },
            { label: 'Pontos', value: 'dots' },
          ],
        },
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <StepsPreview {...props} />;
        }
        return <Steps {...props} />;
      },
    },

    LinkList: {
      label: 'Lista de Links',
      defaultProps: {
        links: [
          { label: 'Link 1', href: '#', description: 'Descrição do link' },
          { label: 'Link 2', href: '#' },
        ],
        variant: 'default',
        showArrows: true,
        columns: 1,
      },
      fields: {
        title: { type: 'text', label: 'Título' },
        links: {
          type: 'array',
          label: 'Links',
          arrayFields: {
            label: { type: 'text', label: 'Texto' },
            href: { type: 'text', label: 'URL' },
            description: { type: 'text', label: 'Descrição' },
            icon: { type: 'text', label: 'Ícone' },
          },
        },
        variant: {
          type: 'select',
          label: 'Variante',
          options: [
            { label: 'Padrão', value: 'default' },
            { label: 'Cards', value: 'card' },
            { label: 'Mínimo', value: 'minimal' },
          ],
        },
        showArrows: { type: 'radio', label: 'Mostrar Setas', options: [
          { label: 'Sim', value: true },
          { label: 'Não', value: false },
        ]},
        columns: { type: 'number', label: 'Colunas (1-3)' },
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <LinkListPreview {...props} />;
        }
        return <LinkList {...props} />;
      },
    },

    MapView: {
      label: 'Mapa',
      defaultProps: {
        center: { lat: -23.5505, lng: -46.6333 },
        zoom: 12,
        height: '400px',
        showControls: true,
        variant: 'default',
      },
      fields: {
        height: { type: 'text', label: 'Altura' },
        zoom: { type: 'number', label: 'Zoom (1-20)' },
        showControls: { type: 'radio', label: 'Mostrar Controles', options: [
          { label: 'Sim', value: true },
          { label: 'Não', value: false },
        ]},
        variant: {
          type: 'select',
          label: 'Estilo',
          options: [
            { label: 'Padrão', value: 'default' },
            { label: 'Satélite', value: 'satellite' },
            { label: 'Terreno', value: 'terrain' },
          ],
        },
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <MapViewPreview />;
        }
        return <MapView {...props} />;
      },
    },

    Testimonial: {
      label: 'Depoimentos',
      defaultProps: {
        testimonials: [
          { quote: 'Excelente produto!', author: 'João Silva', role: 'CEO', rating: 5 },
        ],
        variant: 'default',
        columns: 1,
        showRating: true,
      },
      fields: {
        testimonials: {
          type: 'array',
          label: 'Depoimentos',
          arrayFields: {
            quote: { type: 'textarea', label: 'Citação' },
            author: { type: 'text', label: 'Autor' },
            role: { type: 'text', label: 'Cargo' },
            company: { type: 'text', label: 'Empresa' },
            avatar: { type: 'text', label: 'URL do Avatar' },
            rating: { type: 'number', label: 'Avaliação (1-5)' },
          },
        },
        variant: {
          type: 'select',
          label: 'Variante',
          options: [
            { label: 'Padrão', value: 'default' },
            { label: 'Cards', value: 'card' },
            { label: 'Mínimo', value: 'minimal' },
            { label: 'Destaque', value: 'featured' },
          ],
        },
        columns: { type: 'number', label: 'Colunas (1-3)' },
        showRating: { type: 'radio', label: 'Mostrar Avaliação', options: [
          { label: 'Sim', value: true },
          { label: 'Não', value: false },
        ]},
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <TestimonialPreview {...props} />;
        }
        return <Testimonial {...props} />;
      },
    },

    PricingTable: {
      label: 'Tabela de Preços',
      defaultProps: {
        plans: [
          {
            name: 'Basic',
            price: 29,
            billingPeriod: 'mês',
            features: [
              { name: '5 Usuários', included: true },
              { name: 'Suporte Email', included: true },
              { name: 'API Access', included: false },
            ],
          },
          {
            name: 'Pro',
            price: 99,
            billingPeriod: 'mês',
            highlighted: true,
            badge: 'Popular',
            features: [
              { name: '25 Usuários', included: true },
              { name: 'Suporte Prioritário', included: true },
              { name: 'API Access', included: true },
            ],
          },
        ],
        variant: 'cards',
        columns: 2,
      },
      fields: {
        plans: {
          type: 'array',
          label: 'Planos',
          arrayFields: {
            name: { type: 'text', label: 'Nome' },
            description: { type: 'text', label: 'Descrição' },
            price: { type: 'number', label: 'Preço' },
            billingPeriod: { type: 'text', label: 'Período' },
            badge: { type: 'text', label: 'Badge' },
            cta: { type: 'text', label: 'Texto do Botão' },
          },
        },
        variant: {
          type: 'select',
          label: 'Variante',
          options: [
            { label: 'Cards', value: 'cards' },
            { label: 'Comparação', value: 'comparison' },
          ],
        },
        columns: { type: 'number', label: 'Colunas (2-4)' },
      },
      render: (props) => {
        if (props.puck?.isEditing) {
          return <PricingTablePreview {...props} />;
        }
        return <PricingTable {...props} />;
      },
    },
  },
};

// Initial data for new pages
export const initialData: Data = {
  content: [],
  root: { props: {} },
};
