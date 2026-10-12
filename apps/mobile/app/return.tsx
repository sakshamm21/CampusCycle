import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Redirect, useIsFocused, useRouter } from 'expo-router';
import {
  checkReturnLocation,
  en,
  getStands,
  messageFor,
  returnBike,
  t,
  toAppError,
  type AppError,
  type GeoFix,
  type ReturnCheck,
} from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { getFix } from '@/lib/location';
import { compressPhoto, uploadLocalPhoto, type LocalPhoto } from '@/lib/photos';
import { enqueuePhoto } from '@/lib/queue';
import { useSession } from '@/lib/session';
import { Banner, useOnline } from '@/components/Banner';
import { CameraBox, useCameraStatus } from '@/components/CameraBox';
import { Headline } from '@/components/Headline';
import { Kicker } from '@/components/Kicker';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { ErrorState } from '@/components/States';
import { Steps } from '@/components/Steps';
import { Text } from '@/components/Text';
import { useReturnFlow } from '@/features/ride/ReturnFlowProvider';
import { rideErrorActions } from '@/features/ride/rideErrors';
import { useTheme } from '@/theme/ThemeProvider';

// R14 Return: at a stand, same bike, photo
export default function Return() {
  const router = useRouter();
  const focused = useIsFocused();
  const online = useOnline();
  const { c } = useTheme();
  const { ctx, uid, refresh } = useSession();
  const flow = useReturnFlow();
  const camera = useCameraStatus();

  const demo = !!ctx?.profile.is_demo;
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [check, setCheck] = useState<ReturnCheck | null>(null);
  const [checkError, setCheckError] = useState<AppError | null>(null);
  const [picking, setPicking] = useState(false);
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [finishing, setFinishing] = useState<'upload' | 'return' | null>(null);
  const [finishError, setFinishError] = useState<AppError | null>(null);

  const demoStands = useQuery({
    queryKey: ['stands', null, null],
    queryFn: () => getStands(db),
    enabled: demo,
  });

  // A scan left over from an earlier, abandoned return must not tick step 2.
  useEffect(() => {
    flow.setScan(null);
    flow.setDemoStandId(null);
    // Once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 1: where is the rider?
  const locate = useCallback(
    async (demoStandId?: string) => {
      if (!ctx) return;
      setCheckError(null);
      setCheck(null);
      try {
        const next = await getFix(ctx);
        setFix(next);
        setCheck(await checkReturnLocation(db, next, demoStandId));
        if (demoStandId) flow.setDemoStandId(demoStandId);
      } catch (e) {
        setCheckError(toAppError(e));
      }
    },
    // Tied to the rider, not to every context refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx?.profile.id],
  );

  useEffect(() => {
    if (!ctx) return;
    if (demo) setPicking(true);
    else void locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.profile.id]);

  if (!ctx) return <Screen header={{}}>{null}</Screen>;
  const ride = ctx.ride;
  if (!ride) return focused && !finishing ? <Redirect href="/(main)" /> : null;

  const scan = flow.scan;
  const wrongBike = scan !== null && scan.code !== ride.bike_code;
  const sameBike = scan !== null && !wrongBike;
  const canSkipPhoto = camera === 'unavailable' || camera === 'denied';
  const photoDone = photo !== null || (skipped && canSkipPhoto);
  const ready = check !== null && sameBike && photoDone;

  const finish = async () => {
    if (!ready || !scan || !uid) return;
    setFinishError(null);
    let path: string | null = null;
    if (photo) {
      setFinishing('upload');
      let uri = photo.uri;
      try {
        uri = await compressPhoto(photo);
        path = await uploadLocalPhoto(db, 'return-photos', uid, uri);
      } catch {
        // The ride still ends; the photo follows from the queue when the network is back.
        await enqueuePhoto(ride.id, uri);
      }
    }
    setFinishing('return');
    try {
      const result = await returnBike(db, scan.code, scan.sig, fix, path, flow.demoStandId);
      flow.setResult(result);
      router.replace(`/ride/${result.ride_id}?fresh=1`);
      void refresh();
    } catch (e) {
      setFinishError(toAppError(e));
      setFinishing(null);
    }
  };

  return (
    <Screen
      header={{}}
      testID="r14"
      footer={
        <>
          {finishing === 'upload' ? <Kicker text={en.r14.uploading} /> : null}
          {finishError ? (
            <Text testID="r14.error" variant="bodyS" tone="bad" accessibilityRole="alert">
              {messageFor(finishError.code, finishError.data)}
            </Text>
          ) : null}
          <Pill
            testID="r14.finish"
            size="lg"
            label={t('r14.finish', { bike: ride.bike_code })}
            disabled={!ready || !online}
            loading={finishing !== null}
            onPress={() => void finish()}
          />
        </>
      }
    >
      <Headline text={en.r14.title} size="l" />
      <Steps
        horizontal
        steps={[
          { text: en.r14.t1, status: check ? 'done' : 'todo', testID: 'r14.t1' },
          { text: en.r14.t2, status: sameBike ? 'done' : 'todo', testID: 'r14.t2' },
          { text: en.r14.t3, status: photoDone ? 'done' : 'todo', testID: 'r14.t3' },
        ]}
      />

      {/* 1. At a stand */}
      {check ? (
        <>
          <Kicker tone="ok" text={t('r14.at', { stand: check.stand_name })} testID="r14.at" />
          {check.stand_full ? <Banner tone="warn" text={en.r14.full} /> : null}
        </>
      ) : checkError ? (
        <ErrorState
          error={checkError}
          {...rideErrorActions(checkError, {
            router,
            retry: () => (demo ? setPicking(true) : void locate()),
            scanMode: 'return',
          })}
        />
      ) : demo ? (
        <Pill
          testID="r14.demo_pick"
          variant="secondary"
          label={en.r14.demo_pick}
          onPress={() => setPicking(true)}
        />
      ) : (
        <Kicker text={en.r14.checking} />
      )}

      {/* 2. Same bike */}
      {check && !sameBike ? (
        <>
          {wrongBike && scan ? (
            <Text testID="r14.wrong_bike" variant="body" tone="bad" accessibilityRole="alert">
              {messageFor('CC_WRONG_BIKE', { scanned: scan.code, pass_bike: ride.bike_code })}
            </Text>
          ) : null}
          <Pill
            testID="r14.scan"
            size="lg"
            label={t('r14.scan', { bike: ride.bike_code })}
            onPress={() => router.push('/scan?mode=return')}
          />
        </>
      ) : null}

      {/* 3. Photo */}
      {check && sameBike ? (
        photo ? (
          <View style={{ height: 360, borderRadius: 26, overflow: 'hidden', backgroundColor: c.surface }}>
            <Image
              source={{ uri: photo.uri }}
              style={{ flex: 1 }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
            <View style={{ position: 'absolute', right: 12, bottom: 12 }}>
              <Pill
                testID="r14.retake"
                size="sm"
                variant="secondary"
                label={en.r14.retake}
                onPress={() => setPhoto(null)}
              />
            </View>
          </View>
        ) : (
          <>
            <Text variant="bodyS" tone="muted">
              {en.r14.photo_hint}
            </Text>
            {skipped && canSkipPhoto ? null : (
              <CameraBox
                status={camera}
                onCapture={setPhoto}
                shutterLabel={en.r14.shutter}
                testID="r14.shutter"
              />
            )}
            {canSkipPhoto && !skipped ? (
              <Pill
                testID="r14.skip_photo"
                variant="ghost"
                label={en.r14.skip_photo}
                onPress={() => setSkipped(true)}
              />
            ) : null}
          </>
        )
      ) : null}

      <Sheet open={picking} onClose={() => setPicking(false)} testID="r14.stand_sheet">
        <Text variant="body">{en.r14.demo_pick}</Text>
        {demoStands.error ? (
          <ErrorState error={demoStands.error} onRetry={() => void demoStands.refetch()} />
        ) : null}
        {(demoStands.data ?? []).map((s, i) => (
          <Pressable
            key={s.id}
            testID={`r14.stand.${i}`}
            accessibilityRole="button"
            onPress={() => {
              setPicking(false);
              void locate(s.id);
            }}
            style={{
              minHeight: 48,
              justifyContent: 'center',
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <Text variant="body">{s.name}</Text>
          </Pressable>
        ))}
      </Sheet>
    </Screen>
  );
}
