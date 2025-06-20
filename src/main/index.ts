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
dotenv.config();
export const dataRouter: Router = Router();

dataRouter.use(cors());
dataRouter.use(express.json());
dataRouter.use(bodyParser.json());
dataRouter.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
/**
 *  Main Router
 * ----------------
 *
 *  -- For handling table data requests
 *
 * Routes:
 * - GET: /getTableColumns/:tablename
 * ** For returning the column names from the table
 *
 * - GET: /getAllData/:tablename
 * ** For returning all data from the table
 *
 * - GET: /getData/:tableName/:imageName
 * ** For returning a single data entry from the table
 *
 * - GET: /search/:tablename
 * ** For searching for data in the table
 *
 * - POST: /changeDataNew/:tableName
 * ** For changing data in the table
 *
 * - POST: /changeDataMultiple/:tableName/:field
 * ** For changing multiple data entries in the table
 *
 * - GET: /getFilters/:tableName
 * ** For returning the filters for the table
 *
 */

// -> GET: return the column names from the table,
dataRouter.get(
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
          res.status(404);
          break;
      }
    } catch (err) {
      Logger.info(err); //
    }
  }
);

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
        console.log(
          `Slicied data from ${slicied.length}`
        );
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
// -> GET: get  single data from Azure Table
dataRouter.get(
  "/getData/:tableName/:imageName",

  async (req: Request, res: Response) => {
    const { imageName } = req.params;
    const { tableName } = req.params;
    // Logger.info(`Getting data for image ${imageName}`);
    if (!imageName || !tableName) {
      res.status(400).send("No image name Or table name provided");
    }
    switch (tableName) {
      case "YodaheaTable":
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

// -> POST: change data in the table
dataRouter.post("/changeDataNew/:tableName", async (req, res) => {
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

// -> POST: change multiple data in the table
dataRouter.post("/changeDataMultiple/:tableName/:field", async (req, res) => {
  const { tableName } = req.params;
  const { field } = req.params;
  const data = req.body;
  if (!data) {
    // return a res wiht message
    return res.status(400).send("No data recieved in the request");
  }

  if (tableName === "YodaheaTable") {
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
// --> POST: get filters for the table
dataRouter.get(
  "/getFilters/:tableName",
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
