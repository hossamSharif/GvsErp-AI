import { redirect } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  redirect('/login');
}
