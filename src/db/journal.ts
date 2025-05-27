

import TableLike from "./mytablelike";

export interface journalTypes {
  partitionKey: string;
  rowKey: string;
  folder: string;
  name: string;
  images: string;
  startDate: string;
  endDate: string;
  tripNumber: number; 
}

export const journalTable = new TableLike<journalTypes>("journal");
