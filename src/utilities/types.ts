export type UploadProps = {
  date_Taken: string;
  description: string;
  tags: string;
  fileNames: string;
  uploaderName: string;
};

export type masterMapProps = {
  partitionKey: string;
  rowKey: string;
  date_Taken: string;
  imageName: string;
  identifier: string;
  description: string;
  uploader: string;
  approvedBy: string;
};
