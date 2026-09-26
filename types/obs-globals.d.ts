// The globals the OBS scripts (public/obs/shared/) hand each other: each file is a plain <script> that puts its
// API on window. Types only, for the editor and scripts/typecheck.sh; nothing here is served.
/** a form: 'cyan' | 'yellow' | 'red' | 'princess' | 'blobfish' (plain string: the scripts pass them around as such) */
type Form = string;

interface TGLTheme {
  FORMS: Record<Form, { accent: string; label: string }>;
  /** the form a veadotube state name stands for (pinned names, then word rules, else cyan) */
  formForState(name: string): Form | null;
  readonly form: Form;
  /** pick a form on this page and tell the other pages; returns when it was picked (ms) */
  set(next: Form): number;
  onChange(fn: (form: Form, source: string) => void): void;
  onStatus(fn: (status: { veado: string; obs: string; state: string | null; states: string[]; form: Form }) => void): void;
  connectObs(onReady?: (ws: WebSocket) => void): WebSocket | null;
  paint(form: Form): void;
  cycling: boolean;
  guide: boolean;
  reduced: boolean;
  param(key: string, fallback?: string): string;
  hidden(part: string): boolean;
}

interface TGLObsClient {
  call(requestType: string, requestData?: object): Promise<any>;
  readonly ready: boolean;
  close(): void;
}

interface Window {
  TGL: TGLTheme;
  TGLModel: any;
  TGLObs: { connect(opts: { host?: string; port?: number; password?: string; onStatus?: (s: { state: string; detail?: any }) => void; onEvent?: (type: string, data: any) => void }): TGLObsClient };
  TGLDockColour: { create(opts: any): any };
  TGLPanel: { mount(el: HTMLElement, opts?: { mode?: 'dock' | 'index'; onChange?: (settings: any, env: any) => void; onForm?: (form: Form) => void }): any };
  TGLPanelParts: Record<string, (P: any) => any>;
  TGL_NO_AUTOCONNECT?: boolean;
  TGL_ICONS?: any;
  obsstudio?: any;
}
declare var TGL: TGLTheme;
declare var TGLModel: Window['TGLModel'];
declare var TGLObs: Window['TGLObs'];
declare var TGLDockColour: Window['TGLDockColour'];
declare var TGLPanel: Window['TGLPanel'];
