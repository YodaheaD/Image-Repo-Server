import TableLike from "./mytablelike";

export interface auditsTypes {
  partitionKey: string;
  rowKey: string;
  auditTime: string;
  imageName: string;
  description: string;
  auditor: string;
  approvedBy: string;
  auditType: string;
  auditApprover: string;
  previousValue: string;
  newValue: string;
}

export const auditsTable = new TableLike<auditsTypes>("audits");
