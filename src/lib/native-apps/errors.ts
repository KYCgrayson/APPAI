export type NativeAppErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_ORIGIN"
  | "ORGANIZATION_REQUIRED"
  | "UNKNOWN_APP_TYPE"
  | "APP_NOT_ENABLED"
  | "APP_SUSPENDED";

export class NativeAppError extends Error {
  public readonly code: NativeAppErrorCode;
  public readonly status: number;

  constructor(
    code: NativeAppErrorCode,
    status: number,
    message: string,
  ) {
    super(message);
    this.name = "NativeAppError";
    this.code = code;
    this.status = status;
  }
}
