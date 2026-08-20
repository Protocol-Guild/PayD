import { Link } from 'react-router-dom';
import { FileQuestion, Home, DollarSign, Users, HelpCircle } from 'lucide-react';

const links = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/payroll', label: 'Payroll', icon: DollarSign },
  { to: '/employee', label: 'Employees', icon: Users },
  { to: '/help', label: 'Help Center', icon: HelpCircle },
];

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="card glass noise max-w-md w-full text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 border border-danger/20">
          <FileQuestion size={28} className="text-danger" />
        </div>
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-muted text-sm mb-2">Page not found</p>
        <p className="text-muted text-sm mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex flex-col gap-2">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-hi/20 text-sm font-medium text-text hover:bg-white/5 hover:border-hi/40 transition-colors"
              >
                <Icon size={18} className="text-muted shrink-0" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}