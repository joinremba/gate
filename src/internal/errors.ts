export class CoreError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "CoreError";
    this.code = code;
    this.status = status;
  }
}

export class NetworkError extends CoreError {
  override readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message, "NETWORK_ERROR");
    this.name = "NetworkError";
    this.cause = cause;
  }
}
