import React, { useState } from 'react';

interface AvatarProps {
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  src?: string;
}

const Avatar: React.FC<AvatarProps> = ({ name, color, size = 'md', src }) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  // Maps the character name (MBTI type) to an image file in the 'avatars' folder
  // Example: INTJ -> avatars/INTJ.png
  // Or uses the provided src prop
  const imgSrc = src || `avatars/${name}.png`;

  return (
    <div 
      className={`
        ${sizeClasses[size]} 
        flex-shrink-0 
        border-2 border-black 
        shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] 
        relative 
        overflow-hidden
        ${imgError ? color : 'bg-gray-200'}
      `}
    >
      {!imgError ? (
        <img 
          src={imgSrc} 
          alt={name}
          className="w-full h-full object-cover"
          style={{ imageRendering: 'pixelated' }}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="font-pixel font-bold text-white text-xs drop-shadow-md">
            {name}
          </span>
        </div>
      )}
    </div>
  );
};

export default Avatar;