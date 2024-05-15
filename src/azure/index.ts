import bodyParser from "body-parser";
import cors from "cors";
import express, { Response, Request, Router, NextFunction } from "express";
import { AuthTable } from "../db/auth";
import { FormatImageData, imageFolderAssignment } from "../utils/helpers";
import { decode } from "base64-arraybuffer";
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import multer from "multer";
import Logger from "../utils/logger";
import { newimages } from "../db/blobs";
import { pusherServer } from "../utils/pusher";
import { UploadProps } from "../utilities/types";
import { masterTableFinal } from "../db/masterdata";

export const azureRouter: Router = Router();

azureRouter.use(cors());
azureRouter.use(express.json());
azureRouter.use(bodyParser.json());
azureRouter.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

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
 * -> '/setUserToken'
 *  - This route sets the users token information with the Azure table 'auth
 *
 * -> '/getTableColumns/:tablename'
 * - This route returns the column names from the table
 *
 * ****** Protected Routes   ******
 *
 * -> '/getAllData/:tablename'
 * - This route returns all data from the table
 *
 * -> '/upload/:imageFullname/:uploaderName'
 * - This route uploads an image to the blob storage
 *
 * ****** Admin Routes   ******
 *
 * -> '/Delete/:name'
 *  - This route deletes a data from Azure table
 *
 * -> '/Update'
 * - This route updates a data from Azure table
 *
 */

// -> POST: sets the users token information with the Azure table 'auth
azureRouter.post("/setUserToken", async (req: Request, res: Response) => {
  const { data } = req.body;

  // Console log the last 10 characters of the token
  Logger.http(
    `Setting user's new token from AD: .....${data.usertoken.slice(-50)}`
  );
  const response: any = await AuthTable.updateAuthJWTdata(data.usertoken);
  const username = response.response.username;
  const token = response.response.token;

  // Update the pusher channel with the new token, and username
  await pusherServer.trigger("my_channel", "my_event", {
    data: { username, token },
  }); ////
  Logger.http(`User ${username} token set!`);
  res.send(`User ${username} token set!`);
});

// -> GET: return the column names from the table,
// * Column names are not sensitive info
azureRouter.get(
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

// 'getToken' - middleware function for authenticating users tokens
// - This function decodes token given and compares to information found in
// -- the 'auth' table. If token valid, access is granted to the route.
const getToken = async function (req: any, res: Response, next: NextFunction) {
  try {
    const token = req.headers["authorization"]
      .replace(/['"]+/g, "")
      .split(" ")[1];
    if (!token) {
      return res.status(401).send("Access denied. No token provided.");
    }
    // Remove any quotes from token

    // If the token is equal to the admin token in env, grant access
    if (token === process.env.ADMIN_TOKEN) {
      Logger.info(`ADMIN: Granting access to admin...`);
      next();
      return;
    }

    try {
      // Begining token authorization
      console.log("** Protected Route: checking authorization **"); //   console.log("Preview of Token: " + token.slice(0, 10));

      // Pass token to verify azure, a function that does comparisons with auth data
      const response = await AuthTable.verifyWAzure(token.replace(/\"/g, ""));
      if (response != true) {
        // deny access if token invalid
        Logger.error("Invalid token attempting to access route. ");
        return res.status(401).send("Unauthorized request");
      }
      // If token valid, grant access to route
      Logger.info(`Granting accessing to route...`);
      next();
    } catch (err) {
      console.log(err);
      res.status(400).send("Unknown ERROR: Invalid token.");
    }
  } catch (err) {
    Logger.error(` Error Formatting Token: ${err}`);
    res
      .status(400)
      .send(` Error Formatting Token. Please check authorization.`);
  }
};
const defaultURL =
  "https://images.placeholders.dev/?text=Missing%20Image&bgColor=%23434343&textColor=%23dfdfde";
// --> GET: serve an image from the storage
azureRouter.get("/getImage/:imagename", async (req: Request, res: Response) => {
  const { imagename } = req.params;
  const image = await newimages.downloadBuffer(imagename);
  if (!image) {
    res.send(defaultURL);
  } else {
    // currently image is a RetriableReadableStream we need to convert it to a buffer, but it cant be used in buffer because its a RetriableReadableStream
    const convert = Buffer.from(image);
    res.send(convert);
  }
});

// -> GET: get all data from Azure Table
azureRouter.get(
  "/getAllData/:tablename",
  getToken,
  async (req: Request, res: Response) => {
    const { tablename } = req.params;

    try {
      // Get table name from req and return data from there
      switch (tablename) {
        case "masterdata":
          const masterData: any = await masterTableFinal.myGetData();

          const yodaimages = await newimages.listImages();
          res.send([masterData, yodaimages]);
          break;

        default:
          Logger.error("Invalid Data Request for table");
          res.send("No valid table name provided");
          break;
      }
    } catch (err) {
      Logger.info(err);
    }
  }
);

// -> '/imgupload/:...' - upload image to blob storage
azureRouter.post(
  // "/imgupload/:imageMeta/:uploaderName",
  "/uploadImage",
  getToken,
  upload.array("monfichier"),
  async (req: Request, res: Response) => {
    // check if req.files is empty
    if (!req.files || req.files.length === 0) {
      Logger.error("No files received in request. ");
      return res.status(400).send("No files were received.");
    }
    const data: any = [JSON.parse(req.body.data)];

    await masterTableFinal.newUploadProcess(req.files, data);

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
azureRouter.get("/RandomImage", async (req: Request, res: Response) => {
  let used: any = [];
  const masterdata: any = await masterTableFinal.myGetData();
  if (!masterdata) {
    res.status(404).send("Error fetching data from Storage");
  }

  // theres a column called dateTaken in unix, I want the fice latest values of dateTaken
  if (masterdata.length < 5) {
    const sortByDateTaken = masterdata.sort(
      (a: any, b: any) => b.dateTaken - a.dateTaken
    ).map((item: any) => item.imageName);
    return res.send(sortByDateTaken);
  } else {
    const sortByDateTaken = masterdata
      .sort((a: any, b: any) => b.dateTaken - a.dateTaken)
      .slice(0, 5).map((item: any) => item.imageName);
    const firstFiveElements = sortByDateTaken.slice(0, 5);
    res.send(firstFiveElements);
  }
});
////
// ********** Admin functions ( work in prog ) **********

azureRouter.get("/unapproved", async (req: Request, res: Response) => {
  const data = await masterTableFinal.getUnapprovedImages();
  res.send(data);
});
azureRouter.post("/admin/approve", async (req: Request, res: Response) => {
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
