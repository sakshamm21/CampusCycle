import React from 'react';
import { Pressable, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  Bell,
  Check,
  Clock,
  Flag,
  Key,
  TriangleAlert,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import {
  en,
  font,
  listNotifications,
  markNotificationsRead,
  relativeTime,
  type Database,
} from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { routeForPush } from '@/lib/push';
import { useSession } from '@/lib/session';
import { Headline } from '@/components/Headline';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Skeleton, useDelayedLoading } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/States';
import { Text, type TextTone } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { alpha } from '@/theme/color';

type Kind = Database['public']['Enums']['notification_kind'];

const ICONS: Record<Kind, { icon: LucideIcon; tone: Extract<TextTone, 'ok' | 'bad' | 'warn' | 'muted'> }> = {
  approval: { icon: Check, tone: 'ok' },
  reinstated: { icon: Check, tone: 'ok' },
  rejection: { icon: TriangleAlert, tone: 'bad' },
  suspension: { icon: TriangleAlert, tone: 'bad' },
  strike: { icon: TriangleAlert, tone: 'bad' },
  ride_reminder: { icon: Clock, tone: 'warn' },
  ride_overdue: { icon: Clock, tone: 'warn' },
  ride_closed: { icon: Flag, tone: 'muted' },
  issue_update: { icon: Wrench, tone: 'muted' },
  password_reset: { icon: Key, tone: 'muted' },
  torq: { icon: Zap, tone: 'muted' },
  admin_alert: { icon: Bell, tone: 'muted' },
};

// R18 Notifications. New rows arrive through the realtime channel, which invalidates this query.
export default function Notifications() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { c } = useTheme();
  const { ctx, refresh } = useSession();
  const inbox = useQuery({
    queryKey: ['notifications'],
    queryFn: () => listNotifications(db),
    enabled: !!ctx,
  });
  const showSkeleton = useDelayedLoading(inbox.isPending);
  const rows = inbox.data ?? [];
  const unread = rows.filter((n) => n.read_at === null);

  const markRead = async (ids?: string[]) => {
    try {
      await markNotificationsRead(db, ids);
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  };

  const open = (n: (typeof rows)[number]) => {
    if (n.read_at === null) void markRead([n.id]);
    const data =
      n.data && typeof n.data === 'object' && !Array.isArray(n.data)
        ? (n.data as Record<string, unknown>)
        : null;
    const route = routeForPush(data);
    if (route === '/notifications') return;
    if (route) router.push(route);
    else void refresh();
  };

  return (
    <Screen
      testID="r18"
      header={{
        right:
          unread.length > 0 ? (
            <Pill
              testID="r18.mark_all"
              size="sm"
              variant="ghost"
              label={en.r18.mark_all}
              onPress={() => void markRead()}
            />
          ) : undefined,
      }}
      onRefresh={() => void inbox.refetch()}
      refreshing={inbox.isRefetching}
    >
      <Headline text={en.r18.title} size="l" />
      {inbox.error ? <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} /> : null}
      {showSkeleton ? (
        <>
          <Skeleton height={64} round={22} />
          <Skeleton height={64} round={22} />
          <Skeleton height={64} round={22} />
        </>
      ) : null}
      {!inbox.isPending && !inbox.error && rows.length === 0 ? (
        <EmptyState sticker={en.r18.sticker} title={en.r18.empty} />
      ) : null}
      {rows.map((n) => {
        const { icon: Icon, tone } = ICONS[n.kind] ?? ICONS.admin_alert;
        return (
          <Pressable
            key={n.id}
            testID={`r18.row.${n.kind}`}
            accessibilityRole="button"
            accessibilityLabel={`${n.title}. ${n.body}`}
            onPress={() => open(n)}
            style={{
              flexDirection: 'row',
              gap: 12,
              minHeight: 64,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: alpha(c[tone], 0.14),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={18} color={c[tone]} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="body" style={{ fontFamily: font.bodySemibold }}>
                {n.title}
              </Text>
              <Text variant="bodyS" tone="muted" numberOfLines={2}>
                {n.body}
              </Text>
              <Text variant="label" tone="subtle">
                {relativeTime(n.created_at)}
              </Text>
            </View>
            {n.read_at === null ? (
              <View
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary, marginTop: 8 }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </Screen>
  );
}
