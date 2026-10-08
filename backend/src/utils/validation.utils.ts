import { z } from "zod";

export const validateRequest = <T>(
  schema: z.ZodType<T>,
  data: unknown
): T => {
  return schema.parse(data);
};
