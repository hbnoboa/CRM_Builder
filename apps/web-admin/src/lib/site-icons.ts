import {
  Award, Baby, Bike, Brush, Briefcase, Cake, Calendar, Camera, Car, Check, Clock, Coffee, CreditCard, Dumbbell, Facebook,
  Flower2, Gift, Globe, GraduationCap, Hammer, Headphones, Heart, House, IceCreamCone, Instagram, Leaf, Lightbulb, Linkedin,
  Lock, Mail, MapPin, MessageCircle, Moon, Music, Music2, Package, Palette, PawPrint, Phone, Pizza, Plane, Rocket,
  Scissors, ShieldCheck, ShoppingBag, Smile, Sofa, Sparkles, Star, Stethoscope, Sun, Target, ThumbsUp, TrendingUp, Truck,
  Twitter, User, Users, Utensils, Wifi, Wine, Wrench, Youtube, Zap, type LucideIcon,
} from 'lucide-react';

/** Icones que a pagina pode mostrar. Mesma lista do servidor (site-blocks-more.ts). */
export const SITE_ICON_MAP: Record<string, LucideIcon> = {
  star: Star, heart: Heart, phone: Phone, mail: Mail, 'map-pin': MapPin, clock: Clock, check: Check, 'shield-check': ShieldCheck,
  truck: Truck, coffee: Coffee, cake: Cake, gift: Gift, sparkles: Sparkles, smile: Smile, users: Users, user: User,
  calendar: Calendar, camera: Camera, music: Music, house: House, car: Car, wrench: Wrench, leaf: Leaf, sun: Sun, moon: Moon,
  zap: Zap, award: Award, 'thumbs-up': ThumbsUp, 'shopping-bag': ShoppingBag, 'credit-card': CreditCard, wifi: Wifi,
  'paw-print': PawPrint, scissors: Scissors, stethoscope: Stethoscope, 'graduation-cap': GraduationCap, briefcase: Briefcase,
  globe: Globe, 'message-circle': MessageCircle, utensils: Utensils, baby: Baby, dumbbell: Dumbbell, palette: Palette,
  plane: Plane, package: Package, headphones: Headphones, lightbulb: Lightbulb, target: Target, 'trending-up': TrendingUp,
  lock: Lock, rocket: Rocket, 'flower-2': Flower2, bike: Bike, pizza: Pizza, 'ice-cream-cone': IceCreamCone, wine: Wine,
  sofa: Sofa, hammer: Hammer, brush: Brush,
};
export const SITE_ICON_IDS = Object.keys(SITE_ICON_MAP);

/** Redes sociais e contatos (bloco "Redes sociais" e rodape). */
export const SOCIALS: Record<string, { label: string; icon: LucideIcon; placeholder: string }> = {
  instagram: { label: 'Instagram', icon: Instagram, placeholder: 'instagram.com/suaempresa' },
  facebook: { label: 'Facebook', icon: Facebook, placeholder: 'facebook.com/suaempresa' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, placeholder: '(11) 99999-0000' },
  tiktok: { label: 'TikTok', icon: Music2, placeholder: 'tiktok.com/@suaempresa' },
  youtube: { label: 'YouTube', icon: Youtube, placeholder: 'youtube.com/@suaempresa' },
  linkedin: { label: 'LinkedIn', icon: Linkedin, placeholder: 'linkedin.com/company/suaempresa' },
  x: { label: 'X (Twitter)', icon: Twitter, placeholder: 'x.com/suaempresa' },
  email: { label: 'E-mail', icon: Mail, placeholder: 'contato@suaempresa.com.br' },
  phone: { label: 'Telefone', icon: Phone, placeholder: '(11) 3333-0000' },
  site: { label: 'Site', icon: Globe, placeholder: 'https://suaempresa.com.br' },
};

/** Video do YouTube, do Vimeo ou arquivo: player embutido e link para abrir fora. */
export type ParsedVideo =
  | { kind: 'youtube' | 'vimeo'; embed: string; watch: string }
  | { kind: 'file'; url: string }
  | null;
export function parseVideo(url: string | undefined): ParsedVideo {
  if (!url) return null;
  const yt = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,20})/i);
  if (yt) return { kind: 'youtube', embed: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`, watch: `https://www.youtube.com/watch?v=${yt[1]}` };
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d{5,12})/i);
  if (vm) return { kind: 'vimeo', embed: `https://player.vimeo.com/video/${vm[1]}`, watch: `https://vimeo.com/${vm[1]}` };
  return /^https?:\/\//i.test(url) ? { kind: 'file', url } : null;
}
