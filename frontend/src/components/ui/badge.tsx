import React from 'react';

type BadgeProps = React.HTMLAttributes<HTMLSpanElement>;

export const Badge: React.FC<BadgeProps> = ({ className = '', children, ...props }) => (
  <span className={`inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700 ${className}`} {...props}>
    {children}
  </span>
);
