import { TableClient, TableEntity, TableTransaction } from "@azure/data-tables";

import Logger from "../utils/logger";
import { isEmpty } from "lodash";
import NodeCache from "node-cache";

import {
  compressionBucket,
  deletedBucket,
  newimages,
  yodaheaBucket,
} from "./blobs";
import { masterMap2Props } from "./masterdata";
import { auditsTypes } from "./audits";

const connectionString = "UseDevelopmentStorage=true";

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
    this.myGetData();
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
  private async initializeMaster() {
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
        delete entity.date_Taken;

        const { etag, ...filteredData } = entity;
        holder.push(filteredData);
      }

      // Sort holder by dateTaken
      holder = holder.sort((a, b) => {
        return Number(a.dateTaken) - Number(b.dateTaken);
      });

      Logger.info(
        `${this.tableName} -  Done pulling data, sorting..... found ${holder.length} entries, Building the  Cache ....  `
      );

      // Save the latest data into cache
      myCache.set(`dataCache${this.tableName}`, holder, 10000);

      Logger.info(
        `${this.tableName} - Done setting cache, Returning data from table \n`
      );
      return holder;
    }
  }
  private async initialize() {
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

      Logger.info(
        `${this.tableName} - Done setting cache, Returning data from table \n`
      );
      return holder;
    }
  }
  private async searchData(search: string) {
    Logger.warn(`Searching for ${search} in ${this.tableName} table ....`);
    const currentCache: any = myCache.get(`dataCache${this.tableName}`);
    // make all images lowercase

    const searchResult = currentCache.filter((element: any) => {
      const tempelement = element.imageName.toLowerCase();
      return tempelement.includes(search.toLowerCase());
    });
    if (searchResult.length === 0) {
      Logger.error(`No results found for ${search}`);
      return "No results found";
    }
    return searchResult;
  }

  // -> 'myGetData()'
  // * Function for getting all data entries from Azure Table.

  public async myGetData() {
    // if no search is provided, return all data

    switch (this.tableName) {
      case "masterFinal": {
        Logger.warn(`Getting data for ${this.tableName} table ....`);

        const intialData: any = await this.initializeMaster();
        let noDates = intialData.filter(
          (item: any) => item.dateTaken === "No Date"
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

        return masterData;

        //return this.initializeMaster();
        break;
      }
      case "YodaheaTable": {
        Logger.warn(`Getting data for ${this.tableName} table ....`);

        const intialData: any = await this.initializeMaster();
        let noDates = intialData.filter(
          (item: any) => item.dateTaken === "No Date"
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

        return masterData;

        //return this.initializeMaster();
        break;
      }
      case "compressiontable": {
        return this.initialize();
        break;
      }

      case "tagsdata": {
        return this.initialize();
        break;
      }
      case "audits": {
        return this.initialize();
        break;
      }
      default:
        Logger.error("Invalid tablename: " + this.tableName);
        return "Error: Invalid tablename";
      // return "Error getting data";
    }
  }
  public async myGetDataLimit(start: number, limit: number) {
    // if no search is provided, return all data

    switch (this.tableName) {
      case "masterFinal": {
        Logger.warn(
          `Getting data for ${this.tableName} table with Start limit ${start} - ${limit} ....`
        );

        const intialData: any = await this.initializeMaster();
        let noDates = intialData.filter(
          (item: any) => item.dateTaken === "No Date"
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

        //return this.initializeMaster();
        break;
      }
      case "YodaheaTable": {
        Logger.warn(
          `Getting data for ${this.tableName} table with Start limit ${start} - ${limit} ....`
        );

        const intialData: any = await this.initializeMaster();
        let noDates = intialData.filter(
          (item: any) => item.dateTaken === "No Date"
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

        //return this.initializeMaster();
        break;
      }

      case "tagsdata": {
        return this.initialize();
        break;
      }
      case "audits": {
        return this.initialize();
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

  public async getExactDataByImageName(imageName: string) {
    const currentCache: any = myCache.get(`dataCache${this.tableName}`);
    const searchResult = currentCache.filter(
      (element: any) => element.imageName === imageName
    );
    if (searchResult.length === 0) {
      Logger.error(`No results found for ${imageName}`);
      return "No results found";
    }
    return searchResult;
  }
  public async numberOfImages() {
    const currentCache: any = myCache.get(`dataCache${this.tableName}`);
    return currentCache.length;
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
    Logger.warn(`Deleting data  ${entity.imageName}`);

    // archive the image by uploading its data into the deletedImages bucket

    try {
      await newimages.deleteBlob(entity.imageName);
    } catch (error) {
      Logger.error(` Error deleting entity: ${error}`);
      return "Error deleting entity";
    }

    // now dlete entry from table
    try {
      await this.client?.deleteEntity("masterFinal", "RKey-" + deleteid);
      Logger.info(` Deleted entity: ${entity.imageName}`);
    } catch (error) {
      Logger.error(` Error deleting entity: ${error}`);
      return "Error deleting entity";
    }

    // update cache
    const currentCache: any = myCache.get(`dataCache${this.tableName}`);
    const deleteOld = currentCache.filter(
      (element: any) => element.rowKey !== entity.rowKey
    );
    myCache.set(`dataCache${this.tableName}`, deleteOld, 10000);
    Logger.info(` Done deleting entity: ${entity.imageName}`);

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

      // console.log(
      //   ` Ising New Entity: ${JSON.stringify(
      //     newEntity
      //   )} \n Found Old Entry: ${JSON.stringify(findOldEntry)}`
      // );
      // move the folder, dateTaken and timestamp to new entity
      // const newEntity = {
      //   ...entity,
      //   folder: findOldEntry.folder,
      //   dateTaken: findOldEntry.dateTaken,
      //   auditor: findOldEntry.auditor,
      // };
      await this.client?.updateEntity(newEntity);

      const deleteOld = current.filter(
        (element: any) => element.rowKey !== buildRowKey
      ); //
      const newCache = [...deleteOld, newEntity];
      myCache.set(`dataCache${this.tableName}`, newCache, 10000);
      Logger.info(` Done updating entity: ${entity.imageName}`);
      return "Success";
    } catch (error) {
      console.log(` ERROR in Table, updating entity: ${error}`);
      return "Error";
    }
  }
  //// Azure Functions ////

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

  public async renameImage(oldName: string, newName: string) {
    let checkCache: any = myCache.get(`dataCachemasterFinal`);
    if (!checkCache) {
      checkCache = this.myGetData();
    }

    let getMatch = checkCache.find(
      (element: any) => element.imageName === oldName
    );
    if (!getMatch) {
      return "Error: No Match Found";
    }

    getMatch.imageName = newName;

    try {
      await this.client?.updateEntity(getMatch);
    } catch (error) {
      Logger.error(` Error updating entity: ${error}`);
      return "Error updating entity";
    }
    // update cache
    const currentCache: any = myCache.get(`dataCachemasterFinal`);
    const deleteOld = currentCache.filter(
      (element: any) => element.rowKey !== getMatch.rowKey
    );
    const newCache = [...deleteOld, getMatch];
    myCache.set(`dataCachemasterFinal`, newCache, 10000);
    return "Success";
  }

  public async serveImage(imageName: string, tableName: string) {
    // the imageName will not have the extension so we need to find it in the masterFinal table first
    // assume the cache is already set
    if (tableName === "Yodahea") {
      const currentCache: any = myCache.get(`dataCacheYodaheaTable`);

      const materialMatch = currentCache.find(
        (element: any) => element.imageName === imageName
      );
      const constructSearch = materialMatch.imagePath;
      const searchBlob = await yodaheaBucket.downloadBuffer(constructSearch);
      if (!searchBlob) {
        return "Error: Image not found";
      }
      return searchBlob;
    } else {
      const currentCache: any = myCache.get(`dataCachemasterFinal`);

      const materialMatch = currentCache.find(
        (element: any) => element.imageName === imageName
      );
      const constructSearch = materialMatch.imagePath;
      const searchBlob = await newimages.downloadBuffer(constructSearch);
      if (!searchBlob) {
        return "Error: Image not found";
      }
      return searchBlob;
    }
  }
  public async serveCompressedImage(imageName: string) {
   // Logger.warn(` Serving Compressed Image: ${imageName}`);
    const currentCache: any = await myCache.get(`dataCache`+this.tableName);
    if (!currentCache) {
      Logger.error(` Error: No Cache Found`);
      return "Error: No Cache Found";
    }
    const materialMatch = currentCache.find(
      (element: any) => element.imageName === imageName
    );
    const constructSearch = materialMatch.imagePath.split(".")[0];
    const searchBlob = await compressionBucket.downloadBuffer(constructSearch);
    if (!searchBlob) {
      return "Error: Image not found";
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
          checkCache = this.myGetData();
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
    if (tableName === "Yodahea") {
      await yodaheaBucket.uploadMulter(ReqFiles);
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

  public async getFilters() {
    const checkCache: any = myCache.get(`dataCache${this.tableName}Filters`);
    if (checkCache) {
      Logger.warn(`Cache Found for filters of table ${this.tableName} ....`);
      return checkCache;
    } else {
      // get the tables cache
      const dataCache: any = myCache.get(`dataCache${this.tableName}`);
      let tags: any[] = [];
      // if theres no cache, build it
      if (!dataCache) {
        Logger.error(
          `No Cache Found for ${this.tableName}, cache must be set before using`
        );
        return [];
      } else {
        // make a set of all tags
        dataCache.map((item: any) => {
          let tagsSplit: any = item.tags
            .split(",")
            .filter((item: any) => item !== "");
          // remove blank spaces from items
          tagsSplit = tagsSplit.map((item: any) => item.trim());
          // then sort alphabetically using localeCompare

          tags.push(...tagsSplit);
        });
        tags = tags.sort((a, b) => a.localeCompare(b));
        const setted = [...new Set(tags)];
        // set the cache
        myCache.set(`dataCache${this.tableName}Filters`, setted, 10000);

        return setted;
      }
    }
  }

  // -> 'getUnapprovedImages()' - this method reutnrs the data from table with the  'approvedBy' field as 'Unapproved'
  public async getUnapprovedImages() {
    Logger.warn(`Searching for unapproved images ....`);
    const checkCache: any = myCache.get(`dataCache${this.tableName}`);
    if (checkCache) {
      const unapprovedArr = checkCache.filter(
        (element: any) => element.approvedBy === "Unapproved"
      );
      Logger.info(unapprovedArr.length + " Unapproved images found ");
      return unapprovedArr;
    } else {
      Logger.error(
        `No Cache Found for ${this.tableName}, cache must be set before using`
      );
      return [];
    }
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
}
