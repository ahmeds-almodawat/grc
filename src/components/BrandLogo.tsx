const ACC_LOGO_PATH = '/brand/almodawat-acc-logo.png';
const ACC_LOGO_ALT = 'Almodawat Assurance Control Center';

type BrandLogoVariant = 'auth' | 'loading' | 'sidebar';

interface BrandLogoProps {
  variant: BrandLogoVariant;
}

export function BrandLogo({ variant }: BrandLogoProps) {
  return (
    <img
      alt={ACC_LOGO_ALT}
      className={`acc-brand-logo acc-brand-logo--${variant}`}
      decoding="async"
      draggable={false}
      height={1254}
      src={ACC_LOGO_PATH}
      width={1254}
    />
  );
}
