import express, { Request, Response } from "express";

import { auditsTable, auditsTypes } from "../db/audits";
import { masterTableFinal, YodaheaTable } from "../db/masterdata";

export const auditRouter = express.Router();

import multer from "multer";
import Logger from "../utils/logger";
import { compressionBucket, yodaheaBucket } from "../db/blobs";
import sharp from "sharp";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20000000,
  },
});
// for parsing auditRouterlication/json
auditRouter.use(express.json());

// for parsing auditRouterlication/x-www-form-urlencoded
auditRouter.use(express.urlencoded({ extended: true }));

// for parsing multipart/form-data
auditRouter.use(upload.single("data"));
auditRouter.use(express.static("public"));

auditRouter.post("/changeData/:tableName", async (req, res) => {
  const inputdata = JSON.parse(req.body.data);
  const olddata = JSON.parse(req.body.oldData);
  const { tableName } = req.params;

  if (!inputdata || !olddata) {
    // return a res wiht message
    return res.status(400).send("No data recieved in the request");
  }
  if (tableName && tableName === "Yodahea") {
    const getData = await YodaheaTable.mySearchData(inputdata.imageName);
    //console.log(` Received Data is ${JSON.stringify(getData)}`);
    if (!getData) {
      return res.status(404).send("Data not found");
    }
    // console.log(` Found Data to Update with ` + JSON.stringify(getData));
    const fullNew = {
      partitionKey: "masterFinal",
      rowKey: getData[0].rowKey,
      ...inputdata,
    };
    //console.log(` New Data is ${JSON.stringify(fullNew)}`);
    try {
      const outcome = await auditsTable.auditHandler(
        "Update",
        inputdata,
        olddata
      );
      // if (outcome === "Audit Created") {
      //   res.status(200).send(outcome);
      // }
      const outcomeRes = await YodaheaTable.updateEntity(fullNew);
      Logger.info(
        `Data Updated for table Yodahea with RowKey ${getData[0].rowKey}`
      );
      res.status(200).send("Data updated");
    } catch (error) {
      Logger.error(`Error updating the data ${error}`);
      res.status(400).send("Error making changes to the data");
    }
  } else {
    const getData = await masterTableFinal.mySearchData(inputdata.imageName);
    //console.log(` Received Data is ${JSON.stringify(getData)}`);
    if (!getData) {
      return res.status(404).send("Data not found");
    }
    // console.log(` Found Data to Update with ` + JSON.stringify(getData));
    const fullNew = {
      partitionKey: "masterFinal",
      rowKey: getData[0].rowKey,
      ...inputdata,
    };
    //console.log(` New Data is ${JSON.stringify(fullNew)}`);
    try {
      const outcome = await auditsTable.auditHandler(
        "Update",
        inputdata,
        olddata
      );
      // if (outcome === "Audit Created") {
      //   res.status(200).send(outcome);
      // }
      const outcomeRes = await masterTableFinal.updateEntity(fullNew);
      Logger.info(
        `Data Updated for table masterFinal with RowKey ${getData[0].rowKey}`
      );
      res.status(200).send("Data updated");
    } catch (error) {
      Logger.error(`Error updating the data ${error}`);
      res.status(400).send("Error making changes to the data");
    }
  }
});

auditRouter.post("/changeDataNew/:tableName", async (req, res) => {
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
auditRouter.post("/changeDataMultiple/:tableName/:field", async (req, res) => {
  const { tableName } = req.params;
  const { field } = req.params;
  const data = req.body;
  if (!data) {
    // return a res wiht message
    return res.status(400).send("No data recieved in the request");
  }

  if (tableName === "Yodahea" || tableName === "YodaheaTable") {
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
            `Data Updated in Yodahea for image ${entry} with field ${field}: ${data.newValue}`
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
            `Data Updated in Yodahea for image ${entry} with field ${field}: ${newValue}`
          );
        } catch (error) {
          res.status(400).send("Error making changes to the data");
        }

        res.send("Data updated");
      } else if (
        field === "description" ||
        field === "notes" ||
        field === "imageName"
      ) {
        const newValue = data.newValue;
        const newEntity = {
          ...image,
          [field]: newValue,
        };
        Logger.info(`Data found for update with RowKey ${newEntity.rowKey} `);
        try {
          const outcome = await YodaheaTable.updateEntity(newEntity);
          Logger.info(
            `Data Updated in Yodahea for image ${entry} with field ${field}: ${newValue}`
          );
        } catch (error) {
          res.status(400).send("Error making changes to the data");
        }
        res.send("Data updated");
      } else {
        console.log(` Cannot operate on field ${field}`);
        res.status(400).send("Error making changes to the data");
      }
    }

    ///////////////////////////////////////////////
  } else {
    console.log(` ERROR, Cannot operate on table ${tableName}`);
    res.status(400).send("Error making changes to the data");
  }
});

// --> Delete: delete list of entries using fullDeleteProcess
auditRouter.post(
  "/deleteEntries/:tableName",
  async (req: Request, res: Response) => {
    const { tableName } = req.params;
    const { imageNames } = req.body;
    if (!imageNames) {
      return res.status(400).send("No image names provided");
    }
    if (tableName === "YodaheaTable") {
      for (let imageName of imageNames) {
        const outcome = await YodaheaTable.fullDeleteProcess(imageName);
        if (!outcome) {
          return res.status(400).send("Error deleting entries");
        }
        try {
          await auditsTable.auditHandler("Delete", imageName, []);
        } catch (err) {
          console.log(`Error in audit for ${imageName}`);
        }
      }
    } else {
      for (let imageName of imageNames) {
        const outcome = await masterTableFinal.fullDeleteProcess(imageName);
        if (!outcome) {
          return res.status(400).send("Error deleting entries");
        }
      }
    }
    res.send("Entries deleted");
  }
);

// -. APi to refresh comp table
auditRouter.get("/refreshComp", async (req, res) => {
  const listOfYodaBucketIages = await yodaheaBucket.listContBlobs();
  const listOfCompresImages = await compressionBucket.listContBlobs();

  console.log(
    ` FOund: ${listOfYodaBucketIages.length} images in Yodahea and ${listOfCompresImages.length} in compression`
  );

  const needsCompressing = listOfYodaBucketIages.filter((image) => {
    return !listOfCompresImages.includes(image);
  });

  console.log(` Found ${needsCompressing.length} images to compress`);

  for (let image of needsCompressing) {
    const buffer = await yodaheaBucket.downloadBuffer(image.split(".")[0]);
    if (!buffer) {
      console.log("Error downloading image");
      continue;
    }
    const compressed = await sharp(buffer)
      .rotate() // Corrects the orientation based on EXIF data
      .resize(375, 375, {
        fit: "contain",
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255 },
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })

      .toFormat("webp", { quality: 100 })
      .toBuffer()
      .catch((e) => {
        console.log("Error compressing image");
      });

    if (!compressed) {
      console.log("Error compressing image");
      continue;
    }
    try {
      await compressionBucket.uploadBuffer(image.split(".")[0], compressed);
    } catch (e) {
      console.log("Error uploading compressed image");
      continue;
    }
    console.log(` Compressed ${image}`);
  }

  console.log("Images refreshed");
  res.send("Images refreshed");
});
