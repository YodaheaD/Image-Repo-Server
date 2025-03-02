import TableLike from "./mytablelike";

export interface masterMapProps {
  partitionKey: string;
  rowKey: string;
  imageName: string;
  identifier: string;
  description: string;
}

export interface masterMap2Props {
  partitionKey: string;
  rowKey: string;
  imageName: string;
  description: string;
  tags: string;
  uploader: string;
  approvedBy: string;
  notes: string;
  dateTaken?: string;
  folder?: string;
  filetype: string;
  imagePath: string;
}


export interface imageMapProps {
  partitionKey: string;
  rowKey: string;
  imageName: string;
  description: string;
  notes: string;
  tags: string;
  uploader: string;
  approvedBy: string;
  dateTaken?: string;
  folder?: string;
} 
 
export const masterTableFinal = new TableLike<masterMap2Props>("masterFinal");
export const YodaheaTable = new TableLike<masterMap2Props>(
  "YodaheaTable"
); 
//export const imageM apTable = new TableLike<imageMapProps>("imagemap");
