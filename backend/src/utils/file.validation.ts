import { z } from "zod";

export const fileCategorySchema = z.object({
  category: z.enum([
    "Documents",
    "Images",
    "Videos",
    "Audio",
    "Archives",
    "Other",
  ]),
});
