import { Router } from "express";

import { journalTable, journalTypes } from "../db/journal";
import { journalBucket } from "../db/blobs";

export const journalRouter: Router = Router();

/// ** POST /makefolder

journalRouter.post("/makefolder", async (req, res) => {
  const { nameoffolder } = req.query;
  if (!nameoffolder) {
    return res.status(400).send("Please provide a folder name");
  }
  const data = {
    partitionKey: "journal",
    rowKey: nameoffolder + "-Untitled",
    folder: nameoffolder,
    name: "Untitled",
    images: "",
  };
  const allData: any = await journalTable.straightQuery();
  console.log(` Creating folder: ${nameoffolder}`);
  const allrowkeys = allData.map((data: { rowKey: string }) => data.rowKey);

  const Rowkey = data.rowKey;
  if (allrowkeys.includes(Rowkey)) {
    console.log(`RowKey ${Rowkey} already exists, skipping insertion`);
    return res.status(400).send(`RowKey ${Rowkey} already exists`);
  } else {
    console.log("Inserting data");
    await journalTable.insertEntity(data);

    // now create a file in blob folder/name.txt
    try {
      // create a text file with name.txt and upload it to blob, file should be empty
      const blobName = nameoffolder + "/Untitled.txt";
      const content = Buffer.from("");
      await journalBucket.uploadBuffer(blobName, content);
      return res.status(200).send("Data inserted");
    } catch {
      console.log("Error in creating a text file for folder");
      return res.status(400).send("Error in creating a text file for folder");
    }
  }
});
journalRouter.post("/makefolderNEW", async (req, res) => {
  const { nameoffolder, startDate, endDate, tripNumber } = req.query;
  if (!nameoffolder) {
    return res.status(400).send("Please provide a folder name");
  }
  if (!startDate || !endDate || !tripNumber) {
    return res
      .status(400)
      .send("Please provide a startDate, endDate and tripNumber");
  }
  const data: journalTypes = {
    partitionKey: "journal",
    rowKey: nameoffolder + "-Untitled",
    folder: String(nameoffolder),
    name: "Untitled",
    images: "",
    startDate: String(startDate),
    endDate: String(endDate),
    tripNumber: Number(tripNumber),
  };
  const allData: any = await journalTable.straightQuery();
  console.log(` Creating folder: ${nameoffolder} given:`);
  const formattedStartDate = new Date(Number(startDate)).toLocaleDateString(
    "en-US"
  );
  const formattedEndDate = new Date(Number(endDate)).toLocaleDateString(
    "en-US"
  );
  console.log(` - Start Date: ${formattedStartDate}`);
  console.log(` - End Date: ${formattedEndDate}`);
  console.log(` - Trip Number: ${tripNumber}`);

  const allrowkeys = allData.map((data: { rowKey: string }) => data.rowKey);

  const Rowkey = data.rowKey;
  if (allrowkeys.includes(Rowkey)) {
    console.log(`RowKey ${Rowkey} already exists, skipping insertion`);
    return res.status(400).send(`RowKey ${Rowkey} already exists`);
  } else {
    console.log("Inserting data");
    await journalTable.insertEntity(data);

    // now create a file in blob folder/name.txt
    try {
      // create a text file with name.txt and upload it to blob, file should be empty
      const blobName = nameoffolder + "/Untitled.txt";
      const content = Buffer.from("");
      await journalBucket.uploadBuffer(blobName, content);
      return res.status(200).send("Data inserted");
    } catch {
      console.log("Error in creating a text file for folder");
      return res.status(400).send("Error in creating a text file for folder");
    }
  }
});
//

/// ** POST /addname
// route for adding a new name to an existing folder
journalRouter.post("/addname", async (req, res) => {
  const { foldername, name } = req.query;

  if (!foldername || !name) {
    return res.status(400).send("Please provide a folder name and a name");
  }
  //gigivenvn the foldername, search for an entry with the same foldername, but with valid startDate, endDate and tripNumber
  const alldata: any = await journalTable.straightQuery();
  const matchesFolder = alldata.filter(
    (entry: any) =>
      entry.folder === foldername &&
      entry.startDate &&
      entry.endDate &&
      entry.tripNumber
  );

  if(!matchesFolder || matchesFolder.length === 0) {
    return res.status(400).send(`Folder ${foldername} does not exist`);
  }

  const { startDate, endDate, tripNumber } = matchesFolder[0];
  const data: journalTypes = {
    partitionKey: "journal",
    rowKey: `${foldername}-${name}`,
    folder: String(foldername),
    name: String(name),
    images: "",
    startDate: String(startDate),
    endDate: String(endDate),
    tripNumber: Number(tripNumber),
  };

  try {
    const allData: any = await journalTable.straightQuery();
    const allFolders = allData.map((entry: { folder: string }) => entry.folder);

    if (!allFolders.includes(foldername)) {
      return res.status(400).send(`Folder ${foldername} does not exist`);
    }

    console.log(`Adding name: ${name} to folder: ${foldername}`);
    const allRowKeys = allData.map((entry: { rowKey: string }) => entry.rowKey);

    if (allRowKeys.includes(data.rowKey)) {
      console.log(`Title ${data.rowKey} already exists, skipping insertion`);
      return res.status(400).send(`RowKey ${data.rowKey} already exists`);
    }

    console.log("Inserting data");
    const blobName = `${foldername}/${name}.txt`;
    const content = Buffer.from("");

    await journalBucket.uploadBuffer(blobName, content);
    await journalTable.insertEntity(data);

    return res
      .status(200)
      .send(`SUCCESS: Added name ${name} to folder ${foldername}`);
  } catch (error) {
    console.error("Error adding name:", error);
    return res.status(500).send("Internal server error");
  }
});

// ** PUT /changename
// route for chaning name of existing name in folder
journalRouter.put("/changename", async (req, res) => {
  const { foldername, oldname, newname } = req.query;
  if (!foldername || !oldname || !newname) {
    return res
      .status(400)
      .send("Please provide a folder name, old name and new name");
  }
  const alldata: any = await journalTable.straightQuery();
  const allFolders = alldata.map((entry: { folder: string }) => entry.folder);

  if (!allFolders.includes(foldername)) {
    return res.status(400).send(`Folder ${foldername} does not exist`);
  }

  console.log(` Changing name from ${oldname} to ${newname}`);

  const findOld = alldata.find(
    (data: { rowKey: string }) => data.rowKey === foldername + "-" + oldname
  );

  if (!findOld) {
    return res.status(400).send(`Old Name: ${oldname} not found`);
  }

  const newobj = {
    ...findOld,
    rowKey: foldername + "-" + newname,
    name: newname,
  };
  try {
    await journalBucket.renameBlob(
      foldername + "/" + oldname + ".txt",
      foldername + "/" + newname + ".txt"
    );

    await journalTable.straightDelete(findOld.partitionKey, findOld.rowKey);
    await journalTable.insertEntity(newobj);
    return res.status(200).send(` Name updated from ${oldname} to ${newname}`);
  } catch (err) {
    return res.status(400).send("Error in updating name");
  }
});

// ** PUT /addimages
// given the foldername and name, add images to the images string concatted with ,
journalRouter.put("/addimages", async (req, res) => {
  const { foldername, name, images } = req.query;
  if (!foldername || !name || !images) {
    res.status(400).send("Please provide a folder name, name and images");
  }
  const alldata: any = await journalTable.straightQuery();
  const allFolders = alldata.map((entry: { folder: string }) => entry.folder);
  if (!allFolders.includes(foldername)) {
    return res.status(400).send(`Folder ${foldername} does not exist`);
  }
  const allNamesInFolder = alldata.filter(
    (entry: { folder: string }) => entry.folder === foldername
  );
  const allNames = allNamesInFolder.map(
    (entry: { name: string }) => entry.name
  );
  if (!allNames.includes(name)) {
    return res
      .status(400)
      .send(
        `Name ${name} does not exist in folder ${foldername} with Titles: ${allNames.join(
          ", "
        )}`
      );
  }

  console.log(` Add images to name: ${name} in folder: ${foldername}`);

  const findOld = alldata.find(
    (data: { rowKey: string }) => data.rowKey === foldername + "-" + name
  );

  if (!findOld) {
    res.status(400).send("Name not found");
  }

  const newobj = {
    ...findOld,
    images: findOld.images.length > 0 ? findOld.images + "," + images : images,
  };
  try {
    await journalTable.straightDelete(findOld.partitionKey, findOld.rowKey);
    await journalTable.insertEntity(newobj);
    res.status(200).send(` Images added to ${name}`);
  } catch (err) {
    res.status(400).send("Error in adding images");
  }
});

// ** DELETE /removeImages
journalRouter.delete("/removeImages", async (req, res) => {
  const { foldername, name, images } = req.query;
  if (!foldername || !name) {
    return res.status(400).send("Please provide a folder name and name");
  }
  // check if images is empty
  if (!images || images.length === 0) {
    return res.status(400).send("Please provide images to remove");
  }
  // check if valid Folder
  const alldata: any = await journalTable.straightQuery();
  const allFolders = alldata.map((entry: { folder: string }) => entry.folder);
  if (!allFolders.includes(foldername)) {
    return res.status(400).send(`Folder ${foldername} does not exist`);
  }
  // check if valid Name
  const allNamesInFolder = alldata.filter(
    (entry: { folder: string }) => entry.folder === foldername
  );
  const allNames = allNamesInFolder.map(
    (entry: { name: string }) => entry.name
  );
  if (!allNames.includes(name)) {
    return res
      .status(400)
      .send(
        `Name ${name} does not exist in folder ${foldername} with Titles: ${allNames.join(
          ", "
        )}`
      );
  }

  const imagesPassed = images as string;

  const findOld = alldata.find(
    (data: { rowKey: string }) => data.rowKey === foldername + "-" + name
  );

  console.log(` Found old: ${findOld.images}`);
  const currentImages = findOld.images.split(",").map((img: any) => img.trim());
  const incomingDelImages = images
    ? imagesPassed.split(",").map((img) => img.trim())
    : [];

  console.log(
    ` Removing image: -- ${incomingDelImages} --  from current list -- ${currentImages} --`
  );

  const newarr = currentImages.filter(
    (img: string) => !incomingDelImages.includes(img)
  );
  // If they are the same size, nothing is changed so let user know
  if (newarr.length === currentImages.length) {
    return res
      .status(400)
      .send("No images removed, please check the names exist in Title");
  }

  const newobj = {
    ...findOld,
    images: newarr.join(","),
  };
  console.log(newobj);
  try {
    await journalTable.updateEntity(newobj);
    res.status(200).send(` Images removed from  ${name}`);
  } catch (err) {
    res.status(400).send("Error in removing images");
  }
});

// ** DELETE /deleteName
// delete a name from a folder
journalRouter.delete("/deleteName", async (req, res) => {
  const { foldername, name } = req.query;
  if (!foldername || !name) {
    return res.status(400).send("Please provide a folder name and name");
  }
  const alldata: any = await journalTable.straightQuery();
  // check if valid Folder
  const allFolders = alldata.map((entry: { folder: string }) => entry.folder);
  if (!allFolders.includes(foldername)) {
    return res.status(400).send(`Folder ${foldername} does not exist`);
  }

  const findOld = alldata.find(
    (data: { rowKey: string }) => data.rowKey === foldername + "-" + name
  );

  if (!findOld) {
    console.log(` Name: ${name} not found`);
    return res.status(400).send("Name not found");
  }

  try {
    await journalBucket.deleteBlob(foldername + "/" + name + ".txt");
    await journalTable.straightDelete(findOld.partitionKey, findOld.rowKey);
    console.log(` Name deleted: ${name} from folder: ${foldername}`);
    return res
      .status(200)
      .send(` Name deleted: ${name} from folder: ${foldername}`);
  } catch (err) {
    return res
      .status(400)
      .send("Error in deleting name from folder: " + foldername);
  }
});
// ** GET /returnList
// return a list of all folders and names grouped by tripNumber
journalRouter.get("/returnList", async (req, res) => {
  const alldata: any = await journalTable.straightQuery();
  // we want to group each folder by tripNumber and then group names by folder
  const groupedData = alldata.reduce((acc: any, data: any) => {
    if (!acc[data.tripNumber]) {
      acc[data.tripNumber] = { tripNumber: data.tripNumber, data: [] };
    }
    const folderIndex = acc[data.tripNumber].data.findIndex(
      (folder: any) => folder.foldername === data.folder
    );
    if (folderIndex === -1) {
      acc[data.tripNumber].data.push({
        foldername: data.folder,
        data: [data.name],
      });
    } else {
      acc[data.tripNumber].data[folderIndex].data.push(data.name);
    }
    return acc;
  }, {});
  console.log(`Returning Data`);
  return res.status(200).send(Object.values(groupedData));
});

// using foldername and name, serve text from blbo, in json format
journalRouter.get("/returnText", async (req, res) => {
  const { foldername, name } = req.query;
  if (!foldername || !name) {
    return res.status(400).send("Please provide a folder name and name");
  }
  const blobName = foldername + "/" + name + ".txt";
  try {
    const content = await journalBucket.download(blobName);
    const text = content.toString();
    if (!text) {
      return res.status(204).send("Content is empty");
    }
    return res.status(200).send(text);
  } catch (error) {
    console.error(` Failed to retrieve text for ${blobName}:`);
    return res.status(500).send(` Failed to retrieve text for ${blobName}`);
  }
});
