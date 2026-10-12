import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import {
  en,
  messageFor,
  normalizeCode,
  reportIssue,
  suggestIssue,
  t,
  toAppError,
  type IssueType,
} from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { compressPhoto, uploadLocalPhoto, type LocalPhoto } from '@/lib/photos';
import { useSession } from '@/lib/session';
import { useOnline } from '@/components/Banner';
import { PhotoTile } from '@/components/CameraBox';
import { Chip } from '@/components/Chip';
import { Field } from '@/components/Field';
import { Headline } from '@/components/Headline';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';

type PickableType = Exclude<IssueType, 'ride_close_request'>;
const TYPES = Object.keys(en.r16.types) as PickableType[];
const NOTE_MAX = 1000;

// R16 Report issue (`?bike=&ride=&stand=&type=`)
export default function Report() {
  const params = useLocalSearchParams<{ bike?: string; ride?: string; stand?: string; type?: string }>();
  const router = useRouter();
  const toast = useToast();
  const online = useOnline();
  const queryClient = useQueryClient();
  const { ctx, uid } = useSession();

  // While riding, the report is about the ride's bike unless another one was given.
  const [bike, setBike] = useState(params.bike || ctx?.ride?.bike_code || '');
  const rideId = params.ride || (params.bike ? null : (ctx?.ride?.id ?? null));
  const [type, setType] = useState<PickableType | null>(
    TYPES.includes(params.type as PickableType) ? (params.type as PickableType) : null,
  );
  const [note, setNote] = useState('');
  const noteRef = useRef(note);
  noteRef.current = note;

  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [suggested, setSuggested] = useState<IssueType | null>(null);
  const [errors, setErrors] = useState<{ bike?: string; form?: string }>({});
  const [sending, setSending] = useState(false);

  // After a capture: compress, upload, then ask TORQ. Nothing here blocks the form.
  const onPhoto = async (next: LocalPhoto | null) => {
    setPhoto(next);
    setPhotoPath(null);
    setSuggested(null);
    if (!next || !uid) return;
    setLooking(true);
    try {
      const path = await uploadLocalPhoto(db, 'issue-photos', uid, await compressPhoto(next));
      setPhotoPath(path);
      const suggestion = await suggestIssue(db, path);
      if (suggestion.type && TYPES.includes(suggestion.type as PickableType)) {
        setType(suggestion.type as PickableType);
        setSuggested(suggestion.type);
        // The rider's own words always win over TORQ's.
        if (noteRef.current.trim() === '' && suggestion.note) setNote(suggestion.note.slice(0, NOTE_MAX));
      }
    } catch {
      // No photo or no suggestion: the report still works without them.
    } finally {
      setLooking(false);
    }
  };

  const send = async () => {
    if (!type) return;
    const code = bike.trim() === '' ? null : normalizeCode(bike);
    if (bike.trim() !== '' && !code) {
      setErrors({ bike: messageFor('CC_BAD_CODE') });
      return;
    }
    setErrors({});
    setSending(true);
    try {
      await reportIssue(db, {
        type,
        note: note.trim() || null,
        bike_code: code,
        ride_id: rideId,
        stand_id: params.stand || null,
        photo_path: photoPath,
        ai_suggested_type: suggested,
      });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.show(type === 'bike_missing' && ctx?.ride ? en.r16.missing_sent : en.r16.sent, 'ok');
      router.back();
    } catch (e) {
      const err = toAppError(e);
      setErrors({ form: messageFor(err.code, err.data) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      header={{}}
      testID="r16"
      footer={
        <>
          {errors.form ? (
            <Text testID="r16.error" variant="bodyS" tone="bad" accessibilityRole="alert">
              {errors.form}
            </Text>
          ) : null}
          <Pill
            testID="r16.send"
            size="lg"
            label={en.r16.send}
            disabled={!type || !online}
            loading={sending}
            onPress={() => void send()}
          />
        </>
      }
    >
      <Headline text={en.r16.title} size="l" />
      <PhotoTile
        testID="r16.snap"
        label={en.r16.snap}
        photo={photo}
        onChange={(p) => void onPhoto(p)}
        retakeLabel={en.r16.retake}
        shutterLabel={en.r16.shutter}
        overlay={
          looking ? (
            <Chip text={en.r16.looking} spinner />
          ) : suggested ? (
            <Chip text={en.r16.suggested} tone="ok" icon={Check} />
          ) : null
        }
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TYPES.map((key) => (
          <Chip
            key={key}
            testID={`r16.types.${key}`}
            text={en.r16.types[key]}
            tone="fg"
            selected={type === key}
            onPress={() => setType(key)}
          />
        ))}
      </View>
      <Field
        testID="r16.bike"
        label={en.r16.bike}
        value={bike}
        onChangeText={(v) => setBike(v.toUpperCase())}
        error={errors.bike}
        placeholder={en.r11.code_placeholder}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Field
        testID="r16.note"
        label={en.r16.note}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={NOTE_MAX}
        counter={t('r16.count', { n: note.length })}
      />
    </Screen>
  );
}
