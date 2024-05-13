import express from "express";

import { auditsTable, auditsTypes } from "../db/audits";
import { masterTableFinal } from "../db/masterdata";

export const auditRouter = express.Router();

import multer from "multer";
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

auditRouter.post("/changeData", async (req, res) => {
  try {
    const inputdata = JSON.parse(req.body.data);
    const olddata = JSON.parse(req.body.oldData);

    if (!inputdata || !olddata) {
      // return a res wiht message
      return res.status(400).send("No data recieved in the request");
    }
    /**
     *  {"imageName":"TigerAndOllie.jpg",
     * "description":"Tiger around the home","tags":"cat,tiger,pet","uploader":"yodaheadaniel@live.com",
     * "approvedBy":"Unapproved1"}
     *
     */
    const fullNew = {
      partitionKey: "masterFinal",
      rowKey: "RKey-" + inputdata.imageName,
      ...inputdata,
    };
    try {
      const outcome = await auditsTable.auditHandler(
        "Update",
        inputdata,
        olddata
      );
      if (outcome === "Audit Created") {
        res.status(200).send(outcome);
      }
    } catch (error) {
      res.status(400).send("Error making changes to the data");
    }

    try {
      const outcomeRes = await masterTableFinal.updateEntity(fullNew);
    } catch (error) {
      res.status(400).send("Error making changes to the data");
    }
  } catch (error) {
    res.status(404).send("Error in the request body");
  }
});

auditRouter.delete("/delete/:imageName", async (req, res) => {
  const { imageName } = req.params;
  const data = req.body;
  if (!data || !imageName) {
    return res.status(400).send("No data recieved in the request");
  }
  try {
    const data2 = await masterTableFinal.myDeleteData(data);
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
