import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Auth from '@/components/Auth';

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/');
  }

  return <Auth />;
}
