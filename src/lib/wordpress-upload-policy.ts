export function exhaustedImageReview(message: string) {
  return /safety-approved .*after three attempts/i.test(message);
}

export function uploadFailure(status: number, message: string, attempts: number) {
  const access = /Google Doc access|File not found|insufficient.*permission|reconnect|invalid_grant|not connected/i.test(message);
  const busy = /upload.*already.*running/i.test(message);
  const temporary = busy || status === 429 || status >= 500;
  return {
    blocked: /AMPLIFY Attorney Authority Standard failed:/i.test(message) || exhaustedImageReview(message) || access || !temporary || attempts >= 3,
    message: access
      ? "Google Doc access is required. Connect the Google account that owns this Doc, or grant AMPLIFY access using Reconnect for existing Docs, then retry. Approval is saved; no replacement content will be used."
      : message,
    delayMs: busy ? 60_000 : Math.min(15 * 60_000, 60_000 * 2 ** Math.max(0, attempts - 1)),
  };
}

export function sourceMarker(docId: string, workflow?: string) {
  const type = ["blog", "aop", "subaop"].includes(workflow || "") ? workflow : "geo";
  return `amplify-${type}-source:${docId}`;
}

export function sameApprovedDocument(record: {docUrl:string;aronDone:boolean;approvalStatus?:string}, docId:string) {
  return (record.aronDone || record.approvalStatus === "APPROVED")
    && record.docUrl.match(/\/document\/d\/([A-Za-z0-9_-]+)/)?.[1] === docId;
}
