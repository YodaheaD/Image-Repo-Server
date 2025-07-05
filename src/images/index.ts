import bodyParser from "body-parser";
import cors from "cors";
import express, { Response, Request, Router } from "express";
import multer from "multer";
import Logger from "../utils/logger";
import { masterTableFinal, YodaheaTable } from "../db/masterdata";
import { auditsTable } from "../db/audits";
import stream from "stream";
import { deletedBucket, yodaheaBucket } from "../db/blobs";

export const imagesRouter: Router = Router();

imagesRouter.use(cors());
imagesRouter.use(express.json());
imagesRouter.use(bodyParser.json());
imagesRouter.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// - Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20000000,
  },
});


// --> POST: upload an image to the storage
imagesRouter.post(
  "/uploadImage/:tablename",
  upload.array("monfichier"),
  async (req: Request, res: Response) => {
    // check if req.files is empty
    if (!req.files || req.files.length === 0) {
      Logger.error("No files received in request. ");
      return res.status(400).send("No files were received.");
    }
    const data: any = JSON.parse(req.body.data);

    const { tablename } = req.params;

    if (tablename === "Yodahea") {
      await YodaheaTable.newUploadProcess(req.files, data, "Yodahea");
    } else {
      await masterTableFinal.newUploadProcess(req.files, data, "Total");
    }
    await auditsTable.auditHandler("Upload", data[0], req.files);
    //
    Logger.info("Refreshing cache now....");
    //await YodaheaTable.refreshMapCache();
    try {
      await YodaheaTable.rebuildCache();
    } catch (err) {
      Logger.error("Error rebuilding cache");
    } finally {
      Logger.info("Cache rebuilt successfully");
    }
    res.send("Upload block blob successfully");
    // Send response back to client
  }
);

// --> GET: serve an image from the storage using image cache
imagesRouter.get(
  "/getImg/:imagename",
  async (req: Request, res: Response) => {
    const { imagename } = req.params;
    if (!imagename) {
      Logger.error("No image name provided");
      return res.status(404).send("No image found");
    }

    try {
      // Use the new cache-enabled function
      const imagedata = await YodaheaTable.returnImageWithImageCache(imagename);

      if (!imagedata) {
        Logger.error(`No image found for ${imagename}`);
        return res.status(404).send("No image found for: " + imagename);
      }
      const convert = stream.Readable.from(imagedata);
      res.setHeader("Content-Type", "image/jpeg");
      convert.pipe(res);
    } catch (err) {
      Logger.error(
        `Error fetching image Named "${imagename}" from storage: ${err}`
      );
      res.status(404).send("No image found for " + imagename);
    }
  }
);
// --> GET: serve a Compressed image from the storage (for speed)
imagesRouter.get(
  "/getComp/:imagename",
  async (req: Request, res: Response) => {
    const { imagename } = req.params;

    try {
      // Use imageName as the key for the dataMapCache
      const getImageData = await YodaheaTable.returnCompressedImageWithCache(imagename);
      if (!getImageData) {
        Logger.error(
          `Error fetching compressed image ${imagename} from storage`
        );
        return res.status(400).send("No compressed image found");
      }
      const convert = stream.Readable.from(getImageData);
      res.setHeader("Content-Type", "image/webp");
      convert.pipe(res);
    } catch (err) {
      Logger.error(`Error fetching compressed image ${imagename} from storage`);
      res.status(400).send("Error fetching compressed image");
    }
  }
);
