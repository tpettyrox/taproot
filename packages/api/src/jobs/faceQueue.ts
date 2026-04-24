import PQueue from 'p-queue';
import { processFaceDetection } from '../services/faceService';

// Concurrency 1: CompreFace handles one recognition request at a time well;
// serializing avoids overwhelming it during bulk uploads.
export const faceQueue = new PQueue({ concurrency: 1 });

export function enqueueFaceDetection(mediaId: string): void {
  faceQueue
    .add(() => processFaceDetection(mediaId))
    .catch((err) => console.error(`Face detection failed for media ${mediaId}:`, err));
}
