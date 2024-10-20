import { YodaheaTable } from "../db/masterdata";

async function pullImages() {
  const listFromMasterFinalTotal = await YodaheaTable.myGetData();

  const imageList = listFromMasterFinalTotal.map((item: any) => {
    return item.imagePath;
  });

  for(let imgs of imageList) {
     

    
  }

}
