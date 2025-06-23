import { BlobServiceClient, BlockBlobClient } from "@azure/storage-blob";
import Logger from "../utils/logger";
import { decode } from "base64-arraybuffer";
import NodeCache from "node-cache";
import { compressionTable } from "./compression";
import { YodaheaTable } from "./masterdata";
import sharp from "sharp";
import dotenv from "dotenv";

dotenv.config();
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || "";
const client = BlobServiceClient.fromConnectionString(connectionString);
type listImageOpts = {
  withSizes?: boolean;
  withLastMod?: boolean;
};
const imageCache = new NodeCache();
export class BlobLike {
  constructor(public readonly containerName: string) {}

  // -> Error Catcher
  private catcher(err: any) {
    Logger.error(`BlobLike: ${err.message}`);
  }

  // -> Create Container
  public async createContainer() {
    const containerClient = client.getContainerClient(this.containerName);
    await containerClient.create().catch(this.catcher);
  }

  // -> Get name of container
  private async getClient(name: string) {
    const containerClient = client.getContainerClient(this.containerName);
    return containerClient.getBlockBlobClient(name);
  }

  public async serveBlob(name: string) {
    const blobClient = await this.getClient(name);
    const download = await blobClient.download();
    return download.readableStreamBody;
  }

  public async downloadBuffer(name: string) {
    const blobClient = await this.getClient(name);
    return await blobClient.downloadToBuffer();
  }
  // -> Create a list of Blobs names in a Container
  public async listContBlobs() {
    const containerClient = client.getContainerClient(this.containerName);
    let blobArray: string[] = [];

    for await (const blob of containerClient.listBlobsFlat()) {
      blobArray.push(blob.name);
    }
    return blobArray;
  }
public async listImages(options: listImageOpts = {}) {
  const containerClient = client.getContainerClient(this.containerName);
  let images: any[] = [];

  for await (const blob of containerClient.listBlobsFlat()) {
    let image: any = { name: blob.name };

    if (options.withSizes) {
      image.size = blob.properties.contentLength;
    }
    if (options.withLastMod) {
      image.lastModified = blob.properties.lastModified;
    }

    images.push(image);
  } 

  if (images.length === 0) {
    return "No images found";
  }
  return images;
}
  // -> Returns a list of the images without metadata

  // so, if we have an image uploaded to the blob with an exisiting name
  // we want to use a function to search

  // -> Get Buffer data for a Blob
  public async download(name: string) {
    const blobClient = this.getClient(name);
    return await (await blobClient).downloadToBuffer();
  } 

  // -> Reciving a multer with mutiple files and uploading them to the blob
  public async uploadMulter(files: any) {
    const containerClient = client.getContainerClient(this.containerName);

    for (const file of files) {
      // if it includes a . split it else keep name
      const uploadName = file.originalname.includes(".")
        ? file.originalname.split(".")[0]
        : file.originalname;
      console.log(` -- Uploading to Blob:  ${uploadName}`);
      const blobClient = containerClient.getBlockBlobClient(uploadName);
      await blobClient.uploadData(file.buffer);
    }
  }
  public async uploadMulterCompress(files: any) {
    const containerClient = client.getContainerClient(this.containerName);
    const errorContainerClient = client.getContainerClient("errors");

    for (const file of files) {
      const uploadName = file.originalname.includes(".")
        ? file.originalname.split(".")[0]
        : file.originalname;
      console.log(` -- Uploading to Compressed Blob:  ${uploadName}`);
      const blobClient = containerClient.getBlockBlobClient(uploadName);

      let compressedBuffer: Buffer | undefined;
      try {
        compressedBuffer = await sharp(file.buffer)
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
        console.log("Error compressing image");
      }

      if (compressedBuffer) {
        await blobClient.uploadData(compressedBuffer);
      } else {
        // Upload original buffer to errors/ folder
        const errorBlobClient = errorContainerClient.getBlockBlobClient(`errors/${uploadName}`);
        await errorBlobClient.uploadData(file.buffer);
      }
    }
  }

  // Uplaod a single buffer
  public async uploadBuffer(name: string, buffer: Buffer) {
    // if the tablename is compressiontable then upload as we
    if (this.containerName === "compressiontable") {
      const blobClient = await this.getClient(name);
      await blobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: "image/webp",
        },
      });
    }
    // else if its the journal, its a txt file so add that text/plain
    else if (this.containerName === "journal") {
      const blobClient = await this.getClient(name);
      await blobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: "text/plain",
        },
      });
    } 

    const blobClient = await this.getClient(name);
    await blobClient.uploadData(buffer);
  }

  public async deleteBlob(name: string) {
    try {
      const blobClient = await this.getClient(name);
      await blobClient.delete();
    } catch (err) {
      Logger.error(`Error deleting filename: ${name} + ${err}`);
    }
  }
 
  public async renameBlob(oldname: string, newname: string) {
    try {
      const buffer = await this.downloadBuffer(oldname);
      await this.uploadBuffer(newname, buffer);
      await this.deleteBlob(oldname);
    } catch (err) {
      Logger.error(
        `Error renaming filename: ${oldname} to ${newname} + ${err}`
      );
    }
  }
}
