// Photos she adds from the app (spec §2, "Adding clothes"): shrunk before uploading so
// they send quickly and take little space, and named by the time they were added.

const LONGEST_SIDE = 1600;
const JPEG_QUALITY = 0.85;

// The size to shrink a photo to: the longest side at most LONGEST_SIDE, the shape unchanged.
export function fitSize(width, height, longest = LONGEST_SIDE) {
  const scale = Math.min(1, longest / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// For example photo-2026-10-25-090507-2.jpg: the second photo added at 9:05:07.
export function photoFileName(date, n) {
  const pad = (v) => String(v).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `photo-${day}-${time}-${n}.jpg`;
}

// Browser only: the photo as a smaller JPEG, turned the right way up.
export async function shrinkPhoto(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = fitSize(bitmap.width, bitmap.height);
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) throw new Error('could not make a JPEG');
  return blob;
}
