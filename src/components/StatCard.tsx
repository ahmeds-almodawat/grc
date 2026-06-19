interface StatCardProps {
  label: string;
  value: number | string;
  tone?: 'normal' | 'warning' | 'danger' | 'success';
}

export function StatCard({ label, value, tone = 'normal' }: StatCardProps) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
