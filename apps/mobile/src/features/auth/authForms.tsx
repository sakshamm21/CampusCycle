import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import {
  DEMO_EMAILS,
  DEMO_PASSWORD,
  SignUpStep1Schema,
  en,
  listColleges,
  messageFor,
  setIdPhoto,
  signIn,
  toAppError,
  updateApplication,
  type MyContext,
} from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { compressPhoto, uploadLocalPhoto, type LocalPhoto } from '@/lib/photos';
import { Checkbox } from '@/components/Checkbox';
import { Chip } from '@/components/Chip';
import { Field } from '@/components/Field';
import { PhotoTile } from '@/components/CameraBox';
import { Pill } from '@/components/Pill';
import { Sheet } from '@/components/Sheet';
import { Skeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/States';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';

/** "Try the demo rider": signs in as the demo rider; the gate takes it from there (04 R01). */
export function useDemoSignIn() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      await signIn(db, DEMO_EMAILS.rider, DEMO_PASSWORD);
    } catch (e) {
      const err = toAppError(e);
      toast.show(messageFor(err.code, err.data), 'bad');
    } finally {
      setLoading(false);
    }
  };
  return { run, loading };
}

export interface PersonValues {
  full_name: string;
  phone: string;
  roll_number: string;
}

export type PersonErrors = Partial<Record<keyof PersonValues, string>>;

const PERSON_COPY: Record<keyof PersonValues, string> = {
  full_name: en.r04.bad_name,
  phone: en.r04.bad_phone,
  roll_number: en.r04.bad_roll,
};

/** Validates step 1 of sign-up; returns the first error per field in the app's own copy. */
export function validatePerson(values: PersonValues): PersonErrors {
  const parsed = SignUpStep1Schema.safeParse(values);
  if (parsed.success) return {};
  const errors: PersonErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof PersonValues;
    errors[key] ??= PERSON_COPY[key];
  }
  return errors;
}

export function PersonFields({
  values,
  errors,
  onChange,
}: {
  values: PersonValues;
  errors: PersonErrors;
  onChange(patch: Partial<PersonValues>): void;
}) {
  return (
    <>
      <Field
        testID="r04.full_name"
        label={en.r04.full_name}
        value={values.full_name}
        onChangeText={(full_name) => onChange({ full_name })}
        error={errors.full_name}
        autoCapitalize="words"
        autoComplete="name"
      />
      <Field
        testID="r04.phone"
        label={en.r04.phone}
        value={values.phone}
        onChangeText={(phone) => onChange({ phone })}
        error={errors.phone}
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      <Field
        testID="r04.roll"
        label={en.r04.roll}
        value={values.roll_number}
        onChangeText={(roll_number) => onChange({ roll_number })}
        error={errors.roll_number}
        autoCapitalize="characters"
      />
    </>
  );
}

// The searchable college list of R04 step 3, reused by the edit sheet.
export function CollegePicker({
  value,
  onChange,
  email,
  error,
}: {
  value: string | null;
  onChange(id: string): void;
  /** When its domain is one of the selected college's, an ok chip shows. */
  email?: string;
  error?: string | null;
}) {
  const { c } = useTheme();
  const [search, setSearch] = useState('');
  const colleges = useQuery({
    queryKey: ['colleges'],
    queryFn: () => listColleges(db),
    staleTime: 5 * 60_000,
  });

  const domain = email?.split('@')[1]?.trim().toLowerCase() ?? '';
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (colleges.data ?? []).filter(
      (col) => !q || col.name.toLowerCase().includes(q) || col.short_code.toLowerCase().includes(q),
    );
  }, [colleges.data, search]);

  if (colleges.isPending) {
    return (
      <View style={{ gap: 8 }}>
        <Skeleton height={52} />
        <Skeleton height={64} round={22} />
        <Skeleton height={64} round={22} />
      </View>
    );
  }
  if (colleges.error) return <ErrorState error={colleges.error} onRetry={() => void colleges.refetch()} />;

  return (
    <View style={{ gap: 8 }}>
      <Field
        testID="r04.search"
        label={en.r04.search}
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />
      {rows.length === 0 ? (
        <Text variant="bodyS" tone="muted">
          {en.r04.no_colleges}
        </Text>
      ) : null}
      {rows.map((col) => {
        const selected = col.id === value;
        const match =
          selected && !!domain && (col.email_domains ?? []).map((d) => d.toLowerCase()).includes(domain);
        return (
          <Pressable
            key={col.id}
            testID={`r04.college.${col.short_code}`}
            accessibilityRole="radio"
            accessibilityLabel={col.name}
            accessibilityState={{ selected }}
            onPress={() => onChange(col.id)}
            style={{
              minHeight: 64,
              padding: 14,
              gap: 8,
              borderRadius: 22,
              borderWidth: selected ? 1.5 : 1,
              borderColor: selected ? c.primary : c.border,
              backgroundColor: c.surface,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text variant="displayS" style={{ flex: 1 }}>
                {col.name.toLowerCase()}
              </Text>
              <Chip text={col.short_code} />
              {selected ? <Check size={18} color={c.primary} strokeWidth={3} /> : null}
            </View>
            {match ? <Chip text={en.r04.domain_match} tone="ok" icon={Check} /> : null}
          </Pressable>
        );
      })}
      {error ? (
        <Text variant="bodyS" tone="bad">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** The ID card tile with its consent box (shown only once a photo exists). */
export function IdPhotoField({
  photo,
  onPhoto,
  consent,
  onConsent,
  error,
}: {
  photo: LocalPhoto | null;
  onPhoto(photo: LocalPhoto | null): void;
  consent: boolean;
  onConsent(consent: boolean): void;
  error?: string | null;
}) {
  return (
    <View style={{ gap: 8 }}>
      <PhotoTile
        testID="r04.id_tile"
        label={en.r04.id_tile}
        photo={photo}
        onChange={onPhoto}
        retakeLabel={en.r04.retake}
        shutterLabel={en.r04.shutter}
      />
      {photo ? (
        <Checkbox
          testID="r04.consent"
          label={en.r04.consent}
          checked={consent}
          onChange={onConsent}
          error={error}
        />
      ) : null}
    </View>
  );
}

/** Compresses and uploads an ID photo, then records it on the profile. */
export async function saveIdPhoto(uid: string, photo: LocalPhoto, consent: boolean): Promise<void> {
  const uri = await compressPhoto(photo);
  const path = await uploadLocalPhoto(db, 'id-cards', uid, uri);
  await setIdPhoto(db, path, consent);
}

// "Edit details" on Pending and "fix and re-apply" on Rejected (04 R06, R07).
export function EditDetailsSheet({ open, onClose, ctx }: { open: boolean; onClose(): void; ctx: MyContext }) {
  const { refresh, uid } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [person, setPerson] = useState<PersonValues>({
    full_name: ctx.profile.full_name,
    phone: ctx.profile.phone,
    roll_number: ctx.profile.roll_number,
  });
  const [collegeId, setCollegeId] = useState<string | null>(ctx.profile.college_id);
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [consent, setConsent] = useState(ctx.profile.id_check_consent);
  const [errors, setErrors] = useState<PersonErrors & { college?: string; consent?: string; form?: string }>(
    {},
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const found: typeof errors = validatePerson(person);
    if (!collegeId) found.college = en.r04.need_college;
    if (photo && !consent) found.consent = en.r04.need_consent;
    setErrors(found);
    if (Object.keys(found).length > 0 || !collegeId) return;

    setSaving(true);
    try {
      await updateApplication(db, { ...person, college_id: collegeId });
      if (photo && uid) {
        try {
          await saveIdPhoto(uid, photo, consent);
        } catch {
          toast.show(en.r04.photo_later, 'warn');
        }
      }
      await refresh();
      void queryClient.invalidateQueries({ queryKey: ['idCheck'] });
      onClose();
    } catch (e) {
      const err = toAppError(e);
      setErrors({ form: messageFor(err.code, err.data) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={en.r06.edit_title} testID="r06.edit_sheet">
      <PersonFields
        values={person}
        errors={errors}
        onChange={(patch) => setPerson((p) => ({ ...p, ...patch }))}
      />
      <CollegePicker
        value={collegeId}
        onChange={setCollegeId}
        email={ctx.profile.email}
        error={errors.college}
      />
      <IdPhotoField
        photo={photo}
        onPhoto={setPhoto}
        consent={consent}
        onConsent={setConsent}
        error={errors.consent}
      />
      {errors.form ? (
        <Text variant="bodyS" tone="bad">
          {errors.form}
        </Text>
      ) : null}
      <Pill testID="r06.save" size="lg" label={en.r06.save} loading={saving} onPress={() => void save()} />
    </Sheet>
  );
}

export function SignOutLink({ testID }: { testID: string }) {
  const { signOut } = useSession();
  return (
    <Pill testID={testID} variant="ghost" size="sm" label={en.r06.sign_out} onPress={() => void signOut()} />
  );
}
