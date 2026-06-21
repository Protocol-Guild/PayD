import React from 'react';

type AlertProps = React.HTMLAttributes<HTMLDivElement>;

export const Alert: React.FC<AlertProps> = ({ className = '', children, ...props }) => (
  <div className={`rounded-lg border border-yellow-300 bg-yellow-50 p-4 ${className}`} {...props}>
    {children}
  </div>
);

type AlertDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

export const AlertDescription: React.FC<AlertDescriptionProps> = ({ className = '', children, ...props }) => (
  <p className={`mt-2 text-sm text-yellow-700 ${className}`} {...props}>
    {children}
  </p>
);
