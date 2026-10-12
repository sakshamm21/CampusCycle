import React, { useEffect, useState } from 'react';
import { Linking, Pressable, Switch, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { ChevronRight } from 'lucide-react-native';
import {
  changePassword,
  clearMyAiMemory,
  deleteMyAccount,
  en,
  font,
  messageFor,
  t,
  toAppError,
  updateMyProfile,
  type MyContext,
} from '@campuscycle/shared';
import { adminUrl, db } from '@/lib/supabase';
import { validatePerson } from '@/features/auth/authForms';
import { useSession } from '@/lib/session';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Kicker } from '@/components/Kicker';
import { Pill } from '@/components/Pill';
import { RiderPass } from '@/components/RiderPass';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { passProps } from '@/features/pass/passData';
import { passDisplayState } from '@/features/pass/passState';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';

const READ_ALOUD_KEY = 'cc-read-aloud';
type Prefs = MyContext['profile']['notif_prefs'];

function Section({ title, children, testID }: { title: string; children: React.ReactNode; testID?: string }) {
  return (
    <Card testID={testID}>
      <View style={{ gap: 10 }}>
        <Kicker text={title} />
        {children}
      </View>
    </Card>
  );
}

function Row({
  label,
  value,
  onPress,
  danger,
  testID,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();
  const body = (
    <>
      <Text variant="body" tone={danger ? 'bad' : 'fg'} style={{ flex: 1 }}>
        {label}
      </Text>
      {value ? (
        <Text variant="bodyS" tone="muted">
          {value}
        </Text>
      ) : null}
      {onPress ? <ChevronRight size={16} color={c.subtle} strokeWidth={2} /> : null}
    </>
  );
  const style = { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 } as const;
  return onPress ? (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={style}
    >
      {body}
    </Pressable>
  ) : (
    <View testID={testID} style={style}>
      {body}
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange(v: boolean): void;
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: c.primary, false: c.surface2 }}
        thumbColor={c.fg}
      />
    </View>
  );
}

// R19 Profile and help
export default function Profile() {
  const toast = useToast();
  const screen = useWindowDimensions();
  const { themePreference, setTheme } = useTheme();
  const { ctx, refresh, signOut } = useSession();

  const [phone, setPhone] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [readAloud, setReadAloud] = useState(false);
  const [sheet, setSheet] = useState<'password' | 'delete' | 'memory' | 'how' | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [deleteWord, setDeleteWord] = useState('');
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(READ_ALOUD_KEY).then((v) => setReadAloud(v === '1'));
  }, []);

  if (!ctx) return <Screen dock>{null}</Screen>;
  const { profile, college } = ctx;
  const demo = profile.is_demo;
  const limit = college?.strike_limit ?? 0;

  const closeSheet = () => {
    setSheet(null);
    setSheetError(null);
    setPassword('');
    setConfirm('');
    setDeleteWord('');
  };

  /** Runs a sheet's action: errors show in the sheet, success closes it. */
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setSheetError(null);
    try {
      await action();
      closeSheet();
    } catch (e) {
      const err = toAppError(e);
      setSheetError(messageFor(err.code, err.data));
    } finally {
      setBusy(false);
    }
  };

  const savePhone = async () => {
    if (phone === null) return;
    if (validatePerson({ full_name: profile.full_name, roll_number: profile.roll_number, phone }).phone) {
      setPhoneError(en.r04.bad_phone);
      return;
    }
    try {
      await updateMyProfile(db, { phone: phone.trim() });
      await refresh();
      setPhone(null);
      setPhoneError(null);
    } catch (e) {
      const err = toAppError(e);
      setPhoneError(messageFor(err.code, err.data));
    }
  };

  const setPref = async (patch: Partial<Prefs>) => {
    try {
      await updateMyProfile(db, { notif_prefs: { ...profile.notif_prefs, ...patch } });
      await refresh();
    } catch (e) {
      const err = toAppError(e);
      toast.show(messageFor(err.code, err.data), 'bad');
    }
  };

  const toggleReadAloud = (on: boolean) => {
    setReadAloud(on);
    AsyncStorage.setItem(READ_ALOUD_KEY, on ? '1' : '0').catch(() => {});
  };

  const savePassword = () => {
    if (password.length < 8) {
      setSheetError(messageFor('CC_WEAK_PASSWORD'));
      return;
    }
    if (password !== confirm) {
      setSheetError(en.r04.bad_confirm);
      return;
    }
    void run(async () => {
      await changePassword(db, password);
      toast.show(en.r19.pw_changed, 'ok');
    });
  };

  const version = [Constants.expoConfig?.version, Updates.runtimeVersion].filter(Boolean).join(' · ');

  return (
    <Screen dock testID="r19">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <RiderPass
          {...passProps(ctx, passDisplayState(ctx) === 'minting' ? 'ready' : passDisplayState(ctx))}
          width={Math.min(440, screen.width - 32) * 0.4}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="displayM">{profile.full_name.toLowerCase()}</Text>
          <Text variant="bodyS" tone="muted">
            {profile.email}
          </Text>
          <Text variant="bodyS" tone="muted">
            {college?.name ?? ''}
          </Text>
          {ctx.pass.label ? <Text variant="label">{ctx.pass.label}</Text> : null}
        </View>
      </View>

      <Section title={en.r19.details} testID="r19.details">
        {phone === null ? (
          <Row
            testID="r19.phone"
            label={en.r19.phone}
            value={profile.phone}
            onPress={() => setPhone(profile.phone)}
          />
        ) : (
          <View style={{ gap: 8 }}>
            <Field
              testID="r19.phone_field"
              label={en.r19.phone}
              value={phone}
              onChangeText={setPhone}
              error={phoneError}
              keyboardType="phone-pad"
              autoFocus
            />
            <Pill testID="r19.phone_save" size="sm" label={en.common.save} onPress={() => void savePhone()} />
          </View>
        )}
        <Row label={en.r19.roll} value={profile.roll_number} />
        <Row label={en.r19.name} value={profile.full_name} />
        <Text variant="bodyS" tone="subtle">
          {en.r19.ask_admin}
        </Text>
      </Section>

      <Section title={en.r19.strikes_t}>
        <Text variant="numericM" tone={profile.strikes > 0 ? 'warn' : 'fg'}>
          {t('r19.strikes_value', { strikes: profile.strikes, limit })}
        </Text>
        <Text variant="bodyS" tone="muted">
          {t('r19.strikes_body', { limit })}
        </Text>
      </Section>

      <Section title={en.r19.rules_t}>
        <Text variant="bodyS">{college?.rules_text ?? ''}</Text>
      </Section>

      <Section title={en.r19.notif_t}>
        <SwitchRow
          testID="r19.n_approval"
          label={en.r19.n_approval}
          value={profile.notif_prefs.approval}
          onChange={(approval) => void setPref({ approval })}
        />
        <SwitchRow
          testID="r19.n_reminders"
          label={en.r19.n_reminders}
          value={profile.notif_prefs.reminders}
          onChange={(reminders) => void setPref({ reminders })}
        />
        <SwitchRow
          testID="r19.n_issues"
          label={en.r19.n_issues}
          value={profile.notif_prefs.issues}
          onChange={(issues) => void setPref({ issues })}
        />
        <Text variant="bodyS" tone="subtle">
          {en.r19.n_always}
        </Text>
      </Section>

      <Section title={en.r19.appearance}>
        <Segmented<ThemeMode>
          value={themePreference}
          onChange={(mode) => void setTheme(mode)}
          options={[
            { value: 'system', label: en.r19.system, testID: 'r19.system' },
            { value: 'dark', label: en.r19.dark, testID: 'r19.dark' },
            { value: 'day', label: en.r19.day, testID: 'r19.day' },
          ]}
        />
      </Section>

      <Section title={en.r19.torq_t}>
        <SwitchRow
          testID="r19.read_aloud"
          label={en.r19.read_aloud}
          value={readAloud}
          onChange={toggleReadAloud}
        />
        <Row testID="r19.clear_memory" label={en.r19.clear_memory} onPress={() => setSheet('memory')} />
      </Section>

      <Section title={en.r19.account}>
        {demo ? null : (
          <Row testID="r19.change_pw" label={en.r19.change_pw} onPress={() => setSheet('password')} />
        )}
        <Row testID="r19.sign_out" label={en.r19.sign_out} onPress={() => void signOut()} />
        {demo ? null : (
          <Row testID="r19.delete" label={en.r19.delete} danger onPress={() => setSheet('delete')} />
        )}
      </Section>

      <Section title={en.r19.help}>
        <Row testID="r19.how" label={en.r19.how} onPress={() => setSheet('how')} />
        <Row
          testID="r19.privacy"
          label={en.r19.privacy}
          onPress={() => void Linking.openURL(`${adminUrl}/privacy`)}
        />
        <Text variant="label" tone="subtle" style={{ fontFamily: font.mono }}>
          {t('r19.version', { v: version })}
        </Text>
      </Section>

      <Sheet open={sheet === 'memory'} onClose={closeSheet} testID="r19.memory_sheet">
        <Text variant="body">{en.r19.clear_confirm}</Text>
        {sheetError ? (
          <Text variant="bodyS" tone="bad">
            {sheetError}
          </Text>
        ) : null}
        <Pill
          testID="r19.clear_confirm"
          size="lg"
          label={en.common.confirm}
          loading={busy}
          onPress={() =>
            void run(async () => {
              const { deleted } = await clearMyAiMemory(db);
              toast.show(t('r19.cleared', { n: deleted }), 'ok');
            })
          }
        />
        <Pill variant="ghost" block label={en.common.cancel} onPress={closeSheet} />
      </Sheet>

      <Sheet open={sheet === 'password'} onClose={closeSheet} testID="r19.password_sheet">
        <Field
          testID="r19.new_pw"
          label={en.r19.new_pw}
          value={password}
          onChangeText={setPassword}
          secure
          autoComplete="new-password"
        />
        <Field
          testID="r19.confirm_pw"
          label={en.r19.confirm_pw}
          value={confirm}
          onChangeText={setConfirm}
          secure
          autoComplete="new-password"
          error={sheetError}
        />
        <Pill testID="r19.save_pw" size="lg" label={en.common.save} loading={busy} onPress={savePassword} />
      </Sheet>

      <Sheet open={sheet === 'delete'} onClose={closeSheet} testID="r19.delete_sheet">
        <Text variant="body">{en.r19.delete_body}</Text>
        <Field
          testID="r19.delete_word"
          label={en.r19.delete_word}
          value={deleteWord}
          onChangeText={setDeleteWord}
          autoCapitalize="characters"
          autoCorrect={false}
          error={sheetError}
        />
        <Pill
          testID="r19.delete_confirm"
          size="lg"
          variant="danger"
          label={en.r19.delete}
          disabled={deleteWord.trim() !== en.r19.delete_word}
          loading={busy}
          onPress={() =>
            void run(async () => {
              await deleteMyAccount(db);
              // The account is gone; drop the local session and the gate returns to Welcome.
              await db.auth.signOut({ scope: 'local' });
            })
          }
        />
      </Sheet>

      <Sheet open={sheet === 'how'} onClose={closeSheet} testID="r19.how_sheet">
        {en.r19.how_steps.map((step, i) => (
          <View key={step} style={{ flexDirection: 'row', gap: 10 }}>
            <Text variant="label" tone="primary" style={{ width: 16, lineHeight: 23 }}>
              {String(i + 1)}
            </Text>
            <Text variant="body" style={{ flex: 1 }}>
              {step}
            </Text>
          </View>
        ))}
      </Sheet>
    </Screen>
  );
}
