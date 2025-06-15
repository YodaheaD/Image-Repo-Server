import { TableClient, TableEntity, TableTransaction } from "@azure/data-tables";

import Logger from "../utils/logger";
import { isEmpty, partition } from "lodash";
import NodeCache from "node-cache";

import {
  compressionBucket,
  deletedBucket,
  newimages,
  yodaheaBucket,
} from "./blobs";
import { masterMap2Props } from "./masterdata";
import { auditsTypes } from "./audits";
import logger from "../utils/logger";
import sharp from "sharp";
import dotenv from "dotenv";
import { journalTypes } from "./journal";
import lunr from "lunr";
dotenv.config();
// Use emulated storage account for local development
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || "";
//process.env.AZURE_STORAGE_CONNECTION_STRING || "";

// Create a node cache
const myCache = new NodeCache();

export default class TableLike<Type extends TableEntity<object>> {
  private client?: TableClient;

  constructor(
    public readonly tableName: string,
    public tableData?: any,
    public table1Data?: any,
    public tableStats?: any,
    public tableColumns?: any
  ) {
    this.client = TableClient.fromConnectionString(connectionString, tableName);
    this.createTable();
    this.getDataOrCache();
  }

  /**
   * Data Functions List
   * ______________________
   *
   *  -> 'createTable()' & 'insertEntity()' & 'listEntities()'
   * Functions to create, add to, and list table. 

   * -> 'myGetData()'
   * Function for getting all data entries from Azure Table. 
   *
   * -> 'fullDeleteProcess()' & 'getSingleData()' & 'myUpdateData()'
   * Function for deleting, updating, getting single data entries at specific id in Azure Table.
   * 

   * -> getColumns()
   * Function to get column names from table, only available for items table.
   * 
   * -> getCacheSummary()
   * Function to return all cached values in table.
   * 
 
   * 
   * -> updateCacheData()
   * Function to update the cache when a change in data occurs.
  
   * 
   */

  //  Function to List entities (not functional yet, use myGetData())
  public listEntities() {
    return this.client?.listEntities<Type>();
  }

  // -> 'getDataOrCahce()' -- serves either the cache or the data from the table
  private async getDataOrCache() {
    Logger.warn(` ${this.tableName} - Searching for  Cache ....`);

    const checkCache = myCache.get(`dataCache${this.tableName}`);
    if (checkCache) {
      Logger.info(`${this.tableName} - Cache Found, returning Cache!`);

      return checkCache;
    } else {
      Logger.warn(
        `${this.tableName} - No Cache Found for table, pulling data and building cache ....`
      );
      const client = TableClient.fromConnectionString(
        connectionString,
        this.tableName
      );
      const entities = await client.listEntities();
      let holder: any[] = [];

      for await (const entity of entities) {
        // remove etag

        const { etag, ...filteredData } = entity;
        holder.push(filteredData);
      }
      Logger.info(
        `${this.tableName} -  Done pulling data found ${holder.length} entries, Building the  Cache ....  `
      );

      // Save the latest data into cache
      myCache.set(`dataCache${this.tableName}`, holder, 10000);

      // Set the map if the table is YodaheaTable
      if (this.tableName === "YodaheaTable") {
        this.buildMap(holder);
      }
      Logger.info(
        `${this.tableName} - Done setting cache, Returning data from table \n`
      );
      return holder;
    }
  }
  private async searchData(search: string) {
    const currentCache: any = myCache.get(`dataCache${this.tableName}`);
    if (!currentCache || !Array.isArray(currentCache)) {
      Logger.error(
        `No cache found or cache is not an array for ${this.tableName}`
      );
      return [];
    }

    const lowerSearch = search.toLowerCase();

    // Find by imageName
    const imageNameMatches = currentCache.filter((element: any) => {
      if (!element || !element.imageName) return false;
      return element.imageName.toLowerCase().includes(lowerSearch);
    });

    // Find by tags
    const tagMatches = currentCache.filter((element: any) => {
      if (!element || !element.tags) return false;
      // Split tags, trim, and check if any tag matches the search
      return element.tags
        .split(",")
        .map((tag: string) => tag.trim().toLowerCase())
        .some((tag: string) => tag.includes(lowerSearch));
    });

    // Merge and deduplicate by rowKey (or imageName if rowKey not present)
    const merged = [...imageNameMatches, ...tagMatches];
    const seen = new Set();
    const searchResult = merged.filter((item: any) => {
      const key = item.rowKey || item.imageName;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (searchResult.length === 0) {
      Logger.error(`No results found for ${search}`);
      return [];
    }

    // Sort based on image name
    searchResult.sort((a: any, b: any) => {
      return a.imageName.localeCompare(b.imageName);
    });
    return searchResult;
  }

  public async getDataLUNR(search: string) {
    if (!search) {
      // If no search is provided, return all data
      return [];
    }

    // Perform imageName search
    return this.lunrSearchData(search);
  }

  // Lunr.js search function for imageName and tags
  private async lunrSearchData(search: string) {
    const currentCache: any = myCache.get(`dataCache${this.tableName}`);
    if (!currentCache || !Array.isArray(currentCache)) {
      Logger.error(
        `No cache found or cache is not an array for ${this.tableName}`
      );
      return [];
    }

    // Build lunr index (in-memory, per search)
    const idx = lunr(function (this: lunr.Builder) {
      this.ref("rowKey");
      this.field("imageName");
      this.field("tags");
      currentCache.forEach((doc: any) => {
        // Only index if imageName exists
        if (doc && doc.imageName) {
          this.add({
            rowKey: doc.rowKey || doc.imageName,
            imageName: doc.imageName,
            tags: doc.tags || "",
          });
        }
      });
    });

    // Perform search
    const results = idx.search(`*${search}*`);

    // Map results to original objects
    const resultSet = new Set<string>();
    const searchResult = results
      .map((res: { ref: string }) => {
        const match = currentCache.find(
          (item) =>
            (item.rowKey || item.imageName) === res.ref &&
            !resultSet.has(res.ref)
        );
        if (match) {
          resultSet.add(res.ref);
          return match;
        }
        return null;
      })
      .filter(Boolean);

    if (searchResult.length === 0) {
      Logger.error(`No results found for ${search}`);
      return [];
    }

    // Sort by imageName
    searchResult.sort((a: any, b: any) =>
      a.imageName.localeCompare(b.imageName)
    );
    return searchResult;
  }
  private async extendedSearch(search: string) {
    const currentCache: any = myCache.get(`dataCache${this.tableName}`);
    if (!currentCache || !Array.isArray(currentCache)) {
      Logger.error(
        `No cache found or cache is not an array for ${this.tableName}`
      );
      return { imageNameSearch: [], tagsSearch: [] };
    }

    const lowerSearch = search.toLowerCase();

    // Search in imageName
    let imageNameSearch = currentCache
      .filter((element: any) => {
        if (!element || !element.imageName) return false;
        return element.imageName.toLowerCase().includes(lowerSearch);
      })
      .sort((a: any, b: any) => a.imageName.localeCompare(b.imageName));

    // Use getFilters to get all tags and filter them by search
    const filters = await this.getFilters();
    let tagsSearch = filters
      .filter((tagObj: any) =>
        tagObj.tagName.toLowerCase().includes(lowerSearch)
      )
      .map((tagObj: any) => tagObj.tagName);

    if (imageNameSearch.length === 0 && tagsSearch.length === 0) {
      Logger.error(`No results found for ${search}`);
      return [];
    }

    const limitSearch = 30; // Limit for each search
    // limit each search to 30 results
    if (imageNameSearch.length > limitSearch) {
      imageNameSearch = imageNameSearch.slice(0, limitSearch);
    }
    // limit tags search to 30 results
    if (tagsSearch.length > limitSearch) {
      tagsSearch = tagsSearch.slice(0,  limitSearch);
    }

    return { imageNameSearch, tagsSearch };
  }

  // -> 'myGetDataLimit()' -- similar to myGetData() but with a limit
  public async myGetDataLimit(
    start: number,
    limit: number,
    useUnmatched?: boolean,
    tags?: string[],
    startdate?: number,
    enddate?: number
  ) {
    // if no search is provided, return all data

    switch (this.tableName) {
      case "masterFinal": {
        const intialData: any = await this.getDataOrCache();
        Logger.warn(
          `Getting data from ${this.tableName} table with ${intialData.length} enetries and with Start limit ${start} - ${limit} ....`
        );

        let noDates = intialData.filter(
          (item: any) =>
            item.dateTaken === "No Date" ||
            item.dateTaken === "" ||
            item.dateTaken === undefined ||
            !item.dateTaken
        );

        let masterData = intialData.filter(
          (item: any) => item.dateTaken !== "No Date"
        );

        masterData = masterData.sort(
          (a: any, b: any) => Number(a.dateTaken) - Number(b.dateTaken)
        );

        masterData = masterData.concat(noDates);

        masterData.forEach((item: any) => {
          item.dateTaken = String(item.dateTaken);
        });

        const finalData = masterData.slice(start, start + limit);

        return finalData;

        //return this.getDataOrCache();
        break;
      }
      case "YodaheaTable": {
        //const intialData: any = await this.getDataOrCache();

        //
        let intialData: any = await this.getDataOrCache();
        Logger.warn(
          `Getting data from ${this.tableName} table with ${intialData.length} enetries and with Start limit ${start} - ${limit} ....`
        );
        // if a startdate and end date is provided, return data within that range
        if (startdate && enddate && startdate !== 0 && enddate !== 0) {
          console.log(` Using date range: ${startdate} - ${enddate}`);
          intialData = intialData.filter(
            (item: any) =>
              Number(item.dateTaken) >= startdate &&
              Number(item.dateTaken) <= enddate
          );
        }

        // if tags are passed, we only want data where there tag entry contains any of the tags
        // Begin of tag code

        if (tags && tags.length > 0) {
          console.log(` Using Tags: ${tags}`);
          const tagData = intialData.filter((item: any) => {
            const intialtags = item.tags.replaceAll(" ,", ",");
            const tagArray = intialtags.split(",");
            const match = tags.some(
              (tag) => tagArray.includes(tag) || tagArray.includes(" " + tag)
            );
            return match;
          });
          intialData = tagData;
        }

        // ENd of tag code
        if (!intialData) {
          Logger.error(`No Cache Found for ${this.tableName} table`);
          return "Error: No Cache Found";
        }
        let noDates = intialData.filter(
          (item: any) => item.dateTaken === "No Date"
        );

        let masterData = intialData.filter(
          (item: any) => item.dateTaken !== "No Date"
        );

        masterData = masterData.sort(
          //  (a: any, b: any) => Number(a.dateTaken) - Number(b.dateTaken)
          (a: any, b: any) => Number(b.dateTaken) - Number(a.dateTaken)
        );

        // masterData = masterData.concat(noDates);
        // Do not concat noDates for now

        masterData.forEach((item: any) => {
          item.dateTaken = String(item.dateTaken);
        });

        if (useUnmatched === true) {
          console.log(` Using Unmatched Data`);
          const totalNOdates = noDates.length;
          const finalData = noDates.slice(start, start + limit);
          return [finalData, totalNOdates];
        }

        const finalData = masterData.slice(start, start + limit);
        //  console.log(` All Rowkeys: ${allrowkeys}`);
        return [finalData, intialData.length];

        //return this.getDataOrCache();
        break;
      }

      case "audits": {
        return this.getDataOrCache();
        break;
      }
      case "compressiontable": {
        // return all data
        return this.getDataOrCache();
        break;
      }
      case "journal": {
        return this.getDataOrCache();
        break;
      }
      default:
        Logger.error("Invalid tablename: " + this.tableName);
        return "Error: Invalid tablename";
      // return "Error getting data";
    }
  }
  public async mySearchData(search: string) {
    return this.searchData(search);
  }
  public async myextendedSearch(search: string) {
    if (!search) return "";
    return this.extendedSearch(search);
  }
  public async getExactDataByImageName(imageName: string) {
    const currentCache: any = myCache.get(`dataCache${this.tableName}`);
    const searchResult = currentCache.filter(
      (element: any) => element.imageName === imageName
    );
    if (searchResult.length === 0) {
      Logger.error(`No results found for ${imageName}`);
      return [];
    }
    return searchResult;
  }
  public async numberOfImages(type: string = "all") {
    const currentCache: any = myCache.get(`dataCache${this.tableName}`);

    if (type === "unmatched") {
      const noDates = currentCache.filter(
        (item: any) =>
          item.dateTaken === "No Date" ||
          item.dateTaken === "" ||
          item.dateTaken === undefined ||
          !item.dateTaken
      );
      return noDates.length;
    }
    // Only values with filled in dates are considered in the length
    const filledDates = currentCache.filter(
      (element: any) => element.dateTaken !== "No Date"
    );
    return filledDates.length;
  }

  // -> 'basicDeleteProcess()'
  // Function for deleting entries at specific id in Azure Table.
  public async basicDeleteProcess(entity: any) {
    await this.client?.deleteEntity(entity.partitionKey, entity.rowKey);
    return "Success Deleting";
  }

  // -> 'fullDeleteProcess()'
  // Function for deleting entries at specific id in Azure Table.
  public async fullDeleteProcess(entity: any) {
    const deleteid = entity.imageName;
    const pathInStorage = entity.imagePath.includes(".")
      ? entity.imagePath.split(".")[0]
      : entity.imagePath;
    Logger.warn(
      `Deleting data  ${entity.imageName} with path ${pathInStorage} ....`
    );

    // archive the image by uploading its data into the deletedImages bucket

    try {
      await yodaheaBucket.deleteBlob(pathInStorage);
    } catch (error) {
      Logger.error(` Error deleting entity: ${error}`);
      return "Error deleting entity";
    }

    // now dlete entry from table
    try {
      await this.client?.deleteEntity("masterFinal", "RKey-" + pathInStorage);
      Logger.info(` Deleted entity: ${entity.imageName}`);
    } catch (error) {
      Logger.error(` Error deleting entity: ${error}`);
      return "Error deleting entity";
    }

    // update cache
    const currentCache: any = myCache.get(`dataCache${this.tableName}`);
    const deleteOld = currentCache.filter(
      (element: any) => element.rowKey !== "RKey-" + pathInStorage
    );
    myCache.set(`dataCache${this.tableName}`, deleteOld, 10000);
    Logger.info(
      ` Done deleting entity: ${entity.imageName} with path ${entity.imagePath}, original cache size: ${currentCache.length} new cache size: ${deleteOld.length}`
    );

    return "Success Deleting";
  }
  // Get column names from table, current only works for items table
  public async getColumns() {
    if (myCache.has(`dataNameCache${this.tableName}`)) {
      Logger.warn("Returning Column Names Cache!");
      return myCache.get(`dataNameCache${this.tableName}`);
    } else {
      try {
        Logger.info("Pulling columns from Azure table ...");
        const client = TableClient.fromConnectionString(
          connectionString,
          this.tableName
        );
        // Getting all data from the table
        const entities = await client.listEntities();
        let string: any = 0;
        for await (const entity of entities) {
          string = entity;
        }
        const columns = Object.keys(string);

        // Remove etag, partitionKey, rowKey, timestamp
        const newcolumns = columns.filter(
          (item) =>
            item !== "etag" && item !== "partitionKey" && item !== "rowKey"
        );
        // Set cache
        myCache.set(
          `dataNameCache${this.tableName}`,
          { columns: newcolumns },
          10000
        );

        Logger.warn(`Columns pulled: ${newcolumns}`);
        return { columns: newcolumns };
      } catch (error) {
        Logger.error(error);
        return "Error getting data";
      }
    }
  }
  //
  public async auditHandler(type: string, newdata: any, oldData?: any) {
    const unixTime = new Date().getTime();

    if (!newdata) {
      return "Error: No data recieved in the request";
    }
    //

    if (type === "Update") {
      if (this.tableName === "audits") {
        const rowKey = `RKey-${newdata.imagePath}-${unixTime}-Update-${newdata.auditor}`;
        const entity: auditsTypes = {
          partitionKey: `audits`,
          rowKey: rowKey,
          auditTime: unixTime.toString(),
          imageName: newdata.imageName,
          description: newdata.description,
          auditor: newdata.auditor,
          imagePath: newdata.imagePath,
          approvedBy: newdata.approvedBy,
          auditApprover: "Unapproved",
          auditType: "Update",
          previousValue: JSON.stringify(oldData),
          newValue: JSON.stringify(newdata),
        };

        try {
          console.log(` Inserting Audit for Rowkey: ${rowKey}`);
          await this.client?.createEntity(entity);

          // // Now update the cahce
          // const current: any = myCache.get(`dataCache${this.tableName}`);
          // const newData = [...current, newdata];
          // myCache.set(`dataCache${this.tableName}`, newData, 10000);
          return "Audit Created";
        } catch (error) {
          console.log(` ERROR creating audit for Rowkey: ${rowKey}+ ${error}`);
          return "Error creating audit";
        }
      } else {
        return "Error creating audit";
      }
    } else if (type === "Delete") {
      console.log(` Creating Audit for Delete: ${newdata.imageName}`);
      if (this.tableName === "audits") {
        logger.warn(` Creating Audit for Delete: ${newdata.imageName}`);
        const rowKey = `RKey-${newdata.imageName}-${unixTime}-Delete-${newdata.auditor}`;
        const entity: auditsTypes = {
          partitionKey: `Audits`,
          rowKey: rowKey,
          auditTime: unixTime.toString(),
          imageName: newdata.imageName,
          description: newdata.description,
          auditor: newdata.uploader,
          imagePath: newdata.imagePath,
          approvedBy: newdata.approvedBy,
          auditApprover: "Unapproved",
          auditType: "Delete",
          previousValue: "",
          newValue: "",
        };

        try {
          await this.client?.createEntity(entity);

          // Now update the Cache so we keep it up to date by insertin gthe new entity
          const current: any = myCache.get(`dataCache${this.tableName}`);
          const newData = [...current, newdata];
          myCache.set(`dataCache${this.tableName}`, newData, 10000);
          return "Audit Created";
        } catch (error) {
          console.log(` ERROR creating audit for Rowkey: ${rowKey}+ ${error}`);
        }

        try {
          const buf = await newimages.downloadBuffer(entity.imageName);
          Logger.warn(` Archiving image: ${entity.imageName}`);
          await deletedBucket.uploadBuffer(rowKey, buf);
          Logger.info(` Done Archiving image: ${entity.imageName}`);
        } catch (error) {
          Logger.error(` Error Archiving image: ${error}`);
        }
      } //
    } else if (type === "Upload") {
      const actualData = newdata;
      const listofFile = oldData;
      console.log(` Received Data: ${JSON.stringify(actualData)}`);
      const fileslIst = listofFile.map((item: any) => item.originalname);
      console.log(` Received Files: ${JSON.stringify(fileslIst)}`);
      /**
       * [1]  Received Data: {"description":"A tower in Chap castle's garden.","imageName":"Chapultepec_Castle_Garden_Tower","notes":"","tags":"mexico, mexico city, castle","dateTaken":"1716350400000","imagePath":"IMG_0519.JPEG","filetype":"jpeg","uploader":"yodaheadaniel@live.com"}
[1]  Received Files: ["IMG_0519.JPEG","IMG_0548.JPEG"]
       */
      if (this.tableName === "audits") {
        const rowKey = `RKey-${actualData.imagePath}-${unixTime}-Upload-${actualData.uploader}`;
        const entity: auditsTypes = {
          partitionKey: `Audits`,
          rowKey: rowKey,
          auditTime: unixTime.toString(),
          imageName: actualData.imageName,
          description: actualData.description,
          auditor: actualData.uploader,
          imagePath: actualData.imagePath,
          approvedBy: actualData.approvedBy,
          auditApprover: "Unapproved",
          auditType: "Upload",
          previousValue: JSON.stringify(fileslIst),
          newValue: "", // JSON.stringify(actualData),
        };

        try {
          await this.client?.createEntity(entity);

          // Now update the Cache so we keep it up to date by insertin gthe new entity
          const current: any = myCache.get(`dataCache${this.tableName}`);
          const newData = [...current, actualData];
          myCache.set(`dataCache${this.tableName}`, newData, 10000);
          return "Audit Created";
        } catch (error) {
          console.log(` ERROR creating audit for Rowkey: ${rowKey}+ ${error}`);
        }
      }
    }
  }

  async updateEntity(entity: any) {
    // if the tablename is journal just do a striaght update with azure
    if (this.tableName === "journal") {
      await this.client?.updateEntity(entity);
      return "Success";
    } else {
      console.log(` Recived Entity for updating: ` + entity.imageName);
      try {
        // Valid fields , remove the blacklisted fields
        const blacklistedFields = [
          "etag",
          "partitionKey",
          "rowKey",
          "timestamp",
          "auditor",
          // "dateTaken",
          "approvedBy",
          "folder",
          "filetype",
          "uploader",
          "imagePath",
        ];
        const entityKeys = Object.keys(entity);
        const filteredKeys = entityKeys.filter(
          (item) => !blacklistedFields.includes(item)
        );
        const filteredData: any = {};
        filteredKeys.forEach((key) => {
          filteredData[key] = entity[key];
        });
        const buildRowKey = entity.rowKey;
        console.log(` Using Rowkye ${buildRowKey}`);
        // Now also update the Cache so we keep it up to date
        const current: any = myCache.get(`dataCache${this.tableName}`);
        const findOldEntry = current.find(
          (element: any) => element.rowKey === buildRowKey
        );

        if (!findOldEntry) {
          console.log(` Error: No Entry Found for ${buildRowKey}`);
          return "Error";
        }
        const newEntity = {
          partitionKey: "masterFinal",
          rowKey: buildRowKey,
          ...filteredData,
          // dateTaken: findOldEntry.dateTaken,
          imagePath: findOldEntry.imagePath,
          folder: findOldEntry.folder,
          approvedBy: findOldEntry.approvedBy,
          uploader: findOldEntry.uploader,
          filetype: findOldEntry.filetype,
        };
        // check if the newEntity tags are a string or an array, if array convert to string
        if (Array.isArray(newEntity.tags)) {
          // Remove duplicates by converting to a Set, then join back to string
          newEntity.tags = Array.from(new Set(newEntity.tags)).join(",");
        } else {
          // If it's a string, split to array, remove duplicates, then join back to string
          const tagArr = newEntity.tags
            ? newEntity.tags.split(",").map((tag: string) => tag.trim())
            : [];
          newEntity.tags = Array.from(new Set(tagArr)).join(",");
        }

        try {
          await this.client?.updateEntity(newEntity);
        } catch (error) {
          console.log(` Error updating entity: ${error}`);
          return "Error";
        } finally {
          console.log(` Done updating entity: ${entity.imageName}`);
        }

        const updatedCache = current.map((element: any) =>
          element.rowKey === buildRowKey ? newEntity : element
        );

        myCache.set(`dataCache${this.tableName}`, updatedCache, 10000);
        console.log(`Updated entry in cache:`);
        console.log(` New value:`);
        console.log(newEntity);

        // also rebuild map incase something changed
        await this.buildMap(updatedCache);
        Logger.info(` Done updating entity: ${entity.imageName}`);
        return "Success";
      } catch (error) {
        console.log(` ERROR in Table, updating entity: ${error}`);
        return "Error";
      }
    }
  }

  // -> Manual Rebuild the Cache with the data from the table
  public async rebuildCache() {
    Logger.warn(
      `Resettting Cache for ${this.tableName} table, pulling data from Azure Table ....`
    );
    const client = TableClient.fromConnectionString(
      connectionString,
      this.tableName
    );
    const entities = await client.listEntities();
    let holder: any[] = [];

    for await (const entity of entities) {
      // remove etag

      const { etag, ...filteredData } = entity;
      holder.push(filteredData);
    }
    Logger.info(
      `${this.tableName} -  Done pulling data found ${holder.length} entries, Building the  Cache ....  `
    );

    // Save the latest data into cache
    myCache.set(`dataCache${this.tableName}`, holder, 10000);

    // Set the map if the table is YodaheaTable
    if (this.tableName === "YodaheaTable") {
      this.buildMap(holder);
    }
    // Now reset filter by passing manualrefresh as true
    this.getFilters(true);
    Logger.info(`${this.tableName} - Done re-setting cache \n`);
  }

  //-> 'buildMap()' - Function to build a map of the data in the table
  // -- Only applys to YodaheaTable
  private async buildMap(currentCache: any) {
    // build the mpa then save it in its own cache called dataMapCache
    if (this.tableName === "YodaheaTable") {
      if (!currentCache) {
        Logger.error(` No Cache Found for ${this.tableName}`);
        return "Error: No Cache Found";
      }
      const mapData = currentCache.map((item: any) => {
        return {
          imageName: item.imageName,
          imagePath: item.imagePath,
          dateTaken: item.dateTaken,
          imageBase64: item.imageBase64 || "",
        };
      });
      myCache.set(`dataMapCache`, mapData, 10000);
      Logger.info(`***  Done Building Map for ${this.tableName} ....`);
      return "Success";
    } else {
      //  Logger.error(` Error: Invalid Table Name`);
      return null;
    }
  }

  // -> updateCacheData() - Function to update the cache when a change in data occurs.
  async updateCacheData(type: string, entity: any) {
    switch (type) {
      case "individual": {
        try {
          const currentCache: any = myCache.get(`dataCache${this.tableName}`);
          Logger.warn(`Updating the Cache with new entity ....`);
          // Create a object to push into cache

          const fakeEntity = {
            dateTaken: entity.dateTaken,
            title: entity.title,
            description: entity.description,
            tags: entity.tags,
            timestamp: entity.timestamp,
          };
          // Push object into cache
          currentCache.push(fakeEntity);

          // Make cache into current cache
          myCache.set(`dataCache` + this.tableName, currentCache, 10000);

          const viewLast100 = JSON.stringify(currentCache).slice(-200);
          // last 100 characters of cache

          Logger.info("Done Updating Cache : " + viewLast100);
          return currentCache;
        } catch (error) {
          Logger.error("ERROR UPDATING CACHE:" + error);
        }
      }
      case "all": {
        try {
          Logger.warn(`Updating full Cache with new entity ....`);
          // make cache whatever is passed in entity
          myCache.set(`dataCache` + this.tableName, entity, 10000);
          Logger.info(` Cache now: ${JSON.stringify(entity)}`);
        } catch (error) {
          Logger.error("ERROR UPDATING CACHE:" + error);
        }
        break;
      }
      default: {
        Logger.error("ERROR UPDATING CACHE: Invalid type");
        break;
      }
    } //
  }

  //// ********** Helper Functions ********** ////

  // -> 'myUpdateData()'
  // Function for updating entries at specific id in Azure Table.
  public async myUpdateData(data: any) {
    switch (this.tableName) {
    }
  }

  // --> 'returnImage()' - Function to return an image from the table
  public async returnImage(imageName: string) {
    const mapCache: any = myCache.get(`dataMapCache`);
    if (!mapCache) {
      Logger.error(` Error: No Cache Found`);
      return null;
    }
    //console.log(` Searching for Image: ${imageName}`);
    const findImagepath = mapCache.find(
      (element: any) => element.imageName === imageName
    );
    if (!findImagepath) {
      Logger.error(` Error: No Image Found for ${imageName}`);
      return null;
    }
    //logger.warn(` Image Found: ${findImagepath.imagePath}.. getting image`);

    // create search for, if . in then split if not keep normal
    const searchfor = findImagepath.imagePath.includes(".")
      ? findImagepath.imagePath.split(".")[0]
      : findImagepath.imagePath;
    //console.log(`  Downloading Image: ${searchfor}`);
    const searchBlob = await yodaheaBucket.downloadBuffer(searchfor);
    if (!searchBlob) {
      Logger.error(` Error downloading image: ${searchfor}`);
      return null;
    }
    //console.log(` Done Downloading Image: ${searchfor}`);
    return searchBlob;
  }
  // Mini image cache: imagePath -> base64 image content
  /**
   * How it works:
   * 1. When an image is requested, it first checks the mini cache.
   * 2. If the image is found in the mini cache, it returns the base64 content as a Buffer.
   * 3. If not found, it downloads the image from the main storage bucket, converts it to base64, and stores it in the mini cache.
   * 4. The mini cache has a TTL of 10 minutes (600 seconds) and checks every 2 minutes (120 seconds).
   *  TTL means "Time To Live", which is the duration for which the cached data is valid.
   * Purpose:
   * The mini cache is designed to speed up the retrieval of frequently accessed images by storing them in a smaller, faster cache.
   */
  private imageMiniCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

  // --> 'returnImage()' - Function to return an image from the table
  public async returnImageWithImageCache(imageName: string) {
    const mapCache: any = myCache.get(`dataMapCache`);
    if (!mapCache) {
      Logger.error(` Error: No Cache Found`);
      return null;
    }
    const findImagepath = mapCache.find(
      (element: any) => element.imageName.trim() === imageName.trim()
    );
    if (!findImagepath) {
      Logger.error(` Error: No Image Found for ${imageName}`);
      return null;
    }

    // 1. Check if imageBase64 is present in mapCache entry
    if (findImagepath.imageBase64 && findImagepath.imageBase64.length > 0) {
      Logger.info(`Image ${imageName} served from mapCache imageBase64`);
      return Buffer.from(findImagepath.imageBase64, "base64");
    }
    // create search for, if . in then split if not keep normal
    const searchfor = findImagepath.imagePath.includes(".")
      ? findImagepath.imagePath.split(".")[0]
      : findImagepath.imagePath;
    // 2. Check mini image cache first
    const cachedBase64 = this.imageMiniCache.get<string>(searchfor);
    if (cachedBase64) {
      Logger.info(`Image ${searchfor} served from mini cache`);
      // Also update mapCache entry for future
      findImagepath.imageBase64 = cachedBase64;
      myCache.set(`dataMapCache`, mapCache, 10000);
      return Buffer.from(cachedBase64, "base64");
    }

    // 3. Not in mini cache, download from storage
    const searchBlob = await yodaheaBucket.downloadBuffer(searchfor);
    if (!searchBlob) {
      Logger.error(` Error downloading image: ${searchfor}`);
      return null;
    }

    // Store in mini cache as base64
    const base64Content = searchBlob.toString("base64");
    this.imageMiniCache.set(searchfor, base64Content);

    // Update mapCache entry with imageBase64
    findImagepath.imageBase64 = base64Content;
    myCache.set(`dataMapCache`, mapCache, 10000);

    return searchBlob;
  }

  private compressedImageMiniCache = new NodeCache({
    stdTTL: 600, // 10 minutes
    checkperiod: 120, // Check every 2 minutes
  });
  // --> 'returnCompressedImageWithCache()' - Function to return a compressed image from the table with mini cache
  public async returnCompressedImageWithCache(imageName: string) {
    const mapCache: any = myCache.get(`dataMapCache`);
    if (!mapCache) {
      Logger.error(` Error: No Cache Found`);
      return null;
    }
    const findImagepath = mapCache.find(
      (element: any) => element.imageName.trim() === imageName.trim()
    );
    if (!findImagepath) {
      Logger.error(` Error: No Image Found for ${imageName}`);
      return null;
    }

    const searchfor = findImagepath.imagePath.includes(".")
      ? findImagepath.imagePath.split(".")[0]
      : findImagepath.imagePath;

    // Check compressed mini cache first
    const cachedCompressedBase64 =
      this.compressedImageMiniCache.get<string>(searchfor);
    if (cachedCompressedBase64) {
      Logger.info(
        `Compressed image ${searchfor} served from compressed mini cache`
      );
      // Optionally, you can store this in mapCache as well if needed
      findImagepath.compressedImageBase64 = cachedCompressedBase64;
      myCache.set(`dataMapCache`, mapCache, 10000);
      return Buffer.from(cachedCompressedBase64, "base64");
    }

    // Not in mini cache, download original image from storage
    const downloadImage = await yodaheaBucket.downloadBuffer(searchfor);
    if (!downloadImage) {
      Logger.error(` Error downloading image: ${searchfor}`);
      return null;
    }

    // Compress the image
    let compressedBuffer: Buffer | null = null;
    try {
      compressedBuffer = await sharp(downloadImage)
        .rotate()
        .resize(375, 375, {
          fit: "contain",
          withoutEnlargement: true,
          background: { r: 255, g: 255, b: 255 },
        })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .toFormat("webp", { quality: 100 })
        .toBuffer();
    } catch (e) {
      Logger.error("Error compressing image");
      return null;
    }

    if (!compressedBuffer) {
      Logger.error("Error compressing image");
      return null;
    }

    // Store compressed image in mini cache as base64
    const compressedBase64 = compressedBuffer.toString("base64");
    this.compressedImageMiniCache.set(searchfor, compressedBase64);

    // Optionally, update mapCache entry with compressed base64
    findImagepath.compressedImageBase64 = compressedBase64;
    myCache.set(`dataMapCache`, mapCache, 10000);

    return compressedBuffer;
  }
  public async serveCompressedImage(imageName: string) {
    // Logger.warn(` Serving Compressed Image: ${imageName}`);
    const currentCache: any = await myCache.get(`dataMapCache`);
    if (!currentCache) {
      Logger.error(` Error: No Cache Found`);
      return "Error: No Cache Found";
    }
    //logger.warn( ` Searching Compressed for Image: ${imageName}`);
    const materialMatch = currentCache.find(
      (element: any) => element.imageName === String(imageName)
    );
    //logger.warn(` Found Image: ${imageName}: ${materialMatch.imagePath}`);
    if (!materialMatch) {
      logger.error(
        ` Error: No Match Found in table: ${this.tableName} for image: ${imageName}`
      );
      return "Error: No Match Found";
    }
    const constructSearch = materialMatch.imagePath.includes(".")
      ? materialMatch.imagePath.split(".")[0]
      : materialMatch.imagePath;
    //logger.warn(` Searching Compressed for Image: ${imageName} with path: ${constructSearch}`);
    let searchBlob;
    try {
      searchBlob = await compressionBucket.downloadBuffer(constructSearch);
    } catch (error) {
      logger.error(`Error downloading compressed for image ${constructSearch}`);
      searchBlob = null;
    }
    // logger.warn(` Done Searching Compressed for Image: ${imageName}, size is ${searchBlob.length}`);
    if (!searchBlob) {
      logger.error(
        ` Error Image: ${imageName} not found to Compress , attempting to compress`
      );
      const downloadImage = await yodaheaBucket.downloadBuffer(constructSearch);
      if (!downloadImage) {
        logger.error(` Error Image: ${imageName} not found to Compress `);
        return ` Error Image: ${imageName} not found`;
      }
      // make a compressed and upload it
      const compressedBuffer: any = await sharp(downloadImage)
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
      logger.warn(` Compressing Image: ${imageName}`);
      if (!compressedBuffer) {
        console.log("Error compressing image");
        return "Error compressing image";
      }
      try {
        await compressionBucket.uploadBuffer(constructSearch, compressedBuffer);
      } catch (e) {
        console.log("Error uploading compressed image");
      }
      //logger.warn(` Done Compressing Image: ${imageName}`);
      return compressedBuffer;
    }
    return searchBlob;
  }

  // -> getImagesList()
  public async getImagesList() {
    // check if cache exists
    const checkCache: any = myCache.get(`imagesListCache`);
    if (checkCache) {
      Logger.warn(`Cache Found for images list ....`);
      return checkCache;
    } else {
      const imageList = await newimages.listContBlobs();
      // set cache
      myCache.set(`imagesListCache`, imageList, 10000);
      Logger.info(`Done setting cache for images list ....`);
      return imageList;
    }
  }

  //
  public async checkImagesList(inputNameArr: string[]) {
    const imageList = await this.getImagesList();
    const imageListWithoutExt = imageList.map(
      (element: any) => element.split(".")[0]
    );

    const newFileNames: string[] = [];
    for (const inputName of inputNameArr) {
      console.log(` Chekcing for ${inputName}  `);
      const inputWithoutExt = inputName.split(".")[0];
      const ext = inputName.split(".")[1];
      const existingNames = imageListWithoutExt.filter(
        (element: any) =>
          element.toLowerCase() === inputWithoutExt.toLowerCase()
      );
      const lengthOfExisting = existingNames.length;
      const newFileName =
        lengthOfExisting > 0
          ? `${inputWithoutExt} (${lengthOfExisting}).${ext}`
          : inputName;
      console.log(` New File Name: ${newFileName}`);
      newFileNames.push(newFileName);

      // const existingCount = existingNames.length;
      // const newFileName =
      //   existingCount > 0
      //     ? `${inputWithoutExt} (${existingCount}).${ext}`
      //     : inputName;
      // newFileNames.push(newFileName);
    }
    return newFileNames;
  }

  public async newUploadProcess(
    ReqFiles: any,
    imageMeta: any[],
    tableName: string
  ) {
    // Now instead of one desc and meta data for one image, we will be recieving multiple images with there own meta data in an array

    Logger.warn(
      ` All Data recieved is : ${JSON.stringify(
        imageMeta.map((item) => item.imagePath)
      )}`
    );

    const filenames = ReqFiles.map((item: any) => item.originalname);
    Logger.warn(` All Files recieved is : ${JSON.stringify(filenames)}`);
    const allFiles = ReqFiles;

    const imagesArray = allFiles;

    for (let images of imagesArray) {
      const findData = imageMeta.find(
        (element: any) => element.imagePath === images.originalname
      ); //
      if (!findData) {
        Logger.error(` No Data Found for image: ${images.originalname}`);
        return "Error: No Data Found";
      }
      console.log(` Data Found for image: ${images.originalname}`);
      //

      try {
        let dateTaken = findData.dateTaken;
        const description = findData.description;
        const uploader = findData.uploader || "No User";
        const notes = findData.notes;
        const approvedBy = "Unapproved";
        const filetype = findData.filetype;
        const tags = findData.tags;
        const imagePath = findData.imagePath;
        const imageName = findData.imageName;
        if (!dateTaken || dateTaken === "" || dateTaken === undefined) {
          dateTaken = "No Date";
        }

        const entity: masterMap2Props = {
          partitionKey: "masterFinal",
          rowKey: "RKey-" + images.originalname.split(".")[0],
          notes: notes,
          imageName: imageName,
          description: description,
          tags: tags,
          uploader: uploader,
          approvedBy: approvedBy,
          dateTaken: dateTaken,
          folder: "",
          filetype: filetype,
          imagePath: images.originalname,
        };

        // Check if the entity already exists
        let checkCache: any = myCache.get(`dataCache${this.tableName}`); //
        if (!checkCache) {
          logger.error(` No Cache Found for ${this.tableName}`);
          return "Error: No Cache Found";
        }
        const checkEntity = checkCache.find(
          (element: any) => element.rowKey === entity.rowKey
        ); //
        if (checkEntity) {
          Logger.error(` Entity already exists: ${entity.rowKey}`);
        } else {
          // Insert the entity into the table
          await this.client?.createEntity(entity);
          console.log(` Inserting : ${JSON.stringify(entity)}`);
          // Update the cache to keep it current
          try {
            const checkCache: any = myCache.get(`dataCache${this.tableName}`);
            checkCache.push(entity);
            myCache.set(`dataCache${this.tableName}`, checkCache, 10000);
          } catch (error) {
            Logger.error(
              `Error updating cache: ${error} for Table ${this.tableName}`
            );
          }
        }
        console.log(
          `\n Inserted new entities from User: ${uploader}, moving on to uploading data`
        );
      } catch (error) {
        Logger.error(` Error creating entity: ${error}`);
        return "Error creating entity";
      }
    }
    // if the tableName is Yodahea
    if (tableName === "YodaheaTable" || tableName === "Yodahea") {
      await yodaheaBucket.uploadMulter(ReqFiles);
      await compressionBucket.uploadMulterCompress(ReqFiles);
    } else {
      await newimages.uploadMulter(ReqFiles);
    }
  }
  public async insertEntity(data: any) {
    if (!data.partitionKey || !data.rowKey) {
      Logger.error(`Error: PartitionKey and RowKey must be defined`);
      return "Error: PartitionKey and RowKey must be defined";
    } else {
      try {
        await this.client?.createEntity(data);
      } catch (error) {
        Logger.error(`Error inserting : ${error}`);
        return `Error: ${error}`;
      }
    }
  }

  public async manualGetData() {
    const entities = await this.client?.listEntities();
    if (!entities) {
      Logger.error(`No entities found`);
      return "No entities found";
    }
    // pushing all data into array 'holder' which is then filtered
    let holder: any[] = [];

    for await (const entity of entities) {
      holder.push(entity);
    }
    return holder;
  }

  // **********  Helper Functions  ********** //

  public async getFilters(manualRefresh: boolean = false) {
    const checkCache: any = myCache.get(`dataCache${this.tableName}Filters`);
    if (checkCache && !manualRefresh) {
      Logger.warn(`Cache Found for filters of table ${this.tableName} ....`);
      return checkCache;
    } else {
      // get the tables cache
      const dataCache: any = myCache.get(`dataCache${this.tableName}`);
      let tags: { tagName: string; tagCount: number; tagColor?: string }[] = [];
      // if there's no cache, build it
      if (!dataCache) {
        Logger.error(
          `No Cache Found for ${this.tableName}, cache must be set before using`
        );
        return [];
      } else {
        // if manualrefresh passed display a logger
        if (manualRefresh) {
          Logger.warn(`Manual Refresh of Filters for ${this.tableName}`);
        }
        // make a set of all tags with their counts
        dataCache.forEach((item: any) => {
          let tagsSplit: any = item.tags
            ? item.tags.split(",").filter((tag: any) => tag !== "")
            : [];
          // remove blank spaces from items
          tagsSplit = tagsSplit.map((tag: any) => tag.trim());
          tagsSplit.forEach((tag: string) => {
            const existingTag = tags.find((t) => t.tagName === tag);
            if (existingTag) {
              existingTag.tagCount++;
            } else {
              tags.push({ tagName: tag, tagCount: 1 });
            }
          });
        });
        // sort tags alphabetically
        tags = tags.sort((a, b) => a.tagName.localeCompare(b.tagName));

        // Assign tagColor to each tag
        const startColor = 0xff0000; // Start from red (#ff0000)
        //const increment = 0x000a0a; // Smaller increment for smoother color transition
        const increment = 0x001122; // Increment by this hex value for each tag
        tags.forEach((tag, idx) => {
          let color = (startColor + increment * idx) & 0xffffff;
          tag.tagColor = `#${color.toString(16).padStart(6, "0")}`;
        });

        // set the cache
        myCache.set(`dataCache${this.tableName}Filters`, tags, 10000);

        return tags;
      }
    }
  }

  public async refreshFilters() {
    logger.warn(`Refreshing Filters for ${this.tableName}`);
    myCache.del(`dataCache${this.tableName}Filters`);
    const newFilters = await this.getFilters();
    // set chach
    myCache.set(`dataCache${this.tableName}Filters`, newFilters, 10000);
    logger.warn(`Filters Refreshed for ${this.tableName}`);
  }

  //const currentCache: any = await myCache.get(`dataMapCache`);

  public async refreshMapCache() {
    logger.warn(`Refreshing Map for ${this.tableName}`);
    myCache.del(`dataMapCache`);
    const newMap = await this.buildMap(
      myCache.get(`dataCache${this.tableName}`)
    );
    // set chach
    myCache.set(`dataMapCache`, newMap, 10000);
    logger.warn(`Map Refreshed for ${this.tableName}`);
  }

  // -. 'approveImages()' - this method updates 'approvedBy' field to user who approved the image
  public async approveImages(imagename: string, user: string) {
    const checkCache: any = myCache.get(`dataCache${this.tableName}`);
    if (checkCache) {
      Logger.warn(` Approving image: ${imagename} for user: ${user} ....`);
      checkCache.map(async (item: any) => {
        if (item.title === imagename) {
          item.approvedBy = user;
          try {
            Logger.info(
              ` Image found ${JSON.stringify(
                item
              )} updating data to approved now !`
            );
            // onject needs a partitionKey and rowKey before updating
            item.partitionKey = "PKey-yodadata";
            item.rowKey = "RKey-" + item.dateTaken;
            await this.client?.updateEntity(item);
            // Update the cache
            this.updateCacheData("all", checkCache);
          } catch (error) {
            Logger.error(`Error updating data to approved` + error);
          }
        }
      });
    } else {
      Logger.error(
        `No Cache Found for ${this.tableName}, cache must be set before using`
      );
      return [];
    }
  }

  // -> getCacheSummary - Function to display info on current cache
  public async getCacheSummary() {
    const FullCache = [
      {
        dataCache: myCache.get(`dataCache${this.tableName}`),
        ColumnCache: myCache.get(`dataNameCache${this.tableName}`),
        StatsCache: myCache.get(`dataStatsCache${this.tableName}`),
      },
    ];
    // Check if the caches are empty
    FullCache.map((item: any) => {
      Logger.warn(`Checking cache of ${this.tableName} ....
       Item cache Empty?: ${isEmpty(item.dataCache)} 
       Column cache Empty?: ${isEmpty(item.ColumnCache)} 
       Stats cache Empty?: ${isEmpty(item.StatsCache)}`);
    });

    return FullCache;
  }
  public async checkMapCache() {
    const mapCache: any = myCache.get(`dataMapCache`);
    if (!mapCache) {
      Logger.error(` No Map Cache Found for ${this.tableName}`);
      return "Error: No Map Cache Found";
    }
    Logger.info(` Map Cache Found for ${this.tableName}`);
    return mapCache;
  }

  // -> Error catcher function
  private catcher(err: any) {
    if (err.statusCode !== 409) {
      throw err;
    }
  }
  // -> Function to create the table
  public async createTable() {
    await this.client?.createTable().catch(this.catcher);
  }

  public async totalNumnberUnmatched() {
    const checkCache: any = myCache.get(`dataCache${this.tableName}`);
    if (!checkCache) {
      return "Error: No Cache Found";
    }
    const noDates = checkCache.filter(
      (item: any) =>
        item.dateTaken === "No Date" ||
        item.dateTaken === "" ||
        item.dateTaken === undefined ||
        !item.dateTaken
    );
    return noDates.length;
  }

  // given the partiton and row key, delete entry from table

  public async straightDelete(partitionKey: string, rowKey: string) {
    try {
      await this.client?.deleteEntity(partitionKey, rowKey);
      return "Success Deleting";
    } catch (error) {
      Logger.error(` Error deleting entity: ${error}`);
      return "Error deleting entity";
    }
  }

  public async straightQuery() {
    // just return all data from table
    const entities = await this.client?.listEntities();
    if (!entities) {
      Logger.error(`No entities found`);
      return [];
    } else {
      const holder = [];
      // dont pass the etag
      for await (const entity of entities) {
        holder.push(entity);
      }
      return holder;
    }
    // pushing all data into array 'holder' which is then filtered
  }

  /** For Journal Entries */

  public async journalChangetitle(
    oldTitle: string,
    newTitle: string,
    foldername: string,
    tripNumber: any
  ) {
    logger.warn(
      `For Change ${newTitle} , searching for Title: ${oldTitle} in folder: ${foldername} and trip number: ${tripNumber}`
    );

    const oldEntryForTitle = await this.client?.getEntity<journalTypes>(
      "journal",
      `${foldername}-${oldTitle}`
    );

    if (!oldEntryForTitle) {
      logger.error(
        `No entry found for title: ${oldTitle} in folder: ${foldername}`
      );
      return "Error: No entry found";
    }
    try {
      const newEntity: journalTypes = {
        partitionKey: "journal",
        rowKey: `${foldername}-${newTitle}`,
        name: newTitle,
        folder: foldername,
        images: oldEntryForTitle.images,
        startDate: oldEntryForTitle.startDate,
        endDate: oldEntryForTitle.endDate,
        tripNumber: oldEntryForTitle.tripNumber,
      };
      // create new entity
      await this.client?.createEntity(newEntity);
      logger.info(
        `Successfully created new entry with title: ${newTitle} in folder: ${foldername} for old title: ${oldTitle}`
      );

      // delete old entry
      await this.client?.deleteEntity("journal", `${foldername}-${oldTitle}`);

      return true;
    } catch (error) {
      logger.error(`Error occured during title change, please try again`);
      return null;
    }
  }
}
