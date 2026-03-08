import { HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface HelpTooltipProps {
  content: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function HelpTooltip({ content, side = 'right' }: HelpTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="inline h-3.5 w-3.5 text-muted-foreground cursor-help ml-1 shrink-0" />
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
        {content}
      </TooltipContent>
    </Tooltip>
  )
}
