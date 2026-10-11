export type AgentName = 'orchestrator' | 'ride' | 'inspector' | 'ops' | 'triage';
export type RouteName = 'router' | 'chat' | 'vision' | 'summary';
export type Surface = 'rider_chat' | 'admin_console';
export type Lang = 'en' | 'hi' | 'hinglish';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ModelRequest {
  route: RouteName;
  messages: ChatMessage[];
  tools?: ToolSpec[]; // JSON schema from zod (zod-to-json-schema, target 'openApi3')
  json?: boolean; // response_format json_object
  maxTokens?: number; // default 800
  temperature?: number; // default 0.2
  private?: boolean; // vision of personal photos: data_collection deny + zdr
}

export interface ModelResponse {
  model: string;
  content: string;
  toolCalls: ToolCall[];
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  ms: number;
}

export interface ToolSpec {
  type: 'function';
  function: { name: string; description: string; parameters: object };
}

export interface RunInput {
  surface: Surface;
  message: string;
  inputMode: 'typed' | 'voice';
  threadId: string;
  photoUrl?: string; // signed URL (600 s) of torq-photos/<uid>/...
  location?: { lat: number; lng: number };
  collegeId: string | null; // college in view
}

export interface Caller {
  userId: string;
  role: 'rider' | 'college_admin' | 'super_admin';
  isDemo: boolean;
  name: string;
  email: string;
  ctx: unknown; // MyContext from get_my_context
}

export type StepKind = 'context' | 'model_call' | 'tool_call' | 'guardrail' | 'router_fallback';

export interface SseSink {
  (event: 'run' | 'step' | 'action' | 'message' | 'done' | 'error', data: unknown): void;
}
