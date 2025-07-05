import bodyParser from "body-parser";
import cors from "cors";
import express, { Response, Request, Router } from "express";
import multer from "multer";
import Logger from "../utils/logger";
import { newimages } from "../db/blobs";
import { masterTableFinal, YodaheaTable } from "../db/masterdata";
import dotenv from "dotenv";
import { auditsTable } from "../db/audits";
import logger from "../utils/logger";


// Configs and imports
dotenv.config();
export const dataRouter: Router = Router();

dataRouter.use(cors());
dataRouter.use(express.json());
dataRouter.use(bodyParser.json());
dataRouter.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// End of Configs and imports

// Routes


// -> GET: get all data from Azure Table
dataRouter.get(
  "/getAllData",

  async (req: Request, res: Response) => {
    const {
      start,
      limit,
      showUnmatched,
      tags,
      search,
      tablename,
      startdate,
      enddate,
    } = req.query;
    const startPoint = start || process.env.STARTPOINT;
    const limitPoint = limit || process.env.MAXLIMIT;
    const unmatchedChoice = showUnmatched === "true" ? true : false;
    const tagsInput = tags ? String(tags).split(",") : [];
    const searchInput = search ? String(search) : "";
    // look for start and end dates, if none make 0
    const startingDate = startdate ? Number(startdate) : 0;
    const endingDate = enddate ? Number(enddate) : 0;
    try {
      // Get table name from req and return data from there
      if (!tablename) {
        Logger.error("No table name provided");
        res.status(400).send("No table name provided");
        return;
      } else if (tablename === "YodaheaTable") {
        let yodaData: any = [];
        if (searchInput !== "") {
          logger.info(`Searching for ${searchInput}`);
          yodaData = await YodaheaTable.mySearchData(searchInput);
          res.send([yodaData, [], yodaData.length]);
          return;
        } else {
          logger.warn(
            ` Querying with options: -start: ${startPoint}, -limit: ${limitPoint}, -showUnmatched: ${unmatchedChoice}, -tags: ${tagsInput}, -search: ${searchInput}, -startdate: ${new Date(
              startingDate
            )}, -enddate:  ${new Date(endingDate)}`
          );

          yodaData = await YodaheaTable.myGetDataLimit(
            Number(startPoint),
            Number(limitPoint),
            unmatchedChoice,
            tagsInput,
            startingDate,
            endingDate
          );
        }
        // Sort by dateTaken
        // Remove the any No Date values from masterData and append to the end

        //
        const yodaimagesTotal = await newimages.listImages();
        if (unmatchedChoice === false) {
          console.log(` For matched data size is ${yodaData[1]}`);
          res.send([yodaData[0], yodaimagesTotal, yodaData[1]]);
        } else {
          console.log(` For unmatched data size is ${yodaData[1]}`);

          res.send([yodaData[0], yodaimagesTotal, yodaData[1]]);
        }
      } else {
        Logger.error("Invalid Data Request for table for " + tablename);
        res.status(404).send("Invalid Data Request for table");
      }
    } catch (err) {
      Logger.info(err);
    } //
  }
);
dataRouter.get("/getAllDataTest", async (req: Request, res: Response) => {
  const {
    start,
    limit,
    showUnmatched,
    tags,
    search,
    tablename,
    startdate,
    enddate,
  } = req.query;
  const startPoint = start || process.env.STARTPOINT;
  const limitPoint = limit || process.env.MAXLIMIT;
  const unmatchedChoice = showUnmatched === "true" ? true : false;
  const tagsInput = tags ? String(tags).split(",") : [];
  const searchInput = search ? String(search) : "";
  // look for start and end dates, if none make 0
  const startingDate = startdate ? Number(startdate) : 0;
  const endingDate = enddate ? Number(enddate) : 0;
  try {
    // If no table name provided, return error
    if (!tablename) {
      Logger.error("No table name provided");
      res.status(400).send("No table name provided");
      return;
    } else if (tablename === "YodaheaTable") {
      let yodaData: any = [];
      if (searchInput !== "") {
        logger.info(`Searching for in LUNR ${searchInput}`);

        // Using LUNR for searching across all data
        yodaData = await YodaheaTable.getDataLUNR(searchInput);
        let totalEntries = yodaData.length;
        logger.info(`Found ${totalEntries} entries for ${searchInput}`);

        // res.send([yodaData, [], yodaData.length]);
        // Im forgetting to paginate here, thats why loading is taking so long its returning all data
        let slicied = yodaData.slice(
          Number(startPoint),
          Number(startPoint) + Number(limitPoint)
        );
        console.log(`Slicied data from ${slicied.length}`);
        res.send([slicied, [], totalEntries]);
        return;
      } else {
        logger.warn(
          ` Querying with options: -start: ${startPoint}, -limit: ${limitPoint}, -showUnmatched: ${unmatchedChoice}, -tags: ${tagsInput}, -search: ${searchInput}, -startdate: ${new Date(
            startingDate
          )}, -enddate:  ${new Date(endingDate)}`
        );

        // If no search input, then get data from the table
        yodaData = await YodaheaTable.myGetDataLimit(
          Number(startPoint),
          Number(limitPoint),
          unmatchedChoice,
          tagsInput,
          startingDate,
          endingDate
        );
      }

      const yodaimagesTotal = await newimages.listImages();
      if (unmatchedChoice === false) {
        console.log(` For matched data size is ${yodaData[1]}`);
        res.send([yodaData[0], yodaimagesTotal, yodaData[1]]);
      } else {
        console.log(` For unmatched data size is ${yodaData[1]}`);

        res.send([yodaData[0], yodaimagesTotal, yodaData[1]]);
      }
    } else {
      Logger.error("Invalid Data Request for table for " + tablename);
      res.status(404).send("Invalid Data Request for table");
    }
  } catch (err) {
    Logger.info(err);
  } //
});

/** Routes for Searching */

// -> GET: search for data in the table
dataRouter.get("/search/:tablename", async (req: Request, res: Response) => {
  const { tablename } = req.params;
  const checkForSearch = req.query.search;
  // get [object Object] so convert to string
  if (checkForSearch) {
    console.log(" In search, ", checkForSearch, " for table ", tablename);
    const removeSearchFromTable = tablename.replace(String(checkForSearch), "");

    switch (removeSearchFromTable) {
      case "masterdata":
        const masterData: any = await masterTableFinal.mySearchData(
          String(checkForSearch)
        );
        res.send(masterData);

        break;
      case "Yodahea":
        const yodaData: any = await YodaheaTable.mySearchData(
          String(checkForSearch)
        );
        res.send(yodaData);
        break;
      default:
        Logger.error("Invalid Data Request for table");
        res.status(404).send("Invalid Data Request for table");
        break;
    }
    return;
  }
});
dataRouter.get(
  "/moresearch/:tablename",
  async (req: Request, res: Response) => {
    const { tablename } = req.params;
    const checkForSearch = req.query.search;
    // get [object Object] so convert to string
    if (checkForSearch) {
      console.log(" In extended search, ", checkForSearch);
      const removeSearchFromTable = tablename.replace(
        String(checkForSearch),
        ""
      );

      switch (removeSearchFromTable) {
        case "masterdata":
          const masterData: any = await masterTableFinal.myextendedSearch(
            String(checkForSearch)
          );
          res.send(masterData);

          break;
        case "Yodahea":
          const yodaData: any = await YodaheaTable.myextendedSearch(
            String(checkForSearch)
          );
          res.send(yodaData);
          break;
        default:
          Logger.error("Invalid Data Request for table");
          res.status(404);
          break;
      }
      return;
    }
  }
);

// End of Routes for Searching

// -> POST: change multiple data in the table
dataRouter.post("/changeDataMultiple/:tableName/:field", async (req, res) => {
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
    const entries = data.imageNames;
    for (let entry of entries) {
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
          await YodaheaTable.updateEntity(newEntity);
          Logger.info(
            `Data Updated in Yodahea for image ${entry} with field ${field}: ${data.newValue}`
          );
          await YodaheaTable.refreshFilters();
        } catch (error) {
          return res.status(400).send("Error making changes to the data");
        }
      } else if (field === "dateTaken") {
        const newValue = data.newValue;
        const newEntity = {
          ...image,
          [field]: String(newValue),
        };
        Logger.info(`Data found for update with RowKey ${newEntity.rowKey} `);
        try {
          await YodaheaTable.updateEntity(newEntity);
          Logger.info(
            `Data Updated in Yodahea for image ${entry} with field ${field}: ${newValue}`
          );
        } catch (error) {
          return res.status(400).send("Error making changes to the data");
        }
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
          await YodaheaTable.updateEntity(newEntity);
          Logger.info(
            `Data Updated in Yodahea for image ${entry} with field ${field}: ${newValue}`
          );
          await YodaheaTable.refreshFilters();
        } catch (error) {
          return res.status(400).send("Error making changes to the data");
        }
      } else {
        console.log(` Cannot operate on field ${field}`);
        return res.status(400).send("Error making changes to the data");
      }
    }
    res.send("Data updated");
  } else {
    console.log(` ERROR, Cannot operate on table ${tableName}`);
    res.status(400).send("Error making changes to the data");
  }
});
// -> POST: change multiple data in the table
dataRouter.post("/changeTags", async (req, res) => {
  const data = req.body;
  if (!data) {
    // return a res wiht message
    return res.status(400).send("No data recieved in the request");
  }

  console.log(` Data for Yodahea Change is ${JSON.stringify(data)}  `);
  const etnries = data.imageNames;
  for (let entry of etnries) {
    const imageP = await YodaheaTable.mySearchData(entry);
    const image = imageP[0];
    if (!image) {
      return res.status(404).send("Data not found");
    }

    const newTags = data.newValue;

    const newEntity = {
      ...image,
      tags: newTags,
    };
    Logger.info(`Data found for update with RowKey ${newEntity.rowKey} `);
    try {
      const outcome = await YodaheaTable.updateEntity(newEntity);
      Logger.info(
        `Data Updated in Master for image ${entry} with tags: ${data.newValue}`
      );
    } catch (error) {
      res.status(400).send("Error making changes to the data");
    }
  }
  ///////////////////////////////////////////////

  res.send("Data updated");
});

dataRouter.post(  "/addTagsForNotSameImages",
  async (req: Request, res: Response) => {
    const { newValue, imageNames } = req.body;
    console.log("Received newValue:", newValue);
    console.log("Received imageNames:", imageNames);

    if (!newValue || !Array.isArray(imageNames) || imageNames.length === 0) {
      return res
        .status(400)
        .send({ message: "newValue and imageNames are required" });
    }

    try {
      for (const imageName of imageNames) {
        const imageDataArr = await YodaheaTable.mySearchData(imageName);
        const imageData = imageDataArr[0];
        if (!imageData) {
          console.warn(`Image not found: ${imageName}`);
          continue;
        }
        // Append newValue to tags (comma separated)
        const currentTags = imageData.tags ? imageData.tags.split(",") : [];
        const newTagsArr = [...currentTags, ...newValue.split(",")].filter(
          Boolean
        );
        // Remove duplicates
        const uniqueTags = Array.from(new Set(newTagsArr)).join(",");
        const updatedEntity = { ...imageData, tags: uniqueTags };
        await YodaheaTable.updateEntity(updatedEntity);
        Logger.info(`Updated tags for image ${imageName}: ${uniqueTags}`);
      }
      res.send({ message: "Tags updated for provided images" });
    } catch (error) {
      Logger.error(`Error updating tags: ${error}`);
      res.status(500).send({ message: "Error updating tags" });
    }
  }
);

// --> POST: get filters for the table
dataRouter.get(  "/getFilters/:tableName",
  async (req: Request, res: Response) => {
    let { tableName } = req.params;
    if (!tableName) {
      tableName = "YodaheaTable";
    }
    switch (tableName) {
      case "YodaheaTable":
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

// --> Delete: delete list of entries using fullDeleteProcess
dataRouter.post("/deleteEntries", async (req: Request, res: Response) => {
  const { imageNames } = req.body;
  if (!imageNames) {
    return res.status(400).send("No image names provided");
  }

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

  res.send("Entries deleted");
});
