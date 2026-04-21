import type { z } from "zod";

export function jsonValidationError(error: z.ZodError, status = 400): Response {
  const fields = error.issues
    .slice(0, 12)
    .map((issue) => ({
      path: issue.path.join("."),
      code: issue.code,
      message: issue.message,
    }));
  return Response.json(
    {
      ok: false,
      error: "Invalid request body",
      code: "validation_error",
      fields,
    },
    { status },
  );
}
