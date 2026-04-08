// Enhanced Medical Themes - 5 Professional Medical Color Schemes
// Based on medical color psychology and professional healthcare design standards

export const enhancedMedicalThemes = [
  {
    id: 'medical-professional',
    name: 'Medical Professional',
    nameAr: 'طبي احترافي',
    description: 'Official Medical Services theme with maroon and gold',
    descriptionAr: 'ثيم قيادة الخدمات الطبية الرسمي بالعنابي والذهبي',
    colors: {
      primary: '#8A1538', // Official Maroon
      secondary: '#C9A54C', // Official Gold
      accent: '#E8DABE', // Light Beige
      background: '#ffffff', // Clean White
      surface: '#f8fafc', // Light Gray
      text: '#1e293b', // Dark Slate
      textSecondary: '#64748b', // Medium Gray
      border: '#e2e8f0', // Light Border
      success: '#10b981', // Success Green
      warning: '#C9A54C', // Gold Warning
      error: '#8A1538', // Maroon Error
      info: '#8A1538', // Maroon Info
    },
    gradients: {
      primary: 'linear-gradient(135deg, #8A1538 0%, #6B0F2A 100%)',
      secondary: 'linear-gradient(135deg, #C9A54C 0%, #B8943D 100%)',
      background: 'linear-gradient(135deg, #8A1538 0%, #C9A54C 100%)',
    },
    shadows: {
      sm: '0 1px 2px 0 rgba(138, 21, 56, 0.05)',
      md: '0 4px 6px -1px rgba(138, 21, 56, 0.1)',
      lg: '0 10px 15px -3px rgba(138, 21, 56, 0.1)',
    },
  },

  // ===== الثيمات الجديدة =====
  {
    id: 'deep-maroon-gold',
    name: 'Deep Maroon & Gold',
    nameAr: 'عنابي عميق وذهبي',
    description: 'Deep maroon background with gold accents',
    descriptionAr: 'خلفية عنابية عميقة مع لمسات ذهبية',
    colors: {
      primary: '#800020',
      secondary: '#C9A54C',
      accent: '#FFD700',
      background: '#800020',
      surface: 'rgba(255,255,255,0.12)',
      text: '#FFFFFF',
      textSecondary: '#FFD700',
      border: 'rgba(255,255,255,0.2)',
      success: '#4ade80',
      warning: '#C9A54C',
      error: '#ff6b6b',
      info: '#FFD700',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #800020 0%, #5a0015 100%)',
      secondary: 'linear-gradient(135deg, #C9A54C 0%, #B8860C 100%)',
      background: 'linear-gradient(160deg, #800020 0%, #5a0015 40%, #C9A54C 100%)',
    },
    shadows: {
      sm: '0 1px 2px 0 rgba(128, 0, 32, 0.15)',
      md: '0 4px 6px -1px rgba(128, 0, 32, 0.2)',
      lg: '0 10px 15px -3px rgba(128, 0, 32, 0.25)',
    },
  },
  {
    id: 'olive-green-gold',
    name: 'Olive Green & Gold',
    nameAr: 'أخضر زيتوني وذهبي',
    description: 'Olive green background with gold accents',
    descriptionAr: 'خلفية خضراء زيتونية مع لمسات ذهبية',
    colors: {
      primary: '#556B2F',
      secondary: '#B8860C',
      accent: '#C9A54C',
      background: '#556B2F',
      surface: 'rgba(255,255,255,0.12)',
      text: '#FFFFFF',
      textSecondary: '#F5DEB3',
      border: 'rgba(255,255,255,0.2)',
      success: '#4ade80',
      warning: '#B8860C',
      error: '#ff6b6b',
      info: '#F5DEB3',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #556B2F 0%, #3d4f22 100%)',
      secondary: 'linear-gradient(135deg, #B8860C 0%, #8B6914 100%)',
      background: 'linear-gradient(160deg, #556B2F 0%, #3d4f22 40%, #B8860C 100%)',
    },
    shadows: {
      sm: '0 1px 2px 0 rgba(85, 107, 47, 0.15)',
      md: '0 4px 6px -1px rgba(85, 107, 47, 0.2)',
      lg: '0 10px 15px -3px rgba(85, 107, 47, 0.25)',
    },
  },
  {
    id: 'charcoal-olive',
    name: 'Charcoal & Olive',
    nameAr: 'فحمي وزيتوني',
    description: 'Charcoal dark background with olive green accents',
    descriptionAr: 'خلفية فحمية داكنة مع لمسات زيتونية خضراء',
    colors: {
      primary: '#333333',
      secondary: '#556B2F',
      accent: '#85B862',
      background: '#333333',
      surface: 'rgba(255,255,255,0.08)',
      text: '#FFFFFF',
      textSecondary: '#85B862',
      border: 'rgba(255,255,255,0.15)',
      success: '#4ade80',
      warning: '#C9A54C',
      error: '#ff6b6b',
      info: '#85B862',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #333333 0%, #1a1a1a 100%)',
      secondary: 'linear-gradient(135deg, #556B2F 0%, #3d4f22 100%)',
      background: 'linear-gradient(160deg, #333333 0%, #1a1a1a 50%, #556B2F 100%)',
    },
    shadows: {
      sm: '0 1px 2px 0 rgba(51, 51, 51, 0.2)',
      md: '0 4px 6px -1px rgba(51, 51, 51, 0.25)',
      lg: '0 10px 15px -3px rgba(51, 51, 51, 0.3)',
    },
  },
  {
    id: 'cream-gold',
    name: 'Cream & Gold',
    nameAr: 'كريمي وذهبي',
    description: 'Warm cream background with deep maroon and gold accents',
    descriptionAr: 'خلفية كريمية دافئة مع عنابي عميق ولمسات ذهبية',
    colors: {
      primary: '#800000',
      secondary: '#808628',
      accent: '#C9A54C',
      background: '#F5F5DC',
      surface: 'rgba(128, 0, 0, 0.08)',
      text: '#3a1a1a',
      textSecondary: '#800000',
      border: 'rgba(128, 0, 0, 0.2)',
      success: '#2d7a2d',
      warning: '#808628',
      error: '#800000',
      info: '#808628',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #800000 0%, #5a0000 100%)',
      secondary: 'linear-gradient(135deg, #808628 0%, #5a6020 100%)',
      background: 'linear-gradient(160deg, #F5F5DC 0%, #EDE8C8 50%, #D4C89A 100%)',
    },
    shadows: {
      sm: '0 1px 2px 0 rgba(128, 0, 0, 0.08)',
      md: '0 4px 6px -1px rgba(128, 0, 0, 0.12)',
      lg: '0 10px 15px -3px rgba(128, 0, 0, 0.15)',
    },
  },
];

// Theme utility functions
export function getThemeById(themeId) {
  return enhancedMedicalThemes.find((theme) => theme.id === themeId) || enhancedMedicalThemes[0];
}

export function getThemeColors(themeId) {
  const theme = getThemeById(themeId);
  return theme.colors;
}

export function getThemeGradients(themeId) {
  const theme = getThemeById(themeId);
  return theme.gradients;
}

export function getThemeShadows(themeId) {
  const theme = getThemeById(themeId);
  return theme.shadows;
}

// CSS Custom Properties Generator
export function generateThemeCSS(themeId) {
  const theme = getThemeById(themeId);
  const { colors, gradients, shadows } = theme;

  return `
    :root {
      /* Colors */
      --theme-primary: ${colors.primary};
      --theme-secondary: ${colors.secondary};
      --theme-accent: ${colors.accent};
      --theme-background: ${colors.background};
      --theme-surface: ${colors.surface};
      --theme-text: ${colors.text};
      --theme-text-secondary: ${colors.textSecondary};
      --theme-border: ${colors.border};
      --theme-success: ${colors.success};
      --theme-warning: ${colors.warning};
      --theme-error: ${colors.error};
      --theme-info: ${colors.info};
      
      /* Gradients */
      --theme-gradient-primary: ${gradients.primary};
      --theme-gradient-secondary: ${gradients.secondary};
      --theme-gradient-background: ${gradients.background};
      
      /* Shadows */
      --theme-shadow-sm: ${shadows.sm};
      --theme-shadow-md: ${shadows.md};
      --theme-shadow-lg: ${shadows.lg};
    }
  `;
}

export default enhancedMedicalThemes;
