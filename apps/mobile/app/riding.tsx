import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import {
  en,
  formatDistance,
  formatDuration,
  formatTimer,
  messageFor,
  requestRideClose,
  t,
  timeLeft,
  toAppError,
} from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useNow } from '@/hooks/useNow';
import { Banner, useOnline } from '@/components/Banner';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Kicker } from '@/components/Kicker';
import { Pill } from '@/components/Pill';
import { RiderPass } from '@/components/RiderPass';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { passProps } from '@/features/pass/passData';
import { passDisplayState } from '@/features/pass/passState';
import { useStands } from '@/features/stands/useStands';
import { useTheme } from '@/theme/ThemeProvider';

function LinkButton({ label, onPress, testID }: { label: string; onPress(): void; testID: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={8}
      style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
    >
      <Text variant="bodyS" tone="primary">
        {label}
      </Text>
    </Pressable>
  );
}

// R13 Riding
export default function Riding() {
  const { docked } = useLocalSearchParams<{ docked?: string }>();
  const router = useRouter();
  const toast = useToast();
  const focused = useIsFocused();
  const online = useOnline();
  const { c } = useTheme();
  const { ctx } = useSession();
  const now = useNow(1000);
  const stands = useStands();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!ctx) return <Screen header={{}}>{null}</Screen>;
  const ride = ctx.ride;
  if (!ride) {
    // The ride ended (returned, or closed by an admin). Only the screen in front redirects.
    return focused ? <Redirect href="/(main)" /> : null;
  }

  const left = timeLeft(ride.due_at, new Date(now));
  const state = passDisplayState(ctx);
  const overdue = state === 'overdue' || left.overdue;
  const nearest = (stands.data ?? []).slice(0, 3);

  const askClose = async () => {
    if (note.trim().length < 3) {
      setNoteError(messageFor('CC_REASON_REQUIRED'));
      return;
    }
    setSending(true);
    try {
      await requestRideClose(db, note.trim());
      setAsking(false);
      setNote('');
      toast.show(en.r13.close_sent, 'ok');
    } catch (e) {
      const err = toAppError(e);
      setNoteError(messageFor(err.code, err.data));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      testID="r13"
      header={{ onBack: () => router.dismissTo('/(main)') }}
      footer={
        <>
          <Pill testID="r13.return" size="lg" label={en.r13.return} onPress={() => router.push('/return')} />
          <Pill
            testID="r13.report"
            variant="secondary"
            block
            label={en.r13.report}
            onPress={() => router.push(`/report?ride=${ride.id}&bike=${ride.bike_code}`)}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <LinkButton testID="r13.cant_reach" label={en.r13.cant_reach} onPress={() => setAsking(true)} />
            <LinkButton
              testID="r13.lost"
              label={en.r13.lost}
              onPress={() => router.push(`/report?ride=${ride.id}&bike=${ride.bike_code}&type=bike_missing`)}
            />
          </View>
        </>
      }
    >
      <Kicker live text={t('r13.kicker', { start: ride.start_stand_name })} />
      <RiderPass
        {...passProps(ctx, overdue ? 'overdue' : 'riding')}
        dock={docked === '1'}
        testID="r13.pass"
      />

      <Card testID="r13.timer">
        <View style={{ gap: 6 }}>
          <Kicker text={en.r13.ride_time} />
          <Text variant="numericXL" testID="r13.elapsed">
            {formatTimer(now - new Date(ride.started_at).getTime())}
          </Text>
          <Text variant="body" tone={overdue ? 'warn' : 'muted'}>
            {overdue
              ? t('r13.over', { over: formatDuration(left.ms / 60_000) })
              : t('r13.time_left', { left: formatDuration(left.ms / 60_000) })}
          </Text>
        </View>
      </Card>
      {overdue ? <Banner tone="warn" text={en.r13.overdue_note} testID="r13.overdue_note" /> : null}

      {nearest.length > 0 ? (
        <Card testID="r13.nearest">
          <View style={{ gap: 4 }}>
            <Kicker text={en.r13.nearest} />
            {nearest.map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                onPress={() => router.push(`/stand/${s.id}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 44,
                  borderBottomWidth: 1,
                  borderBottomColor: c.border,
                }}
              >
                <Text variant="body" style={{ flex: 1 }}>
                  {s.name}
                </Text>
                {s.distance_m !== null ? (
                  <Text variant="bodyS" tone="muted">
                    {formatDistance(s.distance_m)}
                  </Text>
                ) : null}
                <Text variant="label" tone="muted">
                  {t('r13.free', { n: s.free_bikes })}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      <Sheet open={asking} onClose={() => setAsking(false)} testID="r13.close_sheet">
        <Text variant="body">{en.r13.cant_reach_body}</Text>
        <Field
          testID="r13.note"
          label={en.r13.note}
          value={note}
          onChangeText={(v) => {
            setNote(v);
            setNoteError(null);
          }}
          error={noteError}
          multiline
          maxLength={1000}
        />
        <Pill
          testID="r13.ask_close"
          size="lg"
          label={en.r13.ask_close}
          loading={sending}
          disabled={!online}
          onPress={() => void askClose()}
        />
      </Sheet>
    </Screen>
  );
}
