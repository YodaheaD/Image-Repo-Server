import express, { Express, Request, Response } from "express";
import Logger from "./src/utils/logger";
import cookieParser from "cookie-parser";
import { utilsRouter } from "./src/utilities";
import cors from "cors";
import { auditRouter } from "./src/audits";
import { mainRouter } from "./src/main";
import { checkCompression } from "./src/scripts/compression";
//import { initilizeMapTable } from "./src/utils/helpers";

/**
 * All router imports
 ---------------------------------
  * 
 * -> " Main Router " :  mainRouter
 * -> " Utilities Router " :  utilsRouter
 * -> " Audit Router " :  auditRouter
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
app.use("/main", mainRouter);
app.use("/utilities", utilsRouter);
app.use("/audits", auditRouter);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello From Yodas Express + TypeScript Server");
});

app.listen(3030, async () => {
  Logger.http(`⚡️ Server is running at http://localhost:3030`); //
 // await checkCompression();
});
