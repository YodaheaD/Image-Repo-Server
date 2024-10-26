import { BlobServiceClient, BlockBlobClient } from "@azure/storage-blob";
import Logger from "../utils/logger";
import { decode } from "base64-arraybuffer";
import NodeCache from "node-cache";

const connectionString = "UseDevelopmentStorage=true";
const client = BlobServiceClient.fromConnectionString(connectionString);

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
 
 
  public async listImages() {
    const containerClient = client.getContainerClient(this.containerName);
    let blobArray: string[] = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      blobArray.push(blob.name);
    }
    if (blobArray.length === 0) {
      return "No images found";
    }
    return blobArray;
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
      console.log(` -- Uploading to Blob:  ${file.originalname}`);
      const blobClient = containerClient.getBlockBlobClient(file.originalname);
      await blobClient.uploadData(file.buffer);
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

    const blobClient = await this.getClient(name);
    await blobClient.uploadData(buffer);
  }

  public async deleteBlob(name: string) {
    try {
      const blobClient = await this.getClient(name);
      await blobClient.delete();
    } catch (err) {
      Logger.error(`Error deleting filename: ${name}+ ${err}`);
    }
  }
}
