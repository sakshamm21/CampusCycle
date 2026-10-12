import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { en, t } from '@campuscycle/shared';
import { adminUrl } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { Card } from '@/components/Card';
import { Headline } from '@/components/Headline';
import { Kicker } from '@/components/Kicker';
import { Pill } from '@/components/Pill';
import { RiderPass } from '@/components/RiderPass';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { EditDetailsSheet, SignOutLink } from '@/features/auth/authForms';
import { passProps } from '@/features/pass/passData';

function Reason({ text }: { text: string | null }) {
  return (
    <Card testID="r07.reason">
      <View style={{ gap: 8 }}>
        <Kicker text={en.r07.reason} />
        <Text variant="body">{text ?? ''}</Text>
      </View>
    </Card>
  );
}

// R07 Rejected, suspended or no college. The gate picks the variant.
export default function Blocked() {
  const { variant } = useLocalSearchParams<{ variant?: string }>();
  const { ctx } = useSession();
  const [editing, setEditing] = useState(false);
  const [contact, setContact] = useState(false);

  if (!ctx) return <Screen header={{ hideBack: true }}>{null}</Screen>;

  if (variant === 'no_college') {
    return (
      <Screen header={{ hideBack: true }} testID="r07.no_college">
        <Headline text={en.r07.nc_title} size="l" />
        <Text variant="body" tone="muted">
          {en.r07.nc_body}
        </Text>
        <Pill
          testID="r07.open_admin"
          size="lg"
          label={en.r07.open_admin}
          onPress={() => void Linking.openURL(adminUrl)}
        />
        <SignOutLink testID="r07.sign_out" />
      </Screen>
    );
  }

  if (variant === 'suspended') {
    return (
      <Screen header={{ hideBack: true }} testID="r07.suspended">
        <RiderPass {...passProps(ctx, 'suspended')} testID="r07.pass" />
        <Headline text={en.r07.sus_title} size="xl" />
        <Reason text={ctx.profile.suspended_reason} />
        <Text variant="body" tone="muted">
          {t('r07.sus_body', { strikes: ctx.profile.strikes, limit: ctx.college?.strike_limit ?? 0 })}
        </Text>
        <Pill
          testID="r07.contact"
          variant="secondary"
          label={en.r07.contact}
          onPress={() => setContact(true)}
        />
        <SignOutLink testID="r07.sign_out" />
        <Sheet open={contact} onClose={() => setContact(false)}>
          <Text variant="body">{en.r07.contact_body}</Text>
        </Sheet>
      </Screen>
    );
  }

  return (
    <Screen header={{ hideBack: true }} testID="r07.rejected">
      <RiderPass {...passProps(ctx, 'pending')} testID="r07.pass" />
      <Headline text={en.r07.rej_title} size="xl" />
      <Reason text={ctx.profile.rejection_reason} />
      <Pill testID="r07.reapply" size="lg" label={en.r07.reapply} onPress={() => setEditing(true)} />
      <SignOutLink testID="r07.sign_out" />
      {editing ? <EditDetailsSheet open onClose={() => setEditing(false)} ctx={ctx} /> : null}
    </Screen>
  );
}
