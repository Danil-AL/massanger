import { CheckCircle2, Info, XCircle } from 'lucide-react';

const icons = { success: CheckCircle2, error: XCircle, info: Info };

export default function Toasts({ toasts }) {
  return (
    <div className="toast-stack">
      {toasts.map((toast) => {
        const Icon = icons[toast.type] || Info;
        return (
          <div key={toast.id} className={`toast toast-${toast.type || 'info'}`}>
            <Icon size={18} />
            <span>{toast.text}</span>
          </div>
        );
      })}
    </div>
  );
}
