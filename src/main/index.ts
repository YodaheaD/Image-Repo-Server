import bodyParser from "body-parser";
import cors from "cors";
import express, { Response, Request, Router, NextFunction } from "express";
import sharp from "sharp";
import multer from "multer";
import Logger from "../utils/logger";
import { compressionBucket, deletedBucket, newimages } from "../db/blobs";
import { pusherServer } from "../utils/pusher";
import { masterTableFinal, YodaheaTable } from "../db/masterdata";
import { auditsTable } from "../db/audits";
import stream from "stream";

export const mainRouter: Router = Router();

mainRouter.use(cors());
mainRouter.use(express.json());
mainRouter.use(bodyParser.json());
mainRouter.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// - Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20000000,
  },
});
///

/**
 * Routes List
 * ______________________
 *
 *
 */

// -> GET: return the column names from the table,
// * Column names are not sensitive info
mainRouter.get(
  "/getTableColumns/:tablename",
  async (req: Request, res: Response) => {
    const { tablename } = req.params;

    try {
      switch (tablename) {
        case "masterdata":
          const columnsyoda = await masterTableFinal.getColumns();
          res.send({ columns: columnsyoda });
          break;
        default:
          Logger.error("Invalid Data Request for columns");
          res.send("No valid table name provided");
          break;
      }
    } catch (err) {
      Logger.info(err); //
    }
  }
);

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

/** Image Routes */
// --> GET: serve an image from the storage
mainRouter.get(
  "/getImage/:imagename/:tablename",
  async (req: Request, res: Response) => {
    const { imagename } = req.params;
    const { tablename } = req.params || "Total";
    // if any missing params return default image
    if (!imagename || !tablename) {
      Logger.error("No image name or table name provided");
      pipeDeafultImage(res);
    }
    if (tablename === "Yodahea") {
      try {
        const image = await YodaheaTable.serveImage(imagename, "Yodahea");

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
mainRouter.get(
  "/getCompressed/:imagename",
  async (req: Request, res: Response) => {
    const { imagename } = req.params;

    try {
      // const getImageData = await compressionBucket.downloadBuffer(imagename);

      // if (!getImageData) {
      //   Logger.error(
      //     `Error fetching compressed image ${imagename} from storage`
      //   );
      //   res.status(400).send("No compressed image found");
      // }
      // const convert = stream.Readable.from(getImageData);
      // res.setHeader("Content-Type", "image/jpeg");
      // convert.pipe(res);
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

/**  END OF IMAGES ROUTES */

// Function for Pipeing the default image, located as favicon.ico in the compressedimages container
const pipeDefaultImage = async (res: any) => {
  const defaultImage = await compressionBucket.downloadBuffer("favicon.ico");
  if (!defaultImage) {
    Logger.error("No default image found");
    res.send("No default image found");
  } else {
    const convert = stream.Readable.from(defaultImage);
    res.setHeader("Content-Type", "image/jpeg");
    convert.pipe(res);
  }
};
// -> GET: get all data from Azure Table
mainRouter.get(
  "/getAllData/:tablename",

  async (req: Request, res: Response) => {
    const { tablename } = req.params;
    const { start, limit } = req.query;
    const startPoint = start || 0;
    const limitPoint = limit || 20;
    try {
      // Get table name from req and return data from there
      switch (tablename) {
        case "masterdata":
          let masterData: any = await masterTableFinal.myGetDataLimit(
            Number(startPoint),
            Number(limitPoint)
          );

          let totalEntries = await masterTableFinal.numberOfImages();
          // Sort by dateTaken
          // Remove the any No Date values from masterData and append to the end

          //
          const yodaimages = await newimages.listImages();
          res.send([masterData, yodaimages, totalEntries]);
          break;
        case "masterFinalTotal":
          let masterDataTotal: any = await YodaheaTable.myGetDataLimit(
            Number(startPoint),
            Number(limitPoint)
          );

          let totalEntriesTotal = await YodaheaTable.numberOfImages();
          // Sort by dateTaken
          // Remove the any No Date values from masterData and append to the end

          //
          const yodaimagesTotal = await newimages.listImages();
          res.send([masterDataTotal, yodaimagesTotal, totalEntriesTotal]);
          break;
        default:
          Logger.error("Invalid Data Request for table");
          res.send("No valid table name provided");
          break; //
      }
    } catch (err) {
      Logger.info(err);
    } //
  }
);
// -> GET: get all data from Azure Table
mainRouter.get(
  "/getData/:tableName/:imageName",

  async (req: Request, res: Response) => {
    const { imageName } = req.params;
    const { tableName } = req.params;
    Logger.info(`Getting data for image ${imageName}`);
    if (!imageName || !tableName) {
      res.status(400).send("No image name Or table name provided");
    }
    switch (tableName) {
      case "Yodahea":
        try {
          // Get table name from req and return data from there

          let masterData: any = await YodaheaTable.getExactDataByImageName(
            imageName
          );
          if (!masterData) {
            res.status(404).send("No data found");
          }

          res.send(masterData);
        } catch (err) {
          Logger.info(err);
          res.send(400).send("Error fetching data");
        }
        break;
      default:
        try {
          // Get table name from req and return data from there

          let masterData: any = await masterTableFinal.getExactDataByImageName(
            imageName
          );
          if (!masterData) {
            res.status(404).send("No data found");
          }

          res.send(masterData);
        } catch (err) {
          Logger.info(err);
          res.send(400).send("Error fetching data");
        }
        break;
    }
  }
);

mainRouter.get("/search/:tablename", async (req: Request, res: Response) => {
  const { tablename } = req.params;
  const checkForSearch = req.query.search;
  // get [object Object] so convert to string
  if (checkForSearch) {
    console.log("searching for ", checkForSearch);
    const removeSearchFromTable = tablename
      .replace(String(checkForSearch), "")
      .replace("&", "");
    switch (removeSearchFromTable) {
      case "masterdata":
        const masterData: any = await masterTableFinal.mySearchData(
          String(checkForSearch)
        );
        res.send(masterData);

        break;
      default:
        Logger.error("Invalid Data Request for table");
        res.send("No valid table name provided");
        break;
    }
    return;
  }
});

// -> '/imgupload/:...' - upload image to blob storage
mainRouter.post(
  // "/imgupload/:imageMeta/:uploaderName",
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
const randomimage = (alreadyUsed: any, current: any, length: any) => {
  const filterAlreadyUsed = current.filter((item: any) => {
    return !alreadyUsed.includes(item);
  });

  const returndata = filterAlreadyUsed[Math.floor(Math.random() * length)];

  return returndata;
};
mainRouter.get("/RandomImage", async (req: Request, res: Response) => {
  let used: any = [];
  // const masterdata: any = await masterTableFinal.myGetData();
  // if (!masterdata) {
  //   res.status(404).send("Error fetching data from Storage");
  // }
  // const firstfive = masterdata.slice(0, 5);
  // // just need the image name
  // const current = firstfive.map((item: any) => item.imageName);
  res.send([
    "Mexico_City_Cathedral",
    "Mexican_Street_vendor",
    "La_roma",
    "Chapultepec_Castle_Garden_Tower",
    "Chap_Castle_Mural",
  ]);
});

mainRouter.post("/changeDataNew/:tableName", async (req, res) => {
  const { data } = req.body;

  const { tableName } = req.params;

  if (!data) {
    // return a res wiht message
    return res.status(400).send("No data recieved in the request");
  }

  if (tableName === "Yodahea") {
    {
      // find entry
      const getData = await YodaheaTable.mySearchData(data.imageName);
      if (!getData) {
        return res.status(404).send("Data not found");
      }
      /**
       * Data for Audit is {"partitionKey":"masterFinal","rowKey":"RKey-C47F8201-681A-467B-A2B9-78227F43A0F7","field":"description","value":"yooo"}
       */
      Logger.info(`Data found for update with RowKey ${getData[0].rowKey}`);
      // change the value
      const field = data.field;
      const value = data.newvalue;
      const oldData = getData[0][field];
      getData[0][field] = value;
      // update the entry
      try {
        Logger.info(`For field ${field} changing from ${oldData} to ${value}`);
        //console.log(getData[0]);
        const outcome = await YodaheaTable.updateEntity(getData[0]);
        if (!outcome) {
          Logger.warn(`Error updating the data...`);
          return res.status(400).send("Error making changes to the data");
        }
        Logger.info(`Data Updated !`);
      } catch (error) {
        Logger.error(`Error updating the data ${error}`);
        res.status(400).send("Error making changes to the data");
      }
    }
  } else {
    // find entry
    const getData = await masterTableFinal.mySearchData(data.imageName);
    if (!getData) {
      return res.status(404).send("Data not found");
    }
    /**
     * Data for Audit is {"partitionKey":"masterFinal","rowKey":"RKey-C47F8201-681A-467B-A2B9-78227F43A0F7","field":"description","value":"yooo"}
     */
    Logger.info(`Data found for update with RowKey ${getData[0].rowKey}`);
    // change the value
    const field = data.field;
    const value = data.newvalue;
    const oldData = getData[0][field];
    getData[0][field] = value;
    // update the entry
    try {
      Logger.info(`For field ${field} changing from ${oldData} to ${value}`);
      console.log(getData[0]);
      const outcome = await masterTableFinal.updateEntity(getData[0]);
    } catch (error) {
      Logger.error(`Error updating the data ${error}`);
      res.status(400).send("Error making changes to the data");
    }
  }
  res.send("Data updated");
});

mainRouter.post("/rename/:oldName/:newName", async (req, res) => {
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

mainRouter.delete("/delete/:imageName", async (req, res) => {
  const { imageName } = req.params;
  const data = req.body;
  if (!data || !imageName) {
    return res.status(400).send("No data recieved in the request");
  }
  try {
    const data2 = await masterTableFinal.fullDeleteProcess(data);
  } catch (error) {
    res.status(400).send("Error deleting the data");
  }

  try {
    const outcome = await auditsTable.auditHandler("Delete", data);
    console.log(` Data for Audit is ${JSON.stringify(data)}`);
  } catch (error) {
    res.status(400).send("Error making changes to the data");
  }

  res.send("Data deleted");
});

mainRouter.post("/changeDataMultiple/:tableName/:field", async (req, res) => {
  const { tableName } = req.params;
  const { field } = req.params;
  const data = req.body;
  if (!data) {
    // return a res wiht message
    return res.status(400).send("No data recieved in the request");
  }

  if (tableName === "Yodahea") {
    console.log(
      ` Data for Yodahea Change is ${JSON.stringify(data)} with field ${field}`
    );
    const etnries = data.imageNames;
    for (let entry of etnries) {
      const imageP = await YodaheaTable.mySearchData(entry);
      const image = imageP[0];
      if (!image) {
        return res.status(404).send("Data not found");
      }
      if (field === "tags") {
        const newTagsInitial = image.tags;
        const newTags = newTagsInitial
          ? newTagsInitial + "," + data.newValue
          : data.newValue;

        const newEntity = {
          ...image,
          [field]: newTags,
        };
        Logger.info(`Data found for update with RowKey ${newEntity.rowKey} `);
        try {
          const outcome = await YodaheaTable.updateEntity(newEntity);
          Logger.info(
            `Data Updated in Master for image ${entry} with field ${field}: ${data.newValue}`
          );
        } catch (error) {
          res.status(400).send("Error making changes to the data");
        }
      } else if (field === "dateTaken") {
        const newValue = data.newValue;
        const newEntity = {
          ...image,
          [field]: String(newValue),
        };
        Logger.info(`Data found for update with RowKey ${newEntity.rowKey} `);
        try {
          const outcome = await YodaheaTable.updateEntity(newEntity);
          Logger.info(
            `Data Updated in Master for image ${entry} with field ${field}: ${newValue}`
          );
        } catch (error) {
          res.status(400).send("Error making changes to the data");
        }
      }
    }
    ///////////////////////////////////////////////
  } else {
    const etnries = data.imageNames;
    for (let entry of etnries) {
      const imageP = await masterTableFinal.mySearchData(entry);
      const image = imageP[0];
      if (!image) {
        return res.status(404).send("Data not found");
      }
      // get current tags and  add new tags
      if (field === "tags") {
        const newTagsInitial = image.tags;
        const newTags = newTagsInitial
          ? newTagsInitial + "," + data.newValue
          : data.newValue;

        const newEntity = {
          ...image,
          [field]: newTags,
        };
        Logger.info(`Data found for update with RowKey ${newEntity.rowKey} `);
        try {
          const outcome = await masterTableFinal.updateEntity(newEntity);
          Logger.info(
            `Data Updated in Master for image ${entry} with field ${field}: ${data.newValue}`
          );
        } catch (error) {
          res.status(400).send("Error making changes to the data");
        }
      } else if (field === "dateTaken") {
        const newValue = data.newValue;
        const newEntity = {
          ...image,
          [field]: String(newValue),
        };
        Logger.info(`Data found for update with RowKey ${newEntity.rowKey} `);
        try {
          const outcome = await masterTableFinal.updateEntity(newEntity);
          Logger.info(
            `Data Updated in Master for image ${entry} with field ${field}: ${newValue}`
          );
        } catch (error) {
          res.status(400).send("Error making changes to the data");
        }
      }
    }
  }
  res.send("Data updated");
});
// ********** Admin functions ( work in prog ) **********

mainRouter.get("/unapproved", async (req: Request, res: Response) => {
  const data = await masterTableFinal.getUnapprovedImages();
  res.send(data);
});
mainRouter.post("/admin/approve", async (req: Request, res: Response) => {
  const { user, imagename } = req.body;
  Logger.http(`User ${user} requesting to approve images`);
  let authorizedUsers: any = process.env.AUTHORIZED_USERS;
  authorizedUsers = JSON.parse(authorizedUsers);
  if (authorizedUsers[0].email !== user) {
    Logger.error(`User ${user} not authorized to view unapproved images`);
    res
      .status(401)
      .send(`User ${user} not authorized to view unapproved images`);
    return;
  }
  const data = await masterTableFinal.approveImages(imagename, user);
  res.send(data);
});

mainRouter.get(
  "/getFilters/:tableName",
  async (req: Request, res: Response) => {
    const { tableName } = req.params;

    switch (tableName) {
      case "Yodahea":
        const filtersYodahea = await YodaheaTable.getFilters();
        res.send(filtersYodahea);
        break;
      default:
        const filters = await masterTableFinal.getFilters();
        res.send(filters);
        break;
    }
  }
);
