import { ApiError } from "./api";

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return error.message || "This room changed. Refresh and try again.";
    }

    if (error.status === 404) {
      return "Tournament not found.";
    }

    return error.message || "Request failed.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}

