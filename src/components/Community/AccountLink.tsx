import { Link } from 'react-router-dom';
import { useCurrentUser } from '../../community/useCurrentUser';

export function AccountLink({ active = false }: { active?: boolean }) {
  const { user } = useCurrentUser();
  return <Link className={active ? 'active' : undefined} to="/account">{user ? '我的' : '账户'}</Link>;
}
