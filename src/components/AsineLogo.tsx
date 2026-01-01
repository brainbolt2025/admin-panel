import type { FC } from 'react';

interface AsineLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  src?: string;
}

const AsineLogo: FC<AsineLogoProps> = ({ className = '', size = 'md', src }) => {
  const sizeClasses = {
    sm: 'h-14',
    md: 'h-24',
    lg: 'h-56',
  };

  // Default logo path - can be overridden with src prop
  const logoPath = src || '/asine-logo.png';

  return (
    <div className={`flex items-center ${className}`} style={{ margin: 0, padding: 0 }}>
      <img
        src={logoPath}
        alt="Asine"
        className={`${sizeClasses[size]} w-auto object-contain flex-shrink-0`}
        style={{ 
          border: 'none', 
          background: 'transparent',
          outline: 'none',
          boxShadow: 'none',
          display: 'block',
          padding: 0,
          margin: 0,
          marginTop: 0,
          marginBottom: 0
        }}
        onError={(e) => {
          console.error('Failed to load logo image:', logoPath);
          // Hide the broken image
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
};

export default AsineLogo;

