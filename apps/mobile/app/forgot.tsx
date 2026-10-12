import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { en, messageFor, requestPasswordReset, toAppError } from '@campuscycle/shared';
import { z } from 'zod';
import { db } from '@/lib/supabase';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Headline } from '@/components/Headline';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

const Email = z.string().trim().email();

// R03 Forgot and reset password
export default function Forgot() {
  const router = useRouter();
  const { c } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const parsed = Email.safeParse(email);
    if (!parsed.success) {
      setError(en.r02.bad_email);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(db, parsed.data);
      setSent(true);
    } catch (e) {
      const err = toAppError(e);
      setError(messageFor(err.code, err.data));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen banners={false} header={{}} testID="r03">
      <Headline text={en.r03.title} size="l" />
      <Text variant="body" tone="muted">
        {en.r03.body}
      </Text>
      {sent ? (
        <Card testID="r03.sent">
          <View style={{ gap: 10 }}>
            <CircleCheck size={24} color={c.ok} strokeWidth={2} />
            <Text variant="displayS">{en.r03.sent_title}</Text>
            <Text variant="bodyS" tone="muted">
              {en.r03.sent_body}
            </Text>
            <Pill
              testID="r03.back"
              variant="secondary"
              label={en.r03.back}
              onPress={() => router.replace('/sign-in')}
            />
          </View>
        </Card>
      ) : (
        <>
          <Field
            testID="r03.email"
            label={en.r02.email}
            value={email}
            onChangeText={setEmail}
            error={error}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            onSubmitEditing={() => void submit()}
          />
          <Pill
            testID="r03.submit"
            size="lg"
            label={en.r03.submit}
            loading={loading}
            onPress={() => void submit()}
          />
        </>
      )}
    </Screen>
  );
}
