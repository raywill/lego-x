import { Link } from 'react-router-dom';
import { useCurrentUser } from '../../community/useCurrentUser';
import { localePath, tr, useLocale } from '../../i18n/locale';

export function AccountLink({ active = false }: { active?: boolean }) {
  const locale = useLocale();
  const { user } = useCurrentUser();
  return <Link className={active ? 'active' : undefined} to={localePath('/account', locale)}>{user ? tr(locale, '我的', 'My Builds') : tr(locale, '账户', 'Account')}</Link>;
}
