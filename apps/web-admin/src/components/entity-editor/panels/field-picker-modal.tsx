'use client';

import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BLOCKS, type BlockDef } from '../blocks';

interface FieldPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (fieldType: string, label: string) => void;
}

// Agrupar categorias por "secao" com cores
const CATEGORY_COLORS: Record<string, string> = {
  'Texto': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'Numeros': 'bg-green-500/10 text-green-500 border-green-500/20',
  'Contato': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  'Documentos': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'Data/Hora': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  'Selecao': 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  'Relacoes': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  'Arquivos': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  'Workflow': 'bg-red-500/10 text-red-500 border-red-500/20',
  'Computados': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  'Layout': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Outros': 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export function FieldPickerModal({ open, onClose, onSelect }: FieldPickerModalProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Agrupar blocos por categoria
  const categories = useMemo(() => {
    const map = new Map<string, BlockDef[]>();
    for (const block of BLOCKS) {
      if (!map.has(block.category)) {
        map.set(block.category, []);
      }
      map.get(block.category)!.push(block);
    }
    return map;
  }, []);

  // Filtrar por busca
  const filteredCategories = useMemo(() => {
    if (!search.trim()) {
      if (activeCategory) {
        const blocks = categories.get(activeCategory);
        return blocks ? new Map([[activeCategory, blocks]]) : new Map();
      }
      return categories;
    }

    const term = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const result = new Map<string, BlockDef[]>();

    for (const [cat, blocks] of categories) {
      const filtered = blocks.filter((b) => {
        const label = b.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const type = b.fieldType.toLowerCase();
        return label.includes(term) || type.includes(term) || cat.toLowerCase().includes(term);
      });
      if (filtered.length > 0) {
        result.set(cat, filtered);
      }
    }
    return result;
  }, [search, activeCategory, categories]);

  const handleSelect = (block: BlockDef) => {
    onSelect(block.fieldType, block.label);
    onClose();
    setSearch('');
    setActiveCategory(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setSearch(''); setActiveCategory(null); } }}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col gap-0 p-0">
        {/* Header com busca */}
        <div className="flex items-center gap-3 px-6 py-4 border-b">
          <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <Input
            placeholder="Buscar campos..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveCategory(null); }}
            className="border-0 shadow-none focus-visible:ring-0 text-lg h-auto py-0 px-0"
            autoFocus
          />
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Filtros de categoria */}
        <div className="flex items-center gap-2 px-6 py-3 border-b overflow-x-auto">
          <Badge
            variant={activeCategory === null ? 'default' : 'outline'}
            className="cursor-pointer whitespace-nowrap"
            onClick={() => setActiveCategory(null)}
          >
            Todos
          </Badge>
          {Array.from(categories.keys()).map((cat) => (
            <Badge
              key={cat}
              variant="outline"
              className={`cursor-pointer whitespace-nowrap ${
                activeCategory === cat
                  ? CATEGORY_COLORS[cat] || ''
                  : 'hover:bg-accent'
              }`}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            >
              {cat}
            </Badge>
          ))}
        </div>

        {/* Grid de campos */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filteredCategories.size === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Nenhum campo encontrado
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(filteredCategories).map(([category, blocks]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      CATEGORY_COLORS[category]?.split(' ')[0]?.replace('/10', '') || 'bg-gray-500'
                    }`} />
                    {category}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {blocks.map((block) => (
                      <button
                        key={block.id}
                        onClick={() => handleSelect(block)}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-accent-foreground/20 transition-colors text-left group"
                      >
                        <span className="text-lg flex-shrink-0 w-8 text-center">{block.icon}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate group-hover:text-foreground">
                            {block.label}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {block.fieldType}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t text-xs text-muted-foreground">
          Clique em um campo para adiciona-lo ao canvas
        </div>
      </DialogContent>
    </Dialog>
  );
}
