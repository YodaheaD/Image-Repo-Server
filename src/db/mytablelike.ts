import { TableClient, TableEntity, TableTransaction } from "@azure/data-tables";

import Logger from "../utils/logger";
import { isEmpty, partition } from "lodash";
import NodeCache from "node-cache";
import { decodeUser, imageFolderAssignment } from "../utils/helpers";
import { pusherServer } from "../utils/pusher";
import { v4 as uuidv4 } from "uuid";
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { UploadProps, masterMapProps } from "../utilities/types";
import { newimages } from "./blobs";
import { masterMap2Props } from "./masterdata";
import { auditsTypes } from "./audits";

const connectionString = "UseDevelopmentStorage=true";

// Create a node cache
const myCache = new NodeCache();
interface userinfoProps {
  username: string;
  token: string;
}
// Function to decode token
const decode = (token: any) =>
  decodeURIComponent(
    atob(token.split(".")[1].replace("-", "+").replace("_", "/"))
      .split("")
      .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
      .join("")
  );

export default class TableLike<Type extends TableEntity<object>> {
  private client?: TableClient;

  constructor(
    public readonly tableName: string,
    public tableData?: any,
    public table1Data?: any,
    public authJWT1Data?: any,
    public tableStats?: any,
    public tableColumns?: any,
    public authUsersList?: any
  ) {
    this.client = TableClient.fromConnectionString(connectionString, tableName);
    this.createTable();
    this.authUsersList = this.getAuthorizedTable();
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
   * -> 'myDeleteData()' & 'getSingleData()' & 'myUpdateData()'
   * Function for deleting, updating, getting single data entries at specific id in Azure Table.
   * 

   * -> getColumns()
   * Function to get column names from table, only available for items table.
   * 
   * -> getCacheSummary()
   * Function to return all cached values in table.
   * 
   * -> getAuthorizedTable()
   * Function to for gathering authenticated users from Azure Table.
   * 
   * -> verifyWAzure()
   * Function to verify an Azure Oauth User.
   * 
   * -> updateAuthJWTdata()
   * This function bridges the Oauth login with the Azure Table.
   * 
   * -> updateCacheData()
   * Function to update the cache when a change in data occurs.
   * 
   *  Authentication Functions
   * ______________________
   * 
   * 
   * -> `fullAuthCheck()` & 'verifyWAzure()'
   * Functions for local and Azure Active Directory authentication.
   * 
   * 
   * -> 'provideToken()' and 'provideTokenNoAuth()'
   * Function to verify username and password then provide saved token data.
   * 
   * -> 'updateToken()' and 'updateTokenNoAuth()'
   * Function to update token data.   
   *  
   * -> 'checkUserPassword()'
   * Checks if the password entered by the user matches the password in the database.
   * 
   * -> 'checkUserExists()'
   * Function that checks if username exists already.
   * 
   * 
   */

  // Function to add entity to table
  // public async insertEntity(entity: Type) {
  //   const newent = JSON.stringify(entity);
  //   const parsed = JSON.parse(newent);
  //   Logger.info(`Inserting entity to ${this.tableName} table :
  //   ${JSON.stringify(parsed)}
  //  `);
  //   await this.client?.createEntity(entity).catch(this.catcher); //
  // } //

  //  Function to List entities (not functional yet, use myGetData())
  public listEntities() {
    return this.client?.listEntities<Type>();
  }

  private async initialize() {
    Logger.warn(` ${this.tableName} - Searching for  Cache ....`);

    const checkCache = myCache.get(`dataCache${this.tableName}`);
    if (checkCache) {
      Logger.info(`${this.tableName} - Cache Found, returning Cache!`);

      return checkCache;
    } else {
      Logger.warn(`${this.tableName} - No Cache Found for table ....`);
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
        `${this.tableName} - Done pulling data found ${holder.length} entries, Setting the  Cache ....  `
      );

      // Save the latest data into cache
      myCache.set(`dataCache${this.tableName}`, holder, 10000);

      Logger.info(
        `${this.tableName} - Done setting cache, Returning data from table \n`
      );
      return holder;
    }
  }

  // -> 'myGetData()'
  // * Function for getting all data entries from Azure Table.

  public async myGetData() {
    switch (this.tableName) {
      case "masterFinal": {
        return this.initialize();
        break;
      }
      case "authJWT": {
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

  // -> 'getSingleData()'
  // * Function for getting single data entries from Azure Table.
  // Currently only used when checking user password.
  public async GetSingleData(username: string) {
    const entity: any = await this.client?.getEntity(
      "PKey-" + username,
      "RKey-" + username
    );
    try {
      const currentUsername = entity.username;
      const currentPassword = entity.password;
      const TableToken = entity.token;
      return entity;
    } catch (error) {
      Logger.error(error);
    }
    return "ERROR getting data";
  }

  // -> 'myDeleteData()'
  // Function for deleting entries at specific id in Azure Table.
  public async myDeleteData(entity: any) {
    const deleteid = entity.imageName;
    Logger.warn(`Deleting data  ${entity.imageName}`);

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

  public async auditHandler(type: string, newdata: any, oldData?: any) {
    const unixTime = new Date().getTime();

    if (!newdata) {
      return "Error: No data recieved in the request";
    }
    if (type === "Update") {
      if (this.tableName === "audits") {
        const rowKey = `RKey-${newdata.imageName}-${unixTime}-Update-${newdata.auditor}`;
        const entity: auditsTypes = {
          partitionKey: `Audits-${newdata.imageName}`,
          rowKey: rowKey,
          auditTime: unixTime.toString(),
          imageName: newdata.imageName,
          description: newdata.description,
          auditor: newdata.uploader,
          approvedBy: newdata.approvedBy,
          auditApprover: "Unapproved",
          auditType: "Update",
          previousValue: JSON.stringify(oldData),
          newValue: JSON.stringify(newdata),
        };

        try {
          console.log(` Inserting Audit for Rowkey: ${rowKey}`);
          await this.client?.createEntity(entity);
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
          approvedBy: newdata.approvedBy,
          auditApprover: "Unapproved",
          auditType: "Delete",
          previousValue: "",
          newValue: "",
        };

        try {
          await this.client?.createEntity(entity);
          return "Audit Created";
        } catch (error) {
          console.log(` ERROR creating audit for Rowkey: ${rowKey}+ ${error}`);
          return "Error creating audit";
        }

        return "Audit Created";
      }
    }
  }
  async updateEntity(entity: any) {
    try {
      delete entity.auditor;
      // Now also update the Cache so we keep it up to date
      const current: any = myCache.get(`dataCache${this.tableName}`);
      const findOldEntry = current.find(
        (element: any) => element.rowKey === entity.rowKey
      );
      // move the folder, dateTaken and timestamp to new entity
      const newEntity = {
        ...entity,
        folder: findOldEntry.folder,
        date_Taken: findOldEntry.dateTaken,
        timestamp: "",
      };
      await this.client?.updateEntity(newEntity);

      const deleteOld = current.filter(
        (element: any) => element.rowKey !== entity.rowKey
      ); //
      const newCache = [...deleteOld, newEntity];
      myCache.set(`dataCache${this.tableName}`, newCache, 10000);
      return "Success";
    } catch (error) {
      console.log(` ERROR updating entity: ${error}`);
      return "Error";
    }
  }
  //// Azure Functions ////

  // -> verifyWAzure()
  // * Function to verify an Azure Oauth User
  // Process is as follows:
  /*
   1) Function receives token from user then decodes contents
   2) First the username is checked from a list of authorized users, cache is available
   3) If valid, function then compares token received to token in database,
       * token is being updated via http request from client, using next-auth
   4) If valid, function returns true, else returns false. */
  async verifyWAzure(token: any) {
    Logger.warn(`Verifying token...`);
    if (myCache.has(`authUsersCache`)) {
      try {
        // This code is used when cache is available
        Logger.http(
          `Token recieved by Auth function: \n\n${
            token /**.slice(0, 10) */
          } \n\n`
        );
        // 1) Function receives token from user then decodes contents
        const decodedData: any = decode(token);
        const userData = JSON.parse(decodedData);
        const authUsersList: any = myCache.get(`authUsersCache`);

        // 2) First the username is checked from a list of authorized users
        Logger.http(`Searching cache for user email: ${userData.email}`);
        const userCheck = authUsersList.find(
          (element: any) => element === userData.email
        );

        //  3) If valid, function then compares token received to token in database,
        if (userCheck) {
          Logger.http(`User Found! verifying token...`);
          const entity: any = await this.client?.getEntity(
            "PKey-" + userData.email,
            "RKey-" + userData.email
          ); //  console.log(`Token in DB: ${token}`)

          // 4) If valid, function returns true, else returns false.
          if (token === entity.token) {
            Logger.http(
              `Token verified! All checks complete! Providing access to data...`
            );
            return true;
          } else {
            // This is the case when the token is not valid
            Logger.error(`ERROR: Error verifying token!`);
            return "Token invalid";
          }
        } else {
          // This is the case when the user is not found in authoized users list
          Logger.error(`User Not Found, token invalid!`);
          return "User Not Found";
        }
      } catch (error) {
        // This is the case when the token could not be decoded
        Logger.error(`ERROR: Could not decode token!`);
        return "Token invalid!";
      }
    } else {
      // This code is used when cache is NOT available
      Logger.warn(
        `No cache found for ${this.tableName}, pulling data from Azure...`
      );

      // We call on this function getAuthorizedTable() to get auth users and build a cache for us to use.
      this.getAuthorizedTable();
      Logger.info(
        `Done pulling data from Auth table and creating cache. \n beginning verification...`
      );
      try {
        // Now we execute the same code as above

        // 1) Function receives token from user then decodes contents
        const decodedData: any = decode(token);
        const userData = JSON.parse(decodedData);
        const authUsersList: any = myCache.get(`authUsersCache`);

        // 2) First the username is checked from a list of authorized users
        Logger.warn(`Searching cache for user email: ${userData.email}`);
        const userCheck = authUsersList.find(
          (element: any) => element === userData.email
        );

        //  3) If valid, function then compares token received to token in database,
        if (userCheck) {
          Logger.info(`User Found! verifying token...`);
          const entity: any = await this.client?.getEntity(
            "PKey-" + userData.email,
            "RKey-" + userData.email
          ); //  console.log(`Token in DB: ${token}`)

          // 4) If valid, function returns true, else returns false.
          if (token === entity.token) {
            Logger.info(
              `Token verified! All checks complete! Providing access to data...`
            );
            return true;
          } else {
            // This is the case when the token is not valid
            Logger.error(`ERROR: Error verifying token!`);
            return "Token invalid";
          }
        } else {
          // This is the case when the user is not found in authoized users list
          Logger.error(`User Not Found, token invalid!`);
          return "User Not Found";
        }
      } catch (error) {
        // This is the case when the token could not be decoded
        Logger.error(`ERROR: Could not decode token!`);
        return "Token invalid!";
      }
    }
  }

  // -> updateAuthJWTdata() - This function bridges the Oauth login with the Azure Table
  // This function is used in the route called by the client Oauth middleware.
  // When the client signs in with Oauth, the client sends the token to the server.
  // --: If user is found in the authJWT table, the token is updated.
  // --: If user is not found in the authJWT table, a new user is created.
  async updateAuthJWTdata(userinfo: any) {
    Logger.http("Logging in Microsoft user ...");

    // Gathering the client information from the token
    const decodedData: any = decode(userinfo);
    const userData = JSON.parse(decodedData);
    Logger.warn(`Checking token of client: ${userData.email}`);

    const partitionKey = "PKey-" + userData.email;
    const rowKey = "RKey-" + userData.email;

    try {
      // This code is completed if the user is found in the authJWT table
      Logger.http("Updating token...");

      const entityToUpdate = {
        partitionKey: partitionKey,
        rowKey: rowKey,
        token: userinfo, // Replace the token in table with the current value of the property
        isLoggedIn: "Logged In",
      };
      await this.client?.updateEntity(entityToUpdate);
      Logger.http("Success updating token.");
    } catch (error) {
      // This code is completed if the user is NOT found in the authJWT table
      Logger.warn(
        "ERROR: User not found ... \n *** Creating new user instead ***"
      );
      try {
        // Creating a new user in the authJWT table
        await this.client?.createEntity({
          partitionKey: partitionKey,
          rowKey: rowKey,
          username: userData.email,
          password: "password",
          hashed: "password",
          token: userinfo,
          isLoggedIn: "Logged In",
        });
        Logger.info(`Done creating new user: ${userData.email}`);
        // Using pusher server set the new username and token to the client
        const username = userData.email;
        // await pusherServer.trigger("my_channel", "my_event", {
        //   data: { username, userinfo },
        // }); ////
        return {
          response: {
            message: "Success",
            token: userinfo,
            username: username,
          },
        };
      } catch (error) {
        // Error for failure to create a user in the table
        Logger.error("ERROR: Failed to create new user.");
        return "Error";
      }
    }

    // Once all is done display the users email
    Logger.info(`Updating data with username ${userData.email} `);
    return {
      response: {
        message: "Success",
        token: userinfo,
        username: userData.email,
      },
    };
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
            date_Taken: entity.date_Taken,
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

  //// ********** Authentication Functions ********** ////
  // -> 'checkUserExists()'
  // Function that accepts RKey and PKey to check if entry exists at position.
  public async checkUserExists(username: string) {
    let ErrorMessage = "ERROR -> Not found";
    let Checker = false;
    try {
      const entity: any = await this.client?.getEntity(
        "PKey-" + username,
        "RKey-" + username
      );
      Checker = true;
      return Checker;
    } catch (error) {
      return false;
    }
  }

  // -> 'myUpdateData()'
  // Function for updating entries at specific id in Azure Table.
  public async myUpdateData(data: any) {
    switch (this.tableName) {
    }
  }

  // -> 'checkUserPassword()'
  //-> Check if user and password match, returns true if they do.
  public async checkUserPassword(username: string, password: string) {
    let usernameData: any[] = [];
    let passwordData: any[] = [];
    const client = TableClient.fromConnectionString(
      connectionString,
      this.tableName
    );
    let userCheck = false;
    let passwCheck = false;

    const entities = await client.listEntities();
    // Pushing entity data into an Array

    for await (const entity of entities) {
      usernameData.push(entity.username);
      passwordData.push(entity.password);
    }

    // Use .find method to check if username exists in the array
    if (usernameData.find((element) => element === username)) {
      userCheck = true;
    } else {
      userCheck = false;
    }

    // Use the now verified Username to get the password from the table
    // -- and compared it to user's input password. If they match --> verified.
    const entity: any = await this?.GetSingleData(username);
    //Logger.info("Entity: "+JSON.stringify(entity))

    if (entity.password === password) {
      Logger.http(" Password Check Validated !");
      passwCheck = true;
    } else {
      passwCheck = false;
    }

    // Final check to see if both username and password are verified.
    const FinalDesc = userCheck && passwCheck; //Logger.warn(`UserCheck: ${userCheck} PasswCheck: ${passwCheck} \n FinalDesc: ${FinalDesc}`)

    return FinalDesc; //return [{ (userCheck, passwCheck) }];
  }
  // -> 'provideToken()'
  //-> Function to verify username and password then provide saved token data.
  public async provideToken(username: string, password: string) {
    let ErrorMessage = "ERROR -> Not found";
    try {
      const entity: any = await this.client?.getEntity(
        "PKey-" + username,
        "RKey-" + username
      );
      let dbPassword = entity.password;
      let dbToken = entity.token;

      if (password === dbPassword) {
        // return `The username :${entity.username}\n\nThe password :${entity.password}\n\nThe token :${entity.token}`;
        let message = "Success";
        return { dbToken, message };
      } else {
        let message = "WrongPassword";
        return { message };
      }
    } catch (error) {
      let message = "User not found";
      return { message };
    }
  }
  // -> 'provideTokenNoAuth()'
  // Function for providing token With no authentication, used internally only.
  public async provideTokenNoAuth(username: string) {
    let ErrorMessage = "ERROR -> Not found";
    try {
      const entity: any = await this.client?.getEntity(
        "PKey-" + username,
        "RKey-" + username
      );
      let dbPassword = entity.password;
      let dbToken = entity.token;

      if (entity) {
        // return `The username :${entity.username}\n\nThe password :${entity.password}\n\nThe token :${entity.token}`;
        let message = "Success";
        return { dbToken, message };
      }
    } catch (error) {
      let message = "User not found";
      return { message };
    }
  }

  // -> 'updateToken()'
  // Function to update token data
  public async updateToken(
    usernameInput: string,
    passwordInput: string,
    NewToken: string
  ) {
    if (
      (await this.checkUserPassword(usernameInput, passwordInput)) === false
    ) {
      return "Auth Failed";
    }
    // Define the entity to update
    const partitionKey = "PKey-" + usernameInput;
    const rowKey = "RKey-" + usernameInput;
    try {
      const entityToUpdate = {
        partitionKey: partitionKey,
        rowKey: rowKey,
        token: NewToken, // Replace with the current value of the property
        isLoggedIn: "Logged In",
      };
      await this.client?.updateEntity(entityToUpdate);
    } catch (error) {
      Logger.error("Error updating token to DB");
      return "Error updating token to DB";
    }
    const { username, token }: any = await this.client?.getEntity(
      partitionKey,
      rowKey
    );
    //Logger.info(`Success -> ${username}'s Token updated: ${token}`);
    return `Successful Update for ${username}'s Token: ${token}`;
  }
  // -> 'updateTokenNoAuth()'
  // Function to update token data for deletion route. No authentication required.
  public async updateTokenNoAuth(usernameInput: string) {
    // Define the entity to update
    const partitionKey = "PKey-" + usernameInput.replace(/\"/g, "");
    const rowKey = "RKey-" + usernameInput.replace(/\"/g, "");

    try {
      const entityToUpdate = {
        partitionKey: partitionKey,
        rowKey: rowKey,
        token: "unassigned", // Replace with the current value of the property
        isLoggedIn: "LoggedOut",
      };
      await this.client?.updateEntity(entityToUpdate);
    } catch (error) {
      Logger.error("Error updating token to DB");
      return "Error";
    }

    //
    pusherServer.trigger("my_channel", "my_event", {
      data: { username: "Login", token: "unassigned" },
    });

    const { username, token }: any = await this.client?.getEntity(
      partitionKey,
      rowKey
    ); //
    Logger.info(`Success -> ${username}'s Token updated: ${token}`);
    return `Logout complete!`;
  }

  // -> Update has password
  public async updateHashed(
    usernameInput: string,
    passwordInput: string,
    NewHash: string
  ) {
    /** 
  if (
    (await this.checkUserPassword(usernameInput, passwordInput)) === false
  ) {
    return "Auth Failed";
  }*/
    // Define the entity to update
    const partitionKey = "PKey-" + usernameInput;
    const rowKey = "RKey-" + usernameInput;
    try {
      const entityToUpdate = {
        partitionKey: partitionKey,
        rowKey: rowKey,
        hashed: NewHash, // Replace with the current value of the property
      };
      await this.client?.updateEntity(entityToUpdate);
    } catch (error) {
      Logger.error("Error updating token to DB");
      return "Error updating token to DB";
    }
    const { username, hashed }: any = await this.client?.getEntity(
      partitionKey,
      rowKey
    );
    //Logger.info(`Success -> ${username}'s Token updated: ${token}`);
    return `Successful Update for ${username}'s Hashed: ${hashed}`;
  }

  // -> 'provideHashed()'

  public async provideHashed(username: string, password: string) {
    let ErrorMessage = "ERROR -> Not found";
    try {
      const entity: any = await this.client?.getEntity(
        "PKey-" + username,
        "RKey-" + username
      );
      let dbPassword = entity.password;
      let dbHashed = entity.hashed;

      if (password === dbPassword) {
        // return `The username :${entity.username}\n\nThe password :${entity.password}\n\nThe token :${entity.token}`;
        let message = "Success";
        return { dbHashed, message };
      } else {
        let message = "WrongPassword";
        return { message };
      }
    } catch (error) {
      let message = "User not found";
      return { message };
    }
  }

  // -> fullAuthCheck() - Method that handles all checks for authentication
  async fullAuthCheck(token: any) {
    // 1) Function receives token from user
    // 2) CONTENTS of token then compared to the user info in the database
    // 3) If valid, function compares token received to the last viable token distributed to that user
    // All True, check complete

    // -> 1) Function decodes token from user
    const returnData = await decodeUser(token);

    // -> 2) CONTENTS of token then compared to the user info in the database
    const latestValidToken = await this.provideToken(
      returnData.compareData.email,
      returnData.compareData.password
    );
    Logger.warn(` Validating Token ...`);

    // -> 3) If valid, function compares token recived to the last viable token distributed to that user
    if (
      latestValidToken.message === "Success" &&
      latestValidToken.dbToken === token
    ) {
      Logger.warn(` Token Validated, all checks complete!`);
      return "Check Complete";
    } else {
      Logger.error(` ERROR: Invalid Token!`);
      return "Check Failed";
    }
  }

  // -> getAuthorizedTable() - Function to for gathering authenticated users from Azure Table
  async getAuthorizedTable() {
    try {
      const client = TableClient.fromConnectionString(
        connectionString,
        "authJWT"
      );
      // Getting all usernames from the table
      const entities = await client.listEntities();
      const authUsersList: any[] = [];
      for await (const entity of entities) {
        authUsersList.push(entity.username);
      }
      //Cache the Auth Users List
      myCache.set(`authUsersCache`, authUsersList, 10000);
      //Logger.http(`Auth Users List: ${authUsersList}`);
      return authUsersList;
    } catch (error) {
      Logger.error(error);
      return "Error getting data";
    }
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

  public async newUploadProcess(ReqFiles: any, imageMeta: any) {
    const dateTaken = imageMeta[0].date_Taken || "No Date";
    const description = imageMeta[0].description || "No Description";
    const fileNames = imageMeta[0].fileNames || [];
    const uploaderName = imageMeta[0].uploaderName || "No Uploader";
    const approvedBy = "Unapproved";

    const tags = imageMeta[0].tags;

    Logger.info(`\n Image Received !: 
    -> Date Taken: ${dateTaken}
   -> Description: ${description}
   -> Uploader: ${imageMeta[0].uploaderName}
   Files: ${JSON.stringify(fileNames)}`);

    const arr: any = ReqFiles;
    for (const file of arr) {
      const entity: masterMap2Props = {
        partitionKey: "masterFinal",
        rowKey: "RKey-" + file.originalname,

        imageName: file.originalname,
        description: description,
        tags: tags,
        uploader: uploaderName,
        approvedBy: approvedBy,
        dateTaken: dateTaken,
        folder: "",
      };

      await this.client?.createEntity(entity);
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
      `\n Inserted new entities from User: ${uploaderName}, moving on to uploading data`
    );

    // upload image data from multer to blob
    await newimages.uploadMulter(ReqFiles);
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
  public async getMapData() {
    const cachedData = myCache.get(`dataCache${this.tableName}`);
    if (cachedData) {
      Logger.warn(`Cache Found for ${this.tableName} ....`);
      return cachedData;
    } else {
      Logger.warn(`No Cache Found for ${this.tableName} ....`);
      const data = await this.myGetData();
      myCache.set(`mapCache${this.tableName}`, data, 10000);
      Logger.info(`Done setting cache for ${this.tableName} ....`);
      return data;
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
            item.rowKey = "RKey-" + item.date_Taken;
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
