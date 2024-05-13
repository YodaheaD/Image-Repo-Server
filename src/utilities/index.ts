import express, { Express, Request, Response, Router } from "express";

import Logger from "../utils/logger";

import { newimages } from "../db/blobs";
import { masterTableFinal } from "../db/masterdata";

export const utilsRouter: Router = Router();

/**
 * Routes List
 * ______________________
 * -> '/viewcache/:tablename'
 * - This route returns the cache summary from the table
 */

// Return Full cache
utilsRouter.get(
  "/viewcache/:tablename",
  async (req: Request, res: Response) => {
    const { tablename } = req.params;
    switch (tablename) {
      case "masterData":
        const masterDatacache = await masterTableFinal.getCacheSummary();
        res.send({ masterDatacache });
        break;
      default:
        Logger.error("Invalid tablename");
        res.send("Error: Invalid tablename");
    }
  }
);

// -> '/viewmissing' - get list of images without metadata assigned
utilsRouter.get("/viewmissing", async (req: Request, res: Response) => {
  // const data = await newimages.getImagesMissingMeta();
  // res.send(data);
}); //

utilsRouter.post("/update/:tablename", async (req: Request, res: Response) => {
  // // ge ttbalename form req.params
  // const { tablename } = req.params;
  // const { data } = req.body;
  // switch (tablename) {
  //   case "masterData": {
  //     const d = await imageMapTable.myUpdateData(data);
  //     res.send(d);
  //     break;
  //   }
  //   default:
  //     Logger.error(` Cannout update table ${tablename}`);
  //     res.send(` Cannout update table ${tablename}`);
  //     break;
  // }
});
