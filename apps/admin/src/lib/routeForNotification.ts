export interface NotificationData {
  screen?: string;
  user_id?: string;
  ride_id?: string;
  issue_id?: string;
  [key: string]: unknown;
}

export function routeForNotification(data?: NotificationData | null): string {
  if (!data || !data.screen) return '/dashboard';

  switch (data.screen) {
    case 'approvals':
      return '/approvals';
    case 'users':
      return data.user_id ? `/users/${data.user_id}` : '/users';
    case 'rides':
      return data.ride_id ? `/rides?ride=${data.ride_id}` : '/rides';
    case 'stands':
      return '/stands';
    case 'issues':
      return data.issue_id ? `/issues?id=${data.issue_id}` : '/issues';
    default:
      return '/dashboard';
  }
}
