import Jwt from "jsonwebtoken";
import Logger from "./logger";
import dotenv from "dotenv";
import {  masterTableFinal } from "../db/masterdata";
import { imageMapTable } from "../db/myimagemap";

dotenv.config();
// decodeUser() - Decodes user token.
export async function decodeUser(Token: string) {
  Logger.info(`Decoding Token contents......`);
  try {
    const decoded: any = Jwt.verify(Token, String(process.env.JWT_SECRET));
    const compareData: any = {
      email: decoded.user.email,
      password: decoded.user.password,
    };
    Logger.info(`Token Contents Decoded !`);

    return { compareData };
  } catch (err) {
    Logger.error(`Error Decoding Token: ${err}`);
    return { email: "Error", password: "Error" };
  }
}

export async function myDecode(token: string) {
  token = decodeURIComponent(
    atob(token.split(".")[1].replace("-", "+").replace("_", "/"))
      .split("")
      .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
      .join("")
  );
  return token;
}

export async function FormatImageData(inputimage: any) {
  console.log(` Formatting : ${inputimage}`);
  // Get base64 url from image
  const imageURL = inputimage.split(",")[1];
  // Get image type from base64 url
  const imageType = inputimage.split(";")[0].split("/")[1];
  return { imageURL, imageType };
}

// we want to assign the correct images to the correct folder so we will take the input of the user and assign it to the correct folder
export function imageFolderAssignment(useremail: any) {
  let folderName = "default";
  // Get the array of authorized users from env file
  let authorizedUsers: any = process.env.AUTHORIZED_USERS;
  // auth is currently a strin gbut we want to convert it to an array
  authorizedUsers = JSON.parse(authorizedUsers);
  console.log(authorizedUsers[0]);
  console.log(` Recived email: ${useremail}`);
  // Serach the authorized users array for the user email
  authorizedUsers.map((user: any) => {
    if (user.email === useremail.replace(/['"]+/g, "")) {
      folderName = user.folder;
      console.log(
        ` User ${useremail} is authorized to upload to ${folderName}`
      );
    }
  });

  return folderName;
}

 
