import { WandSparkles } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { isScenarioLabEnabled } from '../lib/scenarioLab';

interface ScenarioFillButtonProps {
  onClick: () => void;
  label?: string;
  title?: string;
  className?: string;
}

export function ScenarioFillButton({
  onClick,
  label = 'Fill synthetic test data',
  title = 'Fill fields only. Nothing is submitted automatically.',
  className = 'ghost-button',
}: ScenarioFillButtonProps) {
  const auth = useAuth();
  const isAuthorizedAdmin = auth.roles.some(
    assignment => assignment.role === 'super_admin' || assignment.role === 'governance_admin'
  );

  if (!isScenarioLabEnabled || !isAuthorizedAdmin) return null;

  return (
    <button
      className={className}
      type="button"
      title={title}
      onClick={onClick}
    >
      <WandSparkles size={16} />
      {label}
    </button>
  );
}
