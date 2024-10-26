/**
 * Compression Table
 *
 * Description:
 *
 * This table will store the
 *
 * * Name of Image
 * * Time of Compression (String in Unix Time)
 * * Size of Image ( Pre-Compression )
 * * Location of Image in Compressed Folder
 */

import TableLike from "./mytablelike";

export interface Compression {
  partitionKey: string;
  rowKey: string;
  name: string;
  lastCompressed: string;
  sizeOfImage: number;
}

export const compressionTable = new TableLike<Compression>("compressiontable");
