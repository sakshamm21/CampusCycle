import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SignUpStep2Schema, en, messageFor, signUp, t, toAppError } from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import type { LocalPhoto } from '@/lib/photos';
import { Card } from '@/components/Card';
import { Checkbox } from '@/components/Checkbox';
import { Field } from '@/components/Field';
import { Headline } from '@/components/Headline';
import { Kicker } from '@/components/Kicker';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import {
  CollegePicker,
  IdPhotoField,
  PersonFields,
  saveIdPhoto,
  validatePerson,
  type PersonValues,
} from '@/features/auth/authForms';
import { useTheme } from '@/theme/ThemeProvider';

type Step = 1 | 2 | 3 | 4;
type Errors = Partial<
  Record<
    | 'full_name'
    | 'phone'
    | 'roll_number'
    | 'email'
    | 'password'
    | 'confirm'
    | 'college'
    | 'consent'
    | 'rules'
    | 'form',
    string
  >
>;

const TITLES = { 1: en.r04.title_1, 2: en.r04.title_2, 3: en.r04.title_3, 4: en.r04.title_4 } as const;

// R04 Sign up: four steps in one screen
export default function SignUp() {
  const router = useRouter();
  const { c } = useTheme();
  const toast = useToast();
  const { refresh } = useSession();

  const [step, setStep] = useState<Step>(1);
  const [person, setPerson] = useState<PersonValues>({ full_name: '', phone: '', roll_number: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [collegeId, setCollegeId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [consent, setConsent] = useState(false);
  const [rules, setRules] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  const back = () => {
    if (step === 1) router.back();
    else setStep((step - 1) as Step);
  };

  const validate = (): Errors => {
    if (step === 1) return validatePerson(person);
    if (step === 2) {
      const parsed = SignUpStep2Schema.safeParse({ email, password, confirmPassword: confirm });
      if (parsed.success) return {};
      const fields = parsed.error.flatten().fieldErrors;
      return {
        ...(fields.email ? { email: en.r04.bad_email } : null),
        ...(fields.password ? { password: en.r04.bad_password } : null),
        ...(!fields.password && fields.confirmPassword ? { confirm: en.r04.bad_confirm } : null),
      };
    }
    if (step === 3) return collegeId ? {} : { college: en.r04.need_college };
    return {
      ...(photo && !consent ? { consent: en.r04.need_consent } : null),
      ...(rules ? null : { rules: en.r04.need_rules }),
    };
  };

  const submit = async () => {
    if (!collegeId) return;
    setLoading(true);
    try {
      const result = await signUp(db, {
        ...person,
        email: email.trim(),
        password,
        college_id: collegeId,
        id_check_consent: !!photo && consent,
      });
      const uid = result.session?.user.id;
      if (uid && photo) {
        // A failed upload never blocks the account: the photo can be added from Pending.
        try {
          await saveIdPhoto(uid, photo, consent);
          await refresh();
        } catch {
          toast.show(en.r04.photo_later, 'warn');
        }
      }
      // With a session the gate moves on to Permissions and Pending by itself.
    } catch (e) {
      const err = toAppError(e);
      const message = messageFor(err.code, err.data);
      if (err.code === 'CC_EMAIL_TAKEN') {
        setStep(2);
        setErrors({ email: message });
      } else if (err.code === 'CC_WEAK_PASSWORD') {
        setStep(2);
        setErrors({ password: message });
      } else {
        setErrors({ form: message });
      }
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (step === 4) void submit();
    else setStep((step + 1) as Step);
  };

  return (
    <Screen
      banners={false}
      header={{ onBack: back }}
      testID={`r04.step_${step}`}
      footer={
        <Pill
          testID={step === 4 ? 'r04.submit' : 'r04.next'}
          size="lg"
          label={step === 4 ? en.r04.submit : en.r04.next}
          loading={loading}
          onPress={next}
        />
      }
    >
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('r04.step', { n: step })}
        accessibilityValue={{ min: 1, max: 4, now: step }}
        style={{ flexDirection: 'row', gap: 6 }}
      >
        {[1, 2, 3, 4].map((n) => (
          <View
            key={n}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: n <= step ? c.primary : c.surface2,
            }}
          />
        ))}
      </View>
      <Headline text={TITLES[step]} size="l" />

      {step === 1 ? (
        <PersonFields
          values={person}
          errors={errors}
          onChange={(patch) => setPerson((p) => ({ ...p, ...patch }))}
        />
      ) : null}

      {step === 2 ? (
        <>
          <Field
            testID="r04.email"
            label={en.r04.email}
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            testID="r04.password"
            label={en.r04.password}
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secure
            autoComplete="new-password"
          />
          <Field
            testID="r04.confirm"
            label={en.r04.confirm}
            value={confirm}
            onChangeText={setConfirm}
            error={errors.confirm}
            secure
            autoComplete="new-password"
          />
        </>
      ) : null}

      {step === 3 ? (
        <CollegePicker value={collegeId} onChange={setCollegeId} email={email} error={errors.college} />
      ) : null}

      {step === 4 ? (
        <>
          <IdPhotoField
            photo={photo}
            onPhoto={(p) => {
              setPhoto(p);
              if (!p) setConsent(false);
            }}
            consent={consent}
            onConsent={setConsent}
            error={errors.consent}
          />
          <Card>
            <View style={{ gap: 10 }}>
              <Kicker text={en.r04.rules_title} />
              {en.r04.rules.map((rule, i) => (
                <View key={rule} style={{ flexDirection: 'row', gap: 10 }}>
                  <Text variant="label" tone="primary" style={{ width: 16, lineHeight: 19 }}>
                    {String(i + 1)}
                  </Text>
                  <Text variant="bodyS" style={{ flex: 1 }}>
                    {rule}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
          <Checkbox
            testID="r04.rules_accept"
            label={en.r04.rules_accept}
            checked={rules}
            onChange={setRules}
            error={errors.rules}
          />
        </>
      ) : null}

      {errors.form ? (
        <Text testID="r04.error" variant="bodyS" tone="bad" accessibilityRole="alert">
          {errors.form}
        </Text>
      ) : null}
    </Screen>
  );
}
