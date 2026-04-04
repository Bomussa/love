export const enhancedMedicalThemes = [
  {
    id: 'medical-professional',
    name: 'Medical Professional',
    nameAr: 'طبي احترافي',
    description: 'Official Medical Services theme with maroon and gold',
    descriptionAr: 'ثيم قيادة الخدمات الطبية الرسمي بالعنابي والذهبي',
    colors: {
      primary: '#8A1538',
      secondary: '#C9A54C',
      accent: '#E8DABE',
      background: 'linear-gradient(180deg, #8A1538 0%, #C9A54C 100%)',
      surface: 'rgba(0, 0, 0, 0.2)',
      text: '#FFFFFF',
      textSecondary: '#E8DABE',
      border: 'rgba(255, 255, 255, 0.2)',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #8A1538 0%, #6B0F2A 100%)',
      secondary: 'linear-gradient(135deg, #C9A54C 0%, #B8943D 100%)',
      background: 'linear-gradient(160deg, #3a0b1b 0%, #1e1e1e 100%)',
    },
    shadows: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.2)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.25)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
    },
  }
];

export function getThemeById(themeId) {
  return enhancedMedicalThemes[0];
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

export function generateThemeCSS(themeId) {
  const theme = getThemeById(themeId);
  const { colors, gradients, shadows } = theme;

  return `
    :root {
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
      
      --theme-gradient-primary: ${gradients.primary};
      --theme-gradient-secondary: ${gradients.secondary};
      --theme-gradient-background: ${gradients.background};
      
      --theme-shadow-sm: ${shadows.sm};
      --theme-shadow-md: ${shadows.md};
      --theme-shadow-lg: ${shadows.lg};
    }
  `;
}

export default enhancedMedicalThemes;
