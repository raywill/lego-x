import { AlertTriangle, Cloud, MoveUpRight } from 'lucide-react';
import type { PrintWarning } from '../../editor/printability';

const icons = {
  outside: MoveUpRight,
  floating: Cloud,
  overhang: AlertTriangle,
};

export function PrintWarnings({ warnings }: { warnings: PrintWarning[] }) {
  if (!warnings.length) return null;
  return (
    <div className="warning-stack" aria-live="polite">
      {warnings.map((warning) => {
        const Icon = icons[warning.kind];
        return <div className={`warning-chip ${warning.kind}`} key={warning.kind}><Icon size={16} /><span>{warning.message}</span></div>;
      })}
    </div>
  );
}
