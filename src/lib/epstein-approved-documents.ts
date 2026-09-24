import type { AronReviewItem } from './aron-review-queue';
// Verified against the original intake source markers and approved Google Docs.
export function restoreEpsteinApprovedDocument(item: AronReviewItem): AronReviewItem {
 if (!(item.website||'').includes('theepsteinlawfirm.com') || item.workflow !== 'blog') return item;
 const mappings = [
  ['10JMrZKl3qru9bdQbzevnuBgkFTvoeTX9E28IZPaqpi8','1cxCITfDTSekO2ECxdaNMjiByZEKtsJ9_cj_pameH5BY',17713],
  ['1llNO19yzipAyMVGJm3P8XR9YDrOYje7hj0XkvZlUJ8k','1Fa0QjWVRUAg6CA5iinM9IakjfqWJY8OUTV-N0sd2mZw',17714],
 ] as const;
 const found=mappings.find(([wrong])=>item.docUrl.includes(`/d/${wrong}/`));
 if(!found)return item;
 const [wrong,correct,postId]=found;
 const base='https://www.theepsteinlawfirm.com';
 return {...item,docUrl:item.docUrl.replace(wrong,correct),wordpressPageId:postId,wordpressStatus:'draft',wordpressUrl:`${base}/?p=${postId}`,wordpressEditUrl:`${base}/wp-admin/post.php?post=${postId}&action=edit`,wordpressPreviewUrl:`${base}/?p=${postId}&preview=true`,preparationRequired:true,wordpressIntakeOnly:true,pendingImageReviewId:undefined,featuredMediaId:undefined,featuredImageUrl:undefined};
}
