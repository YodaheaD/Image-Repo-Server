import sharp from "sharp";
import { compressionBucket, yodaheaBucket } from "../db/blobs";
import { Compression, compressionTable } from "../db/compression";
import cliProgress from "cli-progress";
export async function checkCompression() {
  const compTable: Compression[] = [];
  for await (const entity of compressionTable.listEntities() || []) {
    compTable.push(entity as Compression);
  }

  const listofImages: string[] | any = await yodaheaBucket.listImages();

  const namesInCompTable: string[] = compTable.map((x) => x.name);
  const progBar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );
  const imagesToCompress = listofImages.filter(
    (x: string) => !namesInCompTable.includes(x)
  );

  // If there are no images to compress, exit
  if (imagesToCompress.length === 0) {
    console.log("No images to compress");
    return;
  }
  // take first ten for testing
  console.log(
    ` Total Images/Files to Compress: ${listofImages.length} / ${imagesToCompress.length}`
  );

  // BEGIN COMPRESSION
  progBar.start(imagesToCompress.length, 0);
  for (const image of imagesToCompress) {
    progBar.increment();
    const buffer = await yodaheaBucket.downloadBuffer(image.split(".")[0]);
    if (!buffer) {
      console.log("Error downloading image");
      continue;
    }
    // Use sharp to compress the image
    //Requirements: webp, compression 100
    const compressedBuffer = await sharp(buffer)
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

    if (!compressedBuffer) {
      console.log("Error compressing image");
      continue;
    }
    try {
      await compressionBucket.uploadBuffer(image.split(".")[0], compressedBuffer);
    } catch (e) {
      console.log("Error uploading compressed image");
    }

    const compressEntry: Compression = {
      partitionKey: "compression",
      rowKey: image,
      name: image,
      lastCompressed: new Date().toISOString(),
      sizeOfImage: compressedBuffer.length,
    };

    try {
      await compressionTable.insertEntity(compressEntry);
    } catch (e) {
      console.log("Error inserting into compression table");
    }
  }

  console.log("\n ------- Compression Complete \n ");
}

checkCompression();
