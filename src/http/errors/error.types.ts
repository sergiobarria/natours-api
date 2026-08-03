export interface ValidationDetail {
  field: string;
  code: string;
  message: string;
}

export interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
}

export interface ErrorResponse {
  error: ErrorBody;
}
