import Logger from "../utils/logger";
import { imageMapTable } from "../db/myimagemap";
import { masterTableFinal } from "../db/masterdata";
import cliProgresss from "cli-progress";

export async function initilizeMapTable() {
  const mapData: any = await imageMapTable.manualGetData();

  Logger.info(`Initializing Image Map Table with ${mapData}...`);

  const masterDataList: any = await masterTableFinal.manualGetData();
  const progressBar = new cliProgresss.SingleBar(
    {},
    cliProgresss.Presets.shades_classic
  );
  progressBar.start(masterDataList.length, 0);
  // this function will run when the server starts up and will check if the data in the master table is in the image map table
  // if it is not in the image map table then it will add it to the image map table
  // this is to ensure that the data in the master table is in the image map table

  for (let i = 0; i < masterDataList.length; i++) {
    let found = false;
    // change partitionKey to "imageMap"
    masterDataList[i].partitionKey = "imageMap";
    for (let j = 0; j < mapData.length; j++) {
      if (masterDataList[i].imageName === mapData[j].imageName) {
        found = true;
      }
    }
    if (!found) {
      // add the data to the image map table
      await imageMapTable.insertEntity(masterDataList[i]);
    }
  }
}

initilizeMapTable();
