import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SignInSchema, en, messageFor, signIn, toAppError } from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { Field } from '@/components/Field';
import { Headline } from '@/components/Headline';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useDemoSignIn } from '@/features/auth/authForms';
import { useTheme } from '@/theme/ThemeProvider';

// R02 Sign in
export default function SignIn() {
  const router = useRouter();
  const { c } = useTheme();
  const demo = useDemoSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const parsed = SignInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({
        email: fields.email ? en.r02.bad_email : undefined,
        password: fields.password ? en.r02.need_password : undefined,
      });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await signIn(db, parsed.data.email, parsed.data.password);
    } catch (e) {
      const err = toAppError(e);
      setErrors({ form: messageFor(err.code, err.data) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen banners={false} header={{}} testID="r02">
      <Headline text={en.r02.title} size="l" />
      <Field
        testID="r02.email"
        label={en.r02.email}
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <Field
        testID="r02.password"
        label={en.r02.password}
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secure
        autoComplete="current-password"
        onSubmitEditing={() => void submit()}
      />
      <Pressable
        testID="r02.forgot"
        accessibilityRole="link"
        onPress={() => router.push('/forgot')}
        hitSlop={12}
        style={{ alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' }}
      >
        <Text variant="bodyS" tone="primary">
          {en.r02.forgot}
        </Text>
      </Pressable>
      {errors.form ? (
        <Text testID="r02.error" variant="bodyS" tone="bad" accessibilityRole="alert">
          {errors.form}
        </Text>
      ) : null}
      <Pill
        testID="r02.submit"
        size="lg"
        label={en.r02.submit}
        loading={loading}
        onPress={() => void submit()}
      />
      <View style={{ height: 1, backgroundColor: c.border, marginVertical: 8 }} />
      <Pill
        testID="r02.demo"
        variant="ghost"
        block
        label={en.r02.demo}
        loading={demo.loading}
        onPress={() => void demo.run()}
      />
    </Screen>
  );
}
