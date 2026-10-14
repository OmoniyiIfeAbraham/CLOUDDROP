import multer from "multer";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  defParamCharset: "utf8",
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});
