// src/app.ts

import express from "express";
import morgan from "morgan";
import authRouter from "./routes/authRouter";
import errorHandler from "./middlewares/errorHandler"; // Import your error handler
import { CustomError } from "./errors/customError";
import cookieParser from "cookie-parser";
import groupRouter from "./routes/groupRouter";
import workspaceRouter from "./routes/workspaceRouter";
import surveyRouter from "./routes/surveyRouter";

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(morgan("dev"));

app.use("/auth", authRouter);
app.use("/group", groupRouter);
app.use("/workspace", workspaceRouter);
app.use("/survey", surveyRouter);

// Handle unmatched routes
app.use("*", (req, res, next) => {
  next(new CustomError("Route not found", 404, true));
});

// Global error handling middleware
app.use(errorHandler);

export default app;
