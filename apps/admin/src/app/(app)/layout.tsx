import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { Providers } from '@/lib/providers';
import { AppShell } from '@/components/shell/AppShell';
import type { MyContext } from '@campuscycle/shared';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  const { data: rawCtx, error: ctxError } = await supabase.rpc('get_my_context');

  if (ctxError || !rawCtx) {
    await supabase.auth.signOut();
    redirect('/sign-in?e=CC_NOT_ADMIN');
  }

  const ctx = rawCtx as unknown as MyContext;

  // Non-admins or non-approved profiles cannot access admin portal
  if (ctx.profile.role === 'rider' || ctx.profile.status !== 'approved') {
    await supabase.auth.signOut();
    redirect('/sign-in?e=CC_NOT_ADMIN');
  }

  const isSuperAdmin = ctx.profile.role === 'super_admin' || ctx.profile.is_owner;
  let colleges: Array<{ id: string; name: string; short_code: string; active: boolean; time_zone: string }> =
    [];

  if (isSuperAdmin) {
    const { data: collegesData } = await supabase
      .from('colleges')
      .select('id,name,short_code,active,time_zone')
      .order('name');
    colleges = collegesData ?? [];
  }

  const cookieStore = await cookies();
  const initialCollegeId = cookieStore.get('cc-college')?.value;

  return (
    <Providers ctx={ctx} initialColleges={colleges} initialCollegeId={initialCollegeId}>
      <AppShell ctx={ctx}>{children}</AppShell>
    </Providers>
  );
}
