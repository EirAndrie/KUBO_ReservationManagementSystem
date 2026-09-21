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
};

export default ENV;
