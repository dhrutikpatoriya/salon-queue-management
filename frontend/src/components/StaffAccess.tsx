import { useState, type FormEvent } from 'react';
import { useTranslation } from '../i18n/LanguageContext';

interface StaffAccessProps {
  receptionistConfigured: boolean;
  barbers: Array<{ id: string; name: string; credentialConfigured: boolean }>;
  pending: boolean;
  change: (id: string, fields: { currentOwnerPassword: string; credential: string; confirmation: string }) => Promise<boolean>;
}

const button = 'min-h-11 rounded-xl border border-[#D4A017]/60 px-4 py-2 text-[#F2C754] disabled:opacity-50';
const field = 'mt-1 min-h-11 w-full min-w-0 rounded-xl border border-gray-500 bg-[#111827] px-3 py-2 text-white';

export function StaffAccess({ receptionistConfigured, barbers, pending, change }: StaffAccessProps) {
  const { t } = useTranslation();
  const [selected, select] = useState<string | null>(null);
  const accounts = [
    { id: 'reception', name: t('security.receptionist'), configured: receptionistConfigured },
    ...barbers.map(({ id, name, credentialConfigured }) => ({ id: `barber:${id}`, name, configured: credentialConfigured })),
    { id: 'owner', name: t('security.owner'), configured: true },
  ];
  const actionLabel = (id: string, configured: boolean) => t(id === 'owner' ? 'security.changeOwner'
    : configured ? 'security.changePasscode' : 'security.setPasscode');
  const account = accounts.find(({ id }) => id === selected);

  async function submit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const saved = await change(id, {
      currentOwnerPassword: String(fields.get('current') ?? ''),
      credential: String(fields.get('credential') ?? ''),
      confirmation: String(fields.get('confirmation') ?? ''),
    });
    form.reset();
    if (saved) select(null);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-gray-600 bg-[#1F2937] p-4 sm:p-6">
      <h2 className="text-xl font-bold text-[#F2C754]">{t('security.title')}</h2>
      {accounts.map(({ id, name, configured }) => (
        <div key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#111827] p-3">
          <div>
            <h3 className="font-semibold">{name}</h3>
            {!configured && <p className="text-sm text-gray-300">{t('security.credentialNotSet')}</p>}
          </div>
          <button className={button} type="button" disabled={pending} onClick={() => select(id)}>
            {actionLabel(id, configured)}
          </button>
        </div>
      ))}
      {account && (
        <form key={account.id} className="space-y-3 rounded-xl border border-[#D4A017]/60 p-3 sm:p-4" onSubmit={(event) => void submit(event, account.id)}>
          <h3 className="font-semibold text-[#F2C754]">{account.name} · {actionLabel(account.id, account.configured)}</h3>
          <p className="text-sm text-gray-200">{t(account.id === 'owner' ? 'security.ownerHint' : 'security.staffHint')}</p>
          <label className="block">{t('security.currentOwnerPassword')}<input className={field} name="current" type="password" autoComplete="current-password" required maxLength={256} /></label>
          <label className="block">{t('security.newCredential')}<input className={field} name="credential" type="password" autoComplete="new-password" required maxLength={account.id === 'owner' ? 256 : 128} /></label>
          <label className="block">{t('security.confirmation')}<input className={field} name="confirmation" type="password" autoComplete="new-password" required maxLength={account.id === 'owner' ? 256 : 128} /></label>
          <div className="flex flex-wrap gap-2">
            <button className="min-h-11 rounded-xl bg-[#D4A017] px-4 py-2 font-bold text-[#111827] disabled:opacity-50" disabled={pending}>{t('security.save')}</button>
            <button className={button} type="button" disabled={pending} onClick={() => select(null)}>{t('admin.cancel')}</button>
          </div>
        </form>
      )}
    </section>
  );
}
