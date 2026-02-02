import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

export const TooltipProvider = RadixTooltip.Provider;
export const Tooltip = RadixTooltip.Root;
export const TooltipTrigger = RadixTooltip.Trigger;
export const TooltipContent = ({ className, ...props }: RadixTooltip.TooltipContentProps) => (
  <RadixTooltip.Content
    sideOffset={4}
    className={cn(
      'z-50 rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0',
      className
    )}
    {...props}
  />
);
