import {  compressionBucket } from "../db/blobs";
import cliProgress from "cli-progress";
export async function fixImageNames() {
  // I have some images in my Azure blob yodaheaBuckt that have filetypes that are capitalized
  // So i want to remove all filetype .__ from names of blobs, because they are not needed

  const listofImages: string[] | any = await compressionBucket.listImages();
  const progBar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );
  progBar.start(listofImages.length, 0);
  const notUploaded: string[] = [];
  const notDeleted: string[] = [];
  for (const image of listofImages) {
    progBar.increment();
    const newName = image.split(".")[0];
    const getImageData = await compressionBucket.downloadBuffer(image);
    if (!getImageData) {
      console.log("Error downloading image");
      continue;
    }
    try {
      await compressionBucket.uploadBuffer(newName, getImageData);
    } catch (e) {
      console.log("Error uploading image");
      notUploaded.push(image);
    }

    try {
      await compressionBucket.deleteBlob(image);
    } catch (e) {
      console.log("Error deleting image");
      notDeleted.push(image);
    }
  }

  console.log(`Not uploaded: ${notUploaded}`);
    console.log(`\n Not deleted: ${notDeleted}`);
}

fixImageNames();