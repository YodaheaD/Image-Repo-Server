import express, { Express, Request, Response } from "express";
import { authRouter } from "./src/auth";
import Logger from "./src/utils/logger";
import cookieParser from "cookie-parser";
import { utilsRouter } from "./src/utilities";
import { azureRouter } from "./src/azure";
import cors from "cors";
import { auditRouter } from "./src/audits";
//import { initilizeMapTable } from "./src/utils/helpers";

/**
 * All router imports
 ---------------------------------
 * -> "Auth" for services with authentication.
 * 
 * -> "Table" for services on data within an Azure Table Storage.
 * 
 * -> "Image" for services on images within an Azure Blob Storage.
 * 
 */
export const app: Express = express();
//const port = process.env.PORT || 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
//app.use(express.static(path.join(__dirname, "public")));
app.use(cors());
//
app.use("/auth", authRouter);
app.use("/azure", azureRouter);
app.use("/utilities", utilsRouter);
app.use("/audits", auditRouter);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello From Yodas Express + TypeScript Server");
});

app.listen(3030, async () => {
  Logger.http(`⚡️ Server is running at http://localhost:3030`); //
});
