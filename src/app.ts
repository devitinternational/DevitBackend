import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { error_handler } from "./middlewares/errorHandler.js";


export const createApp = (): Express => {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(error_handler)

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });


  return app;
};
