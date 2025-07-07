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
import { DatesTable, dateTableType } from "../db/dateTable";

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
      seeOlderFirst = "false",
    } = req.query;
    const startPoint = start || process.env.STARTPOINT;
    const limitPoint = limit || process.env.MAXLIMIT;
    const unmatchedChoice = showUnmatched === "true" ? true : false;
    const tagsInput = tags ? String(tags).split(",") : [];
    const seeOlderFirstChoice = seeOlderFirst === "true" ? true : false;
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
            ` Querying with options: -start: ${startPoint}, -limit: ${limitPoint}, 
            -showUnmatched: ${unmatchedChoice}, -tags: ${tagsInput}, 
            -search: ${searchInput}, 
            -startdate: ${startingDate}, -enddate:  ${endingDate} 
            -seeOlderFirst: ${seeOlderFirstChoice}`
          );

          yodaData = await YodaheaTable.myGetDataLimit(
            Number(startPoint),
            Number(limitPoint),
            unmatchedChoice,
            tagsInput,
            startingDate,
            endingDate,
            undefined, // countryInput
            undefined, // tripInput
            undefined, // specialInput
            seeOlderFirstChoice // seeOlderFirst
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
    seeOlderFirst = "false",
  } = req.query;
  const startPoint = start || process.env.STARTPOINT;
  const limitPoint = limit || process.env.MAXLIMIT;
  const unmatchedChoice = showUnmatched === "true" ? true : false;
  const seeOlderFirstChoice = seeOlderFirst === "true" ? true : false;
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
            ` Querying with options: -start: ${startPoint}, -limit: ${limitPoint}, 
            -showUnmatched: ${unmatchedChoice}, -tags: ${tagsInput}, 
            -search: ${searchInput}, 
            -startdate: ${startingDate}, -enddate:  ${endingDate} 
            -seeOlderFirst: ${seeOlderFirstChoice}`
          );
        // If no search input, then get data from the table
        yodaData = await YodaheaTable.myGetDataLimit(
          Number(startPoint),
          Number(limitPoint),
          unmatchedChoice,
          tagsInput,
          startingDate,
          endingDate,
          undefined, // 3 below are only used for DatesTable
          undefined, // tripInput
          undefined, // specialInput
          seeOlderFirstChoice // seeOlderFirst
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

// change dateTaken for multiple images
/**
 * Incoming in data:
 * [{"imageName":"22C9D6BD-A414-4CAC-B890-85F2F6DEF68D","newdateTaken":"1623470400000"},{"imageName":"1D8D4355-2137-4618-94E8-3F9E4C64B101","newdateTaken":"1623470400001"},{"imageName":"3789AD5B-62EB-4A6A-80CE-77F165C93263","newdateTaken":"1623470400002"},{"imageName":"C969FEED-5815-45A9-AE45-316D92D8AA1D","newdateTaken":"1623470400003"},{"imageName":"F3EDA8EC-8076-4703-98D6-1E1C4F308EDD","newdateTaken":"1623470400004"}]
 */
dataRouter.post("/updateOrder", async (req: Request, res: Response) => {
  const data = req.body.data;
  if (!data || !Array.isArray(data) || data.length === 0) {
    return res.status(404).send("No data provided");
  }
  console.log("Received data for date change:", data.length, "entries");

  try {
    const result = await YodaheaTable.changeDateTakenForImages(data);
    res.send(result);

    // res.send("OK");
  } catch (err) {
    Logger.error(err);
    res.status(500).send("Error updating dateTaken for images");
  }
});

dataRouter.post(
  "/addTagsForNotSameImages",
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

// --> Delete: delete list of entries using fullDeleteProcess
dataRouter.delete("/deleteEntries", async (req: Request, res: Response) => {
  const { imagePaths } = req.body;
  if (!imagePaths) {
    return res.status(400).send("No image paths provided");
  }

  for (let imagePath of imagePaths) {
    logger.info(`Deleting entries for image: ${imagePath}`);
    // Check if the image exists in the Y
    const outcome = await YodaheaTable.fullDeleteProcess(imagePath);
    if (!outcome) {
      return res.status(400).send("Error deleting entries");
    }
    try {
      // await auditsTable.auditHandler("Delete", imagePath, []);
      await auditsTable.auditSimple("deletion", imagePath);
    } catch (err) {
      console.log(`Error in audit for ${imagePath}`);
    }
  }

  res.send("Entries deleted");
});

/** FOR DATE LOG */

// -> GET: get all dates from the DatesTable
dataRouter.get("/getAllDates", async (req: Request, res: Response) => {
  const { start, limit, showUnmatched, country, trip, Special } = req.query;
  const startPoint = start || process.env.STARTPOINT;
  const limitPoint = limit || process.env.MAXLIMIT;
  const unmatchedChoice = showUnmatched === "true" ? true : false;
  const countryInput = country ? String(country) : "";
  const tripInput = trip ? String(trip) : "";
  const SpecialInput = Special ? String(Special) : "";

  try {
    // Get table name from req and return data from there

    const datesData = await DatesTable.myGetDataLimit(
      Number(startPoint),
      Number(limitPoint),
      unmatchedChoice,
      [],
      0, // No start date filter
      0, // No end date filter
      countryInput, // Country filter
      tripInput, // Trip filter
      SpecialInput // Special filter
    );

    // If country or trip filter is applied, count filtered results; otherwise, use total table size
    let totalEntries1: number;
    if (countryInput || tripInput) {
      // Count the filtered results
      totalEntries1 = Array.isArray(datesData) ? datesData.length : 0;
    } else {
      totalEntries1 = await DatesTable.returnTableSize();
    }

    // res.send(datesData);
    res.send([datesData, [], totalEntries1]);
  } catch (err) {
    Logger.info(err);
  }
});
// -> POST: create a new event in the DatesTable
dataRouter.post("/createEvent", async (req: Request, res: Response) => {
  const { country, eventTags, city, trip, startDate, endDate, description } =
    req.body;

  if (!country || !city || !trip || !startDate || !endDate) {
    return res.status(400).send("Missing required fields");
  }

  Logger.info(` data for new event: ${JSON.stringify(req.body)}`);

  const newEvent: any = {
    partitionKey: "PARTITIONKEY-DATES",
    rowKey: `RKEY-${country}-${city}-${trip}`,
    city,
    country,
    trip,
    startDate,
    endDate,
    description: description || "",
    eventTags: eventTags.trim(), // Initialize with an empty array
  };

  try {
    await DatesTable.insertEntity(newEvent);
    res.send("Event created successfully");
  } catch (err) {
    Logger.error(err);
    res.status(500).send("Error creating event");
  }
});

dataRouter.delete(
  "/deleteEventByCity/:city",
  async (req: Request, res: Response) => {
    const { city } = req.params;

    if (!city) {
      return res.status(400).send("Missing city");
    }
    Logger.warn("Deleting event with city: " + city);

    try {
      // Find the event with the given city (only one expected)
      const allEvents = await DatesTable.manualGetData();
      const eventToDelete = Array.isArray(allEvents)
        ? allEvents.find(
            (event: any) =>
              event.city && event.city.toLowerCase() === city.toLowerCase()
          )
        : undefined;

      if (!eventToDelete) {
        return res.status(404).send("No event found for the specified city");
      }

      await DatesTable.straightDelete(
        eventToDelete.partitionKey,
        eventToDelete.rowKey
      );
      Logger.info(`Deleted event with rowKey: ${eventToDelete.rowKey}`);

      res.send(`Deleted event for city: ${city}`);
    } catch (err) {
      Logger.error(err);
      res.status(500).send("Error deleting event");
    }
  }
);

// return all data given a city
dataRouter.get("/getEventByCity/:city", async (req: Request, res: Response) => {
  const { city } = req.params;

  if (!city) {
    return res.status(400).send("Missing city");
  }
  Logger.warn("Getting event with city: " + city);

  try {
    // Find the event with the given city (only one expected)
    const allEvents = await DatesTable.manualGetData();
    const eventToGet = Array.isArray(allEvents)
      ? allEvents.find(
          (event: any) =>
            event.city && event.city.toLowerCase() === city.toLowerCase()
        )
      : undefined;

    if (!eventToGet) {
      return res.status(404).send("No event found for the specified city");
    }

    res.send(eventToGet);
  } catch (err) {
    Logger.error(err);
    res.status(500).send("Error fetching event");
  }
});

// return array of all countries in the DatesTable
dataRouter.get("/getCities", async (req: Request, res: Response) => {
  try {
    const allData = await DatesTable.manualGetData();
    let allCountries: string[] = [];
    if (Array.isArray(allData)) {
      allCountries = allData.map((entry) => entry.city);
    } else {
      Logger.warn("No entities found in DatesTable.manualGetData()");
    }

    res.send(allCountries);
  } catch (err) {
    Logger.error(err);
    res.status(500).send("Error fetching countries");
  }
});

dataRouter.post("/updateEventTags", async (req: Request, res: Response) => {
  const { city, eventTags } = req.body;

  if (!city || !eventTags) {
    return res.status(400).send("Missing city or eventTags");
  }

  try {
    // Find the event with the given city (only one expected)
    const allEvents = await DatesTable.manualGetData();
    const eventToUpdate = Array.isArray(allEvents)
      ? allEvents.find(
          (event: any) =>
            event.city && event.city.toLowerCase() === city.toLowerCase()
        )
      : undefined;

    if (!eventToUpdate) {
      return res.status(404).send("No event found for the specified city");
    }

    Logger.info(`Updating event with rowKey: ${eventToUpdate.rowKey} 
        Oldtags: ${eventToUpdate.eventTags}
        Newtags: ${eventTags}`);

    // Update the eventTags
    eventToUpdate.eventTags = eventTags.trim();

    await DatesTable.updateEntityBasic(eventToUpdate);
    Logger.info(`Updated event tags for city: ${city}`);

    res.send(`Updated event tags for city: ${city}`);
  } catch (err) {
    Logger.error(err);
    res.status(500).send("Error updating event tags");
  }
});

// -> GET: return the dates filters
dataRouter.get("/getDateFilters", async (req: Request, res: Response) => {
  try {
    const filters = await DatesTable.getDateFilters();
    res.send(filters);
  } catch (err) {
    Logger.error(err);
    res.status(500).send("Error fetching date filters");
  }
});
