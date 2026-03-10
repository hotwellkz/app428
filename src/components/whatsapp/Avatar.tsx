import React, { useState } from 'react';

interface AvatarProps {
  name?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  size?: number; // px
}

function getAvatarColor(phone: string): string {
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
  let hash = 0;
  for (let i = 0; i < phone.length; i++) {
    hash = phone.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name?: string | null, phone?: string | null): string {
  const source = (name ?? '').trim() || (phone ?? '').trim();
  if (!source) return '?';
  // Берём первую "видимую" букву/цифру
  const first = source.replace(/^[+\s]+/, '').charAt(0);
  return first ? first.toUpperCase() : '?';
}

const Avatar: React.FC<AvatarProps> = ({ name, phone, avatarUrl, size = 40 }) => {
  const [broken, setBroken] = useState(false);
  const initials = getInitials(name, phone);
  const colorKey = (phone ?? name ?? '').trim() || initials;
  const bgColor = getAvatarColor(colorKey);

  const dimensionStyle: React.CSSProperties = {
    width: size,
    height: size
  };

  if (avatarUrl && !broken) {
    return (
      <div
        className="flex-shrink-0 rounded-full overflow-hidden bg-gray-200"
        style={dimensionStyle}
      >
        <img
          src={avatarUrl}
          alt={name ?? phone ?? 'Контакт'}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
            setBroken(true);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 rounded-full flex items-center justify-center text-white text-sm font-medium"
      style={{ ...dimensionStyle, backgroundColor: bgColor }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
};

export default Avatar;

