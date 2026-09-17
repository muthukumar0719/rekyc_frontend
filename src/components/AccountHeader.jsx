import Card from './ui/Card';

export default function AccountHeader({ account }) {
  const fields = [
    { label: 'Name', value: account.name },
    { label: 'Client ID', value: account.clientId },
    { label: 'Account Status', value: account.accountStatus },
    { label: 'PAN', value: account.pan },
  ];

  return (
    <Card className="p-6 mb-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-blue-600 via-brand-coral-500 to-brand-blue-600" />
      <h2 className="text-lg font-bold text-slate-800 mb-4">Account Details</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 border-t border-slate-100 pt-4">
        {fields.map((f) => (
          <div key={f.label}>
            <p className="text-xs text-slate-400 mb-1">{f.label}</p>
            <p className="font-bold text-slate-800">{f.value || 'N/A'}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
