import express, { Express, Request, Response, Router } from "express";

import Logger from "../utils/logger";

import { newimages, yodaheaBucket } from "../db/blobs";
import { masterTableFinal, YodaheaTable } from "../db/masterdata";

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

// return number of images in the storage
utilsRouter.get("/imagecount", async (req: Request, res: Response) => {
  const count = await yodaheaBucket.listImages();
  const umatchedtotal = await YodaheaTable.totalNumnberUnmatched();
  res.send([count.length, umatchedtotal]);
});
