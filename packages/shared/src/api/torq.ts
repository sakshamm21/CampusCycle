export interface ChatRequest {
  thread_id?: string;
  surface: 'rider_chat' | 'admin_console';
  message: string;
  input_mode: 'typed' | 'voice';
  photo_path?: string;
  college_id?: string;
  location?: { lat: number; lng: number };
}

export type TorqChatEvent =
  | { type: 'run'; data: { run_id: string; thread_id: string; agent: string } }
  | {
      type: 'step';
      data: {
        step_no: number;
        kind: string;
        agent: string;
        name: string;
        status: 'start' | 'end';
        label: string;
        ok?: boolean;
        ms?: number;
      };
    }
  | { type: 'action'; data: unknown }
  | {
      type: 'message';
      data: { message_id: string; content: string; chart?: unknown; table?: unknown; action_ids: string[] };
    }
  | { type: 'done'; data: { run_id: string; status: string; steps: number; cost_usd: number } }
  | { type: 'error'; data: { code: string; message: string } };

export async function streamChat(
  url: string,
  jwt: string,
  body: ChatRequest,
  onEvent: (event: TorqChatEvent) => void,
): Promise<void> {
  const endpoint = url.endsWith('/torq-chat') ? url : `${url.replace(/\/+$/, '')}/torq-chat`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errBody: { code?: string; message?: string } = {};
    try {
      errBody = (await response.json()) as { code?: string; message?: string };
    } catch {
      // response is not json
    }
    throw new Error(errBody.message || `HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const messageBlock = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let eventType = '';
      let dataStr = '';
      const lines = messageBlock.split('\n');
      for (const line of lines) {
        if (line.startsWith(':')) {
          // SSE comment or keep-alive ping
          continue;
        }
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataStr = line.slice(5).trim();
        }
      }

      if (eventType && dataStr) {
        try {
          const parsedData = JSON.parse(dataStr);
          onEvent({ type: eventType as TorqChatEvent['type'], data: parsedData });
        } catch (err) {
          console.warn('[streamChat] Failed to parse SSE event data:', err);
        }
      }

      boundary = buffer.indexOf('\n\n');
    }
  }
}
