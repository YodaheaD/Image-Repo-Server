import express, { Express, Request, Response } from "express";
import Logger from "./src/utils/logger";
import cookieParser from "cookie-parser";
import { utilsRouter } from "./src/utilities";
import cors from "cors";
import { auditRouter } from "./src/audits";
import { dataRouter } from "./src/main";
import { imagesRouter } from "./src/images";
import { journalRouter } from "./src/journal";
//import { initilizeMapTable } from "./src/utils/helpers";

/**
 * All router imports
 ---------------------------------
  * 
 * -> " Main Router " :  dataRouter
 * -> " Utilities Router " :  utilsRouter
 * -> " Audit Router " :  auditRouter
 * -> " Images Router " :  imagesRouter
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
app.use("/main", dataRouter);
app.use("/utilities", utilsRouter);
app.use("/audits", auditRouter);
app.use("/images", imagesRouter);
app.use("/journal", journalRouter);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello From Yodas Express + TypeScript Server");
});

app.listen(3030, async () => {
  Logger.http(`⚡️ Server is running at http://localhost:3030`); //
  // await checkCompression();
});
