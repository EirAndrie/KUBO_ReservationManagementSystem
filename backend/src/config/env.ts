import dotenv from "dotenv";
dotenv.config();

const ENV = {
      PORT: process.env.PORT,
      NODE_ENV: process.env.NODE_ENV,
      FR_ORIGIN: process.env.FR_ORIGIN,
      PASSWORD_LENGTH: process.env.PASSWORD_LENGTH,
      DB_URL: process.env.DB_URL,
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_USERNAME: process.env.DB_USERNAME,
      DB_PASSWORD: process.env.DB_PASSWORD,
      DB_NAME: process.env.DB_NAME,
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
      API_BASE_PATH: process.env.API_BASE_PATH,
      SERVE_FRONTEND: process.env.SERVE_FRONTEND,
};

export default ENV;
