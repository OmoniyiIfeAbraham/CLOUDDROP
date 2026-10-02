const requiredEnvVariables = ["DATABASE_URL"];

export const validateEnv = () => {
  for (const variable of requiredEnvVariables) {
    if (!process.env[variable]) {
      throw new Error(`Missing required environment variable: ${variable}`);
    }
  }
};

