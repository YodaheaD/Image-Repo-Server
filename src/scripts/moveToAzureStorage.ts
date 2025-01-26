import { BlobServiceClient } from "@azure/storage-blob";

import fs from "fs";
import cliProgress from "cli-progress";
import { yodaheaBucket } from "../db/blobs";
export async function migrateImages() {
  const imagesStorage = await yodaheaBucket.listImages();

  const progressBar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );
  progressBar.start(imagesStorage.length, 0);
  const connStringForAzure = String(
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );
  if (!connStringForAzure) {
    throw new Error("Azure Storage Connection String is not provided");
  }
  for (let i = 0; i < imagesStorage.length; i++) {
    const image = imagesStorage[i];
    const imageBuffer = await yodaheaBucket.downloadBuffer(image);
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connStringForAzure);
    const containerClient = blobServiceClient.getContainerClient("familycon");
    const blockBlobClient = containerClient.getBlockBlobClient(image);
    await blockBlobClient.upload(imageBuffer, imageBuffer.byteLength);
    progressBar.increment();
  }
}
migrateImages();
