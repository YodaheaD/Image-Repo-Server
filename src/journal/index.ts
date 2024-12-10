import { Router } from "express";

import { journalTable } from "../db/journal";
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

/// ** POST /addname
// route for adding a new name to an existing folder
journalRouter.post("/addname", async (req, res) => {
  const { foldername, name } = req.query;
  if (!foldername || !name) {
    return res.status(400).send("Please provide a folder name and a name");
  }
  const data = {
    partitionKey: "journal",
    rowKey: foldername + "-" + name,
    folder: foldername,
    name: name,
    images: "",
  };
  const allData: any = await journalTable.straightQuery();
  console.log(` Adding name: ${name} to folder: ${foldername}`);
  const allrowkeys = allData.map((data: { rowKey: string }) => data.rowKey);

  const Rowkey = data.rowKey;
  if (allrowkeys.includes(Rowkey)) {
    console.log(`RowKey ${Rowkey} already exists, skipping insertion`);
    return res.status(400).send(`RowKey ${Rowkey} already exists`);
  } else {
    console.log("Inserting data");
    const content = Buffer.from("");
    const fullnameWIthFolder = foldername + "/" + name + ".txt";
    await journalBucket.uploadBuffer(fullnameWIthFolder, content); 
    await journalTable.insertEntity(data);
    return res.status(200).send("Data inserted");
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
  console.log(` Changing name from ${oldname} to ${newname}`);

  const findOld = alldata.find(
    (data: { rowKey: string }) => data.rowKey === foldername + "-" + oldname
  );

  if (!findOld) {
    return res.status(400).send("Old name not found");
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
  console.log(` Add images to name: ${name}`);

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
  if (!foldername || !name || !images) {
    res.status(400).send("Please provide a folder name, name and images");
  }
  const imagesPassed = images as string;
  const alldata: any = await journalTable.straightQuery();
  console.log(`Removing images from name: ${name}`);

  const findOld = alldata.find(
    (data: { rowKey: string }) => data.rowKey === foldername + "-" + name
  );

  if (!findOld) {
    res.status(400).send("Name not found");
  }
  console.log(` FOund old: ${findOld.images}`);
  const currentImages = findOld.images.split(",").map((img: any) => img.trim());
  const incomingDelImages = images
    ? imagesPassed.split(",").map((img) => img.trim())
    : [];

  if (!incomingDelImages) {
    return res.status(400).send("No images to delete");
  }

  console.log(
    ` Removing image: -- ${incomingDelImages} --  from current list -- ${currentImages} --`
  );

  const newarr = currentImages.filter(
    (img: string) => !incomingDelImages.includes(img)
  );

  //throw an error if no change in images
  if (newarr.length === currentImages.length) {
    return res.status(400).send("No images removed");
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
    return res.status(200).send(` Name deleted: ${name}`);
  } catch (err) {
    return res.status(400).send("Error in deleting name");
  }
}); 

// ** GET /returnList 
// return a list of all folders and names
journalRouter.get("/returnList", async (req, res) => {
  const alldata: any = await journalTable.straightQuery();
// we want to group each name by folder
const groupedData = alldata.reduce((acc: any, data: any) => {
    if (!acc[data.folder]) {
        acc[data.folder] = { foldername: data.folder, data: [] };
    }
    acc[data.folder].data.push(data.name);
    return acc;
}, {});
return res.status(200).send(Object.values(groupedData));

});


// using foldername and name, serve text from blbo, in json format
journalRouter.get("/returnText", async (req, res) => {
  const { foldername, name } = req.query;
  if (!foldername || !name) {
    return res.status(400).send("Please provide a folder name and name");
  }
  const blobName = foldername + "/" + name + ".txt";
  const content = await journalBucket.download(blobName);
  return res.status(200).send(content.toString());
});