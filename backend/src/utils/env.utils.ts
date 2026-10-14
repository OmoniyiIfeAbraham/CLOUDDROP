const requiredEnvVariables = ["DATABASE_URL", "JWT_SECRET"];

export const validateEnv = () => {
  if (process.env.CLOUDDROP_E2E_MAILBOX_DIR && process.env.NODE_ENV !== "test") {
    throw new Error("CLOUDDROP_E2E_MAILBOX_DIR is only supported with NODE_ENV=test.");
  }
  for (const variable of requiredEnvVariables) {
    if (!process.env[variable]) {
      throw new Error(`Missing required environment variable: ${variable}`);
    }
  }
};
