/**
 * Chikbo "Heritage Modern" design tokens.
 * Source of truth: docs/design-system.md
 */

export const colors = {
  brand600: '#EA7A12', // primary — Chikbo orange
  brand500: '#F97316', // logo orange — highlights, gradients
  brand700: '#C2610A', // pressed
  brand50: '#FFF4E8', // tint backgrounds, badges

  ink900: '#1A1714', // headings, dark surfaces
  ink700: '#3D3833', // body text
  ink500: '#6E675F', // secondary text
  ink300: '#B9B2A9', // borders, disabled

  cream50: '#FDFBF7', // page background — warm ivory
  cream100: '#F7F2EA', // cards, image fallbacks

  gold500: '#B08D3E', // ratings, "since 1992", overlines

  success: '#1E7F4F',
  error: '#C0392B',
  info: '#2C5F8A',
  white: '#FFFFFF',

  successTint: '#E4F2EA',
  errorTint: '#F9E9E6',
  infoTint: '#E6EEF5',
} as const;

/** Font family names as registered by @expo-google-fonts in App.tsx. */
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayMedium: 'Fraunces_500Medium',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  card: 12,
  pill: 999,
  input: 10,
} as const;

export const hairline = {
  borderWidth: 1,
  borderColor: 'rgba(185, 178, 169, 0.4)', // ink300 @ 40%
} as const;

export const cardShadow = {
  shadowColor: colors.ink900,
  shadowOpacity: 0.08,
  shadowRadius: 30,
  shadowOffset: { width: 0, height: 8 },
  elevation: 2,
} as const;
