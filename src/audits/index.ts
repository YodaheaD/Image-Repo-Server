import express from "express";

import { auditsTable, auditsTypes } from "../db/audits";
import { masterTableFinal, YodaheaTable } from "../db/masterdata";

export const auditRouter = express.Router();

import multer from "multer";
import Logger from "../utils/logger";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20000000,
  },
});
// for parsing auditRouterlication/json
auditRouter.use(express.json());

// for parsing auditRouterlication/x-www-form-urlencoded
auditRouter.use(express.urlencoded({ extended: true }));

// for parsing multipart/form-data
auditRouter.use(upload.single("data"));
auditRouter.use(express.static("public"));


auditRouter.post("/changeData/:tableName", async (req, res) => {
  const inputdata = JSON.parse(req.body.data);
  const olddata = JSON.parse(req.body.oldData);
  const { tableName } = req.params;

  if (!inputdata || !olddata) {
    // return a res wiht message
    return res.status(400).send("No data recieved in the request");
  }
  if (tableName && tableName === "Yodahea") {
    const getData = await YodaheaTable.mySearchData(inputdata.imageName);
    //console.log(` Received Data is ${JSON.stringify(getData)}`);
    if (!getData) {
      return res.status(404).send("Data not found");
    }
    // console.log(` Found Data to Update with ` + JSON.stringify(getData));
    const fullNew = {
      partitionKey: "masterFinal",
      rowKey: getData[0].rowKey,
      ...inputdata,
    };
    //console.log(` New Data is ${JSON.stringify(fullNew)}`);
    try {
      const outcome = await auditsTable.auditHandler(
        "Update",
        inputdata,
        olddata
      );
      // if (outcome === "Audit Created") {
      //   res.status(200).send(outcome);
      // }
      const outcomeRes = await YodaheaTable.updateEntity(fullNew);
      Logger.info(
        `Data Updated for table Yodahea with RowKey ${getData[0].rowKey}`
      );
      res.status(200).send("Data updated");
    } catch (error) {
      Logger.error(`Error updating the data ${error}`);
      res.status(400).send("Error making changes to the data");
    }
  } else {
    const getData = await masterTableFinal.mySearchData(inputdata.imageName);
    //console.log(` Received Data is ${JSON.stringify(getData)}`);
    if (!getData) {
      return res.status(404).send("Data not found");
    }
    // console.log(` Found Data to Update with ` + JSON.stringify(getData));
    const fullNew = {
      partitionKey: "masterFinal",
      rowKey: getData[0].rowKey,
      ...inputdata,
    };
    //console.log(` New Data is ${JSON.stringify(fullNew)}`);
    try {
      const outcome = await auditsTable.auditHandler(
        "Update",
        inputdata,
        olddata
      );
      // if (outcome === "Audit Created") {
      //   res.status(200).send(outcome);
      // }
      const outcomeRes = await masterTableFinal.updateEntity(fullNew);
      Logger.info(
        `Data Updated for table masterFinal with RowKey ${getData[0].rowKey}`
      );
      res.status(200).send("Data updated");
    } catch (error) {
      Logger.error(`Error updating the data ${error}`);
      res.status(400).send("Error making changes to the data");
    }
  }
});

auditRouter.post("/changeDataNew/:tableName", async (req, res) => {
  const { data } = req.body;

  const { tableName } = req.params;

  if (!data) {
    // return a res wiht message
    return res.status(400).send("No data recieved in the request");
  }

  if (tableName === "Yodahea") {
    {
      // find entry
      const getData = await YodaheaTable.mySearchData(data.imageName);
      if (!getData) {
        return res.status(404).send("Data not found");
      }
      /**
       * Data for Audit is {"partitionKey":"masterFinal","rowKey":"RKey-C47F8201-681A-467B-A2B9-78227F43A0F7","field":"description","value":"yooo"}
       */
      Logger.info(`Data found for update with RowKey ${getData[0].rowKey}`);
      // change the value
      const field = data.field;
      const value = data.newvalue;
      const oldData = getData[0][field];
      getData[0][field] = value;
      // update the entry
      try {
        Logger.info(`For field ${field} changing from ${oldData} to ${value}`);
        //console.log(getData[0]);
        const outcome = await YodaheaTable.updateEntity(getData[0]);
        if (!outcome) {
          Logger.warn(`Error updating the data...`);
          return res.status(400).send("Error making changes to the data");
        }
        Logger.info(`Data Updated !`);
      } catch (error) {
        Logger.error(`Error updating the data ${error}`);
        res.status(400).send("Error making changes to the data");
      }
    }
  } else {
    // find entry
    const getData = await masterTableFinal.mySearchData(data.imageName);
    if (!getData) {
      return res.status(404).send("Data not found");
    }
    /**
     * Data for Audit is {"partitionKey":"masterFinal","rowKey":"RKey-C47F8201-681A-467B-A2B9-78227F43A0F7","field":"description","value":"yooo"}
     */
    Logger.info(`Data found for update with RowKey ${getData[0].rowKey}`);
    // change the value
    const field = data.field;
    const value = data.newvalue;
    const oldData = getData[0][field];
    getData[0][field] = value;
    // update the entry
    try {
      Logger.info(`For field ${field} changing from ${oldData} to ${value}`);
      console.log(getData[0]);
      const outcome = await masterTableFinal.updateEntity(getData[0]);
    } catch (error) {
      Logger.error(`Error updating the data ${error}`);
      res.status(400).send("Error making changes to the data");
    }
  }
  res.send("Data updated");
});
auditRouter.post("/changeDataMultiple/:tableName/:field", async (req, res) => {
  const { tableName } = req.params;
  const { field } = req.params;
  const data = req.body;
  if (!data) {
    // return a res wiht message
    return res.status(400).send("No data recieved in the request");
  }

  if (tableName === "Yodahea") {
    console.log(
      ` Data for Yodahea Change is ${JSON.stringify(data)} with field ${field}`
    );
    const etnries = data.imageNames;
    for (let entry of etnries) {
      const imageP = await YodaheaTable.mySearchData(entry);
      const image = imageP[0];
      if (!image) {
        return res.status(404).send("Data not found");
      }
      if (field === "tags") {
        const newTagsInitial = image.tags;
        const newTags = newTagsInitial
          ? newTagsInitial + "," + data.newValue
          : data.newValue;

        const newEntity = {
          ...image,
          [field]: newTags,
        };
        Logger.info(`Data found for update with RowKey ${newEntity.rowKey} `);
        try {
          const outcome = await YodaheaTable.updateEntity(newEntity);
          Logger.info(
            `Data Updated in Master for image ${entry} with field ${field}: ${data.newValue}`
          );
        } catch (error) {
          res.status(400).send("Error making changes to the data");
        }
      } else if (field === "dateTaken") {
        const newValue = data.newValue;
        const newEntity = {
          ...image,
          [field]: String(newValue),
        };
        Logger.info(`Data found for update with RowKey ${newEntity.rowKey} `);
        try { 
          const outcome = await YodaheaTable.updateEntity(newEntity);
          Logger.info(
            `Data Updated in Master for image ${entry} with field ${field}: ${newValue}`
          );
        } catch (error) {
          res.status(400).send("Error making changes to the data");
        }
      }
    }
    ///////////////////////////////////////////////
  } else {
    const etnries = data.imageNames;
    for (let entry of etnries) {
      const imageP = await masterTableFinal.mySearchData(entry);
      const image = imageP[0];
      if (!image) {
        return res.status(404).send("Data not found");
      }
      // get current tags and  add new tags
      if (field === "tags") {
        const newTagsInitial = image.tags;
        const newTags = newTagsInitial
          ? newTagsInitial + "," + data.newValue
          : data.newValue;

        const newEntity = {
          ...image,
          [field]: newTags,
        };
        Logger.info(`Data found for update with RowKey ${newEntity.rowKey} `);
        try {
          const outcome = await masterTableFinal.updateEntity(newEntity);
          Logger.info(
            `Data Updated in Master for image ${entry} with field ${field}: ${data.newValue}`
          );
        } catch (error) {
          res.status(400).send("Error making changes to the data");
        }
      } else if (field === "dateTaken") {
        const newValue = data.newValue;
        const newEntity = {
          ...image,
          [field]: String(newValue),
        };
        Logger.info(`Data found for update with RowKey ${newEntity.rowKey} `);
        try {
          const outcome = await masterTableFinal.updateEntity(newEntity);
          Logger.info(
            `Data Updated in Master for image ${entry} with field ${field}: ${newValue}`
          );
        } catch (error) {
          res.status(400).send("Error making changes to the data");
        }
      }
    }
  }
  res.send("Data updated");
});



auditRouter.post("/rename/:oldName/:newName", async (req, res) => {
  const { oldName, newName } = req.params;
  const data = req.body;
  console.log(` Old Name is ${oldName} and New Name is ${newName}`);
  try {
    await masterTableFinal.renameImage(oldName, newName);
  } catch (error) {
    res.status(400).send("Error renaming the data");
  }
  res.send("Data updated");
});

auditRouter.delete("/delete/:imageName", async (req, res) => {
  const { imageName } = req.params;
  const data = req.body;
  if (!data || !imageName) {
    return res.status(400).send("No data recieved in the request");
  }
  try {
    const data2 = await masterTableFinal.fullDeleteProcess(data);
  } catch (error) {
    res.status(400).send("Error deleting the data");
  }

  try {
    const outcome = await auditsTable.auditHandler("Delete", data);
    console.log(` Data for Audit is ${JSON.stringify(data)}`);
  } catch (error) {
    res.status(400).send("Error making changes to the data");
  }

  res.send("Data deleted");
});
