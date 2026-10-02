import React from 'react';

export default function ResponsiveCard({ title, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm p-4 sm:p-6 md:p-8 transition-all hover:shadow-md ${className}`}>
      <h3 className="text-lg sm:text-xl font-semibold mb-3">{title}</h3>
      <div className="text-sm sm:text-base">{children}</div>
    </div>
  );
}
