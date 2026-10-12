import React, { useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { Bell, Bike } from 'lucide-react-native';
import { AppError, type Finish, type PassStats } from '@campuscycle/shared';
import { Banner } from '@/components/Banner';
import { Card } from '@/components/Card';
import { Checkbox } from '@/components/Checkbox';
import { Chip, StatusPill } from '@/components/Chip';
import { Field } from '@/components/Field';
import { Headline } from '@/components/Headline';
import { IconButton } from '@/components/IconButton';
import { Kicker } from '@/components/Kicker';
import { Marquee } from '@/components/Marquee';
import { Pill } from '@/components/Pill';
import { Receipt } from '@/components/Receipt';
import { RiderPass, type PassState } from '@/components/RiderPass';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { Skeleton } from '@/components/Skeleton';
import { SlideToConfirm } from '@/components/SlideToConfirm';
import { StandPin } from '@/components/StandPin';
import { EmptyState, ErrorState } from '@/components/States';
import { Steps } from '@/components/Steps';
import { Sticker } from '@/components/Sticker';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';

const STATES: PassState[] = ['pending', 'minting', 'ready', 'riding', 'overdue', 'returned', 'suspended'];
const FINISHES: Finish[] = ['graphite', 'chrome', 'holo'];
const STATS: PassStats = {
  rides: 7,
  minutes: 96,
  fave_stand: 'Hall 5',
  strikes: 0,
  finish: 'graphite',
  next_finish: 'chrome',
  rides_to_next: 3,
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10, paddingVertical: 8 }}>
      <Kicker text={title} />
      {children}
    </View>
  );
}

// Development only: every component of 06 §5 and every Rider Pass state, in the current theme.
// Sample text here is fixture data, not product copy, so it is not in strings/en.ts.
export default function Dev() {
  const toast = useToast();
  const { themePreference, setTheme } = useTheme();
  const [state, setState] = useState<PassState>('ready');
  const [finish, setFinish] = useState<Finish>('graphite');
  const [run, setRun] = useState(0);
  const [checked, setChecked] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [text, setText] = useState('');

  if (!__DEV__) return <Redirect href="/" />;

  const start = new Date(Date.now() - 23 * 60_000).toISOString();
  const due = new Date(Date.now() + (state === 'overdue' ? -4 : 97) * 60_000).toISOString();

  return (
    <Screen banners={false} header={{}} testID="dev">
      <Segmented<ThemeMode>
        value={themePreference}
        onChange={(m) => void setTheme(m)}
        options={[
          { value: 'system', label: 'System' },
          { value: 'dark', label: 'Dark' },
          { value: 'day', label: 'Day' },
        ]}
      />

      <Block title="RiderPass">
        <RiderPass
          key={`${state}-${finish}-${run}`}
          state={state}
          finish={finish}
          name="Aanya Sharma"
          collegeShort="IITK"
          passLabel={state === 'pending' ? null : 'IITK · 0421'}
          rides={7}
          bikeCode="K-004"
          fromStand="Library"
          startedAt={start}
          dueAt={due}
          appliedAt={start}
          returnedStamp={{ stand: 'Hall 5', minutes: 23 }}
          levelUpTo={state === 'returned' ? 'chrome' : undefined}
          dock={state === 'riding'}
          qr={{ payload: 'campuscycle://p/dev', expiresAt: new Date(Date.now() + 30_000).toISOString() }}
          stats={STATS}
          interactive
          onMinted={() => setState('ready')}
          testID="dev.pass"
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {STATES.map((s) => (
            <Chip
              key={s}
              testID={`dev.state.${s}`}
              text={s}
              tone="fg"
              selected={s === state}
              onPress={() => {
                setState(s);
                setRun((n) => n + 1);
              }}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {FINISHES.map((f) => (
            <Chip
              key={f}
              testID={`dev.finish.${f}`}
              text={f}
              tone="fg"
              selected={f === finish}
              onPress={() => setFinish(f)}
            />
          ))}
        </View>
      </Block>

      <Block title="Text, Headline, Kicker">
        <Headline text="hey *aanya*" size="xl" />
        <Headline text="find a *bike*." size="l" />
        <Headline text="your rides land *here*" size="m" />
        <Text variant="numericXL">23:05</Text>
        <Text variant="bodyL">Body large</Text>
        <Text variant="body" tone="muted">
          Body, muted
        </Text>
        <Text variant="bodyS" tone="subtle">
          Body small, subtle
        </Text>
        <Kicker text="Live kicker" live />
      </Block>

      <Block title="Pill, IconButton">
        <Pill size="lg" label="primary large" />
        <Pill variant="secondary" label="Secondary" />
        <Pill variant="ghost" label="Ghost" />
        <Pill variant="danger" label="Danger" />
        <Pill variant="inverse" label="Inverse" />
        <Pill size="sm" label="Small" />
        <Pill label="Loading" loading />
        <Pill label="Disabled" disabled />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon={Bell} label="Bell" badge={3} />
          <IconButton icon={Bike} label="Bike" active />
          <IconButton icon={Bell} label="Many" badge={12} />
        </View>
      </Block>

      <Block title="Card, Sticker, Chip, StatusPill, StandPin">
        <Card>
          <Text>Default card</Text>
        </Card>
        <Card variant="raised">
          <Text>Raised card</Text>
        </Card>
        <Card variant="outlineDashed">
          <Text>Dashed card</Text>
        </Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Sticker text="scan to borrow" color="yellow" rotate={-3} />
          <Sticker text="return anywhere" color="coral" rotate={4} />
          <Sticker text="free" color="mint" rotate={-2} />
          <Sticker text="blue" color="blue" rotate={3} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip text="chip" />
          <Chip text="ok chip" tone="ok" />
          <Chip text="busy" spinner />
          <StatusPill text="available" tone="ok" />
          <StatusPill text="borrowed" tone="primary" />
          <StatusPill text="maintenance" tone="warn" />
          <StatusPill text="missing" tone="bad" />
          <StatusPill text="retired" tone="subtle" />
        </View>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
          <StandPin free={5} name="Library" />
          <StandPin free={1} name="Hall 5" />
          <StandPin free={0} name="Gate 2" selected />
        </View>
      </Block>

      <Block title="Field, Checkbox, Segmented, SlideToConfirm">
        <Field label="Email" value={text} onChangeText={setText} hint="A hint" />
        <Field label="Password" value={text} onChangeText={setText} secure />
        <Field label="With error" value={text} onChangeText={setText} error="Something is wrong." />
        <Checkbox label="A checkbox" checked={checked} onChange={setChecked} />
        <SlideToConfirm label="slide to borrow" onConfirm={() => toast.show('Confirmed', 'ok')} />
      </Block>

      <Block title="Toast, Banner, Sheet">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Pill size="sm" label="Toast ok" onPress={() => toast.show('Your Rider Pass is live.', 'ok')} />
          <Pill size="sm" label="Toast bad" onPress={() => toast.show('Something went wrong.', 'bad')} />
          <Pill size="sm" label="Sheet" onPress={() => setSheet(true)} />
        </View>
        <Banner tone="warn" text="Offline banner" />
        <Banner tone="primary" text="Demo banner" />
        <Sheet open={sheet} onClose={() => setSheet(false)} title="a *sheet*.">
          <Text>Drag down or tap outside to close.</Text>
        </Sheet>
      </Block>

      <Block title="Skeleton, EmptyState, ErrorState, Steps">
        <Skeleton height={60} round={22} />
        <EmptyState
          sticker="first ride?"
          title="your rides land *here*"
          action={{ label: 'Borrow a bike', onPress: () => {} }}
        />
        <ErrorState error={new AppError('CC_NETWORK')} onRetry={() => {}} />
        <Steps
          steps={[
            { text: 'Done', status: 'done' },
            { text: 'Warning', status: 'warn' },
            { text: 'Busy', status: 'busy' },
            { text: 'To do', status: 'todo' },
          ]}
        />
      </Block>

      <Block title="Receipt, Marquee">
        <Receipt
          top={
            <Text variant="numericL" style={{ color: '#16130A' }}>
              23:05
            </Text>
          }
          bottom={<Text>12 Oct · 9:41 AM–10:04 AM</Text>}
        />
        <Marquee />
      </Block>
    </Screen>
  );
}
