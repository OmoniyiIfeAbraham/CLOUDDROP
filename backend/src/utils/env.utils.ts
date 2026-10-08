const requiredEnvVariables = ["DATABASE_URL", "JWT_SECRET"];

export const validateEnv = () => {
  for (const variable of requiredEnvVariables) {
    if (!process.env[variable]) {
      throw new Error(`Missing required environment variable: ${variable}`);
    }
  }
};
