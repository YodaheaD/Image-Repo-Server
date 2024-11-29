/**
 *  Images Router
 * ----------------
 *
 *  -- For handling image uploads, deletions, and retrievals
 *
 * Routes:
 * - GET: /getImage/:imagename/:tablename
 *  ** For serving an image from the storage
 *
 * - GET: /getCompressed/:imagename
 * ** For serving a compressed image from the storage
 *
 * - POST: /uploadImage/:tablename
 * ** For uploading an image to the storage
 *
 * - POST: /rename/:oldName/:newName
 * ** For renaming an image
 *

 */

import bodyParser from "body-parser";
import cors from "cors";
import express, { Response, Request, Router } from "express";
import multer from "multer";
import Logger from "../utils/logger";
import { masterTableFinal, YodaheaTable } from "../db/masterdata";
import { auditsTable } from "../db/audits";
import stream from "stream";
import { deletedBucket } from "../db/blobs";

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

// --> GET: serve an image from the storage
imagesRouter.get(
  "/getImage/:imagename/:tablename",
  async (req: Request, res: Response) => {
    const { imagename } = req.params;
    const { tablename } = req.params || "Total";
    // if any missing params return default image
    if (!imagename || !tablename) {
      Logger.error("No image name or table name provided");
      pipeDeafultImage(res);
    }
    if (tablename === "YodaheaTable") {
      //console.info(` Searching for image ${imagename} in Yodahea Table`);
      try {
        const image = await YodaheaTable.serveImage(imagename, "Yodahea");
        if (!image) {
          Logger.error(`No image found for ${imagename}`);
          pipeDeafultImage(res);
        }

        // Convert the image buffer to a ReadableStream
        const convert2 = stream.Readable.from(image);

        res.setHeader("Content-Type", "image/jpeg");
        convert2.pipe(res);
      } catch (err) {
        // display the image from the url dont send it or else it just shows the url as text
        Logger.error(
          `Error fetching image Named " ${imagename} " from storage` + err
        );
        pipeDeafultImage(res);
      }
    } else {
      try {
        const image = await masterTableFinal.serveImage(imagename, "Total");

        // Convert the image buffer to a ReadableStream
        const convert2 = stream.Readable.from(image);

        res.setHeader("Content-Type", "image/jpeg");
        convert2.pipe(res);
      } catch (err) {
        // display the image from the url dont send it or else it just shows the url as text
        Logger.error(
          `Error fetching image Named " ${imagename} " from storage`
        );
        pipeDeafultImage(res);
      }
    }
  }
);

// --> GET: serve a Compressed image from the storage (for speed)
imagesRouter.get(
  "/getCompressed/:imagename",
  async (req: Request, res: Response) => {
    const { imagename } = req.params;

    try {
      const getImageData = await YodaheaTable.serveCompressedImage(imagename);
      if (!getImageData) {
        Logger.error(
          `Error fetching compressed image ${imagename} from storage`
        );
        res.status(400).send("No compressed image found");
      }
      const convert = stream.Readable.from(getImageData);
      res.setHeader("Content-Type", "image/jpeg");
      convert.pipe(res);
    } catch (err) {
      Logger.error(`Error fetching compressed image ${imagename} from storage`);
      res.status(400).send("Error fetching compressed image");
    }
  }
);

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
    Logger.info(" Data added to table, All done!");
    res.send("Upload block blob successfully");
    // Send response back to client
  }
);

// -> POST: renaming image
imagesRouter.post("/rename/:oldName/:newName", async (req, res) => {
  const { oldName, newName } = req.params;
  const data = req.body;
  console.log(` Old Name is ${oldName} and New Name is ${newName}`);
  try {
    await masterTableFinal.renameImage(oldName, newName);
  } catch (error) {
    res.status(400).send("Error renaming the data");
  }
  res.send("Data updated");
});

// -> GET: random image
imagesRouter.get("/RandomImage", async (req: Request, res: Response) => {
  let used: any = [];

  res.send([
    "Mexico_City_Cathedral",
    "Mexican_Street_vendor",
    "La_roma",
    "Chapultepec_Castle_Garden_Tower",
    "Chap_Castle_Mural",
  ]);
});

// --- Helper Functions --- //
const randomimage = (alreadyUsed: any, current: any, length: any) => {
  const filterAlreadyUsed = current.filter((item: any) => {
    return !alreadyUsed.includes(item);
  });

  const returndata = filterAlreadyUsed[Math.floor(Math.random() * length)];

  return returndata;
};

// --> For pipeing the default image when no image is found
const pipeDeafultImage = async (res: any) => {
  const deafiltsvg = await deletedBucket.downloadBuffer(
    "default/default-image.jpg"
  );
  if (!deafiltsvg) {
    Logger.error("No default image found");
    res.send("No default image found");
  } else {
    // change the name of the image to the default image

    const convert = stream.Readable.from(deafiltsvg);
    res.setHeader("Content-Type", "image/jpeg");
    convert.pipe(res);
  }
}; //
