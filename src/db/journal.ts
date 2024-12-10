

import TableLike from "./mytablelike";

export interface journalTypes {
  partitionKey: string;
  rowKey: string;
  folder: string;
  name: string;
  images: string;
}

export const journalTable = new TableLike<journalTypes>("journal");
