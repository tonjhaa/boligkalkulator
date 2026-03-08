import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formater NOK-beloep med norsk tallformat */
export function formatCurrency(amount: number, decimals = 0): string {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

/** Formater prosent med norsk tallformat */
export function formatPercent(value: number, decimals = 1): string {
  return new Intl.NumberFormat('nb-NO', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100)
}

/** Formater tall med norsk tallseparator */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}
