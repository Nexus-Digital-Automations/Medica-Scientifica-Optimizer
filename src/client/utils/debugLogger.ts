export class DebugLogger {
  private logs: string[] = [];
  private originalConsoleLog: typeof console.log;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;

  constructor() {
    this.originalConsoleLog = console.log;
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
  }

  start() {
    this.logs = []; // Clear previous logs (overwrites)
    this.logs.push(`Optimizer Debug Log - This file will be overwritten on each optimization run`);
    this.logs.push(`========================================================================`);
    this.logs.push(`Started: ${new Date().toISOString()}`);
    this.logs.push('');

    // Override console methods
    console.log = (...args: unknown[]) => {
      this.log('LOG', args);
      this.originalConsoleLog.apply(console, args);
    };

    console.error = (...args: unknown[]) => {
      this.log('ERROR', args);
      this.originalConsoleError.apply(console, args);
    };

    console.warn = (...args: unknown[]) => {
      this.log('WARN', args);
      this.originalConsoleWarn.apply(console, args);
    };
  }

  private log(level: string, args: unknown[]) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    this.logs.push(`[${timestamp}] [${level}] ${message}`);
  }

  stop() {
    // Restore original console methods
    console.log = this.originalConsoleLog;
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;

    this.logs.push('');
    this.logs.push(`Ended: ${new Date().toISOString()}`);
    this.logs.push(`========================================================================`);
  }

  download(filename = 'optimizer-debug.log') {
    const content = this.logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getLogsAsString(): string {
    return this.logs.join('\n');
  }
}

export const debugLogger = new DebugLogger();
