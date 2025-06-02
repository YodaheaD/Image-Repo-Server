import TableLike from "./mytablelike";

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
 
export const imageMapTable = new TableLike<imageMapProps>("imagemap");