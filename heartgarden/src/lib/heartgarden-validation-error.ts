import type { z } from "zod";

export function jsonValidationError(error: z.ZodError, status = 400): Response {
  const fields = error.issues.slice(0, 12).map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path.join("."),
  }));
  return Response.json(
    {
      code: "validation_error",
      error: "Invalid request body",
      fields,
      ok: false,
    },
    { status }
  );
}
