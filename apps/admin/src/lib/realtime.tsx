'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/browser';
import { useCollege } from '@/lib/scope';
import { routeForNotification, type NotificationData } from '@/lib/routeForNotification';
import type { MyContext } from '@campuscycle/shared';

export function RealtimeBridge({ ctx }: { ctx: MyContext }) {
  const { collegeId } = useCollege();
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    if (!collegeId) return;

    const channelName = `college:${collegeId}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bikes',
          filter: `college_id=eq.${collegeId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['bikes'] });
          queryClient.invalidateQueries({ queryKey: ['stats', collegeId] });
          queryClient.invalidateQueries({ queryKey: ['map', collegeId] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `college_id=eq.${collegeId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['rides'] });
          queryClient.invalidateQueries({ queryKey: ['stats', collegeId] });
          queryClient.invalidateQueries({ queryKey: ['map', collegeId] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'issue_reports',
          filter: `college_id=eq.${collegeId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['issues'] });
          queryClient.invalidateQueries({ queryKey: ['stats', collegeId] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${ctx.profile.id}`,
        },
        (payload) => {
          const notif = payload.new as {
            kind?: string;
            title?: string;
            body?: string;
            data?: NotificationData;
          };
          if (notif.kind === 'admin_alert') {
            const targetRoute = routeForNotification(notif.data);
            toast(notif.title || 'Admin Alert', {
              description: notif.body,
              action: {
                label: 'Open',
                onClick: () => router.push(targetRoute),
              },
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [collegeId, ctx.profile.id, queryClient, router]);

  return null;
}
