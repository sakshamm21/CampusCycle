import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { en, getMyIdCheck, relativeTime, t } from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { Headline } from '@/components/Headline';
import { Kicker } from '@/components/Kicker';
import { Pill } from '@/components/Pill';
import { RiderPass } from '@/components/RiderPass';
import { Screen } from '@/components/Screen';
import { Steps, type Step } from '@/components/Steps';
import { Text } from '@/components/Text';
import { EditDetailsSheet, SignOutLink } from '@/features/auth/authForms';
import { firstName, passProps } from '@/features/pass/passData';

// R06 Pending approval
export default function Pending() {
  const { ctx, uid, refresh } = useSession();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const waiting = !!ctx?.profile.id_photo_path && !!ctx.profile.id_check_consent;
  const idCheck = useQuery({
    queryKey: ['idCheck'],
    queryFn: () => getMyIdCheck(db),
    enabled: !!uid && waiting,
    // The check runs in the background after sign-up; look again until it lands.
    refetchInterval: (q) => (q.state.data ? false : 8000),
  });

  if (!ctx) return <Screen header={{ hideBack: true }}>{null}</Screen>;

  const idStep: Step = !ctx.profile.id_photo_path
    ? { text: en.r06.id_none, status: 'todo', testID: 'r06.id_none' }
    : !ctx.profile.id_check_consent
      ? { text: en.r06.id_added, status: 'done', testID: 'r06.id_added' }
      : !idCheck.data
        ? { text: en.r06.id_checking, status: 'busy', testID: 'r06.id_checking' }
        : idCheck.data.match === 'yes'
          ? { text: en.r06.id_match, status: 'done', testID: 'r06.id_match' }
          : { text: en.r06.id_mismatch, status: 'warn', testID: 'r06.id_mismatch' };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ['idCheck'] })]);
    setRefreshing(false);
  };

  return (
    <Screen
      header={{ hideBack: true }}
      testID="r06"
      onRefresh={() => void onRefresh()}
      refreshing={refreshing}
    >
      <Kicker
        text={t('r06.kicker', {
          college: ctx.college?.name ?? '',
          time: relativeTime(ctx.profile.applied_at),
        })}
      />
      <Headline text={t('r06.title', { first: firstName(ctx) })} size="xl" />
      <RiderPass {...passProps(ctx, 'pending')} sway testID="r06.pass" />
      <Steps
        steps={[
          { text: t('r06.step_applied', { roll: ctx.profile.roll_number }), status: 'done' },
          idStep,
          { text: en.r06.step_review, status: 'todo' },
        ]}
      />
      <Text variant="body" tone="muted">
        {en.r06.body}
      </Text>
      <Pill testID="r06.edit" variant="secondary" label={en.r06.edit} onPress={() => setEditing(true)} />
      <SignOutLink testID="r06.sign_out" />
      {editing ? <EditDetailsSheet open onClose={() => setEditing(false)} ctx={ctx} /> : null}
    </Screen>
  );
}
