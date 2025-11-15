import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Medical pathways based on exam type and gender
// Get medical pathway based on exam type and gender
export function getMedicalPathway(examType, gender) {
  const pathway = medicalPathways[examType]
  if (!pathway) return []
  return pathway[gender] || pathway.male
}

export const themes = [
  { id: 'classic', name: 'Classic', nameAr: 'كلاسيكي', colors: ['#ef4444', '#fbbf24'] },
  { id: 'mint', name: 'Mint Medical', nameAr: 'طبي نعناعي', colors: ['#10b981', '#fbbf24'] },
  { id: 'navy', name: 'Military Navy', nameAr: 'بحري عسكري', colors: ['#3b82f6', '#fbbf24'] },
  { id: 'desert', name: 'Desert Gold', nameAr: 'ذهبي صحراوي', colors: ['#fbbf24', '#ef4444'] },
  { id: 'rose', name: 'Medical Rose', nameAr: 'وردي طبي', colors: ['#ef4444', '#fbbf24'] },
  { id: 'night', name: 'Night Shift', nameAr: 'المناوبة الليلية', colors: ['#fbbf24', '#ef4444'] }
]

export function formatTime(date) {
  return new Intl.DateTimeFormat('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

export function calculateWaitTime(position, avgTime = 5) {
  return Math.max(0, (position - 1) * avgTime)
}
