import type { FC } from 'react';

interface AsineLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'login';
  src?: string;
  /** Soften light grey PNG background against white surfaces */
  blendOnWhite?: boolean;
}

const AsineLogo: FC<AsineLogoProps> = ({
  className = '',
  size = 'md',
  src,
  blendOnWhite = false,
}) => {
  const sizeClasses = {
    sm: 'h-14',
    md: 'h-24',
    lg: 'h-56',
    login: 'h-28 sm:h-32 w-auto max-w-[280px]',
  };

  const logoPath = src || '/asine-logo.png';

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src={logoPath}
        alt="Asine"
        className={`${sizeClasses[size]} object-contain flex-shrink-0 ${
          blendOnWhite ? 'mix-blend-multiply' : ''
        }`}
        style={{
          border: 'none',
          background: 'transparent',
          outline: 'none',
          boxShadow: 'none',
          display: 'block',
        }}
        onError={(e) => {
          console.error('Failed to load logo image:', logoPath);
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
};

export default AsineLogo;
