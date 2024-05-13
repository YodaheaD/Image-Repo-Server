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
  dateTaken?: string;
  folder?: string;
}

export interface tagsMapProps {
  partitionKey: string;
  rowKey: string;
  filenames: string;
  tags: string;
}
export interface imageMapProps {
  partitionKey: string;
  rowKey: string;
  imageName: string;
  description: string;
  notes:string;
  tags: string;
  uploader: string;
  approvedBy: string;
  dateTaken?: string;
  folder?: string;
}

 export const masterTableFinal = new TableLike<masterMap2Props>("masterFinal");
export const tagsTable = new TableLike<tagsMapProps>("tagsdata");
//export const imageMapTable = new TableLike<imageMapProps>("imagemap");

